import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import type { CandidateRelease, PosthogLock } from "./upstream";

export const webOverlayFiles = ["Dockerfile", "aws-config", "apply-object-storage-overlay.cjs"] as const;

function fileSha256(name: (typeof webOverlayFiles)[number]): string {
  return createHash("sha256")
    .update(readFileSync(new URL(`../../images/web/${name}`, import.meta.url)))
    .digest("hex");
}

export function webOverlayProvenance(lock: PosthogLock): CandidateRelease["webOverlay"] {
  const baseImage = lock.officialImages.main.image;
  const baseRevision = lock.officialImages.main.revision;
  const files = webOverlayFiles.map((name) => [name, fileSha256(name)]);
  return {
    baseImage,
    baseRevision,
    fingerprintSha256: createHash("sha256")
      .update(JSON.stringify({ baseImage, baseRevision, files }))
      .digest("hex"),
  };
}

export function webCandidateTag(lock: PosthogLock): string {
  return `sha-${lock.upstreamCommit.slice(0, 12)}-overlay-${webOverlayProvenance(lock).fingerprintSha256.slice(0, 16)}`;
}

export function assertWebOverlayCandidate(candidate: CandidateRelease, lock: PosthogLock): void {
  const expected = webOverlayProvenance(lock);
  const image = candidate.images.web ?? "";
  const imagePrefix = "ghcr.io/uptomic/posthog-railway/web@";
  if (
    !image.startsWith(imagePrefix) ||
    !/^sha256:[0-9a-f]{64}$/.test(image.slice(imagePrefix.length)) ||
    candidate.webOverlay?.baseImage !== expected.baseImage ||
    candidate.webOverlay?.baseRevision !== expected.baseRevision ||
    candidate.webOverlay?.fingerprintSha256 !== expected.fingerprintSha256
  ) {
    throw new Error("Built Web overlay does not match the locked main image and current overlay files");
  }
}
