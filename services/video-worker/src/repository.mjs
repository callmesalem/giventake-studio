import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

function timestamp(now) {
  return now.toISOString();
}

function hydrate(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    job: JSON.parse(row.payload),
    runtime: JSON.parse(row.runtime ?? "{}"),
    status: row.status,
    availableAt: row.available_at,
    leaseOwner: row.lease_owner,
    leaseUntil: row.lease_until,
    errorCategory: row.error_category,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function createWorkerRepository({ databasePath }) {
  mkdirSync(dirname(databasePath), { recursive: true });
  const database = new DatabaseSync(databasePath);
  database.exec(`
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      runtime TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL,
      available_at TEXT NOT NULL,
      lease_owner TEXT,
      lease_until TEXT,
      error_category TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS requests (
      request_id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      job_id TEXT NOT NULL,
      category TEXT NOT NULL,
      detail TEXT,
      retryable INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );
    CREATE TABLE IF NOT EXISTS exports (
      id TEXT PRIMARY KEY,
      job_id TEXT NOT NULL,
      profile TEXT NOT NULL,
      width INTEGER NOT NULL,
      height INTEGER NOT NULL,
      output_path TEXT NOT NULL,
      expected_duration_seconds INTEGER NOT NULL,
      checksum TEXT,
      created_at TEXT NOT NULL
    );
  `);

  const columns = database.prepare("PRAGMA table_info(jobs)").all();
  if (!columns.some((column) => column.name === "runtime")) {
    database.exec("ALTER TABLE jobs ADD COLUMN runtime TEXT NOT NULL DEFAULT '{}'");
  }

  const getStatement = database.prepare("SELECT * FROM jobs WHERE id = ?");
  const attemptsStatement = database.prepare(
    "SELECT category, detail, retryable, created_at FROM attempts WHERE job_id = ? ORDER BY id",
  );

  function get(id) {
    return hydrate(getStatement.get(id));
  }

  function updateStatus(id, status, now, options = {}) {
    database
      .prepare(
        `UPDATE jobs
         SET status = ?, available_at = ?, lease_owner = ?, lease_until = ?, error_category = ?, updated_at = ?
         WHERE id = ?`,
      )
      .run(
        status,
        options.availableAt ?? timestamp(now),
        options.leaseOwner ?? null,
        options.leaseUntil ?? null,
        options.errorCategory ?? null,
        timestamp(now),
        id,
      );
    return get(id);
  }

  return {
    enqueue(job, requestId, now) {
      if (this.hasRequest(requestId)) throw new Error("Worker request has already been processed.");
      const createdAt = timestamp(now);
      database
        .prepare(
          `INSERT INTO jobs (id, tenant_id, payload, status, available_at, created_at, updated_at)
           VALUES (?, ?, ?, 'queued', ?, ?, ?)`,
        )
        .run(job.id, job.tenantId, JSON.stringify(job), createdAt, createdAt, createdAt);
      database
        .prepare("INSERT INTO requests (request_id, job_id, created_at) VALUES (?, ?, ?)")
        .run(requestId, job.id, createdAt);
      return get(job.id);
    },
    hasRequest(requestId) {
      return Boolean(
        database.prepare("SELECT 1 FROM requests WHERE request_id = ?").get(requestId),
      );
    },
    get,
    getAttempts(id) {
      return attemptsStatement.all(id).map((attempt) => ({
        category: attempt.category,
        detail: attempt.detail,
        retryable: Boolean(attempt.retryable),
        createdAt: attempt.created_at,
      }));
    },
    claimNext(workerId, now, leaseMs) {
      const current = timestamp(now);
      database
        .prepare(
          `UPDATE jobs
           SET status = 'queued', lease_owner = NULL, lease_until = NULL, available_at = ?, updated_at = ?
           WHERE status IN ('leased', 'submitting', 'assembling') AND lease_until IS NOT NULL AND lease_until <= ?`,
        )
        .run(current, current, current);
      const next = database
        .prepare(
          `SELECT * FROM jobs
           WHERE status IN ('queued', 'waiting_for_provider') AND available_at <= ?
           ORDER BY available_at, created_at
           LIMIT 1`,
        )
        .get(current);
      if (!next) return null;
      const leaseUntil = new Date(now.getTime() + leaseMs).toISOString();
      database
        .prepare(
          `UPDATE jobs
           SET status = 'leased', lease_owner = ?, lease_until = ?, updated_at = ?
           WHERE id = ?`,
        )
        .run(workerId, leaseUntil, current, next.id);
      return get(next.id);
    },
    claimAssembly(workerId, now, leaseMs) {
      const current = timestamp(now);
      const next = database
        .prepare(
          `SELECT * FROM jobs
           WHERE status = 'assembling' AND (lease_until IS NULL OR lease_until <= ?)
           ORDER BY updated_at, created_at
           LIMIT 1`,
        )
        .get(current);
      if (!next) return null;
      const leaseUntil = new Date(now.getTime() + leaseMs).toISOString();
      database
        .prepare("UPDATE jobs SET lease_owner = ?, lease_until = ?, updated_at = ? WHERE id = ?")
        .run(workerId, leaseUntil, current, next.id);
      return get(next.id);
    },
    recordAttempt(id, category, detail, retryable, now) {
      database
        .prepare(
          "INSERT INTO attempts (job_id, category, detail, retryable, created_at) VALUES (?, ?, ?, ?, ?)",
        )
        .run(id, category, detail ?? null, retryable ? 1 : 0, timestamp(now));
      return this.getAttempts(id).at(-1);
    },
    setStatus(id, status, now, options) {
      return updateStatus(id, status, now, options);
    },
    setRuntime(id, runtime, now) {
      database
        .prepare("UPDATE jobs SET runtime = ?, updated_at = ? WHERE id = ?")
        .run(JSON.stringify(runtime), timestamp(now), id);
      return get(id);
    },
    complete(id, now) {
      return updateStatus(id, "completed", now);
    },
    fail(id, category, now) {
      return updateStatus(id, "failed", now, { errorCategory: category });
    },
    markQaFailed(id, category, now) {
      return updateStatus(id, "qa_failed", now, { errorCategory: category });
    },
    addExport(item) {
      database
        .prepare(
          `INSERT INTO exports
           (id, job_id, profile, width, height, output_path, expected_duration_seconds, checksum, created_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          item.id,
          item.jobId,
          item.profile,
          item.width,
          item.height,
          item.outputPath,
          item.expectedDurationSeconds,
          item.checksum ?? null,
          item.createdAt,
        );
      return item;
    },
    getExports(jobId) {
      return database
        .prepare(
          `SELECT id, profile, width, height, output_path, expected_duration_seconds, checksum, created_at
           FROM exports WHERE job_id = ?
           ORDER BY CASE profile WHEN 'vertical' THEN 1 WHEN 'square' THEN 2 WHEN 'landscape' THEN 3 END`,
        )
        .all(jobId)
        .map((item) => ({
          id: item.id,
          profile: item.profile,
          width: item.width,
          height: item.height,
          outputPath: item.output_path,
          expectedDurationSeconds: item.expected_duration_seconds,
          checksum: item.checksum,
          createdAt: item.created_at,
        }));
    },
    queueCounts() {
      const rows = database
        .prepare("SELECT status, COUNT(*) AS count FROM jobs GROUP BY status")
        .all();
      return Object.fromEntries(rows.map((row) => [row.status, Number(row.count)]));
    },
    close() {
      database.close();
    },
  };
}
