import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationDir = join(testDir, "..", "migrations");
const database = `growth_os_task7_retry_upgrade_015_${process.pid}`;
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

function applyMigration(fileName) {
  psql(database, readFileSync(join(migrationDir, fileName), "utf8"));
  process.stdout.write(`applied ${fileName}\n`);
}

const migrations = readdirSync(migrationDir)
  .filter((name) => /^\d+.*\.sql$/.test(name))
  .sort();
const through015 = migrations.filter((name) => name < "202608120016");
const after015 = migrations.filter((name) => name >= "202608120016");

if (!after015.some((name) => name.startsWith("202608120018_"))) {
  throw new Error("expected additive Task 7 wall-clock lease migration 018");
}
if (!database.startsWith("growth_os_task7_retry_upgrade_015_")) {
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

  for (const migration of through015) applyMigration(migration);

  psql(
    database,
    `
      begin;
      insert into public.tenants (id, slug, display_name, timezone, currency)
      values ('171aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'retry-upgrade', 'Retry Upgrade', 'UTC', 'USD');
      insert into public.sites (
        id, tenant_id, origin, key_id, signing_secret_ciphertext, verified_at
      ) values (
        '17100000-0000-4000-8000-000000000001',
        '171aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'https://retry-upgrade.example.com', 'retry-upgrade-key', 'v1.fixture.secret', now()
      );
      insert into public.leads (
        id, tenant_id, site_id, external_event_id, name_ciphertext, email_ciphertext,
        email_lookup_hash, notes_ciphertext, declared_source, budget_range, timeline_range,
        occurred_at, last_activity_at
      ) values
        (
          '17120000-0000-4000-8000-000000000001',
          '171aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          '17100000-0000-4000-8000-000000000001',
          '17130000-0000-4000-8000-000000000001',
          'v1.fixture.name', 'v1.fixture.email', repeat('1', 64), 'v1.fixture.notes',
          'referral', '5k-10k', '1-2-months',
          '2026-08-09 16:00:00+00', '2026-08-09 16:00:00+00'
        ),
        (
          '17120000-0000-4000-8000-000000000002',
          '171aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          '17100000-0000-4000-8000-000000000001',
          '17130000-0000-4000-8000-000000000002',
          'v1.fixture.name', 'v1.fixture.email', repeat('2', 64), 'v1.fixture.notes',
          'google', '5k-10k', '1-2-months',
          '2026-08-09 16:00:00+00', '2026-08-09 16:00:00+00'
        );
      insert into public.consent_receipts (
        tenant_id, lead_id, receipt_type, policy_version, processing_basis,
        categories, source, recorded_at
      ) values
        (
          '171aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          '17120000-0000-4000-8000-000000000001',
          'website_lead', 'privacy-2026-08-08', 'contact_request',
          '{"necessary":true}', 'contact-form', '2026-08-09 16:00:00+00'
        ),
        (
          '171aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          '17120000-0000-4000-8000-000000000002',
          'website_lead', 'privacy-2026-08-08', 'contact_request',
          '{"necessary":true}', 'contact-form', '2026-08-09 16:00:00+00'
        );
      commit;

      insert into public.attribution_evidence (
        id, tenant_id, lead_id, occurred_at, declared_source, click_ids,
        landing_origin, landing_path, offer_id
      ) values
        (
          '17140000-0000-4000-8000-000000000001',
          '171aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          '17120000-0000-4000-8000-000000000001',
          '2026-08-09 14:00:00+00', 'referral', '{}',
          'https://retry-upgrade.example.com', '/', 'brief'
        ),
        (
          '17140000-0000-4000-8000-000000000002',
          '171aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          '17120000-0000-4000-8000-000000000002',
          '2026-08-09 14:00:00+00', 'google', '{"gclid":"upgrade-click"}',
          'https://retry-upgrade.example.com', '/', 'brief'
        );

      update public.attribution_recompute_jobs
      set attempt_count = 4
      where lead_id = '17120000-0000-4000-8000-000000000001';
      update public.attribution_recompute_jobs
      set status = 'failed', attempt_count = 4,
          sanitized_failure_code = 'RECOMPUTE_FAILED',
          next_retry_at = '2026-08-09 16:05:00+00'
      where lead_id = '17120000-0000-4000-8000-000000000002';
    `,
  );

  for (const migration of after015) applyMigration(migration);

  psql(
    database,
    `
      do $$
      begin
        if exists (
          select 1 from public.attribution_recompute_jobs
          where status in ('pending', 'failed') and attempt_count >= 4
        ) then
          raise exception 'upgrade stranded an unresolved max-attempt job';
        end if;
        if (
          select count(*) from public.attribution_recompute_jobs
          where tenant_id = '171aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
            and status = 'exhausted'
            and attempt_count = 4
            and sanitized_failure_code = 'RETRY_EXHAUSTED'
            and next_retry_at is null
            and claimed_generation is null
            and claim_token is null
            and lease_expires_at is null
        ) <> 2 then
          raise exception 'upgrade did not truthfully normalize both legacy jobs';
        end if;
        if (
          select count(*) from public.attribution_evidence
          where tenant_id = '171aaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
        ) <> 2 then
          raise exception 'upgrade changed accepted attribution evidence';
        end if;
      end;
      $$;

      set role service_role;
      do $$
      begin
        if public.claim_attribution_recompute_jobs(10, '2030-01-01 00:00:00+00') <> '[]'::jsonb then
          raise exception 'exhausted upgrade jobs remained claimable';
        end if;
      end;
      $$;
    `,
  );

  process.stdout.write("Task 7 015 retry-job upgrade normalization: PASS\n");
} finally {
  psql("postgres", `drop database if exists ${database} with (force);`);
}
