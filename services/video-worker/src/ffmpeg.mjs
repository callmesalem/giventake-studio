import { spawn as defaultSpawn } from "node:child_process";

function runProcess(spawn, command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout?.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr?.on("data", (chunk) => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("close", (code) => {
      if (code === 0) return resolve(stdout);
      return reject(new Error(`${command} exited with code ${code}: ${stderr.slice(0, 500)}`));
    });
  });
}

export function createFfmpegRunner({
  ffmpegPath = "ffmpeg",
  ffprobePath = "ffprobe",
  spawn = defaultSpawn,
} = {}) {
  return {
    async run(plan) {
      await runProcess(spawn, ffmpegPath, plan.args);
      return { outputPath: plan.outputPath };
    },
    async probe(outputPath) {
      const stdout = await runProcess(spawn, ffprobePath, [
        "-v",
        "error",
        "-select_streams",
        "v:0",
        "-show_entries",
        "stream=width,height",
        "-show_entries",
        "format=duration",
        "-of",
        "json",
        outputPath,
      ]);
      const parsed = JSON.parse(stdout);
      const stream = parsed.streams?.[0];
      return {
        width: Number(stream?.width ?? 0),
        height: Number(stream?.height ?? 0),
        durationSeconds: Number(parsed.format?.duration ?? 0),
        hasVideo: Boolean(stream),
      };
    },
  };
}
