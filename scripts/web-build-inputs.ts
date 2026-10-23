import lockPayload from "../posthog.lock.json";
import { webCandidateTag, webOverlayProvenance } from "./lib/web-overlay";
import type { PosthogLock } from "./lib/upstream";

const lock = lockPayload as PosthogLock;
const provenance = webOverlayProvenance(lock);
console.log(`web_base_image=${provenance.baseImage}`);
console.log(`web_base_revision=${provenance.baseRevision}`);
console.log(`web_overlay_sha256=${provenance.fingerprintSha256}`);
console.log(`web_tag=${webCandidateTag(lock)}`);
