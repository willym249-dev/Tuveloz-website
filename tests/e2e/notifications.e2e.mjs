// Real notification component; all accounts and responses are synthetic/local.
import assert from "node:assert/strict";
import { mkdirSync, readFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { build } from "vite";

const root = fileURLToPath(new URL("../..", import.meta.url));
const output = process.argv[2] ? resolve(process.argv[2]) : null;
if (output) mkdirSync(output, { recursive: true });
const built = await build({ root, configFile: false, envFile: false, logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  resolve: { alias: { "next/link": fileURLToPath(import.meta.resolve("vinext/shims/link")),
    "next/navigation": fileURLToPath(import.meta.resolve("vinext/shims/navigation")) } },
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/notifications.tsx"), name: "NotificationsFixture", formats: ["iife"] } },
});
const bundle = Array.isArray(built) ? built[0] : built;
const assets = new Map(bundle.output.map(asset => ["/" + asset.fileName, asset.type === "chunk" ? asset.code : asset.source]));
const js = bundle.output.find(asset => asset.type === "chunk").fileName;
const css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
assets.set("/brand-badge.png", readFileSync(resolve(root, "public/brand-badge.png")));
const server = createServer((request, response) => {
  const path = request.url.split("?")[0];
  response.writeHead(200, { "content-type": assets.has(path) ? path.endsWith(".png") ? "image/png" : path.endsWith(".css") ? "text/css" : "text/javascript" : "text/html" });
  response.end(assets.get(path) ?? (path === "/notifications"
    ? `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`
    : `<html><body><h1>Destination ${path}</h1></body></html>`));
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const item = { id: "synthetic-welcome", title: "Thank you for joining Tuveloz", body: "Your customer account is ready. Open your workspace to review your details and see what is available.", href: "/customer", readAt: "", createdAt: "2026-09-26 12:00:00" };
const snapshot = (role = "customer", read = false) => ({ role, email: "account@example.invalid", notifications: [{ ...item,
  href: role === "customer" ? "/customer" : "/provider-jobs", readAt: read ? "2026-09-26T13:00:00Z" : "" }], unreadCount: read ? 0 : 1 });
const reply = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const failed = reply({ error: "SYNTHETIC failure" }, 503);
const success = reply({ ok: true });
const readButton = page => page.getByRole("button", { name: "Mark all as read", exact: true });
const refresh = page => page.getByRole("button", { name: "Refresh notifications", exact: true });
try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      async function run(name, responses, action, clock = false) {
        const context = await browser.newContext({ viewport: { width: browserType === webkit ? 320 : 390, height: 844 }, timezoneId: "America/New_York", locale: "en-US" });
        const page = await context.newPage(); page.setDefaultTimeout(5000);
        if (clock) await page.clock.install();
        const requests = [], errors = [], unexpected = [];
        page.on("pageerror", error => errors.push(error.message));
        await page.route("**/*", async route => {
          const request = route.request(), url = new URL(request.url());
          if (url.origin !== origin) { unexpected.push(request.url()); return route.abort(); }
          if (url.pathname === "/api/notifications") {
            const planned = responses[requests.length];
            requests.push({ method: request.method(), body: request.method() === "POST" ? request.postDataJSON() : null });
            if (planned === undefined) { unexpected.push("unexpected API request"); return route.abort(); }
            if (planned === "timeout") return;
            if (planned === null) return route.abort("failed");
            return route.fulfill(planned);
          }
          return route.continue();
        });
        try {
          await page.goto(origin + "/notifications");
          await action(page, requests);
          assert.deepEqual(unexpected, []); assert.deepEqual(errors, []);
          assert.equal(requests.length, responses.length);
          assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false, "mobile page must not overflow");
          console.log(`PASS ${browserType.name()}: ${name}`);
        } finally { await context.close(); }
      }
      for (const [name, failure] of [["initial server failure", failed], ["malformed response", reply({ notifications: null })], ["connection failure", null]]) {
        await run(name, [failure, reply(snapshot())], async page => {
          await page.getByRole("alert").waitFor(); await refresh(page).click();
          await readButton(page).waitFor(); assert.equal(await page.getByRole("alert").count(), 0);
        });
      }
      await run("stalled request can be retried", ["timeout", reply(snapshot())], async (page, requests) => {
        await page.waitForFunction(() => document.querySelector("button")?.textContent === "Refreshing…");
        while (requests.length === 0) await page.waitForTimeout(10);
        await page.clock.runFor(15050);
        await page.getByRole("alert").filter({ hasText: "taking longer" }).waitFor();
        await refresh(page).click(); await readButton(page).waitFor();
      }, true);
      await run("rejected update preserves unread state", [reply(snapshot()), failed, success, reply(snapshot("customer", true))], async (page, requests) => {
        await readButton(page).click(); await page.getByRole("alert").waitFor();
        await page.getByText("New · " + item.title, { exact: true }).waitFor();
        assert.equal(await page.getByRole("status").count(), 0);
        await readButton(page).click(); await page.getByRole("status").waitFor();
        await page.getByText(item.title, { exact: true }).waitFor();
        assert.equal(requests.filter(request => request.method === "POST").length, 2);
      });
      await run("saved update survives failed refresh", [reply(snapshot()), success, failed, reply(snapshot("customer", true))], async (page, requests) => {
        await readButton(page).click();
        await page.getByRole("status").filter({ hasText: "Notifications marked as read." }).waitFor();
        await page.getByRole("alert").filter({ hasText: "marked as read, but" }).waitFor();
        assert.equal(await readButton(page).count(), 0);
        await refresh(page).click(); await page.getByRole("alert").waitFor({ state: "detached" });
        await refresh(page).waitFor();
        assert.equal(requests.filter(request => request.method === "POST").length, 1, "refresh must not repeat the update");
        if (output) await page.screenshot({ path: resolve(output, `notifications-${browserType.name()}.png`), fullPage: true });
      });
      await run("unconfirmed update does not claim success", [reply(snapshot()), reply({}), reply(snapshot("customer", true))], async page => {
        await readButton(page).click(); await page.getByRole("alert").filter({ hasText: "couldn’t confirm" }).waitFor();
        assert.equal(await page.getByRole("status").count(), 0);
        await refresh(page).click(); await readButton(page).waitFor({ state: "detached" });
      });
      for (const role of ["customer", "provider"]) await run(`${role} Open works even if read tracking fails`, [reply(snapshot(role)), failed], async page => {
        await page.getByRole("link", { name: "Open: " + item.title, exact: true }).click();
        await page.waitForURL(origin + (role === "customer" ? "/customer" : "/provider-jobs"));
      });
      await run("expired session returns to sign in", [reply({}, 401)], async page => {
        await page.waitForURL(origin + "/account");
      });
    } finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
