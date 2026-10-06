// Actual repair-record page, isolated loopback replies, synthetic records only.
import assert from "node:assert/strict";
import { readFileSync, mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { createHash } from "node:crypto";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { build } from "vite";
import { transformSync } from "esbuild";

const root = fileURLToPath(new URL("../..", import.meta.url));
const librarySource = transformSync(readFileSync(resolve(root, "lib/maryland-repair-records.ts"), "utf8"), { loader: "ts", format: "esm" }).code;
const repairLibrary = await import(`data:text/javascript;base64,${Buffer.from(librarySource).toString("base64")}`);
const outputDir = process.argv[2] ? resolve(process.argv[2]) : null;
if (outputDir) mkdirSync(outputDir, { recursive: true });
const built = await build({ root, configFile: false, envFile: false, logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"', "process.env": "{}" },
  resolve: { alias: { "next/link": fileURLToPath(import.meta.resolve("vinext/shims/link")), "next/navigation": fileURLToPath(import.meta.resolve("vinext/shims/navigation")) } },
  build: { write: false, lib: { entry: resolve(root, "tests/e2e/fixtures/repair-records.tsx"), name: "RepairFixture", formats: ["iife"] } },
});
const bundle = Array.isArray(built) ? built[0] : built;
const assets = new Map(bundle.output.map(asset => ["/" + asset.fileName, asset.type === "chunk" ? asset.code : asset.source]));
const js = bundle.output.find(asset => asset.type === "chunk").fileName;
const css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
assets.set("/brand-badge.png", readFileSync(resolve(root, "public/brand-badge.png")));
const server = createServer((request, response) => {
  const path = request.url.split("?")[0];
  if (assets.has(path)) { response.writeHead(200, { "content-type": path.endsWith(".png") ? "image/png" : path.endsWith(".css") ? "text/css" : "text/javascript" }); response.end(assets.get(path)); return; }
  if (path === "/repair-records") { response.writeHead(200, { "content-type": "text/html" }); response.end(`<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`); return; }
  response.writeHead(404); response.end();
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const json = (body, status = 200) => ({ status, contentType: "application/json", body: JSON.stringify(body) });
const report = { startedAt: new Date().toISOString(), cases: [] };
const instant = "2026-10-04T20:00:00.000Z";
const line = { id: "synthetic-line", sortOrder: 0, lineType: "labor", description: "SYNTHETIC authorized labor", partNumber: "", partCondition: "not_applicable", quantity: 1, unitAmountCents: 10000, lineAmountCents: 10000, laborMinutes: 60, mechanicIdentifier: "SYNTHETIC-1" };
function document(id, status) {
  return { id, requestId: "job-a", quoteId: "job-a-quote", providerId: "provider", scopeVersion: 1, serviceCodes: '["provisional_12v_jump_start"]', invoiceNumber: "SYNTHETIC-INV-1", authorizationRecordId: "authorization-a",
    providerEmail: "provider@example.invalid", providerName: "SYNTHETIC provider", providerBusinessName: "SYNTHETIC provider business", providerBusinessAddress: "SYNTHETIC business address", providerBusinessPhone: "2025550100", countyRegistrationNumber: "SYNTHETIC-REG",
    customerEmail: "customer@example.invalid", customerName: "SYNTHETIC customer", customerAddress: "SYNTHETIC customer address", vehicleYear: "2020", vehicleMakeModel: "SYNTHETIC car", vehicleTag: "SYNTHETIC", vehicleVin: "", odometerReading: 100,
    customerInstructions: "SYNTHETIC instructions", providerDiagnosis: "SYNTHETIC diagnosis", laborBillingMethod: "other_flat_rate", laborDisclosure: "SYNTHETIC agreed flat labor", estimatedCompletionAt: "", completionDisclosure: "SYNTHETIC completion plan", estimateFeeCents: 0, surchargeCents: 0, surchargeDescription: "",
    laborAmountCents: 10000, partsAmountCents: 0, taxAmountCents: 0, otherAmountCents: 0, totalAmountCents: 10000, replacedPartsChoice: "not_applicable", returnedPartsChoice: "not_applicable", partsDescription: "",
    customerRightsHeading: "Customer's Rights", customerRightsText: "SYNTHETIC customer rights fixture", manufacturerNotice: "SYNTHETIC manufacturer notice", responsibilityNotice: "SYNTHETIC responsibility notice", warrantyProvider: "none_offered", warrantyTerms: "SYNTHETIC warranty terms", warrantyWorkStatement: "SYNTHETIC work statement", workSummary: "SYNTHETIC completed labor", mechanicIdentifiers: '["SYNTHETIC-1"]',
    providerRepresentativeName: "SYNTHETIC provider", providerRepresentativeTitle: "Technician", providerSignedAt: instant, status, presentedAt: instant, issuedAt: instant, customerViewedAt: "", customerSignatureName: status === "signed" ? "ORIGINAL SIGNER" : "", customerSignatureAt: status === "signed" ? instant : "", customerSignatureAction: status === "signed" ? "typed-name-and-affirmative-authorization-checkbox" : "", customerSignatureIp: "", customerSignatureSessionId: "", customerSignatureDevice: "{}",
    customerCopyDeliveryMethod: "", customerCopyDeliveredTo: "", customerCopyDeliveredAt: "", providerCopyRetainedAt: "", documentSnapshot: '{"synthetic":true}', documentHash: "a".repeat(64), createdAt: instant, updatedAt: instant, lineItems: [{ ...line }] };
}
function snapshot(role = "customer") {
  const value = { testOnly: true, realJobsEnabled: false, role, email: `${role}@example.invalid`, version: "maryland-repair-records-2026-08-01-v2", legalNotices: {
    customerRightsHeading: repairLibrary.MARYLAND_CUSTOMER_RIGHTS_HEADING, customerRightsText: repairLibrary.MARYLAND_CUSTOMER_RIGHTS_TEXT, writtenEstimateStandard: repairLibrary.MONTGOMERY_COUNTY_WRITTEN_ESTIMATE_STANDARD, manufacturerNotice: repairLibrary.MANUFACTURER_SPECIAL_POLICY_NOTICE, responsibilityNotice: repairLibrary.REPAIR_FACILITY_RESPONSIBILITY_NOTICE, electronicSignatureNotice: repairLibrary.ELECTRONIC_SIGNATURE_NOTICE,
  }, jobs: [{ requestId: "job-a", requestStatus: "completed", vehicle: "SYNTHETIC vehicle A", service: "SYNTHETIC service", serviceCodes: '["provisional_12v_jump_start"]', quoteServiceCodes: '["provisional_12v_jump_start"]', jurisdiction: "US-MD-MontgomeryCounty", municipality: "Rockville", serviceAddress: "SYNTHETIC service address", customerName: "SYNTHETIC customer", customerEmail: "customer@example.invalid", quoteId: "job-a-quote", quotePriceCents: "10000", scopeVersion: 1, providerId: "provider", providerName: "SYNTHETIC provider", providerEmail: "provider@example.invalid", providerBusinessAddress: "SYNTHETIC business address", isTestJob: "yes", isTestProvider: "yes", isTest: true, writesAllowed: true, authorizationWritesAllowed: true, invoiceWritesAllowed: true, writeBlockReason: "", authorization: document("authorization-a", "signed"), invoice: document("invoice-a", "final") }] };
  bindSnapshots(value); return value;
}
function bindSnapshots(data) {
  for (const job of data.jobs) for (const key of ["authorization", "invoice"]) {
    const record = job[key]; if (!record) continue;
    if (key === "invoice") { record.authorizationRecordId = job.authorization.id; record.authorizationDocumentHash = job.authorization.documentHash; }
    const frozen = Object.fromEntries(Object.entries(record).filter(([name]) => !["id", "status", "documentHash", "documentSnapshot", "createdAt", "updatedAt", "presentedAt", "customerViewedAt"].includes(name) && !/^(customerSignature|customerCopy|providerCopy)/.test(name)));
    Object.assign(frozen, { version: data.version, documentType: key === "invoice" ? "provider_final_repair_invoice" : "repair_authorization_and_written_estimate", writtenEstimateStandard: data.legalNotices.writtenEstimateStandard,
      serviceCodes: JSON.parse(record.serviceCodes), mechanicIdentifiers: JSON.parse(record.mechanicIdentifiers), lineItems: record.lineItems.map(item => Object.fromEntries(Object.entries(item).filter(([name]) => !["id", "sortOrder"].includes(name)))) });
    record.documentSnapshot = JSON.stringify(frozen);
    record.documentHash = record.status === "draft" ? "" : createHash("sha256").update(record.documentSnapshot).digest("hex");
  }
}
const form = (page, name) => page.locator(`form[data-repair-form="${name}"]`);
async function fitsPhone(page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "page fits a 320px phone");
  assert.equal(await page.locator(".repair-record-header > a > span:not(.brand-mark)").evaluate(element => {
    const range = document.createRange(); range.selectNodeContents(element); return range.getClientRects().length;
  }), 1, "Tuveloz brand text must stay on one line at 320px");
}
async function signFields(page, name = "SYNTHETIC SIGNER") {
  const signature = form(page, "sign-invoice");
  await signature.locator('[name="acceptedByName"]').fill(name);
  assert.equal(await signature.locator('[name="signatureAccepted"]').isChecked(), false, "consent starts unchecked");
  await signature.locator('[name="signatureAccepted"]').check();
  return signature;
}
try {
  for (const engine of [chromium, webkit]) {
    const browser = await engine.launch({ headless: true });
    try {
      for (const spanish of [false, true]) {
        async function run(name, scenario) {
          if (process.env.REPAIR_CASE && !name.includes(process.env.REPAIR_CASE)) return;
          const context = await browser.newContext({ viewport: { width: 320, height: 740 } });
          const page = await context.newPage(); page.setDefaultTimeout(5000);
          const errors = [], unexpected = [], posts = []; let state = snapshot(), gets = 0, handler;
          await page.addInitScript(({ spanish }) => { localStorage.setItem("tuveloz-language", spanish ? "es" : "en"); window.print = () => { window.repairPrintCount = (window.repairPrintCount || 0) + 1; }; }, { spanish });
          page.on("pageerror", error => errors.push(error.message));
          await context.route("**/*", async route => {
            const request = route.request(), url = new URL(request.url());
            if (url.origin !== origin) { unexpected.push(request.url()); return route.abort(); }
            if (!url.pathname.startsWith("/api/")) return route.continue();
            if (url.pathname === "/api/account" && request.method() === "GET") return route.fulfill(json({ user: null }));
            if (url.pathname !== "/api/repair-records") { unexpected.push(`${request.method()} ${url.pathname}`); return route.abort(); }
            if (request.method() === "GET") gets++; else posts.push(request.postDataJSON());
            if (handler) return handler(route, request, posts.at(-1));
            if (request.method() === "GET") return route.fulfill(json(state));
            unexpected.push(`Unplanned ${request.method()} ${url.pathname}`); return route.abort();
          });
          const api = { page, posts, get state() { return state; }, set state(value) { state = value; }, get gets() { return gets; }, set handler(value) { handler = value; },
            goto: query => page.goto(`${origin}/repair-records?lang=${spanish ? "es" : "en"}&${query ?? ""}`) };
          const caseName = `${engine.name()}-${spanish ? "es" : "en"}-${name}`;
          try {
            await scenario(api); await fitsPhone(page); assert.deepEqual(errors, []); assert.deepEqual(unexpected, []);
            if (outputDir && name === "provider-structured-cents-and-zero-price-part" && !spanish && engine === chromium) {
              await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: resolve(outputDir, "provider-header-320px.png") });
              await form(page, "invoice").evaluate(element => window.scrollTo(0, element.getBoundingClientRect().top + scrollY - 16));
              await page.screenshot({ path: resolve(outputDir, "provider-form-320px.png") });
            }
            report.cases.push({ name: caseName, status: "passed" }); console.log(`PASS ${caseName}`);
          } catch (error) {
            report.cases.push({ name: caseName, status: "failed", error: error.message }); console.error(`FAIL ${caseName}: ${error.message}`);
            if (outputDir) await page.screenshot({ path: resolve(outputDir, `${caseName}.png`), fullPage: true }).catch(() => {});
          } finally { await context.close(); }
        }
        await run("exact-invoice-signature-one-request", async api => {
          const { page } = api; let pending, releaseRefresh;
          const refreshReady = new Promise(resolve => { releaseRefresh = resolve; });
          api.handler = async (route, request) => {
            if (request.method() === "GET") {
              if (api.gets > 1) await refreshReady;
              return route.fulfill(json(api.state));
            }
            return new Promise(resolve => { pending = () => {
              const payload = api.posts[0], record = api.state.jobs[0].invoice;
              Object.assign(record, { customerSignatureAt: instant, customerSignatureName: payload.acceptedByName, customerCopyDeliveredAt: instant, providerCopyRetainedAt: instant, customerCopyDeliveryMethod: "secure-account-copy", customerCopyDeliveredTo: api.state.email });
              resolve(route.fulfill(json({ ...api.state, ok: true, action: "sign-invoice", requestId: "job-a", recordId: record.id, documentHash: record.documentHash, status: "signed-and-delivered", paymentReleased: false })));
            }; });
          };
          await api.goto(); await form(page, "sign-invoice").waitFor();
          const signature = await signFields(page); await signature.locator('button[type="submit"]').click();
          assert.equal(await signature.locator('button[type="submit"]').isDisabled(), true);
          await signature.locator('button[type="submit"]').evaluate(button => button.click());
          assert.equal(api.posts.length, 1);
          assert.deepEqual(api.posts[0], { action: "sign-invoice", requestId: "job-a", expectedQuoteId: "job-a-quote", expectedScopeVersion: 1, expectedRecordId: "invoice-a", expectedDocumentHash: api.state.jobs[0].invoice.documentHash, acceptedByName: "SYNTHETIC SIGNER", signatureAccepted: true, providerCertified: false, copyReceived: false });
          try {
            pending();
            // Hold the fresh read so the receipt and loading statuses coexist.
            await page.getByText(spanish ? "Cargando sus documentos guardados…" : "Loading your saved records…", { exact: true }).waitFor();
            const success = page.getByRole("status").and(page.getByText(spanish
              ? "Su acción sobre la factura quedó registrada. La finalización del trabajo es independiente; no se liberó ningún pago."
              : "Your invoice action was recorded. Job completion is separate; no payment was released.", { exact: true }));
            await success.waitFor();
            assert.equal(await page.getByRole("status").count(), 3);
            assert.equal(await signature.locator('button[type="submit"]').isDisabled(), true);
            releaseRefresh();
            await page.locator('.repair-feedback[aria-busy="false"]').waitFor();
            await form(page, "sign-invoice").waitFor({ state: "detached" });
            assert.equal(await success.isVisible(), true, "confirmed receipt remains after the saved-copy refresh");
            assert.equal(api.posts.length, 1, "receipt refresh must not resubmit the signature");
            assert.equal(api.gets, 2, "one initial read and one fresh saved-copy read");
            assert.equal(await page.getByRole("alert").count(), 0);
          } finally { releaseRefresh(); }
          if (outputDir && !spanish && engine === chromium) await page.screenshot({ path: resolve(outputDir, "signed-invoice-320px.png"), fullPage: true });
        });
        await run("job-switch-clears-signer-and-consent", async api => {
          const second = structuredClone(api.state.jobs[0]);
          Object.assign(second, { requestId: "job-b", quoteId: "job-b-quote", vehicle: "SYNTHETIC vehicle B" });
          for (const key of ["authorization", "invoice"]) Object.assign(second[key], { id: `${key}-b`, requestId: "job-b", quoteId: "job-b-quote", documentHash: "b".repeat(64) });
          api.state.jobs.push(second);
          bindSnapshots(api.state);
          await api.goto("requestId=job-a"); await signFields(api.page, "PREVIOUS CUSTOMER");
          await api.page.locator("#repair-job-select").selectOption("job-b");
          assert.equal(await form(api.page, "sign-invoice").locator('[name="acceptedByName"]').inputValue(), "");
          assert.equal(await form(api.page, "sign-invoice").locator('[name="signatureAccepted"]').isChecked(), false);
          assert.equal(api.posts.length, 0);
        });
        await run("paused-real-copy-is-readable-without-signing", async api => {
          const job = api.state.jobs[0]; api.state.testOnly = false;
          Object.assign(job, { isTestJob: "no", isTestProvider: "no", isTest: false, writesAllowed: false, authorizationWritesAllowed: false, invoiceWritesAllowed: false, writeBlockReason: "SYNTHETIC real records paused" });
          Object.assign(job.invoice, { customerSignatureName: "ORIGINAL SIGNER", customerSignatureAt: instant, customerCopyDeliveredAt: instant, providerCopyRetainedAt: instant, customerCopyDeliveryMethod: "secure-account-copy", customerCopyDeliveredTo: api.state.email });
          await api.goto(); await api.page.locator(".repair-paused").waitFor();
          assert.equal(await api.page.locator('form[data-repair-form]').count(), 0);
          await api.page.getByRole("button", { name: /Print or save this secure copy|Imprimir|Guardar.*copia/i }).last().click();
          assert.equal(await api.page.evaluate(() => window.repairPrintCount), 1); assert.equal(api.posts.length, 0);
        });
        await run("stale-invoice-does-not-report-signing-success", async api => {
          api.handler = (route, request) => route.fulfill(request.method() === "GET" ? json(api.state) : json({ error: "SYNTHETIC invoice changed. Review the current record." }, 409));
          await api.goto(); const signature = await signFields(api.page); await signature.locator('button[type="submit"]').click();
          await api.page.getByRole("alert").first().waitFor(); assert.equal(await api.page.getByRole("status").count(), 0); assert.equal(api.posts.length, 1);
          assert.equal(api.state.jobs[0].invoice.customerSignatureAt, "");
        });
        for (const failure of ["malformed", "network"]) await run(`${failure}-read-retry`, async api => {
          api.handler = (route, request) => {
            assert.equal(request.method(), "GET");
            if (api.gets > 1) return route.fulfill(json(api.state));
            return failure === "network" ? route.abort() : route.fulfill(json({ ...api.state, jobs: "invalid" }));
          };
          await api.goto(); await api.page.getByRole("alert").waitFor();
          assert.equal(await form(api.page, "sign-invoice").count(), 0);
          await api.page.getByRole("button", { name: /Try loading again|Volver a cargar|Intentar.*nuevo/i }).click();
          await form(api.page, "sign-invoice").waitFor(); assert.equal(api.posts.length, 0); assert.equal(api.gets, 2);
        });
        await run("unknown-deep-link-does-not-select-another-job", async api => {
          await api.goto("requestId=not-owned"); await api.page.getByRole("alert").waitFor();
          assert.equal(await form(api.page, "sign-invoice").count(), 0); assert.equal(api.posts.length, 0);
        });
        await run("authorization-rights-immediately-precede-fresh-consent", async api => {
          api.state.jobs[0].invoice = null;
          Object.assign(api.state.jobs[0].authorization, { status: "presented", customerSignatureAt: "", customerSignatureName: "" });
          await api.goto(); const signature = form(api.page, "sign-authorization"); await signature.waitFor();
          const rights = api.page.locator(".repair-customer-rights");
          assert.ok(await rights.evaluate((element) => Boolean(element.compareDocumentPosition(document.querySelector('form[data-repair-form="sign-authorization"]')) & Node.DOCUMENT_POSITION_FOLLOWING)));
          assert.ok(await rights.evaluate(element => parseFloat(getComputedStyle(element).borderTopWidth) >= 4));
          assert.equal(await signature.locator('[name="signatureAccepted"]').isChecked(), false);
          assert.equal(await signature.locator('[name="acceptedByName"]').inputValue(), "");
          assert.equal(api.posts.length, 0);
        });
        for (const invalid of ["visible-work", "signature-date", "signature-name", "consent-notice"]) await run(`invalid-${invalid}-cannot-enable-signing`, async api => {
          const record = api.state.jobs[0].invoice;
          if (invalid === "visible-work") record.workSummary = "TAMPERED work not in the frozen snapshot";
          if (invalid === "signature-date") { record.customerSignatureAt = "invalid date"; record.customerSignatureName = "SYNTHETIC"; }
          if (invalid === "signature-name") record.customerSignatureAt = instant;
          if (invalid === "consent-notice") api.state.legalNotices.electronicSignatureNotice = "Unexpected substitute consent text";
          await api.goto(); await api.page.getByRole("alert").first().waitFor();
          assert.equal(await api.page.locator('form[data-repair-form]').count(), 0); assert.equal(api.posts.length, 0);
        });
        for (const outcome of ["unconfirmed-receipt", "uncertain-503"]) await run(outcome, async api => {
          api.handler = (route, request) => route.fulfill(request.method() === "GET" ? json(api.state) : outcome === "unconfirmed-receipt" ? json({ ok: true }) : json({ error: "SYNTHETIC unknown commit result", snapshotRefreshRequired: true }, 503));
          await api.goto(); const signature = await signFields(api.page); await signature.locator('button[type="submit"]').click();
          await api.page.getByRole("alert").first().waitFor();
          assert.equal(await api.page.locator(".form-success").count(), 0);
          assert.equal(await signature.locator('button[type="submit"]').isDisabled(), true);
          assert.equal(await signature.locator('[name="acceptedByName"]').inputValue(), "SYNTHETIC SIGNER");
          const error = await api.page.locator(".form-error").textContent();
          assert.match(error, /could not confirm|No pudimos confirmar/); assert.equal(api.posts.length, 1);
        });
        await run("signed-copy-receipt-does-not-sign-again", async api => {
          const record = api.state.jobs[0].invoice;
          Object.assign(record, { customerSignatureAt: instant, customerSignatureName: "ORIGINAL SIGNER" });
          api.handler = (route, request, payload) => {
            if (request.method() === "GET") return route.fulfill(json(api.state));
            assert.equal(payload.action, "receive-invoice-copy"); assert.equal(payload.copyReceived, true); assert.equal(payload.signatureAccepted, false); assert.equal(payload.acceptedByName, undefined);
            Object.assign(record, { customerCopyDeliveredAt: instant, providerCopyRetainedAt: instant, customerCopyDeliveryMethod: "secure-account-copy", customerCopyDeliveredTo: api.state.email });
            return route.fulfill(json({ ok: true, action: payload.action, requestId: "job-a", recordId: record.id, documentHash: record.documentHash, status: "copy-received", paymentReleased: false }));
          };
          await api.goto(); const copy = form(api.page, "receive-invoice-copy"); await copy.waitFor();
          assert.equal(await form(api.page, "sign-invoice").count(), 0); assert.equal(await copy.locator('[name="copyReceived"]').isChecked(), false);
          await copy.locator('[name="copyReceived"]').check(); await copy.locator('button[type="submit"]').click();
          await copy.waitFor({ state: "detached" }); assert.equal(api.posts.length, 1); assert.equal(record.customerSignatureName, "ORIGINAL SIGNER"); assert.equal(record.customerSignatureAt, instant);
        });
        await run("provider-structured-cents-and-zero-price-part", async api => {
          api.state = snapshot("provider"); const job = api.state.jobs[0]; job.invoice = null; job.quotePriceCents = "30";
          Object.assign(job.authorization, { laborAmountCents: 30, totalAmountCents: 30 });
          Object.assign(job.authorization.lineItems[0], { unitAmountCents: 30, lineAmountCents: 30 }); bindSnapshots(api.state);
          api.handler = (route, request) => route.fulfill(request.method() === "GET" ? json(api.state) : json({ error: "SYNTHETIC retained validation error" }, 400));
          await api.goto(); const editor = form(api.page, "invoice"); await editor.waitFor();
          for (const [name, value] of Object.entries({ workSummary: "SYNTHETIC completed work", warrantyWorkStatement: "SYNTHETIC no warranty work", warrantyTerms: "SYNTHETIC terms", mechanicIdentifiers: "SYNTHETIC-1" })) await editor.locator(`[name="${name}"]`).fill(value);
          await editor.locator('[name="warrantyProvider"]').selectOption("none_offered");
          await editor.locator('[name="line.0.quantity"]').fill("3"); await editor.locator('[name="line.0.unitPrice"]').fill("0.11");
          await editor.locator('button[value="draft"]').click(); await api.page.getByRole("alert").first().waitFor(); assert.equal(api.posts.length, 0, "mismatched total cannot be sent");
          await editor.locator('[name="line.0.unitPrice"]').fill("0.10");
          await editor.getByRole("button", { name: /Add customer-supplied part|Agregar pieza del cliente/ }).click();
          await editor.locator('[name="line.1.description"]').fill("SYNTHETIC customer part"); await editor.locator('[name="line.1.partNumber"]').fill("SYNTHETIC-PART");
          assert.equal(await editor.locator('textarea[name="lineItems"]').count(), 0);
          await Promise.all([api.page.waitForResponse(response => response.url().endsWith("/api/repair-records") && response.request().method() === "POST"), editor.locator('button[value="draft"]').click()]);
          assert.equal(api.posts.length, 1); const payload = api.posts[0];
          assert.equal(payload.expectedRecordId, ""); assert.equal(payload.expectedUpdatedAt, ""); assert.equal(payload.status, "draft");
          assert.equal(payload.lineItems[0].unitAmountCents, 10); assert.equal(payload.lineItems[0].lineAmountCents, 30);
          assert.equal(payload.lineItems[1].unitAmountCents, 0); assert.equal(payload.lineItems[1].lineAmountCents, 0);
          assert.equal(await editor.locator('[name="workSummary"]').inputValue(), "SYNTHETIC completed work");
          await editor.locator('button[value="final"]').click(); assert.equal(api.posts.length, 1, "final issue requires new certification");
          await editor.locator('[name="providerCertified"]').check();
          await Promise.all([api.page.waitForResponse(response => response.request().method() === "POST"), editor.locator('button[value="final"]').click()]);
          assert.equal(api.posts.length, 2); assert.equal(api.posts[1].action, "save-invoice"); assert.equal(api.posts[1].status, "final"); assert.equal(api.posts[1].providerCertified, true);
        });
        await run("provider-stale-draft-reload-retains-then-replaces-correctly", async api => {
          api.state = snapshot("provider"); const job = api.state.jobs[0]; job.invoice = null; job.requestStatus = "quote accepted";
          Object.assign(job.authorization, { status: "draft", customerSignatureAt: "", customerSignatureName: "" }); bindSnapshots(api.state);
          const priorRevision = job.authorization.updatedAt, nextRevision = "2026-10-04T20:01:00.000Z";
          api.handler = (route, request, payload) => {
            if (request.method() === "GET") return route.fulfill(api.gets === 2 ? json({ error: "SYNTHETIC reload failed" }, 503) : json(api.state));
            if (api.posts.length === 1) {
              Object.assign(job.authorization, { providerDiagnosis: "NEWER SAVED DIAGNOSIS", updatedAt: nextRevision }); bindSnapshots(api.state);
              return route.fulfill(json({ error: "SYNTHETIC stale draft", code: "REPAIR_RECORD_STALE" }, 409));
            }
            assert.equal(payload.status, "presented");
            Object.assign(job.authorization, { status: "presented", providerSignedAt: nextRevision, updatedAt: nextRevision }); bindSnapshots(api.state);
            return route.fulfill(json({ ok: true, action: "save-authorization", requestId: job.requestId, recordId: job.authorization.id, documentHash: job.authorization.documentHash, status: "presented", paymentReleased: false }));
          };
          await api.goto(); const editor = form(api.page, "authorization"); await editor.waitFor();
          await editor.locator('[name="providerDiagnosis"]').fill("MY UNSAVED OLD DRAFT");
          await editor.locator('button[value="draft"]').click(); await api.page.getByRole("alert").first().waitFor();
          assert.equal(api.posts[0].expectedUpdatedAt, priorRevision); assert.equal(api.posts[0].expectedRecordId, job.authorization.id);
          const retry = api.page.getByRole("button", { name: /Try loading again|Intentar cargar de nuevo/ });
          await retry.click(); await api.page.waitForFunction(() => document.querySelector('.repair-feedback')?.getAttribute('aria-busy') === "false");
          assert.equal(await editor.locator('[name="providerDiagnosis"]').inputValue(), "MY UNSAVED OLD DRAFT"); assert.equal(await editor.locator('button[value="draft"]').isDisabled(), true);
          await retry.click(); await api.page.waitForFunction(() => document.querySelector('[name="providerDiagnosis"]')?.value === "NEWER SAVED DIAGNOSIS");
          assert.equal(await editor.locator('[name="providerCertified"]').isChecked(), false);
          await editor.locator('[name="providerCertified"]').check(); await editor.locator('button[value="presented"]').click();
          await editor.waitFor({ state: "detached" }); assert.equal(api.posts.length, 2);
          assert.equal(api.posts[1].expectedUpdatedAt, nextRevision); assert.equal(api.posts[1].providerDiagnosis, "NEWER SAVED DIAGNOSIS"); assert.equal(api.posts[1].providerCertified, true);
        });
      }
    } finally { await browser.close(); }
  }
} finally {
  await new Promise(done => server.close(done));
  if (outputDir) writeFileSync(resolve(outputDir, "report.json"), JSON.stringify(report, null, 2));
}
assert.equal(report.cases.filter(item => item.status === "failed").length, 0);
