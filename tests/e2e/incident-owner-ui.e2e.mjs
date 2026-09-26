// Real owner test console, with synthetic loopback API replies.
// The separate incident-owner-review test executes real authentication and SQL.
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { build } from "vite";

const root = fileURLToPath(new URL("../..", import.meta.url));
const builds = await build({ root, configFile: false, envFile: false, logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/incident-owner.tsx"), name: "IncidentFixture", formats: ["iife"] } },
});
const bundle = Array.isArray(builds) ? builds[0] : builds;
const assets = new Map(bundle.output.map(asset => ["/" + asset.fileName, asset.type === "chunk" ? asset.code : asset.source]));
const js = bundle.output.find(asset => asset.type === "chunk").fileName;
const css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
const server = createServer((request, response) => {
  const path = request.url.split("?")[0];
  if (assets.has(path)) {
    response.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : "text/javascript" });
    response.end(assets.get(path));
  } else if (request.method === "GET" && path === "/job-operations") {
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`);
  } else { response.writeHead(404); response.end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
        const page = await context.newPage();
        const errors = []; page.on("pageerror", error => errors.push(error.message));
        const requests = [];
        let role = "owner", held = true, denyNext = true;
        const snapshot = () => ({ testOnly: true, transferExecutionEnabled: false, actorRole: role,
          job: { requestId: "synthetic-job", status: "assigned", scopeVersion: 1, serviceCodes: [], scheduledFor: "" },
          cancellations: [], changeOrders: [], invoices: [], paymentAdjustments: [], lifecycle: [],
          incidents: [
            { id: "retained", status: "resolved", holdPayments: held ? "yes" : "no", summary: "Synthetic resolved incident" },
            { id: "open", status: "open", holdPayments: "yes", summary: "Synthetic open incident" },
            { id: "released", status: "resolved", holdPayments: "no", summary: "Synthetic released incident" },
          ],
        });
        await page.route("**/*", async route => {
          const request = route.request(); const url = new URL(request.url());
          assert.equal(url.origin, origin, "fixture must never contact a real service");
          if (url.pathname !== "/api/job-operations") return route.continue();
          if (request.method() === "GET") return route.fulfill({ json: snapshot() });
          requests.push(request.postDataJSON());
          if (denyNext) { denyNext = false; return route.fulfill({ status: 409, json: { error: "This incident changed. Refresh the job before trying again." } }); }
          held = false;
          return route.fulfill({ json: { ok: true, status: "resolved", paymentHoldReleased: true, transferCreated: false } });
        });
        try {
          const path = "/job-operations?requestId=synthetic-job";
          await page.goto(origin + path);
          const title = "Release incident hold retained";
          const form = page.locator("details").filter({ has: page.locator("summary").filter({ hasText: title }) });
          await form.waitFor(); assert.equal(await form.count(), 1);
          assert.equal(await page.getByText(/^Release incident hold (open|released)$/).count(), 0);
          await form.locator("summary").click();
          const reason = form.getByLabel("Reason for releasing the hold", { exact: true });
          const confirmation = form.getByRole("checkbox");
          await reason.fill("Synthetic claim review is complete.");
          await form.getByRole("button").click();
          assert.equal(requests.length, 0, "unchecked confirmation must block submission");
          await confirmation.check(); await form.getByRole("button").click();
          await page.getByRole("alert").waitFor();
          assert.equal(await reason.inputValue(), "Synthetic claim review is complete.");
          assert.equal(await confirmation.isChecked(), true);
          assert.ok((await page.getByRole("alert").textContent()).includes("This incident changed"));
          await form.getByRole("button").click(); await form.waitFor({ state: "detached" });
          assert.equal(requests.length, 2);
          assert.deepEqual(requests[1], { action: "release-incident-hold", requestId: "synthetic-job", incidentId: "retained", releaseReason: "Synthetic claim review is complete.", confirmHoldRelease: true });
          role = "customer"; held = true; await page.reload();
          await page.getByRole("heading", { name: "Controlled test actions", exact: true }).waitFor();
          assert.equal(await page.getByText(title, { exact: true }).count(), 0, "customer must not see owner release controls");
          assert.deepEqual(errors, []);
          console.log(`PASS ${browserType.name()}: confirmation, retained draft, saved release, owner-only control`);
        } finally { await context.close(); }
    } finally { await browser.close(); }
  }
} finally { await new Promise(done => server.close(done)); }
