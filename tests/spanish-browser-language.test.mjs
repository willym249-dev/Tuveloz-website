import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
const routes = {};
new Function("exports", compile(read("lib/spanish-routes.ts")))(routes);
const source = read("app/components/site-language.tsx");
const helpers = source.slice(source.indexOf("let inMemoryLanguage:"), source.indexOf("const SiteLanguageContext"));
function languageClient(pathname, saved = "en", blocked = false, search = "?source=test") {
  const assigned = [];
  const events = [];
  const window = {
    location: { pathname, search, hash: "#provider-apply", assign(value) { assigned.push(value); } },
    history: { state: { retained: true }, replaceState(state, _unused, href) {
      assert.deepEqual(state, { retained: true });
      const url = new URL(href, "https://tuveloz.com");
      window.location.search = url.search;
      window.location.hash = url.hash;
    } },
    localStorage: { getItem() { if (blocked) throw Error("blocked"); return saved; }, setItem(_key, value) { if (blocked) throw Error("blocked"); saved = value; } },
    dispatchEvent(event) { events.push(event.type); },
  };
  const methods = new Function("exports", "window", "englishPathFor", "pathHasSpanish", "LANGUAGE_KEY", "LANGUAGE_EVENT",
    `${compile(helpers)}; return {getLanguageSnapshot, setStoredLanguage};`,
  )({}, window, routes.englishPathFor, routes.pathHasSpanish, "test-language", "test-language-change");
  return { ...methods, assigned, events, location: window.location };
}

test("account language hints work before storage and stay consistent after switching", () => {
  const client = languageClient("/account", "en", true, "?role=customer&mode=create&lang=es");
  assert.equal(client.getLanguageSnapshot(), "es");
  client.setStoredLanguage("en");
  assert.equal(client.getLanguageSnapshot(), "en");
  assert.equal(client.location.search, "?role=customer&mode=create&lang=en");
  assert.equal(client.location.hash, "#provider-apply");
  assert.deepEqual(client.assigned, []);
  assert.equal(languageClient("/account", "es", false, "?lang=en").getLanguageSnapshot(), "en");
  assert.equal(languageClient("/account", "es", false, "?lang=invalid").getLanguageSnapshot(), "es");
  assert.equal(languageClient("/customer-agreement", "es", false, "?lang=es").getLanguageSnapshot(), "en");
});

test("private privacy language hints preserve data scope and work without browser storage", () => {
  const client = languageClient("/privacy-center", "en", true, "?scope=provider&lang=es");
  assert.equal(client.getLanguageSnapshot(), "es");
  client.setStoredLanguage("en");
  assert.equal(client.getLanguageSnapshot(), "en");
  assert.equal(client.location.search, "?scope=provider&lang=en");
  assert.deepEqual(client.assigned, [], "language switching must preserve the open form");
  client.setStoredLanguage("es");
  assert.equal(client.getLanguageSnapshot(), "es");
});

test("privacy sign-in returns preserve language without changing other account destinations", () => {
  const account = read("app/account/page.tsx");
  const helper = account.slice(account.indexOf("function destinationAfterSignIn("), account.indexOf("export default function AccountPage"));
  function destination(search) {
    return new Function("exports", "window", `${compile(helper)}; return destinationAfterSignIn('/customer');`)({}, { location: { search } });
  }
  assert.equal(destination("?privacy=1&lang=es"), "/privacy-center?lang=es");
  assert.equal(destination("?privacy=1&lang=en"), "/privacy-center?lang=en");
  assert.equal(destination("?privacy=1&lang=invalid"), "/privacy-center");
  assert.equal(destination("?lang=es"), "/customer");
});

test("explicit Spanish URLs stay Spanish with an English saved preference", () => {
  for (const path of ["/es", "/es/", "/es/join", "/es/post-job"]) {
    assert.equal(languageClient(path).getLanguageSnapshot(), "es", path);
  }
});

test("legal and unknown pages stay English regardless of saved preference", () => {
  for (const path of ["/customer-agreement", "/es/customer-agreement", "/es/account", "/unknown"]) {
    assert.equal(languageClient(path, "es").getLanguageSnapshot(), "en", path);
  }
});

test("account controls retain Spanish and can switch even when storage is blocked", () => {
  assert.equal(languageClient("/account", "es").getLanguageSnapshot(), "es");
  const client = languageClient("/account", "en", true);
  client.setStoredLanguage("es");
  assert.equal(client.getLanguageSnapshot(), "es");
  client.setStoredLanguage("en");
  assert.equal(client.getLanguageSnapshot(), "en");
  assert.deepEqual(client.assigned, [], "changing account language must not navigate or discard form state");
});

test("blocked browser storage does not break language selection", () => {
  const client = languageClient("/join", "en", true);
  assert.equal(client.getLanguageSnapshot(), "en");
  client.setStoredLanguage("es");
  assert.equal(client.getLanguageSnapshot(), "es");
  assert.deepEqual(client.events, ["test-language-change"]);
  assert.equal(languageClient("/es/join", "en", true).getLanguageSnapshot(), "es");
});

test("returning from an explicit Spanish URL preserves query and application anchor", () => {
  const client = languageClient("/es/join", "es");
  client.setStoredLanguage("en");
  assert.deepEqual(client.assigned, ["/join?source=test#provider-apply"]);
});

test("the language provider preserves page-specific titles and offers the Spanish-page switch", () => {
  assert.doesNotMatch(source, /document\.title\s*=/);
  assert.match(source, /translateInterface\(document\.head, language\)/);
  assert.match(source, /const ready = pathHasSpanish\(englishPathFor\(window\.location\.pathname\) \?\? window\.location\.pathname\)/);
});
