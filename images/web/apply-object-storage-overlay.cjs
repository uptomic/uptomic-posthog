"use strict";

const { createHash } = require("node:crypto");
const { readFileSync, writeFileSync } = require("node:fs");
const { join } = require("node:path");

const [sourcePath = "/code/posthog/storage/object_storage.py"] = process.argv.slice(2);
const baseImage = process.env.WEB_BASE_IMAGE;
const baseRevision = process.env.WEB_BASE_REVISION;
const expectedFingerprint = process.env.WEB_OVERLAY_SHA256;
const overlayDirectory = __dirname;
const overlayFiles = ["Dockerfile", "aws-config", "apply-object-storage-overlay.cjs"];
const source = readFileSync(sourcePath, "utf8");
const config = readFileSync(join(overlayDirectory, "aws-config"), "utf8");
const commit = readFileSync("/code/commit.txt", "utf8").trim();

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

const baseImagePrefix = "ghcr.io/posthog/posthog@";
if (!baseImage?.startsWith(baseImagePrefix) ||
    !/^sha256:[0-9a-f]{64}$/.test(baseImage.slice(baseImagePrefix.length)) ||
    !/^[0-9a-f]{40}$/.test(baseRevision ?? "") ||
    commit !== baseRevision) {
  throw new Error("WEB_BASE_PROVENANCE_MISMATCH");
}

const expectedConfig = "[default]\nregion = auto\ns3 =\n    addressing_style = virtual\n";
if (config !== expectedConfig) {
  throw new Error("WEB_AWS_CONFIG_DRIFT");
}

const sourceAnchor = '        s3_config = Config(\n            signature_version="s3v4",';
if (source.split(sourceAnchor).length - 1 !== 1 ||
    source.includes('s3={"addressing_style": "virtual"}')) {
  throw new Error("WEB_OBJECT_STORAGE_SOURCE_DRIFT");
}

const fingerprint = sha256(JSON.stringify({
  baseImage,
  baseRevision,
  files: overlayFiles.map((file) => [file, sha256(readFileSync(join(overlayDirectory, file)))]),
}));
if (!/^[0-9a-f]{64}$/.test(expectedFingerprint ?? "") || fingerprint !== expectedFingerprint) {
  throw new Error("WEB_OVERLAY_FINGERPRINT_MISMATCH");
}

writeFileSync(
  "/code/web-overlay-provenance.json",
  JSON.stringify({
    baseImage,
    baseRevision,
    fingerprintSha256: fingerprint,
    awsConfigPath: "/opt/uptomic-web-overlay/aws-config",
    awsConfigSha256: sha256(config),
  }) + "\n",
);
