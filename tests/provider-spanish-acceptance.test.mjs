import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const read = path => readFileSync(new URL(path, root), "utf8");
const hash = text => createHash("sha256").update(text.replaceAll("\r\n", "\n")).digest("hex");
const require = createRequire(import.meta.url);
const modules = new Map();
function load(path, parent = root) {
  if (!path.startsWith(".")) return require(path);
  let url = new URL(path, parent);
  if (url.pathname.endsWith(".json")) return JSON.parse(readFileSync(url, "utf8"));
  if (!url.pathname.endsWith(".ts")) url = new URL(`${url.href}.ts`);
  if (modules.has(url.href)) return modules.get(url.href);
  const exports = {};
  const compiled = ts.transpileModule(readFileSync(url, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true },
  }).outputText;
  modules.set(url.href, exports);
  new Function("exports", "require", compiled)(exports, name => load(name, url));
  return exports;
}
const acceptance = load("./lib/provider-policy-acceptance");
const copy = load("./lib/provider-policy-spanish-text");
const englishReleases = JSON.parse(read("config/policy-releases.json"));
const spanishReleases = JSON.parse(read("config/policy-spanish-releases.json"));
const { PROVIDER_ACCEPTANCE_DOCUMENTS: documents, providerAgreementEvidenceText: evidence,
  providerAgreementEvidenceCandidates: candidates } = acceptance;

test("each Spanish policy release pins its complete source and English version", () => {
  assert.deepEqual(Object.keys(spanishReleases).sort(), [...documents.map(doc => doc.key), "customer_agreement"].sort());
  for (const [key, release] of Object.entries(spanishReleases)) {
    const doc = { key };
    const source = read(release.sourceFile);
    const english = read(englishReleases[doc.key].sourceFile);
    assert.equal(release.translationBodyHash, hash(source), doc.key);
    assert.equal(release.englishBodyHash, hash(english), doc.key);
    if (key === "customer_agreement") {
      assert.equal(release.acceptanceTextHash, undefined, "a translated customer page does not claim provider consent");
    } else {
      assert.equal(release.acceptanceTextHash, hash(read("lib/provider-policy-spanish-text.ts")));
    }
    assert.match(release.releaseId, /-es-\d{4}-\d{2}-\d{2}$/);
    // No omitted section or list item; translations are static, trusted HTML.
    for (const tag of ["h2", "h3", "li"]) {
      assert.equal((source.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length,
        (english.match(new RegExp(`<${tag}[ >]`, "g")) ?? []).length, `${doc.key}: ${tag} coverage`);
    }
    assert.doesNotMatch(source, /<script|\son\w+=|javascript:|\$\{/i);
    for (const [, href] of source.matchAll(/href="([^"]+)"/g)) {
      assert.ok(href.startsWith("/") || href.startsWith("https://") || href.startsWith("mailto:"), href);
    }
  }
});

test("the complete customer translation preserves paragraphs and routes independently of launch approval", () => {
  const { default: customer } = load("./lib/policy-spanish/customer-agreement");
  const english = read("app/customer-agreement/page.tsx");
  assert.equal((customer.html.match(/<section>/g) ?? []).length, 11);
  assert.equal((customer.html.match(/<p>/g) ?? []).length, (english.match(/<p>/g) ?? []).length);
  for (const phrase of ["TUVELOZ LLC", "Stripe", "5% del subtotal del proveedor", "antes de que comience el trabajo autorizado", "no se descuenta de ese reembolso"]) {
    assert.ok(customer.html.includes(phrase), phrase);
  }
  for (const href of ["/es/terms", "/es/payments", "mailto:hello@tuveloz.com"]) {
    assert.ok(customer.html.includes(`href="${href}"`), href);
  }
  const { spanishPolicyForTitle } = load("./lib/policy-spanish/index");
  assert.equal(spanishPolicyForTitle("Customer Agreement"), customer);
  const { pathHasSpanish, englishPathFor } = load("./lib/spanish-routes");
  assert.equal(pathHasSpanish("/customer-agreement"), true);
  assert.equal(englishPathFor("/es/customer-agreement"), "/customer-agreement");
  assert.equal(load("./lib/launch-status").CUSTOMER_JOB_POSTING_PAUSED, true);
});

test("Spanish evidence contains the displayed text and exact translation, while English keeps its existing envelope", async () => {
  for (const doc of documents) {
    const en = evidence(doc);
    const currentEnglishHashes = JSON.parse(read("tests/fixtures/provider-english-acceptance-hashes.json"));
    assert.equal(hash(en), currentEnglishHashes[doc.key], "current release acceptance bytes must match the reviewed fixture");
    const es = evidence(doc, { language: "es" });
    assert.equal(evidence(doc, { language: "Spanish" }), es);
    const parsed = JSON.parse(es);
    assert.equal(parsed.presentedText, doc.control === "terms-bundle"
      ? copy.PROVIDER_TERMS_ACCEPTANCE_TEXT_ES : copy.PROVIDER_PRIVACY_ACKNOWLEDGMENT_TEXT_ES);
    assert.equal(parsed.presentation.translationBodyHash, spanishReleases[doc.key].translationBodyHash);
    assert.equal(parsed.presentation.href, `/es${doc.href}`);
    const enParsed = JSON.parse(en);
    assert.equal(enParsed.presentedText, doc.presentedText);
    assert.equal(enParsed.presentation, undefined);
    assert.equal(enParsed.schemaVersion, "2");
    const allowed = await candidates(doc);
    assert.equal(allowed.length, 2);
    for (const text of [en, es]) assert.ok(allowed.some(item => item.text === text && item.hash === hash(text)));
    const tampered = JSON.stringify({ ...parsed, presentedText: "Acepto" });
    assert.ok(!allowed.some(item => item.text === tampered && item.hash === hash(tampered)));
    assert.ok(!allowed.some(item => item.text === es && item.hash === hash(en)), "mixed-language hash must fail");
    const draft = { ...doc, releaseStatus: "draft", canonicalBodyHash: "" };
    assert.deepEqual(await candidates(draft), [], "drafts cannot qualify a provider in either language");
    assert.throws(() => evidence({ ...doc, canonicalBodyHash: "a".repeat(64) }, { language: "es" }), /not current/);
    assert.throws(() => evidence(doc, { language: "es", asOf: new Date("2026-09-06") }), /not current/);
  }
});

for (const [release, changed] of [
  ["20260907", ["terms", "provider_agreement", "payment_policy"]],
  ["20260930", ["terms", "provider_agreement"]],
  ["20261005", ["provider_agreement"]],
]) {
  test(`current policies reject ${release} browser consent without relabeling historical acceptance`, async () => {
    const historicalHashes = JSON.parse(read(`tests/fixtures/provider-english-acceptance-hashes-${release}.json`));
    const historicalPresentations = JSON.parse(read(`tests/fixtures/provider-policy-presentations-${release}.json`));
    const changedKeys = new Set(changed);
    for (const locale of ["en", "es"]) {
      const oldText = historicalPresentations[locale];
      const oldDocuments = JSON.parse(oldText).documents;
      const currentDocuments = JSON.parse(acceptance.providerPolicyPresentation(locale)).documents;
      assert.equal(acceptance.providerPolicyPresentationLanguage(oldText), null);
      for (const current of currentDocuments) {
        const old = oldDocuments.find(doc => doc.key === current.key);
        if (changedKeys.has(current.key)) {
          assert.notEqual(current.version, old.version);
          assert.notEqual(current.releaseId, old.releaseId);
          assert.notEqual(current.canonicalBodyHash, old.canonicalBodyHash);
          if (locale === "es") assert.notEqual(current.translation.translationBodyHash, old.translation.translationBodyHash);
        } else {
          assert.deepEqual(current, old, `${current.key}: unchanged release stays byte-compatible`);
        }
      }
      assert.equal(historicalPresentations[locale], oldText, "historical evidence stays intact");
    }
    for (const doc of documents) {
      const allowed = await candidates(doc);
      if (changedKeys.has(doc.key)) {
        assert.ok(allowed.every(item => item.hash !== historicalHashes[doc.key]), "old consent cannot qualify as a new policy acceptance");
      } else {
        assert.equal(hash(evidence(doc)), historicalHashes[doc.key]);
      }
    }
  });
}

test("challenge binding and final writes use the verified presentation language consistently", () => {
  const verify = read("lib/provider-application-verification.ts");
  const route = read("app/api/providers/route.ts");
  assert.match(verify, /providerPolicyPresentationLanguage\(body.policyPresentation\)/);
  assert.match(verify, /providerApplicationDocumentBaseManifest\(application.agreementLanguage\)/);
  assert.match(route, /providerApplicationFinalDocumentManifest\(\s*verified.challenge.id,\s*application.agreementLanguage/);
  assert.match(route, /providerAgreementEvidenceText\(document, \{\s*acceptanceEvidenceId: verified.challenge.id,\s*language: application.agreementLanguage/);
});

test("a stale or unversioned browser cannot claim the current policy presentation", () => {
  const { providerPolicyPresentation: presentation, providerPolicyPresentationLanguage: language } = acceptance;
  const fixtures = JSON.parse(read("tests/fixtures/provider-policy-presentations.json"));
  for (const locale of ["en", "es"]) {
    const current = presentation(locale);
    assert.equal(fixtures[locale], current, "fixture pins the exact browser presentation");
    assert.equal(language(current), locale);
    const parsed = JSON.parse(current);
    for (const changed of [
      { ...parsed, termsText: "An old agreement" },
      { ...parsed, language: locale === "en" ? "es" : "en" },
      { ...parsed, documents: parsed.documents.slice(1) },
      { ...parsed, documents: parsed.documents.map((doc, index) => index ? doc : { ...doc, canonicalBodyHash: "a".repeat(64) }) },
    ]) assert.equal(language(JSON.stringify(changed)), null);
  }
  for (const missing of [undefined, null, "", "Spanish", {}, []]) assert.equal(language(missing), null);
});

test("partial certificate drafts survive without admitting incomplete server submissions", () => {
  const { cleanOptionalCertificateDraft: draft, cleanOptionalCertificates: submit } = load("./lib/optional-certificates");
  const partial = { category: "ase", title: "", credentialIdentifier: "12345", issuingAuthority: "ASE" };
  assert.deepEqual(draft([partial]), [partial]);
  assert.deepEqual(submit([partial]), []);
  assert.deepEqual(draft([null, false, { category: "unknown" }]), []);
  assert.equal(draft(Array(30).fill(partial)).length, 12);
  assert.equal(draft([{ ...partial, title: "a".repeat(300) }])[0].title.length, 120);
  assert.equal(submit([...Array(20).fill(partial), { ...partial, title: "Completed" }]).length, 1);
});
