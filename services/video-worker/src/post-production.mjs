import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const exportProfiles = {
  vertical: { width: 1080, height: 1920 },
  square: { width: 1080, height: 1080 },
  landscape: { width: 1920, height: 1080 },
};

function srtTimestamp(seconds) {
  const totalMilliseconds = Math.round(seconds * 1000);
  const hours = Math.floor(totalMilliseconds / 3_600_000);
  const minutes = Math.floor((totalMilliseconds % 3_600_000) / 60_000);
  const wholeSeconds = Math.floor((totalMilliseconds % 60_000) / 1000);
  const milliseconds = totalMilliseconds % 1000;
  return [hours, minutes, wholeSeconds]
    .map((part) => String(part).padStart(2, "0"))
    .join(":")
    .concat(`,${String(milliseconds).padStart(3, "0")}`);
}

function escapeConcatPath(value) {
  return value.replace(/'/g, "'\\''");
}

function escapeDrawText(value) {
  return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'").replace(/:/g, "\\:");
}

function escapeFilterPath(value) {
  return value.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}

function buildCaptions(storyboard) {
  let cursor = 0;
  return storyboard
    .map((scene, index) => {
      const start = cursor;
      cursor += scene.durationSeconds;
      return `${index + 1}\n${srtTimestamp(start)} --> ${srtTimestamp(cursor)}\n${scene.narration.trim()}\n`;
    })
    .join("\n");
}

export function createAssemblyPlan(job, profileName, inputPaths, outputPath) {
  const profile = exportProfiles[profileName];
  if (!profile) throw new Error(`Unknown export profile: ${profileName}.`);
  if (inputPaths.length !== job.storyboard.length)
    throw new Error("Post-production requires one clip for every storyboard scene.");

  const expectedDurationSeconds = job.storyboard.reduce(
    (total, scene) => total + scene.durationSeconds,
    0,
  );
  const concatPath = `${outputPath}.concat.txt`;
  const captionsPath = `${outputPath}.srt`;
  const safeBrand = escapeDrawText(job.brand.name);
  const safeWebsite = escapeDrawText(job.brand.website);
  const safeCallToAction = escapeDrawText(job.brand.callToAction);
  const safeCaptionPath = escapeFilterPath(captionsPath);
  const panelHeight = Math.round(profile.height * 0.22);
  const filterGraph = [
    `[0:v]scale=${profile.width}:${profile.height}:force_original_aspect_ratio=increase`,
    `crop=${profile.width}:${profile.height}`,
    `subtitles='${safeCaptionPath}'`,
    `drawbox=x=0:y=${profile.height - panelHeight}:w=${profile.width}:h=${panelHeight}:color=black@0.72:t=fill`,
    `drawtext=fontcolor=white:fontsize=${Math.round(profile.height * 0.032)}:x=${Math.round(profile.width * 0.06)}:y=${Math.round(profile.height * 0.81)}:text='${safeBrand}'`,
    `drawtext=fontcolor=white:fontsize=${Math.round(profile.height * 0.025)}:x=${Math.round(profile.width * 0.06)}:y=${Math.round(profile.height * 0.855)}:text='${safeWebsite}'`,
    `drawtext=fontcolor=white:fontsize=${Math.round(profile.height * 0.03)}:x=${Math.round(profile.width * 0.06)}:y=${Math.round(profile.height * 0.905)}:text='${safeCallToAction}'[video]`,
  ].join(",");

  return {
    profile: profileName,
    width: profile.width,
    height: profile.height,
    expectedDurationSeconds,
    outputPath,
    concatPath,
    captionsPath,
    concatContent: inputPaths
      .map((path) => `file '${escapeConcatPath(path)}'`)
      .join("\n")
      .concat("\n"),
    captionsContent: buildCaptions(job.storyboard),
    filterGraph,
    args: [
      "-y",
      "-f",
      "concat",
      "-safe",
      "0",
      "-i",
      concatPath,
      "-filter_complex",
      filterGraph,
      "-map",
      "[video]",
      "-map",
      "0:a?",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      "-movflags",
      "+faststart",
      outputPath,
    ],
  };
}

export function writeAssemblyArtifacts(plan) {
  mkdirSync(dirname(plan.concatPath), { recursive: true });
  writeFileSync(plan.concatPath, plan.concatContent, "utf8");
  writeFileSync(plan.captionsPath, plan.captionsContent, "utf8");
  return plan;
}
