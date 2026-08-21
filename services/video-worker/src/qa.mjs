export function validateExport(probe, expected) {
  const findings = [];
  if (!probe.hasVideo || probe.width !== expected.width || probe.height !== expected.height) {
    findings.push({ code: "video_profile_mismatch", severity: "error" });
  }
  if (Math.abs(probe.durationSeconds - expected.expectedDurationSeconds) > 0.75) {
    findings.push({ code: "duration_mismatch", severity: "error" });
  }
  return { passed: findings.length === 0, findings };
}
