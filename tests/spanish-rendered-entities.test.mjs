import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
const dictionarySource = read("lib/spanish-dictionary.ts");
const dictionaryModule = { exports: {} };
const compile = (source) => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
new Function("exports", compile(dictionarySource))(dictionaryModule.exports);
const helper = { exports: {} };
new Function("exports", "require", compile(read("lib/spanish-html.ts")))(
  helper.exports, () => dictionaryModule.exports,
);
const page = read("worker/spanish-page.ts");
const classSource = page.slice(page.indexOf("class TranslateRun {"), page.indexOf("/**\n * The Spanish twin"));
const TranslateRun = new Function("exports", "translateText", "decodeRenderedText",
  `${compile(classSource)}; return TranslateRun;`,
)({}, helper.exports.translateText, helper.exports.decodeRenderedText);

function rewrite(parts) {
  const handler = new TranslateRun();
  const output = [];
  parts.forEach((text, i) => handler.text({
    text, lastInTextNode: i === parts.length - 1,
    remove() {}, replace(value, options) { output.push({ value, ...options }); },
  }));
  return output;
}

test("rendered apostrophes translate even when an entity crosses chunk boundaries", () => {
  const plain = "We're onboarding providers for the services customers will need. Customer requests open once the marketplace is ready.";
  const expected = dictionaryModule.exports.spanishText[plain];
  assert.ok(expected);
  const encoded = plain.replace("'", "&#x27;");
  const split = encoded.indexOf("x27");
  assert.deepEqual(rewrite([encoded.slice(0, split), encoded.slice(split)]), [{ value: expected, html: false }]);
});

test("unknown escaped copy preserves the original bytes without double escaping", () => {
  assert.deepEqual(rewrite(["Unknown &amp; name: caf&eacute; &#39;test&#39;"]), [
    { value: "Unknown &amp; name: caf&eacute; &#39;test&#39;", html: true },
  ]);
});

test("encoded markup stays encoded in the unchanged fallback", () => {
  const encoded = "&lt;img src=x onerror=alert(1)&gt;";
  assert.deepEqual(rewrite([encoded]), [{ value: encoded, html: true }]);
});

test("entities are decoded once for matching, including React punctuation", () => {
  assert.equal(helper.exports.decodeRenderedText("&amp;#x27; &quot; &#39; &#x3c; &gt;"), "&#x27; \" ' < >");
  assert.equal(helper.exports.decodeRenderedText("&#x110000; &unknown;"), "&#x110000; &unknown;");
});

test("opaque script and style text is untouched by the translator", () => {
  const handler = new TranslateRun();
  handler.enterOpaque();
  handler.text({ text: "&#x27;", lastInTextNode: true,
    remove() { assert.fail("opaque text removed"); },
    replace() { assert.fail("opaque text rewritten"); },
  });
  handler.leaveOpaque();
});
