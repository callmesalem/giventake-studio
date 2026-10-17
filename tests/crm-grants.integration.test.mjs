// Two claims, both only checkable against a real database.
//
// 1. The migration chain rebuilds the schema from nothing. It did not: production
//    held a role, two tables, three functions and eight columns that no migration
//    created, and nobody could know, because nothing ever replayed the chain.
// 2. After it has run, service_role reads an allowlist of tables, writes none, and
//    the six writes the dashboard used to make directly work through RPCs.
//
// Plain postgres:17 rather than the Supabase image on purpose. It has none of
// Supabase's default privileges, so it proves the grants do not lean on them.
import { execFileSync } from "node:child_process";
import { readFileSync, readdirSync } from "node:fs";
import assert from "node:assert/strict";

const docker = (...args) =>
  execFileSync("docker", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
try {
  docker("info");
} catch {
  if (process.env.ALLOW_DOCKER_INTEGRATION_SKIP === "true") {
    console.log(
      "SKIP CRM grants integration: Docker unavailable and ALLOW_DOCKER_INTEGRATION_SKIP=true",
    );
    process.exit(0);
  }
  throw new Error(
    "Docker is required for the CRM grants integration test. Set ALLOW_DOCKER_INTEGRATION_SKIP=true only for an explicit skip.",
  );
}

const name = `giventake-crm-grants-${process.pid}`;
const run = (input, extra = []) =>
  execFileSync(
    "docker",
    ["exec", "-i", name, "psql", "-v", "ON_ERROR_STOP=1", "-qAt", "-U", "postgres", ...extra],
    { input, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] },
  ).trim();
/** One statement as a role. `set role` is what PostgREST does with the JWT's role. */
const as = (role, sql) => run(`${role === "postgres" ? "" : `set role ${role};`} ${sql}`);
const refuses = (role, sql, pattern) =>
  assert.throws(
    () => as(role, sql),
    (error) => pattern.test(String(error.stderr)),
    `${role}: ${sql}`,
  );

const READABLE = [
  "leads", "companies", "contacts", "deals", "notes", "tasks", "touchpoints", "agent_log",
  "pipeline_stages", "deal_stage_events", "approval_queue", "referral_partners", "referrals",
  "clients", "projects", "invoices", "campaigns", "newsletter_subscribers", "reviews",
  "price_book_items",
]; // prettier-ignore
const WRITE_RPCS = [
  "crm_assign(text,text,uuid,uuid)",
  "deal_link_lead(uuid,uuid)",
  "deal_set_outcome(uuid,text)",
  "contact_set_next_action(uuid,text,timestamp with time zone)",
  "lead_set_status(uuid,text)",
  "client_create(text,uuid,uuid,boolean,uuid)",
  "project_create(uuid,text)",
  "invoice_create(uuid,bigint,text,text,timestamp with time zone)",
  "price_book_upsert(uuid,text,text,text,text,text,bigint,boolean,boolean,text[],text[],numeric,boolean,integer)",
];

try {
  docker("run", "-d", "--rm", "--name", name, "-e", "POSTGRES_PASSWORD=local-synthetic-only", "postgres:17"); // prettier-ignore
  // Probe over TCP, not the unix socket. The image's entrypoint brings up a
  // temporary server with listen_addresses='' to run initdb and the init
  // scripts, then shuts it down and starts the real one. A socket probe is
  // answered by that throwaway server, so the loop breaks early and the next
  // statement hits a socket with nothing behind it:
  //   psql: error: connection to server on socket ... No such file or directory
  // Only the real server listens on 127.0.0.1, so this waits for the right one.
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try {
      docker("exec", name, "psql", "-h", "127.0.0.1", "-U", "postgres", "-qAt", "-c", "select 1");
      ready = true;
      break;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
  assert.ok(ready, "postgres:17 never accepted a TCP connection within 30s");

  // What a Supabase project supplies before the first migration runs.
  run(`
    create role anon nologin;
    create role authenticated nologin;
    create role service_role nologin bypassrls;
    create schema auth;
    create table auth.users (id uuid primary key default gen_random_uuid());
  `);

  // 1. The chain, in order, from nothing.
  const dir = new URL("../supabase/migrations/", import.meta.url);
  const files = readdirSync(dir)
    .filter((file) => file.endsWith(".sql"))
    .sort();
  for (const file of files) {
    const sql = readFileSync(new URL(file, dir), "utf8");
    try {
      run(sql, /^\s*begin\s*;/im.test(sql) ? [] : ["-1"]);
    } catch (error) {
      assert.fail(`${file} does not apply on a fresh database:\n${String(error.stderr).trim()}`);
    }
  }

  // 2. Reads: the allowlist, and nothing past it.
  const tables = as(
    "postgres",
    "select string_agg(tablename, ',' order by tablename) from pg_tables where schemaname='public';",
  ).split(",");
  assert.ok(tables.length >= 45, `expected the full schema, found ${tables.length} tables`);
  for (const table of tables) {
    if (READABLE.includes(table)) as("service_role", `select 1 from public.${table} limit 1;`);
    else refuses("service_role", `select 1 from public.${table} limit 1;`, /permission denied/);
  }
  for (const table of READABLE) assert.ok(tables.includes(table), `${table} is on the allowlist but does not exist`); // prettier-ignore

  // 3. Writes: none, on any table, for any API role.
  for (const table of tables) {
    for (const role of ["service_role", "anon", "authenticated"]) {
      assert.equal(
        as("postgres", `select has_table_privilege('${role}','public.${table}','insert,update,delete,truncate,references,trigger');`),
        "f",
        `${role} can write public.${table}`,
      ); // prettier-ignore
    }
  }
  refuses("service_role", "delete from public.deals;", /permission denied/);
  refuses("service_role", "update public.approval_queue set status='approved';", /permission denied/); // prettier-ignore
  refuses("service_role", "insert into public.invoices(amount_cents) values (1);", /permission denied/); // prettier-ignore

  // 4. The write RPCs exist, for service_role only.
  for (const fn of WRITE_RPCS) {
    assert.equal(
      as(
        "postgres",
        `select concat_ws('|', has_function_privilege('service_role','public.${fn}','execute'),
           has_function_privilege('anon','public.${fn}','execute'),
           has_function_privilege('authenticated','public.${fn}','execute'),
           has_function_privilege('crm_agent','public.${fn}','execute'),
           has_function_privilege('agent_sami','public.${fn}','execute'));`,
      ),
      "t|f|f|f|f",
      fn,
    );
  }

  // 5. And they do what the dashboard needs. Fixtures go in as postgres.
  const user = as("postgres", "insert into auth.users default values returning id;");
  const lead = as("postgres", "insert into public.leads(email, name) values ('alex@sample.invalid','Alex Fixture') returning id;"); // prettier-ignore
  const deal = as("postgres", "insert into public.deals(name, stage) values ('Sample Electric', 'Lead arrives') returning id;"); // prettier-ignore
  const missing = "99999999-9999-4999-8999-999999999999";

  as("service_role", `select public.lead_set_status('${lead}','converted');`);
  assert.equal(as("postgres", `select status from public.leads where id='${lead}';`), "converted");
  refuses("service_role", `select public.lead_set_status('${missing}','converted');`, /lead not found/); // prettier-ignore
  refuses("service_role", `select public.lead_set_status('${lead}','');`, /status/);
  refuses("service_role", `select public.lead_set_status('${lead}','Converted; drop');`, /status/);

  as("service_role", `select public.deal_link_lead('${deal}','${lead}');`);
  assert.equal(as("postgres", `select lead_id from public.deals where id='${deal}';`), lead);
  refuses("service_role", `select public.deal_link_lead('${missing}','${lead}');`, /deal not found/); // prettier-ignore
  refuses("service_role", `select public.deal_link_lead('${deal}','${missing}');`, /foreign key/);

  as("service_role", `select public.deal_set_outcome('${deal}','Price');`);
  assert.equal(as("postgres", `select lost_reason || '|' || (closed_at is not null) from public.deals where id='${deal}';`), "Price|true"); // prettier-ignore
  as("service_role", `select public.deal_set_outcome('${deal}',null);`);
  assert.equal(as("postgres", `select (lost_reason is null) || '|' || (closed_at is null) from public.deals where id='${deal}';`), "true|true"); // prettier-ignore
  refuses("service_role", `select public.deal_set_outcome('${deal}','  ');`, /lost reason/);
  refuses("service_role", `select public.deal_set_outcome('${missing}','Price');`, /deal not found/); // prettier-ignore

  // A new lead mirrored into contacts gets a reply deadline; other contacts don't.
  const leadContact = as("postgres", "insert into public.contacts(name, email, source, source_record_id) values ('Alex Fixture','alex@sample.invalid','lead_migration','fixture-1') returning id;"); // prettier-ignore
  assert.equal(as("postgres", `select next_action || '|' || (next_action_due > now() + interval '3 hours') from public.contacts where id='${leadContact}';`), "Reply to new lead|true"); // prettier-ignore
  const manual = as("postgres", "insert into public.contacts(name, source, source_record_id) values ('Sam Fixture','crm','fixture-2') returning id;"); // prettier-ignore
  assert.equal(as("postgres", `select next_action is null from public.contacts where id='${manual}';`), "t"); // prettier-ignore
  as("service_role", `select public.contact_set_next_action('${leadContact}', null, null);`);
  assert.equal(as("postgres", `select (next_action is null) || '|' || (next_action_due is null) from public.contacts where id='${leadContact}';`), "true|true"); // prettier-ignore
  refuses("service_role", `select public.contact_set_next_action('${leadContact}', '', now());`, /next action/); // prettier-ignore
  refuses("service_role", `select public.contact_set_next_action('${missing}', 'Call', now());`, /contact not found/); // prettier-ignore

  // Price book: seeded, and writable only through price_book_upsert.
  assert.equal(as("postgres", "select count(*) from public.price_book_items;"), "16");
  assert.equal(as("postgres", "select unit_price_cents from public.price_book_items where key='site_contractor';"), "199900"); // prettier-ignore
  const pb = as("service_role", "select public.price_book_upsert(null,'test_item','Test','','addon','each',1900,false,false,'{}','{}',null,false,99);"); // prettier-ignore
  as("service_role", `select public.price_book_upsert('${pb}','test_item','Test','','addon','each',2900,false,false,'{}','{}',1.5,true,99);`); // prettier-ignore
  assert.equal(as("postgres", `select unit_price_cents || '|' || archived from public.price_book_items where id='${pb}';`), "2900|true"); // prettier-ignore
  refuses("service_role", "select public.price_book_upsert(null,'site_standard','Dup','','website','each',1,false,false,'{}','{}',null,false,0);", /duplicate key/); // prettier-ignore
  refuses("service_role", "select public.price_book_upsert(null,'bad_cat','X','','nope','each',1,false,false,'{}','{}',null,false,0);", /check constraint/); // prettier-ignore
  refuses("service_role", "select public.price_book_upsert(null,'neg','X','','addon','each',-1,false,false,'{}','{}',null,false,0);", /check constraint/); // prettier-ignore

  as("service_role", `select public.crm_assign('deals','assigned_to','${deal}','${user}');`);
  assert.equal(as("postgres", `select assigned_to from public.deals where id='${deal}';`), user);
  as("service_role", `select public.crm_assign('deals','assigned_to','${deal}',null);`);
  assert.equal(as("postgres", `select assigned_to is null from public.deals where id='${deal}';`), "t"); // prettier-ignore
  refuses("service_role", `select public.crm_assign('deals','stage','${deal}','${user}');`, /cannot be assigned/); // prettier-ignore
  refuses("service_role", `select public.crm_assign('operator_controls','enabled','${deal}','${user}');`, /cannot be assigned/); // prettier-ignore
  refuses("service_role", `select public.crm_assign('companies','assigned_to','${deal}','${user}');`, /cannot be assigned/); // prettier-ignore
  refuses("service_role", `select public.crm_assign('deals','owner_id','${missing}','${user}');`, /record not found/); // prettier-ignore

  const client = as("service_role", `select public.client_create('Sample Electric','${lead}','${deal}',true,'${user}');`); // prettier-ignore
  assert.match(client, /^[0-9a-f-]{36}$/);
  assert.equal(
    as("postgres", `select concat_ws('|', name, lead_id, deal_id, ai_processing_allowed, owner_id, synthetic) from public.clients where id='${client}';`),
    `Sample Electric|${lead}|${deal}|t|${user}|f`,
  ); // prettier-ignore
  refuses("service_role", `select public.client_create('  ',null,'${deal}',false,null);`, /name/);

  const project = as("service_role", `select public.project_create('${client}','Intake automation');`); // prettier-ignore
  assert.equal(as("postgres", `select name from public.projects where id='${project}';`), "Intake automation"); // prettier-ignore
  refuses("service_role", `select public.project_create('${missing}','Orphan');`, /foreign key/);

  const invoice = as("service_role", `select public.invoice_create('${project}',150000,'USD','draft',null);`); // prettier-ignore
  assert.equal(
    as("postgres", `select concat_ws('|', project_id, amount_cents, currency, status, synthetic) from public.invoices where id='${invoice}';`),
    `${project}|150000|usd|draft|f`,
  ); // prettier-ignore
  refuses("service_role", `select public.invoice_create('${project}',-1,'USD','draft',null);`, /amount/); // prettier-ignore
  refuses("service_role", `select public.invoice_create('${project}',100,'dollars','draft',null);`, /currency/); // prettier-ignore

  // 6. The agents gained nothing from any of this.
  for (const role of ["crm_agent", "agent_sami"]) {
    for (const table of tables) {
      assert.equal(
        as("postgres", `select has_table_privilege('${role}','public.${table}','select,insert,update,delete,truncate');`),
        "f",
        `${role} can reach public.${table}`,
      ); // prettier-ignore
    }
  }

  // 7. The Worker can assert an agent through PostgREST's request.headers, and
  //    the guard treats that assertion exactly like a direct agent login.
  //    session_user here is postgres (exempt), which is the same branch the app
  //    takes as authenticator.
  const HEADER = `set "request.headers" = '{"x-agent-role":"agent_perplexity"}';`;
  const asserting = (sql) => as("service_role", `${HEADER} ${sql}`);
  const NOTE = (key) =>
    `select public.note_upsert('agent_perplexity','${key}',null,'t','hello',null,null);`;

  as(
    "postgres",
    `update public.operator_system_control set operators_enabled = false where id='global';`,
  );
  refuses("service_role", `${HEADER} ${NOTE("n1")}`, /agent_capability_denied: operators_disabled/);
  as(
    "postgres",
    `update public.operator_system_control set operators_enabled = true where id='global';`,
  );
  refuses(
    "service_role",
    `${HEADER} ${NOTE("n1")}`,
    /capability_disabled \(agent_perplexity, note_upsert\)/,
  );
  as(
    "postgres",
    `update public.agent_capabilities set enabled = true where agent_role='agent_perplexity' and capability='note_upsert';`,
  );
  assert.match(asserting(NOTE("n1")), /^[0-9a-f-]{36}$/);
  assert.equal(
    as(
      "postgres",
      `select count(*) from public.operator_audit_events where operator_key='agent_perplexity' and event_type='capability_allowed';`,
    ),
    "1",
  );
  refuses(
    "service_role",
    `set "request.headers" = '{"x-agent-role":"postgres"}'; ${NOTE("n2")}`,
    /bad_assertion/,
  );
  refuses(
    "service_role",
    `set "request.headers" = '{"x-agent-role":"agent_nobody"}'; ${NOTE("n2")}`,
    /capability_missing \(agent_nobody, note_upsert\)/,
  );
  // Without the header the app path is untouched: allowed, and not audited as an agent.
  assert.match(
    as("service_role", `select public.note_upsert('crm:salem','n3',null,'t','hello',null,null);`),
    /^[0-9a-f-]{36}$/,
  );
  assert.equal(
    as(
      "postgres",
      `select count(*) from public.operator_audit_events where operator_key='agent_perplexity';`,
    ),
    "1",
  );

  // approval_decide is guarded the same way, by its own row.
  as(
    "postgres",
    `update public.agent_capabilities set enabled = true where agent_role='agent_perplexity' and capability='approval_request';`,
  );
  const proposal = asserting(
    `select public.approval_request('agent_perplexity','deal_close','deal','${deal}','close it','{}','high',null);`,
  );
  assert.match(proposal, /^[0-9a-f-]{36}$/);
  refuses(
    "service_role",
    `${HEADER} select public.approval_decide('${proposal}','approved','crm:salem via agent_perplexity','directed: "do it"');`,
    /capability_disabled \(agent_perplexity, approval_decide\)/,
  );
  assert.equal(
    as("postgres", `select status from public.approval_queue where id='${proposal}';`),
    "pending",
  );
  as(
    "postgres",
    `update public.agent_capabilities set enabled = true where agent_role='agent_perplexity' and capability='approval_decide';`,
  );
  assert.equal(
    asserting(
      `select public.approval_decide('${proposal}','approved','crm:salem via agent_perplexity','directed: "do it"');`,
    ),
    "t",
  );
  assert.equal(
    as(
      "service_role",
      `select capability||':'||enabled from public.agent_capabilities_for('agent_perplexity') where capability='note_upsert';`,
    ),
    "note_upsert:true",
  );
  refuses(
    "anon",
    `select * from public.agent_capabilities_for('agent_perplexity');`,
    /permission denied/,
  );

  console.log(`CRM grants integration passed: ${files.length} migrations, ${tables.length} tables`);
} finally {
  try {
    docker("rm", "-f", name);
  } catch {
    // The container may never have started.
  }
}
