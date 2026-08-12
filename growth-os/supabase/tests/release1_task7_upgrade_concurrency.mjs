import { spawn, spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationDir = join(testDir, "..", "migrations");
const database = `growth_os_task7_upgrade_${process.pid}`;
const container = process.env.SUPABASE_DB_CONTAINER ?? "supabase_db_growth-os";

function run(command, args, input, cwd) {
  const result = spawnSync(command, args, {
    cwd,
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

const migrations = readdirSync(migrationDir)
  .filter((name) => /^\d+.*\.sql$/.test(name))
  .sort();
const throughTask6 = migrations.filter((name) => name < "202608120014");
const task7 = migrations.find((name) => name.startsWith("202608120014_"));
const fixRound1 = migrations.find((name) => name.startsWith("202608120015_"));

if (!task7 || !fixRound1) throw new Error("expected Task 7 migrations 014 and 015");
if (!database.startsWith("growth_os_task7_upgrade_")) {
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
      as $$
        select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
      $$;
      grant usage on schema auth to anon, authenticated, service_role;
      grant execute on function auth.uid() to anon, authenticated, service_role;
    `,
  );

  for (const migration of throughTask6) applyMigration(migration);

  psql(
    database,
    `
      insert into auth.users (id, email) values
        ('f7111111-1111-4111-8111-111111111111', 'legacy-owner@example.com');
      insert into public.tenants (id, slug, display_name, timezone, currency) values
        ('f7aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'task7-upgrade', 'Task 7 Upgrade', 'UTC', 'USD');
      insert into public.sites (
        id, tenant_id, origin, key_id, signing_secret_ciphertext, verified_at
      ) values (
        'f7100000-0000-4000-8000-000000000001',
        'f7aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'https://task7-upgrade.example.com', 'task7-upgrade-key', 'v1.fixture.secret', now()
      );
      select public.ingest_website_lead(
        'f7aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'f7100000-0000-4000-8000-000000000001',
        'f7200000-0000-4000-8000-000000000001', repeat('a', 64),
        'f7200000-0000-4000-8000-000000000001', '2026-08-09T16:00:00Z',
        jsonb_build_object(
          'name_ciphertext', 'v1.fixture.name', 'email_ciphertext', 'v1.fixture.email',
          'email_lookup_hash', repeat('1', 64), 'phone_ciphertext', null,
          'phone_lookup_hash', null, 'company_ciphertext', null,
          'notes_ciphertext', 'v1.fixture.notes', 'budget_range', '5k-10k',
          'timeline_range', '1-2-months'
        ),
        jsonb_build_object(
          'declared_source', 'google', 'source_detail', null, 'utm_source', 'google',
          'utm_medium', 'cpc', 'utm_campaign', 'launch', 'utm_content', null,
          'utm_term', null, 'referrer_domain', 'google.com',
          'click_ids', '{"gclid":"legacy-click"}'::jsonb,
          'landing_origin', 'https://task7-upgrade.example.com', 'landing_path', '/',
          'offer_id', 'brief'
        ),
        jsonb_build_object(
          'policy_version', 'privacy-2026-08-08', 'source', 'contact-form',
          'necessary', true, 'analytics', false, 'marketing', true,
          'preferences', false, 'contact_requested', true, 'gpc', false,
          'recorded_at', '2026-08-09T16:00:00Z'
        ),
        'f7300000-0000-4000-8000-000000000001'
      );
      insert into public.attribution_touches (
        tenant_id, lead_id, evidence_id, touch_type, normalized_source,
        confidence, state, reason_codes
      )
      select
        lead.tenant_id, lead.id, evidence.id, 'first', 'google_ads',
        'high', 'attributed', array['declared_source:google_ads']
      from public.leads lead
      join public.attribution_evidence evidence
        on evidence.tenant_id = lead.tenant_id and evidence.lead_id = lead.id
      where lead.external_event_id = 'f7200000-0000-4000-8000-000000000001';
      insert into public.attribution_touches (
        tenant_id, lead_id, evidence_id, touch_type, normalized_source,
        confidence, state, reason_codes, manual_actor, manual_reason
      )
      select
        lead.tenant_id, lead.id, evidence.id, 'manual', 'meta_ads',
        'medium', 'attributed', array['manual_correction'],
        'f7111111-1111-4111-8111-111111111111', 'Legacy detached correction reason.'
      from public.leads lead
      join public.attribution_evidence evidence
        on evidence.tenant_id = lead.tenant_id and evidence.lead_id = lead.id
      where lead.external_event_id = 'f7200000-0000-4000-8000-000000000001';
    `,
  );

  const leadId = psql(
    database,
    "select id from public.leads where external_event_id = 'f7200000-0000-4000-8000-000000000001';",
  );
  const evidenceId = psql(
    database,
    `select id from public.attribution_evidence where lead_id = '${leadId}' order by occurred_at, id limit 1;`,
  );

  applyMigration(task7);
  applyMigration(fixRound1);

  psql(
    database,
    `
      do $$
      begin
        if exists (
          select 1 from public.attribution_touches
          where lead_id = '${leadId}' and touch_type = 'manual'
        ) then
          raise exception 'detached legacy manual overlay survived upgrade cleanup';
        end if;
        if (select count(*) from public.attribution_touches
            where lead_id = '${leadId}' and touch_type = 'first') <> 1 then
          raise exception 'upgrade cleanup changed valid computed history';
        end if;
        if not coalesce((
          select convalidated from pg_constraint
          where conrelid = 'public.attribution_touches'::regclass
            and conname = 'attribution_touches_original_computed_shape_check'
        ), false) then
          raise exception 'strict manual relationship constraint is not validated';
        end if;
        if has_table_privilege('service_role', 'public.attribution_touches', 'INSERT')
          or has_table_privilege('service_role', 'public.attribution_touches', 'UPDATE')
          or has_table_privilege('service_role', 'public.attribution_touches', 'DELETE') then
          raise exception 'service role retained direct attribution history writes';
        end if;
      end;
      $$;

      create function public.task7_concurrency_pause()
      returns trigger
      language plpgsql
      set search_path = ''
      as $$
      begin
        if new.lead_id = '${leadId}' and new.touch_type = 'last' then
          perform pg_sleep(1);
        end if;
        return new;
      end;
      $$;
      create trigger zz_task7_concurrency_pause
      before insert on public.attribution_touches
      for each row execute function public.task7_concurrency_pause();
    `,
  );

  const decision = JSON.stringify({
    source: "google_ads",
    campaign_external_id: null,
    confidence: "high",
    state: "attributed",
    reason_codes: ["declared_source:google_ads"],
  }).replaceAll("'", "''");
  const recompute = (requestId) => `
    set role service_role;
    select public.apply_attribution_recomputation(
      'f7aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '${leadId}',
      '${evidenceId}', '${decision}'::jsonb,
      '${evidenceId}', '${decision}'::jsonb,
      '${requestId}'
    );
  `;

  await Promise.all([
    psqlAsync(database, recompute("f7400000-0000-4000-8000-000000000001")),
    psqlAsync(database, recompute("f7400000-0000-4000-8000-000000000002")),
  ]);

  psql(
    database,
    `
      do $$
      begin
        if (select count(*) from public.attribution_touches
            where lead_id = '${leadId}' and touch_type = 'last') <> 1 then
          raise exception 'concurrent identical recomputes appended duplicate last touches';
        end if;
        if (select count(*) from public.audit_events
            where request_id in (
              'f7400000-0000-4000-8000-000000000001',
              'f7400000-0000-4000-8000-000000000002'
            ) and action = 'attribution.recomputed') <> 1 then
          raise exception 'concurrent identical recomputes appended duplicate visible-change audits';
        end if;
      end;
      $$;
    `,
  );

  process.stdout.write("Task 7 Task 6 upgrade and concurrent recomputation: PASS\n");
} finally {
  psql("postgres", `drop database if exists ${database} with (force);`);
}
