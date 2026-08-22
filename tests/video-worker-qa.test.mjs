import assert from "node:assert/strict";

const { validateExport } = await import("../services/video-worker/src/qa.mjs");

const expected = { width: 1080, height: 1920, expectedDurationSeconds: 20 };
assert.deepEqual(
  validateExport({ width: 1080, height: 1920, durationSeconds: 20.5, hasVideo: true }, expected),
  { passed: true, findings: [] },
);
const failed = validateExport(
  { width: 1920, height: 1080, durationSeconds: 21, hasVideo: false },
  expected,
);
assert.equal(failed.passed, false);
assert.deepEqual(
  failed.findings.map((finding) => finding.code),
  ["video_profile_mismatch", "duration_mismatch"],
);

console.log("Video worker QA tests passed.");
