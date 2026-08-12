import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationDir = join(testDir, "..", "migrations");
const database = `growth_os_task7_retries_${process.pid}`;
const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_growth-os";

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

async function waitForAdvisoryLock(classId, objectId) {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (
      psql(
        database,
        `select exists (
          select 1 from pg_locks
          where locktype = 'advisory' and classid = ${classId} and objid = ${objectId} and granted
        );`,
      ) === "t"
    ) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
  throw new Error("timed out waiting for the evidence mutation race barrier");
}

const migrations = readdirSync(migrationDir)
  .filter((name) => /^\d+.*\.sql$/.test(name))
  .sort();
const throughTask6 = migrations.filter((name) => name < "202608120014");
const task7Migrations = migrations.filter((name) => name >= "202608120014");

if (!task7Migrations.some((name) => name.startsWith("202608120017_"))) {
  throw new Error("expected additive Task 7 retry migration 017");
}
if (!database.startsWith("growth_os_task7_retries_")) {
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

  for (const migration of throughTask6) applyMigration(migration);

  psql(
    database,
    `
      begin;
      insert into public.tenants (id, slug, display_name, timezone, currency) values
        ('c1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'race-a', 'Race A', 'UTC', 'USD'),
        ('d1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'race-b', 'Race B', 'UTC', 'USD');
      insert into public.sites (
        id, tenant_id, origin, key_id, signing_secret_ciphertext, verified_at
      ) values
        ('c1100000-0000-4000-8000-000000000001', 'c1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
         'https://race-a.example.com', 'race-a-key', 'v1.fixture.secret', now()),
        ('d1100000-0000-4000-8000-000000000001', 'd1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
         'https://race-b.example.com', 'race-b-key', 'v1.fixture.secret', now());
      insert into public.leads (
        id, tenant_id, site_id, external_event_id, name_ciphertext, email_ciphertext,
        email_lookup_hash, notes_ciphertext, declared_source, budget_range, timeline_range,
        occurred_at, last_activity_at
      ) values
        ('c1200000-0000-4000-8000-000000000001', 'c1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
         'c1100000-0000-4000-8000-000000000001', 'c1300000-0000-4000-8000-000000000001',
         'v1.fixture.name', 'v1.fixture.email', repeat('1', 64), 'v1.fixture.notes',
         'referral', '5k-10k', '1-2-months', '2026-08-09 16:00:00+00', '2026-08-09 16:00:00+00'),
        ('c1200000-0000-4000-8000-000000000002', 'c1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
         'c1100000-0000-4000-8000-000000000001', 'c1300000-0000-4000-8000-000000000002',
         'v1.fixture.name', 'v1.fixture.email', repeat('2', 64), 'v1.fixture.notes',
         'google', '5k-10k', '1-2-months', '2026-08-09 16:00:00+00', '2026-08-09 16:00:00+00'),
        ('d1200000-0000-4000-8000-000000000001', 'd1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
         'd1100000-0000-4000-8000-000000000001', 'd1300000-0000-4000-8000-000000000001',
         'v1.fixture.name', 'v1.fixture.email', repeat('3', 64), 'v1.fixture.notes',
         'meta', '5k-10k', '1-2-months', '2026-08-09 16:00:00+00', '2026-08-09 16:00:00+00');
      insert into public.consent_receipts (
        tenant_id, lead_id, receipt_type, policy_version, processing_basis,
        categories, source, recorded_at
      ) values
        ('c1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1200000-0000-4000-8000-000000000001',
         'website_lead', 'privacy-2026-08-08', 'contact_request', '{"necessary":true}',
         'contact-form', '2026-08-09 16:00:00+00'),
        ('c1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'c1200000-0000-4000-8000-000000000002',
         'website_lead', 'privacy-2026-08-08', 'contact_request', '{"necessary":true}',
         'contact-form', '2026-08-09 16:00:00+00'),
        ('d1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'd1200000-0000-4000-8000-000000000001',
         'website_lead', 'privacy-2026-08-08', 'contact_request', '{"necessary":true}',
         'contact-form', '2026-08-09 16:00:00+00');
      commit;
    `,
  );

  for (const migration of task7Migrations) applyMigration(migration);

  psql(
    database,
    `
      insert into public.attribution_evidence (
        id, tenant_id, lead_id, occurred_at, declared_source, click_ids,
        landing_origin, landing_path, offer_id
      ) values
        ('c1400000-0000-4000-8000-000000000001', 'c1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
         'c1200000-0000-4000-8000-000000000001', '2026-08-09 14:00:00+00', 'referral', '{}',
         'https://race-a.example.com', '/', 'brief'),
        ('c1400000-0000-4000-8000-000000000003', 'c1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
         'c1200000-0000-4000-8000-000000000002', '2026-08-09 14:00:00+00', 'google', '{"gclid":"g-3"}',
         'https://race-a.example.com', '/', 'brief'),
        ('d1400000-0000-4000-8000-000000000001', 'd1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
         'd1200000-0000-4000-8000-000000000001', '2026-08-09 14:00:00+00', 'meta', '{"fbclid":"f-1"}',
         'https://race-b.example.com', '/', 'brief');
    `,
  );

  const staleClaim = JSON.parse(
    psql(
      database,
      `set role service_role; select public.claim_attribution_recompute_job(
        'c1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'c1200000-0000-4000-8000-000000000001',
        '2030-01-01 00:00:00+00'
      );`,
    ),
  );

  const evidenceMutation = psqlAsync(
    database,
    `begin;
     select pg_advisory_lock(716, 1);
     insert into public.attribution_evidence (
       id, tenant_id, lead_id, occurred_at, declared_source, click_ids,
       landing_origin, landing_path, offer_id
     ) values (
       'c1400000-0000-4000-8000-000000000002', 'c1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
       'c1200000-0000-4000-8000-000000000001', '2026-08-09 15:00:00+00', 'meta', '{"fbclid":"f-2"}',
       'https://race-a.example.com', '/later', 'brief'
     );
     select pg_sleep(1);
     commit;`,
  );
  await waitForAdvisoryLock(716, 1);
  const staleApply = psqlAsync(
    database,
    `set role service_role; select public.apply_attribution_recomputation(
        '${staleClaim.tenant_id}', '${staleClaim.lead_id}', '${staleClaim.generation}',
        '${staleClaim.claim_token}', 'c1400000-0000-4000-8000-000000000001',
        '{"source":"referral","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:referral"]}',
        'c1400000-0000-4000-8000-000000000001',
        '{"source":"referral","campaign_external_id":null,"confidence":"high","state":"attributed","reason_codes":["declared_source:referral"]}',
        'c1500000-0000-4000-8000-000000000001'
      );`,
  );
  const [, staleOutput] = await Promise.all([evidenceMutation, staleApply]);
  const staleResult = JSON.parse(staleOutput);
  if (staleResult.stale !== true)
    throw new Error("older evidence snapshot was not rejected as stale");

  psql(
    database,
    `do $$
     begin
       if not exists (
         select 1 from public.attribution_recompute_jobs
         where tenant_id = 'c1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
           and lead_id = 'c1200000-0000-4000-8000-000000000001'
           and generation = 2 and status = 'pending'
       ) then raise exception 'newer generation lost retry eligibility after stale apply'; end if;
       if exists (
         select 1 from public.attribution_touches
         where tenant_id = 'c1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
           and lead_id = 'c1200000-0000-4000-8000-000000000001'
       ) then raise exception 'stale apply changed attribution history'; end if;
     end $$;`,
  );

  const concurrentClaim = `
    begin;
    set local role service_role;
    select public.claim_attribution_recompute_jobs(1, '2030-01-01 00:00:00+00');
    select pg_sleep(1);
    commit;
  `;
  const outputs = await Promise.all([
    psqlAsync(database, concurrentClaim),
    psqlAsync(database, concurrentClaim),
  ]);
  const claims = outputs.map((output) => JSON.parse(output.split(/\r?\n/)[0])[0]);
  if (claims.some((claim) => !claim)) throw new Error("a concurrent worker failed to claim work");
  if (claims[0].claim_token === claims[1].claim_token) {
    throw new Error("concurrent workers received the same attribution claim");
  }
  for (const claim of claims) {
    if (
      claim.evidence.some(
        (item) =>
          psql(
            database,
            `select count(*) from public.attribution_evidence
             where id = '${item.id}' and tenant_id = '${claim.tenant_id}' and lead_id = '${claim.lead_id}';`,
          ) !== "1",
      )
    ) {
      throw new Error("a claim snapshot crossed a tenant or lead boundary");
    }
  }

  psql(
    database,
    `update public.attribution_recompute_jobs
     set status = 'succeeded', attempt_count = 0,
         claimed_generation = null, claim_token = null, lease_expires_at = null,
         next_retry_at = null, sanitized_failure_code = null;
     update public.attribution_recompute_jobs
     set status = 'processing', attempt_count = 4,
         claimed_generation = generation,
         claim_token = 'c1600000-0000-4000-8000-000000000001',
         lease_expires_at = '2029-12-31 23:59:00+00',
         next_retry_at = null, sanitized_failure_code = null
     where tenant_id = 'c1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
       and lead_id = 'c1200000-0000-4000-8000-000000000002';
     update public.attribution_recompute_jobs
     set status = 'pending', attempt_count = 0,
         claimed_generation = null, claim_token = null, lease_expires_at = null,
         next_retry_at = null, sanitized_failure_code = null
     where tenant_id = 'd1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
       and lead_id = 'd1200000-0000-4000-8000-000000000001';`,
  );

  const lockedExpiredJob = psqlAsync(
    database,
    `begin;
     select * from public.attribution_recompute_jobs
     where tenant_id = 'c1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
       and lead_id = 'c1200000-0000-4000-8000-000000000002'
     for update;
     select pg_advisory_lock(716, 2);
     select pg_sleep(2);
     commit;`,
  );
  await waitForAdvisoryLock(716, 2);
  const unlockedClaimOutput = await psqlAsync(
    database,
    `set statement_timeout = '500ms';
     set role service_role;
     select public.claim_attribution_recompute_jobs(1, '2030-01-01 00:00:00+00');`,
  );
  const unlockedClaim = JSON.parse(unlockedClaimOutput)[0];
  await lockedExpiredJob;
  if (
    unlockedClaim?.tenant_id !== "d1bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb" ||
    unlockedClaim?.lead_id !== "d1200000-0000-4000-8000-000000000001"
  ) {
    throw new Error("locked expired work blocked or contaminated an unrelated tenant claim");
  }
  psql(
    database,
    `do $$
     begin
       if not exists (
         select 1 from public.attribution_recompute_jobs
         where tenant_id = 'c1aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
           and lead_id = 'c1200000-0000-4000-8000-000000000002'
           and status = 'processing' and attempt_count = 4
           and claim_token = 'c1600000-0000-4000-8000-000000000001'
       ) then raise exception 'skipped locked job changed during unrelated claim'; end if;
     end $$;`,
  );

  process.stdout.write("Task 7 generation-safe retries and concurrent claims: PASS\n");
} finally {
  psql("postgres", `drop database if exists ${database} with (force);`);
}
