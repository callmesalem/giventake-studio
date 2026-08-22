import { spawn as defaultSpawn } from "node:child_process";
import { existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";

function run(spawn, command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: "ignore" });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) return resolve();
      return reject(new Error(`${command} exited with code ${code}.`));
    });
  });
}

function pathSegment(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export function createFixtureDownloader({
  outputDirectory,
  ffmpegPath = "ffmpeg",
  spawn = defaultSpawn,
}) {
  return async (assetUrl, scene, job) => {
    if (!assetUrl.startsWith("fixture://")) throw new Error("unsupported_asset_url");
    const directory = join(outputDirectory, "raw", pathSegment(job.id));
    const outputPath = join(directory, `scene-${scene.order}.mp4`);
    if (existsSync(outputPath)) return outputPath;
    mkdirSync(directory, { recursive: true });
    await run(spawn, ffmpegPath, [
      "-y",
      "-f",
      "lavfi",
      "-i",
      `color=c=0x112548:s=1280x720:d=${scene.durationSeconds}`,
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=48000:cl=stereo",
      "-shortest",
      "-c:v",
      "libx264",
      "-c:a",
      "aac",
      outputPath,
    ]);
    return outputPath;
  };
}
