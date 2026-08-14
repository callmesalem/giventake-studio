import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import assert from "node:assert/strict";
const docker = (...args) =>
  execFileSync("docker", args, { encoding: "utf8", stdio: ["pipe", "pipe", "pipe"] });
try {
  docker("info");
} catch {
  if (process.env.ALLOW_DOCKER_INTEGRATION_SKIP === "true") {
    console.log(
      "SKIP operator PostgreSQL integration: Docker unavailable and ALLOW_DOCKER_INTEGRATION_SKIP=true",
    );
    process.exit(0);
  }
  throw new Error(
    "Docker is required for operator integration tests. Set ALLOW_DOCKER_INTEGRATION_SKIP=true only for an explicit skip.",
  );
}
const name = `giventake-operator-${process.pid}`;
const psql = (sql, role = "postgres") =>
  docker(
    "exec",
    "-i",
    name,
    "psql",
    "-v",
    "ON_ERROR_STOP=1",
    "-qAt",
    "-U",
    "postgres",
    "-c",
    `${role === "postgres" ? "" : `set role ${role};`} ${sql}`,
  ).trim();
try {
  docker(
    "run",
    "-d",
    "--rm",
    "--name",
    name,
    "-e",
    "POSTGRES_PASSWORD=local-synthetic-only",
    "postgres:17",
  );
  const bindings = docker("inspect", "-f", "{{json .HostConfig.PortBindings}}", name).trim();
  assert.ok(
    bindings === "null" || bindings === "{}",
    `container unexpectedly publishes ports: ${bindings}`,
  );
  for (let i = 0; i < 30; i++) {
    try {
      docker("exec", name, "pg_isready", "-U", "postgres");
      break;
    } catch {
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
    }
  }
  psql(
    "create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;",
  );
  for (const migration of [
    "20260814133600_operator_control_foundation.sql",
    "20260814150000_synthetic_lead_workflow.sql",
    "20260814170000_synthetic_draft_human_decisions.sql",
    "20260814180000_operator_security_hardening.sql",
  ]) {
    execFileSync(
      "docker",
      ["exec", "-i", name, "psql", "-v", "ON_ERROR_STOP=1", "-U", "postgres"],
      {
        input: readFileSync(new URL(`../supabase/migrations/${migration}`, import.meta.url)),
        stdio: ["pipe", "pipe", "pipe"],
      },
    );
  }
  const fns = [
    "operator_create_synthetic_lead_run(text,jsonb)",
    "operator_record_synthetic_cfo(uuid,jsonb)",
    "operator_record_synthetic_draft_approval(uuid,jsonb,timestamp with time zone)",
    "operator_dashboard_snapshot()",
    "operator_approve_synthetic_draft(uuid,text,text,text)",
    "operator_reject_synthetic_draft(uuid,text,text,text)",
  ];
  for (const fn of fns)
    assert.equal(
      psql(
        `select has_function_privilege('service_role','public.${fn}','execute'),has_function_privilege('anon','public.${fn}','execute'),has_function_privilege('authenticated','public.${fn}','execute');`,
      ),
      "t|f|f",
    );
  for (const table of [
    "operator_runs",
    "operator_approvals",
    "operator_audit_events",
    "leads",
    "synthetic_datasets",
  ])
    assert.equal(
      psql(
        `select has_table_privilege('service_role','public.${table}','select,insert,update,delete,truncate');`,
      ),
      "f",
    );
  assert.throws(() => psql("select * from operator_runs;", "service_role"));
  assert.throws(() =>
    psql(
      "insert into operator_audit_events(operator_key,event_type) values ('x','x');",
      "service_role",
    ),
  );
  assert.throws(() => psql("truncate operator_audit_events;", "service_role"));
  psql(
    "update operator_system_control set operators_enabled=true; insert into operator_controls(operator_key,enabled,allowed_modes) values ('giventake-cfo-compliance',true,array['synthetic']::operator_mode[]),('giventake-cro-pipeline',true,array['synthetic']::operator_mode[]);",
  );
  const fixture = `{"synthetic":true,"fixtureKind":"local-synthetic","id":"fixture-integration-1","email":"alex@sample.invalid","contactName":"Alex Fixture","businessName":"Sample Electric","category":"electrical-contractor","offerSlug":"business-automation","observedNeed":"synthetic intake"}`;
  const created = JSON.parse(
    psql(
      `select operator_create_synthetic_lead_run('fixture:integration-1','${fixture}'::jsonb);`,
      "service_role",
    ),
  );
  assert.equal(created.duplicate, false);
  const duplicate = JSON.parse(
    psql(
      `select operator_create_synthetic_lead_run('fixture:integration-1','${fixture}'::jsonb);`,
      "service_role",
    ),
  );
  assert.equal(duplicate.duplicate, true);
  assert.equal(duplicate.runId, created.runId);
  assert.throws(() =>
    psql(
      `select operator_create_synthetic_lead_run('fixture:real-email','${fixture.replace("alex@sample.invalid", "alex@example.com")}'::jsonb);`,
      "service_role",
    ),
  );
  assert.throws(() =>
    psql(
      `select operator_create_synthetic_lead_run('fixture:unknown-key','${fixture.slice(0, -1)},"sourceText":"raw"}'::jsonb);`,
      "service_role",
    ),
  );
  assert.throws(() =>
    psql(
      `select operator_create_synthetic_lead_run('fixture:sensitive','${fixture.replace("synthetic intake", "synthetic patient medical record")}'::jsonb);`,
      "service_role",
    ),
  );
  const cfo = {
    operator: "giventake-cfo-compliance",
    decision: "pass",
    blocks: [],
    escalations: [],
    flags: [],
    sendAuthorized: false,
  };
  const disclosure =
    "Synthetic fixture draft for human review.\n\n—\nThis message was sent automatically by GivenTake Devs.\nReply and a person will read it.";
  const draftFor = (runId, text = disclosure) => ({
    operator: "giventake-cro-pipeline",
    status: "awaiting_human_review",
    leadId: runId,
    offerSlug: "business-automation",
    draft: text,
    wordCount: 20,
    compliance: cfo,
    sendAuthorized: false,
    sideEffects: 0,
  });
  const conflictRun = JSON.parse(
    psql(
      `select operator_create_synthetic_lead_run('fixture:conflict-review','${fixture.replace("fixture-integration-1", "fixture-conflict-review").replace("electrical-contractor", "public-adjuster")}'::jsonb);`,
      "service_role",
    ),
  );
  assert.throws(() =>
    psql(
      `select operator_record_synthetic_cfo('${conflictRun.runId}','${JSON.stringify(cfo)}'::jsonb);`,
      "service_role",
    ),
  );
  assert.throws(() =>
    psql(
      `select operator_create_synthetic_lead_run('fixture:real-looking','${fixture
        .replace("Alex Fixture", "Alex Smith")
        .replace("Sample Electric", "Acme Electric")
        .replace("synthetic intake", "manual intake")}'::jsonb);`,
      "service_role",
    ),
  );
  assert.throws(() =>
    psql(
      `select operator_record_synthetic_cfo('${created.runId}','${JSON.stringify({ ...cfo, sendAuthorized: true })}'::jsonb);`,
      "service_role",
    ),
  );
  psql(
    `select operator_record_synthetic_cfo('${created.runId}','${JSON.stringify(cfo)}'::jsonb);`,
    "service_role",
  );
  const approval = JSON.parse(
    psql(
      `select operator_record_synthetic_draft_approval('${created.runId}','${JSON.stringify(draftFor(created.runId))}'::jsonb,now()+interval '1 day');`,
      "service_role",
    ),
  );
  assert.equal(approval.status, "pending");
  assert.match(approval.payloadHash, /^[0-9a-f]{64}$/);
  assert.equal(
    psql(
      `select encode(digest(convert_to(payload::text,'UTF8'),'sha256'),'hex')=payload_hash,approved_at is null,consumed_at is null from operator_approvals where id='${approval.approvalId}';`,
    ),
    "t|t|t",
  );
  assert.throws(() =>
    psql(
      `update operator_approvals set payload=payload||'{"forged":true}'::jsonb where id='${approval.approvalId}';`,
    ),
  );
  assert.throws(() =>
    psql(
      `select append_operator_audit_event('${created.runId}','wrong-operator','forged','{"synthetic":true}'::jsonb);`,
    ),
  );
  assert.equal(
    psql(
      `select string_agg(event_type,',' order by id) from operator_audit_events where run_id='${created.runId}';`,
    ),
    "synthetic_lead_persisted,cfo_compliance_decision,cro_draft_created,human_approval_queued",
  );
  const snapshot = JSON.parse(psql("select operator_dashboard_snapshot();", "service_role"));
  assert.ok(
    snapshot.runs.some(
      (run) =>
        run.id === created.runId &&
        run.lead.email === "alex@sample.invalid" &&
        run.compliance_result.decision === "pass",
    ),
  );
  assert.ok(
    snapshot.approvals.some((item) => item.id === approval.approvalId && item.status === "pending"),
  );
  assert.equal(
    psql(
      `select operator_approve_synthetic_draft('${approval.approvalId}','${"0".repeat(64)}','local:reviewer','wrong hash');`,
      "service_role",
    ),
    "f",
  );
  assert.throws(() =>
    psql(
      `select operator_approve_synthetic_draft('${approval.approvalId}','${approval.payloadHash}','browser:spoof','spoof');`,
      "service_role",
    ),
  );
  assert.equal(
    psql(
      `select operator_approve_synthetic_draft('${approval.approvalId}','${approval.payloadHash}','local:reviewer','acceptable synthetic draft');`,
      "service_role",
    ),
    "t",
  );
  assert.equal(
    psql(
      `select approved_at is not null,rejected_at is null,consumed_at is null,decided_by,decision_reason from operator_approvals where id='${approval.approvalId}';`,
    ),
    "t|t|t|local:reviewer|acceptable synthetic draft",
  );
  assert.equal(psql(`select status from operator_runs where id='${created.runId}';`), "completed");
  assert.equal(
    psql(
      `select operator_reject_synthetic_draft('${approval.approvalId}','${approval.payloadHash}','local:reviewer','second decision');`,
      "service_role",
    ),
    "f",
  );
  assert.equal(
    psql(
      `select count(*) from operator_audit_events where run_id='${created.runId}' and event_type='human_draft_approved' and details->>'payloadHash'='${approval.payloadHash}';`,
    ),
    "1",
  );
  const rejectedRun = JSON.parse(
    psql(
      `select operator_create_synthetic_lead_run('fixture:integration-reject','${fixture.replace("alex@sample.invalid", "reject@sample.invalid")}'::jsonb);`,
      "service_role",
    ),
  );
  psql(
    `select operator_record_synthetic_cfo('${rejectedRun.runId}','${JSON.stringify(cfo)}'::jsonb);`,
    "service_role",
  );
  assert.throws(() =>
    psql(
      `select operator_record_synthetic_draft_approval('${rejectedRun.runId}','${JSON.stringify(draftFor(rejectedRun.runId, "Act now for a guaranteed result.\nThis message was sent automatically by GivenTake Devs.\nReply and a person will read it."))}'::jsonb,now()+interval '1 day');`,
      "service_role",
    ),
  );
  assert.throws(() =>
    psql(
      `select operator_record_synthetic_draft_approval('${rejectedRun.runId}','${JSON.stringify(draftFor(rejectedRun.runId, "Synthetic fixture draft missing disclosure"))}'::jsonb,now()+interval '1 day');`,
      "service_role",
    ),
  );
  const rejectedApproval = JSON.parse(
    psql(
      `select operator_record_synthetic_draft_approval('${rejectedRun.runId}','${JSON.stringify(draftFor(rejectedRun.runId))}'::jsonb,now()+interval '1 day');`,
      "service_role",
    ),
  );
  assert.equal(
    psql(
      `select operator_reject_synthetic_draft('${rejectedApproval.approvalId}','${rejectedApproval.payloadHash}','local:reviewer','draft needs revision');`,
      "service_role",
    ),
    "t",
  );
  assert.equal(
    psql(
      `select r.status,a.rejected_at is not null,a.consumed_at is null from operator_runs r join operator_approvals a on a.run_id=r.id where a.id='${rejectedApproval.approvalId}';`,
    ),
    "blocked|t|t",
  );
  assert.equal(
    psql("select count(*) from operator_audit_events where event_type ~* 'sent|send_authorized';"),
    "0",
  );
  assert.throws(() =>
    psql(
      `select request_operator_approval('${created.runId}','send','{}'::jsonb,'${"a".repeat(64)}',now()+interval '1 day');`,
      "service_role",
    ),
  );
  psql("update operator_controls set enabled=false where operator_key='giventake-cfo-compliance';");
  assert.throws(() =>
    psql(
      `select operator_create_synthetic_lead_run('fixture:disabled-1','${fixture}'::jsonb);`,
      "service_role",
    ),
  );
  console.log("operator PostgreSQL integration: ok");
} finally {
  try {
    docker("rm", "-f", name);
  } catch {}
}
