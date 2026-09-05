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
function languageClient(pathname, saved = "en", blocked = false) {
  const assigned = [];
  const events = [];
  const window = {
    location: { pathname, search: "?source=test", hash: "#provider-apply", assign(value) { assigned.push(value); } },
    localStorage: { getItem() { if (blocked) throw Error("blocked"); return saved; }, setItem(_key, value) { if (blocked) throw Error("blocked"); saved = value; } },
    dispatchEvent(event) { events.push(event.type); },
  };
  const methods = new Function("exports", "window", "englishPathFor", "pathHasSpanish", "LANGUAGE_KEY", "LANGUAGE_EVENT",
    `${compile(helpers)}; return {getLanguageSnapshot, setStoredLanguage};`,
  )({}, window, routes.englishPathFor, routes.pathHasSpanish, "test-language", "test-language-change");
  return { ...methods, assigned, events };
}

test("explicit Spanish URLs stay Spanish with an English saved preference", () => {
  for (const path of ["/es", "/es/", "/es/join", "/es/post-job"]) {
    assert.equal(languageClient(path).getLanguageSnapshot(), "es", path);
  }
});

test("legal and unknown pages stay English regardless of saved preference", () => {
  for (const path of ["/terms", "/es/terms", "/account", "/unknown"]) {
    assert.equal(languageClient(path, "es").getLanguageSnapshot(), "en", path);
  }
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
