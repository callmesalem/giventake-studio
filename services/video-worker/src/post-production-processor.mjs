import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

import { createAssemblyPlan, exportProfiles, writeAssemblyArtifacts } from "./post-production.mjs";
import { validateExport } from "./qa.mjs";

function pathSegment(value) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function checksum(outputPath) {
  if (!existsSync(outputPath)) return null;
  return createHash("sha256").update(readFileSync(outputPath)).digest("hex");
}

export function createPostProductionProcessor({
  repository,
  outputDirectory,
  ffmpeg,
  downloader,
  now = () => new Date(),
  leaseMs,
}) {
  return {
    async runOnce(workerId) {
      const current = now();
      const claimed = repository.claimAssembly(workerId, current, leaseMs);
      if (!claimed) return null;

      try {
        const inputPaths = await Promise.all(
          claimed.job.storyboard.map(async (scene) => {
            const assetUrl = claimed.runtime.sceneRequests?.[scene.order]?.result?.assetUrl;
            if (!assetUrl) throw new Error("raw_scene_asset_missing");
            return downloader(assetUrl, scene, claimed.job);
          }),
        );
        const jobDirectory = join(
          outputDirectory,
          pathSegment(claimed.tenantId),
          pathSegment(claimed.id),
        );

        for (const profile of Object.keys(exportProfiles)) {
          const outputPath = join(jobDirectory, `${profile}.mp4`);
          const plan = writeAssemblyArtifacts(
            createAssemblyPlan(claimed.job, profile, inputPaths, outputPath),
          );
          await ffmpeg.run(plan);
          const qa = validateExport(await ffmpeg.probe(outputPath), plan);
          if (!qa.passed) {
            repository.recordAttempt(
              claimed.id,
              "qa_failed",
              qa.findings.map((finding) => finding.code).join(","),
              false,
              current,
            );
            return repository.markQaFailed(claimed.id, "technical_qa_failed", current);
          }
          repository.addExport({
            id: randomUUID(),
            jobId: claimed.id,
            profile,
            width: plan.width,
            height: plan.height,
            outputPath,
            expectedDurationSeconds: plan.expectedDurationSeconds,
            checksum: checksum(outputPath),
            createdAt: current.toISOString(),
          });
        }

        repository.recordAttempt(claimed.id, "qa_passed", null, false, current);
        return repository.complete(claimed.id, current);
      } catch (error) {
        const category =
          error instanceof Error && error.message === "raw_scene_asset_missing"
            ? "raw_scene_asset_missing"
            : "post_production_failed";
        repository.recordAttempt(claimed.id, category, null, false, current);
        return repository.fail(claimed.id, category, current);
      }
    },
  };
}
