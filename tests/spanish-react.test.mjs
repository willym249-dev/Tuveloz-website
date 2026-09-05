import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import test from "node:test";
import { createElement as h } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";

const require = createRequire(import.meta.url);
const modules = new Map();
function load(name) {
  if (!name.startsWith("./")) return require(name);
  if (modules.has(name)) return modules.get(name);
  const filename = new URL(`../lib/${name.slice(2)}.ts`, import.meta.url);
  const compiled = ts.transpileModule(readFileSync(filename, "utf8"), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  const exports = {};
  new Function("exports", "require", compiled)(exports, load);
  modules.set(name, exports);
  return exports;
}
const { spanishInterfaceTree: translate, spanishInterfaceHref } = load("./spanish-react");
const { spanishText } = load("./spanish-dictionary");

test("placeholders use reviewed display copy when no special placeholder wording exists", () => {
  for (const text of ["Tell us what should be added", "Suggest another provider feature", "Suggest another improvement"]) {
    const input = translate(h("input", { placeholder: text }));
    assert.equal(input.props.placeholder, spanishText[text]);
    assert.notEqual(input.props.placeholder, text);
  }
});

test("reviewed Spanish is already present in React's server output", () => {
  const tree = h("main", null, h("h1", null, "How it works"), h("p", null, "Unknown copy stays unchanged."));
  const output = renderToStaticMarkup(translate(tree));
  assert.ok(output.includes(spanishText["How it works"]));
  assert.ok(output.includes("Unknown copy stays unchanged."));
  assert.equal(tree.props.children[0].props.children, "How it works", "source elements must not be mutated");
});

test("translation preserves a button's identity and click handler", () => {
  const onClick = () => "clicked";
  const ref = { current: null };
  const source = h("button", { key: "continue", ref, onClick, type: "button" }, "How it works");
  const result = translate(source);
  assert.equal(result.key, source.key);
  assert.equal(result.props.ref, ref);
  assert.equal(result.props.onClick, onClick);
  assert.equal(result.props.onClick(), "clicked");
  assert.equal(result.props.type, "button");
});

test("form values stay in their original format while labels are translated", () => {
  const option = translate(h("option", null, "Battery replacement"));
  assert.equal(option.props.value, "Battery replacement");
  assert.equal(option.props.children, spanishText["Battery replacement"]);
  const input = translate(h("input", { name: "service", value: "Battery replacement", readOnly: true }));
  assert.equal(input.props.name, "service");
  assert.equal(input.props.value, "Battery replacement");
  const area = translate(h("textarea", { defaultValue: "How it works", "aria-label": "How it works" }));
  assert.equal(area.props.defaultValue, "How it works");
  assert.equal(area.props["aria-label"], spanishText["How it works"]);
});

test("manual language, entered content, code and styles remain untouched", () => {
  for (const tag of ["script", "style", "noscript"]) {
    const source = h(tag, null, "How it works");
    assert.equal(translate(source), source);
  }
  for (const attribute of ["data-manual-language", "data-no-interface-translation", "data-language-control"]) {
    const source = h("div", { [attribute]: true }, h("p", null, "How it works"));
    assert.equal(translate(source), source);
  }
});

test("Spanish navigation uses only reviewed routes and preserves attribution and anchors", () => {
  assert.equal(spanishInterfaceHref("/join?ref=local#provider-apply"), "/es/join?ref=local#provider-apply");
  assert.equal(spanishInterfaceHref("/"), "/es");
  for (const href of ["/account?role=provider", "/terms", "/es/join", "/api/reviews", "#provider-apply", "https://example.com/join", "//example.com/join"]) {
    assert.equal(spanishInterfaceHref(href), href);
  }
});
