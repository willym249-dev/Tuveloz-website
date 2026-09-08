// A real built page and its real unauthenticated API response. No form writes.
import assert from "node:assert/strict";
import { writeFileSync } from "node:fs";
import { chromium, webkit } from "playwright";

const origin = process.env.PROVIDER_REDIRECT_ORIGIN ?? "http://127.0.0.1:3041";
const local = ["localhost", "127.0.0.1"].includes(new URL(origin).hostname);
const report = { origin, testedAt: new Date().toISOString(), cases: [] };
for (let attempt = 0; ; attempt++) {
  try { if ((await fetch(`${origin}/provider-onboarding`)).ok) break; } catch { /* server starting */ }
  if (attempt >= 59) throw new Error("Provider redirect test server did not become ready.");
  await new Promise(done => setTimeout(done, 1000));
}

try {
  for (const type of [chromium, webkit]) {
    const browser = await type.launch();
    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [], prematurePrefetches = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("request", request => {
      if (new URL(page.url()).pathname === "/provider-onboarding" && new URL(request.url()).pathname.endsWith(".rsc")) {
        prematurePrefetches.push(request.url());
      }
    });
    await context.route("**/*", async route => {
      if (!["GET", "HEAD"].includes(route.request().method())) return route.abort();
      const url = new URL(route.request().url());
      if (local && url.origin === origin) {
        if (url.pathname === "/api/provider-onboarding") {
          // Preserve the actual 401, but let the header mount first to expose
          // preloads that race with the subsequent sign-in redirect.
          const response = await route.fetch();
          await new Promise(done => setTimeout(done, 300));
          return route.fulfill({ response });
        }
        if (route.request().isNavigationRequest()) {
          const response = await route.fetch();
          const headers = response.headers();
          if (headers["content-security-policy"]) headers["content-security-policy"] = headers["content-security-policy"]
            .split(";").filter(part => part.trim() !== "upgrade-insecure-requests").join(";");
          return route.fulfill({ response, headers });
        }
      }
      return route.continue();
    });
    try {
      await page.goto(`${origin}/provider-onboarding`, { waitUntil: "domcontentloaded" });
      await page.waitForURL(url => url.pathname === "/account" && url.searchParams.get("role") === "provider", { waitUntil: "domcontentloaded" });
      await page.locator('main input[type="email"]').first().waitFor();
      await page.waitForTimeout(500);
      assert.deepEqual(prematurePrefetches, [], "The private page must finish its session check before preloading other routes");
      assert.deepEqual(errors, [], "The sign-in redirect must not leave an unhandled page error");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
      report.cases.push({ browser: type.name(), result: "passed", destination: page.url(), prematurePrefetches, errors });
      console.log(`PASS ${type.name()}: signed-out provider opens sign-in without premature preloads or page errors`);
    } catch (error) {
      report.cases.push({ browser: type.name(), result: "failed", destination: page.url(), error: error.message, prematurePrefetches, errors });
      throw error;
    } finally { await browser.close(); }
  }
} finally {
  if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify(report, null, 2) + "\n");
}
