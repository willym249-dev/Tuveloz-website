import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import ts from "typescript";
const root = fileURLToPath(new URL("../", import.meta.url));
const cache = new Map();
function pureModule(file) {
  file = resolve(root, file);
  if (!existsSync(file)) file += ".ts";
  if (cache.has(file)) return cache.get(file);
  if (file.endsWith(".json")) return JSON.parse(readFileSync(file, "utf8"));
  const exports = {}; cache.set(file, exports);
  const js = ts.transpileModule(readFileSync(file, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
  new Function("require", "exports", js)(specifier => {
    assert.ok(specifier.startsWith("."), "Only local pure policy modules can load");
    return pureModule(resolve(dirname(file), specifier));
  }, exports);
  return exports;
}
const identity = pureModule("lib/identity-verification-policy.ts");
const policy = pureModule("lib/provider-policy-acceptance.ts");
const account = { session: { id: "test-session", role: "provider", email: "test@example.invalid" }, provider: { id: "test-provider", preferredLanguage: "Spanish" } };
function routeHarness(path) {
  const writes = [], audits = [];
  let reads = 0;
  const query = new Proxy({}, { get: (_target, key) => key === "then" ? resolve => resolve([]) : () => query });
  const db = { select: () => { reads++; return query; }, insert: () => ({ values: value => { writes.push(value); return query; } }) };
  const bindings = {
    getDb: () => db, eq: () => null, and: () => null, desc: () => null,
    getAccountSession: async () => account.session, providerApplicationFor: async () => account.provider,
    isSameOriginRequest: () => true, isStrictSameOriginWriteRequest: () => true,
    identityClaimSessionHash: async () => "synthetic-session-digest",
    readLimitedJsonObject: async request => request.json(),
    recordProviderAuditEvent: async value => { audits.push(value); },
    POLICY_STATUS: "draft_pending_mandatory_compliance_insurance_tax", POLICY_JURISDICTION: "US-MD-MontgomeryCounty",
    ...identity, ...policy,
  };
  let source = readFileSync(resolve(root, path), "utf8");
  // The response read is separately browser-tested. Keep the actual POST,
  // validation, evidence generation, hashes, audit and insert operations here.
  const ast = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const response = ast.statements.find(node => ts.isFunctionDeclaration(node) && node.name?.text === "responseData");
  if (response) source = source.slice(0, response.getStart(ast)) + 'async function responseData() { return {}; }' + source.slice(response.end);
  if (path.includes("provider-identity-verification")) source += "\nexport { createAttempt };";
  const js = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const exports = {};
  const dependencies = new Proxy(bindings, { get: (target, key) => key in target ? target[key] : {} });
  new Function("require", "exports", js)(() => dependencies, exports);
  return { ...exports, writes, audits, reads: () => reads };
}
const request = body => new Request("https://tuveloz.com/api/provider-onboarding", { method: "POST", headers: { "content-type": "application/json", origin: "https://tuveloz.com" }, body: JSON.stringify(body) });
const agreementBody = { action: "accept-current-agreements", signerName: "Test Signer", signerTitle: "Owner", termsBundleAccepted: true, privacyAcknowledged: true };

test("onboarding records the displayed English or Spanish policies, independently of contact language", async () => {
  for (const language of ["en", "es"]) {
    const route = routeHarness("app/api/provider-onboarding/route.ts");
    const result = await route.POST(request({ ...agreementBody, policyPresentation: policy.providerPolicyPresentation(language) }));
    assert.equal(result.status, 200);
    assert.equal(route.writes.length, policy.PROVIDER_ACCEPTANCE_DOCUMENTS.length);
    for (const record of route.writes) {
      const document = policy.PROVIDER_ACCEPTANCE_DOCUMENTS.find(item => item.key === record.agreementKey);
      const expected = policy.providerAgreementEvidenceText(document, { language, purpose: "provider_eligibility", acceptanceEvidenceId: record.sessionId, asOf: new Date(record.acceptedAt) });
      assert.equal(record.agreementText, expected);
      assert.equal(record.agreementHash, await policy.sha256Text(expected));
      assert.equal(JSON.parse(record.deviceContext).presentationLanguage, language);
    }
    assert.equal(route.audits.at(-1).metadata.presentationLanguage, language);
  }
});

test("old English onboarding forms stay compatible; stale or altered policy copy cannot write acceptance", async () => {
  const legacy = routeHarness("app/api/provider-onboarding/route.ts");
  assert.equal((await legacy.POST(request(agreementBody))).status, 200);
  assert.equal(JSON.parse(legacy.writes[0].deviceContext).presentationLanguage, "en");
  for (const value of [null, "", "es", policy.providerPolicyPresentation("es").replace('"schemaVersion":"1"', '"schemaVersion":"0"'), JSON.stringify({ ...JSON.parse(policy.providerPolicyPresentation("es")), termsText: "Changed consent" })]) {
    const route = routeHarness("app/api/provider-onboarding/route.ts");
    assert.equal((await route.POST(request({ ...agreementBody, policyPresentation: value }))).status, 409);
    assert.deepEqual(route.writes, []);
    assert.deepEqual(route.audits, []);
  }
});

test("identity copy has immutable language versions and rejects any changed consent before database or vendor work", async () => {
  const consents = { identityConsentAcknowledged: true, adultVerificationAcknowledged: true, samePersonCertificationAcknowledged: true };
  for (const language of ["en", "es"]) {
    const copy = identity.identityConsentCopy(language);
    assert.equal(identity.identityConsentPresentationLanguage(identity.identityConsentPresentation(language)), language);
    assert.equal(JSON.parse(identity.identityConsentPresentation(language)).document, copy.document);
    const route = routeHarness("app/api/provider-identity-verification/route.ts");
    // Exercise the real insert. The empty synthetic read prevents all Stripe calls.
    await assert.rejects(() => route.createAttempt(request({}), account, "test-person", "test-evidence", [], language), /could not be claimed/);
    assert.equal(route.writes.length, 1);
    assert.equal(route.writes[0].certificationVersion, copy.version);
    assert.ok(route.writes[0].consentedAt);
  }
  assert.notEqual(identity.identityConsentCopy("en").version, identity.identityConsentCopy("es").version);
  assert.equal(identity.identityConsentCopy("en").version, identity.IDENTITY_VERIFICATION_CONSENT_VERSION);
  assert.equal(identity.identityConsentPresentationLanguage(undefined), "en");
  for (const value of [null, "", "es", identity.identityConsentPresentation("es").replace("biométrica", "visual"), identity.identityConsentPresentation("es").replace("es-v1", "es-v0")]) {
    const route = routeHarness("app/api/provider-identity-verification/route.ts");
    assert.equal((await route.POST(request({ ...consents, consentPresentation: value }))).status, 409);
    assert.equal(route.reads(), 0);
    assert.deepEqual(route.writes, []);
    assert.deepEqual(route.audits, []);
  }
});


test("Spanish renewal and attempt messages use the right singular and plural", () => {
  const { translatedValue } = pureModule("lib/spanish-interface-text.ts");
  assert.equal(translatedValue("Expires on 2030-12-31 (1 day remaining)"), "Vence el 2030-12-31 (queda 1 día)");
  assert.equal(translatedValue("Expires on 2030-12-31 (2 days remaining)"), "Vence el 2030-12-31 (quedan 2 días)");
  assert.equal(translatedValue(" 1 of 3 attempts remain today."), " Queda 1 de 3 intentos hoy.");
  assert.equal(translatedValue(" 2 of 3 attempts remain today."), " Quedan 2 de 3 intentos hoy.");
});
