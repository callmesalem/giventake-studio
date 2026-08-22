function reservationFor(job, rates) {
  const rate = rates[job.provider]?.[job.model];
  if (rate === undefined || !Number.isFinite(rate) || rate < 0)
    throw new Error("provider_pricing_unavailable");
  if (job.provider !== "fixture" && rate <= 0) throw new Error("provider_pricing_unavailable");
  return job.storyboard.reduce((total, scene) => total + scene.durationSeconds * rate, 0);
}

function retryOrFail(repository, job, runtime, category, now) {
  const failures = repository
    .getAttempts(job.id)
    .filter((attempt) => attempt.category === category).length;
  if (failures < 3) {
    repository.setRuntime(job.id, runtime, now);
    return repository.setStatus(job.id, "queued", now);
  }
  return repository.fail(job.id, category, now);
}

export function createScheduler({ repository, providers, rates, now = () => new Date(), leaseMs }) {
  return {
    async runOnce(workerId) {
      const current = now();
      const claimed = repository.claimNext(workerId, current, leaseMs);
      if (!claimed) return null;

      const job = claimed.job;
      const provider = providers[job.provider];
      if (!provider) {
        repository.recordAttempt(job.id, "provider_unavailable", null, false, current);
        return repository.fail(job.id, "provider_unavailable", current);
      }

      let runtime = { sceneRequests: {}, ...claimed.runtime };
      if (runtime.reservedCostCents === undefined) {
        let reservation;
        try {
          reservation = reservationFor(job, rates);
        } catch {
          repository.recordAttempt(job.id, "provider_pricing_unavailable", null, false, current);
          return repository.fail(job.id, "provider_pricing_unavailable", current);
        }
        if (reservation > job.budgetCents) {
          repository.recordAttempt(job.id, "budget_exceeded", null, false, current);
          return repository.fail(job.id, "budget_exceeded", current);
        }
        runtime = { ...runtime, reservedCostCents: reservation };
        repository.setRuntime(job.id, runtime, current);
      }

      for (const scene of job.storyboard) {
        const previous = runtime.sceneRequests[scene.order];
        if (previous?.result) continue;

        let sceneState = previous ?? {};
        if (!sceneState.providerRequestId) {
          try {
            sceneState = {
              providerRequestId: await provider.submit({
                campaignId: job.campaignId,
                tenantId: job.tenantId,
                scene,
              }),
            };
            runtime = {
              ...runtime,
              sceneRequests: { ...runtime.sceneRequests, [scene.order]: sceneState },
            };
            repository.setRuntime(job.id, runtime, current);
            repository.recordAttempt(
              job.id,
              "provider_submitted",
              `scene:${scene.order}`,
              false,
              current,
            );
          } catch {
            repository.recordAttempt(job.id, "provider_submit_failed", null, true, current);
            return retryOrFail(repository, job, runtime, "provider_submit_failed", current);
          }
        }

        let polled;
        try {
          polled = await provider.poll(sceneState.providerRequestId);
        } catch {
          repository.recordAttempt(job.id, "provider_poll_failed", null, true, current);
          runtime = {
            ...runtime,
            sceneRequests: { ...runtime.sceneRequests, [scene.order]: {} },
          };
          return retryOrFail(repository, job, runtime, "provider_poll_failed", current);
        }

        if (polled.state === "pending") {
          return repository.setStatus(job.id, "waiting_for_provider", current, {
            availableAt: new Date(current.getTime() + polled.retryAfterMs).toISOString(),
          });
        }
        if (polled.state === "cancelled") {
          repository.recordAttempt(
            job.id,
            "provider_cancelled",
            `scene:${scene.order}`,
            false,
            current,
          );
          return repository.setStatus(job.id, "cancelled", current);
        }
        if (polled.state === "failed") {
          repository.recordAttempt(
            job.id,
            polled.category,
            `scene:${scene.order}`,
            polled.retryable,
            current,
          );
          runtime = {
            ...runtime,
            sceneRequests: { ...runtime.sceneRequests, [scene.order]: {} },
          };
          if (polled.retryable)
            return retryOrFail(repository, job, runtime, polled.category, current);
          return repository.fail(job.id, polled.category, current);
        }

        runtime = {
          ...runtime,
          sceneRequests: {
            ...runtime.sceneRequests,
            [scene.order]: { ...sceneState, result: polled.result },
          },
        };
        repository.setRuntime(job.id, runtime, current);
      }

      repository.recordAttempt(job.id, "provider_completed", null, false, current);
      return repository.setStatus(job.id, "assembling", current);
    },
  };
}
