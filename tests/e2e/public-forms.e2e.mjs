// Real React forms with intercepted submissions: no real email or application.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { build } from "vite";

const root = fileURLToPath(new URL("../..", import.meta.url));
const outputDir = process.argv[2] ? resolve(process.argv[2]) : null;
if (outputDir) mkdirSync(outputDir, { recursive: true });
const builds = await build({
  root, configFile: false, envFile: false, logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  resolve: { alias: {
    "next/link": fileURLToPath(import.meta.resolve("vinext/shims/link")),
    "next/navigation": fileURLToPath(import.meta.resolve("vinext/shims/navigation")),
  } },
  build: {
    write: false,
    lib: { entry: resolve(root, "tests/e2e/fixtures/public-forms.tsx"), name: "PublicFormsFixture", formats: ["iife"] },
  },
});
const bundle = Array.isArray(builds) ? builds[0] : builds;
const assets = new Map(bundle.output.map(asset => ["/" + asset.fileName, asset.type === "chunk" ? asset.code : asset.source]));
const js = bundle.output.find(asset => asset.type === "chunk").fileName;
const css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
assets.set("/brand-badge.png", readFileSync(resolve(root, "public/brand-badge.png")));
const paths = ["/post-job", "/es/post-job", "/fleet"];
const server = createServer((request, response) => {
  const path = request.url.split("?")[0];
  if (assets.has(path)) {
    response.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : path.endsWith(".png") ? "image/png" : "text/javascript" });
    response.end(assets.get(path));
  } else if (request.method === "GET" && paths.includes(path)) {
    response.writeHead(200, { "content-type": "text/html" });
    response.end('<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/' + css + '"></head><body><div id="root"></div><script src="/' + js + '"></script></body></html>');
  } else {
    response.writeHead(404);
    response.end();
  }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = "http://127.0.0.1:" + server.address().port;
const json = (status, body) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const report = { testedAt: new Date().toISOString(), cases: [] };
const email = "reader@example.test";
const configurations = [
  { name: "updates-en", path: "/post-job", api: "/api/launch-updates/subscribe", kind: "updates", spanish: false },
  { name: "updates-es", path: "/es/post-job", api: "/api/launch-updates/subscribe", kind: "updates", spanish: true },
  { name: "fleet", path: "/fleet", api: "/api/fleet-inquiry", kind: "fleet", spanish: false },
];

const submitName = spec => spec.kind === "fleet" ? "Send fleet details" : spec.spanish ? "Recibir novedades" : "Get launch updates";
const busyName = spec => spec.kind === "fleet" ? "Sending…" : spec.spanish ? "Enviando…" : "Signing up…";
const doneSelector = spec => spec.kind === "fleet" ? ".fleet-form-done" : ".launch-updates-done";
const emailField = (page, spec) => page.getByRole("textbox", { name: spec.spanish ? "Correo electrónico" : "Email address", exact: true });
const failureMessage = spec => spec.kind === "fleet"
  ? "We couldn't confirm that your fleet details were received. Please try again."
  : spec.spanish ? "No pudimos confirmar su suscripción. Intente de nuevo." : "We couldn't confirm your signup. Please try again.";
const waitMessage = spec => spec.spanish ? "Espere un poco e intente de nuevo." : "Please wait a little, then try again.";

async function fillForm(page, spec) {
  if (spec.kind === "fleet") {
    await page.getByRole("textbox", { name: "Business name", exact: true }).fill("Example Fleet");
    await page.getByRole("textbox", { name: "Your name", exact: true }).fill("Test Reader");
    await page.getByRole("combobox", { name: "How many vehicles?", exact: true }).selectOption({ label: "2–5 vehicles" });
  }
  await emailField(page, spec).fill(email);
  if (spec.kind === "updates") {
    assert.equal(await page.getByRole("checkbox").isChecked(), false, "launch consent starts unchecked");
    await page.getByRole("checkbox").check();
  }
}

async function submit(page, spec) {
  const button = page.getByRole("button", { name: submitName(spec), exact: true });
  await button.scrollIntoViewIfNeeded();
  await page.waitForFunction(() => new Promise(done => {
    let previous = scrollY;
    let stable = 0;
    function measure() {
      stable = scrollY === previous ? stable + 1 : 0;
      previous = scrollY;
      if (stable >= 3) done(true);
      else requestAnimationFrame(measure);
    }
    requestAnimationFrame(measure);
  }));
  await button.click();
}

try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      async function run(spec, name, responses, action) {
        const context = await browser.newContext({ viewport: { width: browserType === webkit ? 320 : 390, height: 844 } });
        const page = await context.newPage();
        page.setDefaultTimeout(5000);
        const errors = [];
        const unexpected = [];
        const submissions = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("**/*", async route => {
          const request = route.request();
          const url = new URL(request.url());
          const expectedSubmission = url.pathname === spec.api && request.method() === "POST";
          if (url.origin !== origin || (!["GET", "HEAD"].includes(request.method()) && !expectedSubmission)) {
            unexpected.push(request.method() + " " + request.url());
            return route.abort();
          }
          if (url.pathname === "/api/account") return route.fulfill(json(401, { error: "Synthetic signed-out visitor" }));
          if (expectedSubmission) {
            const index = submissions.length;
            submissions.push(request.postDataJSON());
            const response = responses[Math.min(index, responses.length - 1)];
            if (response === null) return route.abort("failed");
            if (response.waitFor) await response.waitFor;
            return route.fulfill({ status: response.status, contentType: response.contentType, body: response.body });
          }
          return route.continue();
        });
        const result = { browser: browserType.name(), name: spec.name + "-" + name };
        try {
          await page.goto(origin + spec.path);
          await fillForm(page, spec);
          await action(page, submissions);
          assert.equal(submissions.length, responses.length, "one request per deliberate submission");
          assert.deepEqual(errors, [], "the form must not crash");
          assert.deepEqual(unexpected, [], "only synthetic submissions to the loopback fixture are allowed");
          result.layout = await page.evaluate(() => ({ width: innerWidth, scrollWidth: document.documentElement.scrollWidth }));
          assert.ok(result.layout.scrollWidth <= result.layout.width, "form feedback fits a phone");
          result.status = "passed";
        } catch (error) {
          result.status = "failed";
          result.error = error.stack ?? error.message;
        } finally {
          result.submissions = submissions.length;
          result.browserErrors = errors;
          if (outputDir && result.status === "failed") {
            await page.screenshot({ path: resolve(outputDir, result.browser + "-" + result.name + ".png"), fullPage: true });
          }
          await context.close();
        }
        report.cases.push(result);
        console.log(result.status.toUpperCase() + " " + result.browser + " " + result.name + (result.error ? ": " + result.error : ""));
      }

      for (const spec of configurations) {
        const success = json(spec.kind === "fleet" ? 201 : 202, { ok: true });
        const failures = [
          ["network-error", null, failureMessage(spec)],
          ["malformed-receipt", { status: 200, contentType: "text/html", body: "<html>Unexpected response</html>" }, failureMessage(spec)],
          ["missing-receipt", json(202, { ok: false }), failureMessage(spec)],
          ["rate-limit", json(429, { error: "Too many signups from here just now. Please try again later." }), waitMessage(spec)],
          spec.kind === "fleet"
            ? ["unexpected-server-error", json(500, { error: "INTERNAL_TEST_ERROR" }), failureMessage(spec)]
            : ["email-validation", json(400, { error: "Enter a valid email address." }), spec.spanish ? "Ingrese un correo electrónico válido." : "Enter a valid email address."],
        ];
        for (const [name, response, message] of failures) {
          await run(spec, name + "-recovery", [response, success], async (page, submissions) => {
            await submit(page, spec);
            await page.getByRole("alert").waitFor();
            assert.equal(await page.getByRole("alert").textContent(), message, "show a useful message in the selected language");
            assert.equal(await page.locator(doneSelector(spec)).count(), 0, "an unconfirmed request is never presented as success");
            assert.equal(await emailField(page, spec).inputValue(), email, "keep entered details for retry");
            await submit(page, spec);
            await page.locator(doneSelector(spec)).waitFor();
            assert.equal(await page.getByRole("alert").count(), 0);
            assert.deepEqual(submissions[1], submissions[0], "retry preserves the submitted details and consent");
            if (spec.kind === "updates") {
              assert.equal(submissions[1].language, spec.spanish ? "es" : "en");
              assert.equal(submissions[1].consent, true);
            }
          });
        }

        let release;
        const waitFor = new Promise(done => { release = done; });
        await run(spec, "fresh-consent-and-pending-receipt", [{ ...success, waitFor }], async (page, submissions) => {
          try {
            if (spec.kind === "fleet") {
              const phone = page.getByRole("textbox", { name: /^Phone \(optional\)/ });
              await phone.fill("2025550114");
              await page.getByRole("checkbox").check();
              await phone.fill("");
              await phone.fill("2025550150");
              assert.equal(await page.getByRole("checkbox").isChecked(), false, "a different phone number needs its own optional text consent");
            } else {
              await emailField(page, spec).fill("changed@example.test");
              assert.equal(await page.getByRole("checkbox").isChecked(), false, "changing the email clears the earlier consent");
              assert.equal(await page.getByRole("button", { name: submitName(spec), exact: true }).isDisabled(), true);
              await page.getByRole("checkbox").check();
            }
            await submit(page, spec);
            await page.getByRole("button", { name: busyName(spec), exact: true }).waitFor();
            assert.equal(await page.getByRole("button", { name: busyName(spec), exact: true }).isDisabled(), true);
            assert.equal(await page.locator("form input:not(:disabled), form select:not(:disabled), form textarea:not(:disabled)").count(), 0, "submitted details cannot change while receipt is pending");
            assert.equal(await page.locator(doneSelector(spec)).count(), 0, "wait for server acceptance");
          } finally {
            release();
          }
          await page.locator(doneSelector(spec)).waitFor();
          if (spec.kind === "fleet") {
            assert.equal(submissions[0].smsMarketingConsent, false, "optional text consent does not gate a fleet inquiry");
            assert.equal(submissions[0].contactPhone, "2025550150");
          } else {
            assert.equal(submissions[0].email, "changed@example.test");
            assert.equal(submissions[0].consent, true);
            assert.doesNotMatch(await page.locator(doneSelector(spec)).textContent(), /Check your email for the confirmation|Revise su correo para la confirmación/);
          }
        });
      }
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise(done => server.close(done));
  if (outputDir) writeFileSync(resolve(outputDir, "report.json"), JSON.stringify(report, null, 2));
}
assert.equal(report.cases.filter(result => result.status === "failed").length, 0, "all public form cases must pass");
