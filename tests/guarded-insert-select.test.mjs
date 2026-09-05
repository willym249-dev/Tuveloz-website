import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { DatabaseSync } from "node:sqlite";
import test from "node:test";
import ts from "typescript";
import { and, eq, getTableColumns, getTableName, sql } from "drizzle-orm";
import { drizzle } from "drizzle-orm/sqlite-proxy";
import * as schema from "../db/schema.ts";

const db = drizzle(async () => { throw new Error("Only local SQLite may execute these queries."); });
const now = "2026-09-05T12:00:00.000Z";

// Execute the actual query expression from the route, not a hand-written copy
// of its SQL. Imports, network clients and request handlers are never run.
function routeQuery(path, name, values) {
  const source = ts.createSourceFile(path, readFileSync(new URL(`../${path}`, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
  let expression;
  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && node.name.getText(source) === name) expression = node.initializer?.getText(source);
    ts.forEachChild(node, visit);
  };
  visit(source);
  assert.ok(expression, `${path}: ${name} must still be exercised`);
  const compiled = ts.transpileModule(`return (${expression});`, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const context = { db, sql, and, eq, ...schema, ...values };
  return new Function(...Object.keys(context), compiled)(...Object.values(context)).toSQL();
}

function localDatabase(...tables) {
  const sqlite = new DatabaseSync(":memory:");
  for (const table of tables) {
    const columns = Object.values(getTableColumns(table)).map(column =>
      `"${column.name}" ${column.dataType === "number" ? "INTEGER" : "TEXT"}${column.primary ? " PRIMARY KEY" : ""}`);
    sqlite.exec(`CREATE TABLE "${getTableName(table)}" (${columns.join(", ")})`);
  }
  return sqlite;
}

function run(sqlite, query) {
  return sqlite.prepare(query.sql).all(...query.params);
}

test("checkout invalidation writes its actual guarded audit query with literal values", () => {
  const sqlite = localDatabase(schema.stripePayments, schema.jobLifecycleEvents);
  try {
    sqlite.prepare("INSERT INTO stripe_payments (id, status, updated_at) VALUES (?, ?, ?)")
      .run("payment-fixture", "checkout_invalidated_scope_change", now);
    const input = { requestId: "request-fixture", quoteId: "quote-fixture", providerId: "provider-fixture",
      requestStatus: "quote accepted", currentScopeVersion: 1, changedAt: now };
    const values = { input, payment: { id: "payment-fixture" }, eventId: "audit-fixture", eventType: "checkout_invalidated_before_scope_change",
      reasonCode: "old_checkout_url_expired_before_scope_or_price_change", eventDetails: "Owner's updated scope", previousEventHash: "", eventHash: "hash-fixture" };
    const query = routeQuery("app/api/job-operations/route.ts", "auditInsert", values);
    assert.equal(run(sqlite, query).length, 1);
    const row = sqlite.prepare("SELECT * FROM job_lifecycle_events").get();
    assert.equal(row.actor_role, "system");
    assert.equal(row.actor_id, "stripe-checkout-scope-guard");
    assert.equal(row.authorization_snapshot_id, "");
    assert.equal(row.details, "Owner's updated scope");
    sqlite.exec("DELETE FROM job_lifecycle_events; UPDATE stripe_payments SET status = 'checkout_open'");
    assert.equal(run(sqlite, query).length, 0, "an unchanged payment must not acquire an invalidation audit record");
  } finally { sqlite.close(); }
});

test("change-order acceptance stores its exact agreement values only while the order is pending", () => {
  const sqlite = localDatabase(schema.jobChangeOrders, schema.customerAgreementAcceptances);
  try {
    sqlite.prepare("INSERT INTO job_change_orders (id, status) VALUES (?, ?)").run("order-fixture", "pending_customer");
    const query = routeQuery("app/api/job-operations/route.ts", "acceptanceInsert", {
      acceptanceId: "acceptance-fixture", actor: { email: "fixture@tuveloz.invalid", sessionId: "session-fixture" },
      requestId: "request-fixture", context: { quoteId: "quote-fixture" }, order: { proposedScopeVersion: 2 },
      scopeSnapshot: "{}", JOB_OPERATIONS_RULES_VERSION: "fixture-version", agreementHash: "hash-fixture",
      agreementText: "Customer's exact authorization", acceptedByName: "Local Fixture", now,
      requestIp: () => "127.0.0.1", request: {}, deviceContext: "local-test",
      authorizationPrerequisite: and(eq(schema.jobChangeOrders.id, "order-fixture"), eq(schema.jobChangeOrders.status, "pending_customer")),
    });
    assert.equal(run(sqlite, query).length, 1);
    const row = sqlite.prepare("SELECT * FROM customer_agreement_acceptances").get();
    assert.equal(row.agreement_key, "change_order_authorization");
    assert.equal(row.acceptance_action, "affirmative-change-order-authorization-checkbox");
    assert.equal(row.agreement_text, "Customer's exact authorization");
    sqlite.exec("DELETE FROM customer_agreement_acceptances; UPDATE job_change_orders SET status = 'declined'");
    assert.equal(run(sqlite, query).length, 0);
  } finally { sqlite.close(); }
});

test("the approved scope query keeps its exact version and authorization binding", () => {
  const sqlite = localDatabase(schema.jobChangeOrders, schema.jobScopeVersions);
  try {
    sqlite.prepare("INSERT INTO job_change_orders (id, status) VALUES (?, ?)").run("order-fixture", "pending_customer");
    const query = routeQuery("app/api/job-operations/route.ts", "scopeInsert", {
      scopeVersionId: "scope-fixture", requestId: "request-fixture",
      context: { quoteId: "quote-fixture", jurisdiction: "fixture-jurisdiction", providerId: "provider-fixture", personId: "person-fixture" },
      order: { proposedScopeVersion: 2, scopeDetails: "Customer's updated scope", priceBreakdown: "{}", reason: "customer-requested", providerApprovedAt: now },
      serviceCodes: ["photo_documentation_only"], scheduledFor: now,
      scopeDetails: { partsResponsibility: "no-parts" }, clean: value => value,
      now, stageDecision: { result: { decisionId: "decision-fixture" } }, priorScope: { id: "previous-scope-fixture" },
      authorizationPrerequisite: and(eq(schema.jobChangeOrders.id, "order-fixture"), eq(schema.jobChangeOrders.status, "pending_customer")),
    });
    assert.equal(run(sqlite, query).length, 1);
    const row = sqlite.prepare("SELECT * FROM job_scope_versions").get();
    assert.equal(row.version, 2);
    assert.equal(row.authorization_decision_id, "decision-fixture");
    assert.equal(row.supersedes_scope_version_id, "previous-scope-fixture");
    assert.equal(row.scope_details, "Customer's updated scope");
    sqlite.exec("DELETE FROM job_scope_versions; UPDATE job_change_orders SET status = 'declined'");
    assert.equal(run(sqlite, query).length, 0);
  } finally { sqlite.close(); }
});

test("a scanner result is inserted only from its exact pending file record", () => {
  const sqlite = localDatabase(schema.evidenceFileScans);
  try {
    sqlite.prepare("INSERT INTO evidence_file_scans (id, evidence_submission_id, provider_id, file_hash, status) VALUES (?, ?, ?, ?, ?)")
      .run("pending-fixture", "evidence-fixture", "provider-fixture", "file-hash-fixture", "pending");
    const query = routeQuery("lib/evidence-scan-result-recorder.ts", "terminalInsert", {
      scanId: "result-fixture", provider: "fixture-scanner", engineVersion: "fixture-engine", status: "clean", now, scannedAt: now,
      resultId: "vendor-fixture", reportReference: "private-fixture-reference",
      pendingClaim: and(eq(schema.evidenceFileScans.id, "pending-fixture"), eq(schema.evidenceFileScans.status, "pending"),
        eq(schema.evidenceFileScans.fileHash, "file-hash-fixture")),
    });
    assert.equal(run(sqlite, query).length, 1);
    const row = sqlite.prepare("SELECT * FROM evidence_file_scans WHERE id = ?").get("result-fixture");
    assert.equal(row.evidence_submission_id, "evidence-fixture");
    assert.equal(row.provider_id, "provider-fixture");
    assert.equal(row.file_hash, "file-hash-fixture");
    assert.equal(row.status, "clean");
    assert.equal(row.reviewed_by, "authenticated_scanner:fixture-scanner");
    sqlite.exec("DELETE FROM evidence_file_scans WHERE id = 'result-fixture'; UPDATE evidence_file_scans SET status = 'result_received'");
    assert.equal(run(sqlite, query).length, 0, "a completed scan must not be reused for another result");
  } finally { sqlite.close(); }
});
