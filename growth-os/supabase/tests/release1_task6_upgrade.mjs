import { spawnSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const testDir = dirname(fileURLToPath(import.meta.url));
const migrationDir = join(testDir, "..", "migrations");
const database = `growth_os_task6_upgrade_${process.pid}`;
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

function applyHistoricalMigration(commit, fileName) {
  const repositoryRoot = join(testDir, "..", "..", "..");
  const migrationPath = `growth-os/supabase/migrations/${fileName}`;
  const sql = run("git", ["show", `${commit}:${migrationPath}`], undefined, repositoryRoot);
  psql(database, sql);
  process.stdout.write(`applied ${fileName} from ${commit}\n`);
}

const migrations = readdirSync(migrationDir)
  .filter((name) => /^\d+.*\.sql$/.test(name))
  .sort();
const before010 = migrations.filter((name) => name < "202608120010");
const migration010 = migrations.find((name) => name.startsWith("202608120010_"));
const migration011 = migrations.find((name) => name.startsWith("202608120011_"));
const migration012 = migrations.find((name) => name.startsWith("202608120012_"));
const migration013 = migrations.find((name) => name.startsWith("202608120013_"));

if (!migration010 || !migration011 || !migration012 || !migration013) {
  throw new Error("expected Task 6 migrations 010, 011, 012, and 013");
}
if (!database.startsWith("growth_os_task6_upgrade_")) {
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

  for (const migration of before010) applyMigration(migration);
  applyHistoricalMigration("232bcc8", migration010);

  psql(
    database,
    `
      insert into auth.users (id, email) values
        ('f3111111-1111-4111-8111-111111111111', 'legacy-owner@example.com');
      insert into public.tenants (id, slug, display_name) values
        ('f3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'task6-upgrade', 'Task 6 Upgrade');
      insert into public.audit_events (
        id, tenant_id, actor_user_id, actor_kind, action, target_type, target_id,
        request_id, metadata, created_at
      ) values (
        'f3600000-0000-4000-8000-000000000001',
        'f3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
        'f3111111-1111-4111-8111-111111111111',
        'user', 'lead.reopened', 'lead',
        'f3200000-0000-4000-8000-000000000001',
        'f3400000-0000-4000-8000-000000000001',
        '{"previous_status":"won","current_status":"qualified","reason":"Legacy private reopen reason."}',
        '2026-08-10T14:30:00Z'
      );
    `,
  );

  applyMigration(migration011);
  psql(
    database,
    `
      do $$
      begin
        if not exists (
          select 1 from public.audit_events
          where id = 'f3600000-0000-4000-8000-000000000001'
            and metadata ? 'reason'
        ) then
          raise exception 'migration 011 did not retain the representative legacy row';
        end if;
        if coalesce((
          select convalidated from pg_constraint
          where conrelid = 'public.audit_events'::regclass
            and conname = 'audit_events_lead_operation_metadata_check'
        ), true) then
          raise exception 'migration 011 lifecycle constraint unexpectedly validated';
        end if;
      end;
      $$;
    `,
  );

  applyMigration(migration012);
  applyMigration(migration013);

  psql(
    database,
    `
      do $$
      declare
        upgraded public.audit_events%rowtype;
      begin
        select * into strict upgraded
        from public.audit_events
        where id = 'f3600000-0000-4000-8000-000000000001';

        if upgraded.metadata <> '{"change_code":"lead_reopened","previous_status":"won","current_status":"qualified","superseded_count":0}'::jsonb then
          raise exception 'actual migration cleanup produced unexpected metadata: %', upgraded.metadata;
        end if;
        if upgraded.tenant_id <> 'f3aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
          or upgraded.actor_user_id <> 'f3111111-1111-4111-8111-111111111111'
          or upgraded.action <> 'lead.reopened'
          or upgraded.target_type <> 'lead'
          or upgraded.target_id <> 'f3200000-0000-4000-8000-000000000001'
          or upgraded.request_id <> 'f3400000-0000-4000-8000-000000000001'
          or upgraded.created_at <> '2026-08-10T14:30:00Z'::timestamptz then
          raise exception 'actual migration cleanup changed immutable event identity';
        end if;
        if not coalesce((
          select convalidated from pg_constraint
          where conrelid = 'public.audit_events'::regclass
            and conname = 'audit_events_lead_operation_metadata_check'
        ), false) then
          raise exception 'strict lifecycle constraint is not validated';
        end if;
        if not public.is_sanitized_lead_operation_metadata(upgraded.action, upgraded.metadata) then
          raise exception 'upgraded metadata does not satisfy the exact lifecycle contract';
        end if;
      end;
      $$;

      set role service_role;
      do $$
      begin
        begin
          update public.audit_events
          set metadata = '{}'
          where id = 'f3600000-0000-4000-8000-000000000001';
          raise exception 'service role unexpectedly updated audit history';
        exception when insufficient_privilege then
          null;
        end;
        begin
          delete from public.audit_events
          where id = 'f3600000-0000-4000-8000-000000000001';
          raise exception 'service role unexpectedly deleted audit history';
        exception when insufficient_privilege then
          null;
        end;
      end;
      $$;
      reset role;
    `,
  );

  process.stdout.write("Task 6 disposable upgrade path: PASS\n");
} finally {
  psql("postgres", `drop database if exists ${database} with (force);`);
}
