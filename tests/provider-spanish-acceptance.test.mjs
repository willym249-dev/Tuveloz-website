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

test("each Spanish policy release pins its complete source, English version and acceptance text", () => {
  assert.deepEqual(Object.keys(spanishReleases).sort(), documents.map(doc => doc.key).sort());
  for (const doc of documents) {
    const release = spanishReleases[doc.key];
    const source = read(release.sourceFile);
    const english = read(englishReleases[doc.key].sourceFile);
    assert.equal(release.translationBodyHash, hash(source), doc.key);
    assert.equal(release.englishBodyHash, hash(english), doc.key);
    assert.equal(release.acceptanceTextHash, hash(read("lib/provider-policy-spanish-text.ts")));
    assert.ok(release.releaseId.endsWith("-es-2026-09-07"));
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

test("Spanish evidence contains the displayed text and exact translation, while English keeps its existing envelope", async () => {
  for (const doc of documents) {
    const en = evidence(doc);
    const previousEnglishHashes = JSON.parse(read("tests/fixtures/provider-english-acceptance-hashes.json"));
    assert.equal(hash(en), previousEnglishHashes[doc.key], "existing English acceptance bytes must stay valid");
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

test("challenge binding and final writes use the submitted language consistently", () => {
  const verify = read("lib/provider-application-verification.ts");
  const route = read("app/api/providers/route.ts");
  assert.match(verify, /providerApplicationDocumentBaseManifest\(application.preferredLanguage\)/);
  assert.match(route, /providerApplicationFinalDocumentManifest\(\s*verified.challenge.id,\s*application.preferredLanguage/);
  assert.match(route, /providerAgreementEvidenceText\(document, \{\s*acceptanceEvidenceId: verified.challenge.id,\s*language: application.preferredLanguage/);
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
