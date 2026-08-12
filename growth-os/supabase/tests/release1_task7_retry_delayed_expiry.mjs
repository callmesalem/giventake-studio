import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationDir = join(testDir, "..", "migrations");
const database = `growth_os_task7_delayed_expiry_${process.pid}`;
const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_growth-os";

const tenantId = "181aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa";
const applyLeadId = "18120000-0000-4000-8000-000000000001";
const failureLeadId = "18120000-0000-4000-8000-000000000002";
const applyEvidenceId = "18140000-0000-4000-8000-000000000001";
const failureEvidenceId = "18140000-0000-4000-8000-000000000002";
const applyRequestId = "18150000-0000-4000-8000-000000000001";
const failureRequestId = "18150000-0000-4000-8000-000000000002";

function run(command, args, input) {
  const result = spawnSync(command, args, {
    encoding: "utf8",
    input,
    maxBuffer: 16 * 1024 * 1024,
  });
  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed with status ${result.status}`,
        result.stdout,
        result.stderr,
      ]
        .filter(Boolean)
        .join("\n"),
    );
  }
  return result.stdout.trim();
}

function psql(targetDatabase, sql) {
  return run(
    "docker",
    [
      "exec",
      "-i",
      container,
      "psql",
      "-X",
      "-q",
      "-t",
      "-A",
      "-v",
      "ON_ERROR_STOP=1",
      "-U",
      "postgres",
      "-d",
      targetDatabase,
    ],
    sql,
  );
}

function psqlAsync(targetDatabase, sql) {
  return new Promise((resolve, reject) => {
    const child = spawn(
      "docker",
      [
        "exec",
        "-i",
        container,
        "psql",
        "-X",
        "-q",
        "-t",
        "-A",
        "-v",
        "ON_ERROR_STOP=1",
        "-U",
        "postgres",
        "-d",
        targetDatabase,
      ],
      { stdio: ["pipe", "pipe", "pipe"] },
    );
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(stdout.trim());
      else reject(new Error(`concurrent psql failed with status ${code}\n${stdout}\n${stderr}`));
    });
    child.stdin.end(sql);
  });
}

function applyMigration(fileName) {
  psql(database, readFileSync(join(migrationDir, fileName), "utf8"));
  process.stdout.write(`applied ${fileName}\n`);
}

async function waitForTransactionsWaitingOnJobLocks(applicationNames) {
  const expected = applicationNames.length;
  const names = applicationNames.map((name) => `'${name}'`).join(", ");
  for (let attempt = 0; attempt < 100; attempt += 1) {
    const waiting = Number(
      psql(
        database,
        `select count(*)
         from pg_stat_activity
         where datname = current_database()
           and application_name in (${names})
           and wait_event_type = 'Lock';`,
      ),
    );
    if (waiting === expected) return;
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("timed out waiting for delayed RPC transactions to block on job row locks");
}

const migrations = readdirSync(migrationDir)
  .filter((name) => /^\d+.*\.sql$/.test(name))
  .sort();

if (!migrations.some((name) => name.startsWith("202608120018_"))) {
  throw new Error("expected additive Task 7 wall-clock lease migration 018");
}
if (!database.startsWith("growth_os_task7_delayed_expiry_")) {
  throw new Error("refusing to use a non-test database name");
}

run("docker", ["inspect", container]);

try {
  psql("postgres", `drop database if exists ${database} with (force);`);
  psql("postgres", `create database ${database};`);
  psql(
    database,
    `
      create schema auth;
      create schema extensions;
      create table auth.users (id uuid primary key, email text);
      create function auth.uid()
      returns uuid
      language sql
      stable
      set search_path = ''
      as $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
      grant usage on schema auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
    `,
  );
  for (const migration of migrations) applyMigration(migration);

  psql(
    database,
    `
      begin;
      insert into public.tenants (id, slug, display_name, timezone, currency)
      values ('${tenantId}', 'delayed-expiry', 'Delayed Expiry', 'UTC', 'USD');
      insert into public.sites (
        id, tenant_id, origin, key_id, signing_secret_ciphertext, verified_at
      ) values (
        '18100000-0000-4000-8000-000000000001', '${tenantId}',
        'https://delayed-expiry.example.com', 'delayed-expiry-key', 'v1.fixture.secret', now()
      );
      insert into public.leads (
        id, tenant_id, site_id, external_event_id, name_ciphertext, email_ciphertext,
        email_lookup_hash, notes_ciphertext, declared_source, budget_range, timeline_range,
        occurred_at, last_activity_at
      ) values
        (
          '${applyLeadId}', '${tenantId}', '18100000-0000-4000-8000-000000000001',
          '18130000-0000-4000-8000-000000000001', 'v1.fixture.name', 'v1.fixture.email',
          repeat('1', 64), 'v1.fixture.notes', 'referral', '5k-10k', '1-2-months',
          '2026-08-09 16:00:00+00', '2026-08-09 16:00:00+00'
        ),
        (
          '${failureLeadId}', '${tenantId}', '18100000-0000-4000-8000-000000000001',
          '18130000-0000-4000-8000-000000000002', 'v1.fixture.name', 'v1.fixture.email',
          repeat('2', 64), 'v1.fixture.notes', 'google', '5k-10k', '1-2-months',
          '2026-08-09 16:00:00+00', '2026-08-09 16:00:00+00'
        );
      insert into public.consent_receipts (
        tenant_id, lead_id, receipt_type, policy_version, processing_basis,
        categories, source, recorded_at
      ) values
        (
          '${tenantId}', '${applyLeadId}', 'website_lead', 'privacy-2026-08-08',
          'contact_request', '{"necessary":true}', 'contact-form', '2026-08-09 16:00:00+00'
        ),
        (
          '${tenantId}', '${failureLeadId}', 'website_lead', 'privacy-2026-08-08',
          'contact_request', '{"necessary":true}', 'contact-form', '2026-08-09 16:00:00+00'
        );
      commit;
      insert into public.attribution_evidence (
        id, tenant_id, lead_id, occurred_at, declared_source, click_ids,
        landing_origin, landing_path, offer_id
      ) values
        (
          '${applyEvidenceId}', '${tenantId}', '${applyLeadId}',
          '2026-08-09 14:00:00+00', 'referral', '{}',
          'https://delayed-expiry.example.com', '/', 'brief'
        ),
        (
          '${failureEvidenceId}', '${tenantId}', '${failureLeadId}',
          '2026-08-09 14:00:00+00', 'google', '{"gclid":"delayed-click"}',
          'https://delayed-expiry.example.com', '/', 'brief'
        );
    `,
  );

  const claims = JSON.parse(
    psql(
      database,
      `set role service_role;
       select public.claim_attribution_recompute_jobs(2, clock_timestamp());`,
    ),
  );
  const applyClaim = claims.find((claim) => claim.lead_id === applyLeadId);
  const failureClaim = claims.find((claim) => claim.lead_id === failureLeadId);
  if (!applyClaim || !failureClaim) throw new Error("failed to claim both delayed-expiry fixtures");

  const leaseExpiresAt = psql(
    database,
    `update public.attribution_recompute_jobs
     set lease_expires_at = clock_timestamp() + interval '2 seconds'
     where tenant_id = '${tenantId}' and lead_id in ('${applyLeadId}', '${failureLeadId}');
     select min(lease_expires_at) from public.attribution_recompute_jobs
     where tenant_id = '${tenantId}' and lead_id in ('${applyLeadId}', '${failureLeadId}');`,
  );
  const beforeJobs = psql(
    database,
    `select jsonb_agg(to_jsonb(job) order by lead_id)::text
     from public.attribution_recompute_jobs job
     where tenant_id = '${tenantId}' and lead_id in ('${applyLeadId}', '${failureLeadId}');`,
  );

  const rowLocker = psqlAsync(
    database,
    `begin;
     select 1 from public.attribution_recompute_jobs
     where tenant_id = '${tenantId}' and lead_id in ('${applyLeadId}', '${failureLeadId}')
     order by lead_id for update;
     select pg_advisory_lock(718, 1);
     select pg_sleep(4);
     commit;`,
  );
  for (let attempt = 0; attempt < 100; attempt += 1) {
    if (
      psql(
        database,
        `select exists (
          select 1 from pg_locks
          where locktype = 'advisory' and classid = 718 and objid = 1 and granted
        );`,
      ) === "t"
    ) {
      break;
    }
    if (attempt === 99) throw new Error("timed out waiting for the delayed-expiry lock barrier");
    await new Promise((resolve) => setTimeout(resolve, 20));
  }

  const decision = JSON.stringify({
    source: "referral",
    campaign_external_id: null,
    confidence: "high",
    state: "attributed",
    reason_codes: ["declared_source:referral"],
  }).replaceAll("'", "''");
  const apply = psqlAsync(
    database,
    `set application_name = 'task7-delayed-apply';
     begin;
     set local role service_role;
     select public.apply_attribution_recomputation(
       '${tenantId}', '${applyLeadId}', '${applyClaim.generation}', '${applyClaim.claim_token}',
       '${applyEvidenceId}', '${decision}'::jsonb, '${applyEvidenceId}', '${decision}'::jsonb,
       '${applyRequestId}'
     );
     commit;`,
  );
  const failure = psqlAsync(
    database,
    `set application_name = 'task7-delayed-failure';
     begin;
     set local role service_role;
     select public.record_attribution_recompute_failure(
       '${tenantId}', '${failureLeadId}', '${failureClaim.generation}', '${failureClaim.claim_token}',
       '${failureRequestId}', clock_timestamp()
     );
     commit;`,
  );

  await waitForTransactionsWaitingOnJobLocks(["task7-delayed-apply", "task7-delayed-failure"]);
  if (Date.now() >= Date.parse(leaseExpiresAt)) {
    throw new Error("RPC transactions did not reach the row lock before lease expiry");
  }

  const [applyOutput, failureOutput] = await Promise.all([apply, failure, rowLocker]).then(
    ([applyResult, failureResult]) => [applyResult, failureResult],
  );
  if (Date.now() <= Date.parse(leaseExpiresAt)) {
    throw new Error("row lock was released before lease expiry");
  }

  const applyResult = JSON.parse(applyOutput);
  const failureResult = JSON.parse(failureOutput);
  const authorizationFailures = [];
  if (applyResult.stale !== true || applyResult.completed !== false) {
    authorizationFailures.push(`delayed expired apply was authorized: ${applyOutput}`);
  }
  if (failureResult.status !== "stale") {
    authorizationFailures.push(`delayed expired failure was authorized: ${failureOutput}`);
  }
  if (authorizationFailures.length > 0) {
    throw new Error(authorizationFailures.join("\n"));
  }

  const afterJobs = psql(
    database,
    `select jsonb_agg(to_jsonb(job) order by lead_id)::text
     from public.attribution_recompute_jobs job
     where tenant_id = '${tenantId}' and lead_id in ('${applyLeadId}', '${failureLeadId}');`,
  );
  if (afterJobs !== beforeJobs) throw new Error("delayed expired RPC changed a retry job row");
  if (
    psql(
      database,
      `select count(*) from public.attribution_touches
       where tenant_id = '${tenantId}' and lead_id in ('${applyLeadId}', '${failureLeadId}');`,
    ) !== "0"
  ) {
    throw new Error("delayed expired apply appended attribution history");
  }
  if (
    psql(
      database,
      `select count(*) from public.audit_events
       where request_id in ('${applyRequestId}', '${failureRequestId}');`,
    ) !== "0"
  ) {
    throw new Error("delayed expired RPC wrote an audit event");
  }

  process.stdout.write("Task 7 delayed apply/failure lease expiry: PASS\n");
} finally {
  psql("postgres", `drop database if exists ${database} with (force);`);
}
