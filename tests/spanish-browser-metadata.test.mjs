import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const modules = new Map();
function load(name) {
  if (modules.has(name)) return modules.get(name);
  const exports = {};
  modules.set(name, exports);
  const source = readFileSync(new URL(`../lib/${name}.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText;
  new Function("exports", "require", compiled)(exports, (path) => load(path.replace(/^\.\//, "")));
  return exports;
}
const { synchronizeSpanishMetadata } = load("spanish-browser-metadata");

function fixture() {
  let writes = 0;
  const elements = new Map([
    ['link[rel="canonical"]', { href: "https://tuveloz.com/join" }],
    ['meta[property="og:url"]', { content: "https://tuveloz.com/join" }],
    ['meta[property="og:locale"]', { content: "en_US" }],
    ['meta[property="og:title"]', { content: "Join as a Provider — Free Signup | Tuveloz" }],
    ['meta[name="description"]', { content: "An unknown description stays intact." }],
  ].map(([selector, attrs]) => [selector, {
    getAttribute: (name) => attrs[name] ?? null,
    setAttribute: (name, value) => { writes += 1; attrs[name] = value; },
  }]));
  const document = { querySelectorAll: (selector) => selector.split(",").map((s) => elements.get(s.trim())).filter(Boolean) };
  return { document, value: (selector, attribute) => elements.get(selector).getAttribute(attribute), writes: () => writes };
}

test("rendered Spanish provider metadata recovers from English hydration values", () => {
  const page = fixture();
  synchronizeSpanishMetadata(page.document, "/es/join");
  assert.equal(page.value('link[rel="canonical"]', "href"), "https://tuveloz.com/es/join");
  assert.equal(page.value('meta[property="og:url"]', "content"), "https://tuveloz.com/es/join");
  assert.equal(page.value('meta[property="og:locale"]', "content"), "es_US");
  assert.equal(page.value('meta[property="og:title"]', "content"), "Únase como proveedor — Registro gratis | Tuveloz");
  assert.equal(page.value('meta[name="description"]', "content"), "An unknown description stays intact.");
});

test("English, legal and unreviewed URLs do not acquire Spanish metadata", () => {
  for (const path of ["/join", "/terms", "/es/terms", "/es/missing"]) {
    const page = fixture();
    synchronizeSpanishMetadata(page.document, path);
    assert.equal(page.writes(), 0, path);
  }
});

test("Spanish homepage and trailing slashes use their canonical reviewed paths", () => {
  for (const [path, canonical] of [["/es/", "/es"], ["/es/join/", "/es/join"]]) {
    const page = fixture();
    synchronizeSpanishMetadata(page.document, path);
    assert.equal(page.value('link[rel="canonical"]', "href"), `https://tuveloz.com${canonical}`);
  }
});

test("reconciling already-correct metadata produces no further DOM mutations", () => {
  const page = fixture();
  synchronizeSpanishMetadata(page.document, "/es/join");
  const writes = page.writes();
  synchronizeSpanishMetadata(page.document, "/es/join");
  assert.equal(page.writes(), writes);
});

test("missing optional metadata does not break language rendering", () => {
  assert.doesNotThrow(() => synchronizeSpanishMetadata({ querySelectorAll: () => [] }, "/es/join"));
});
