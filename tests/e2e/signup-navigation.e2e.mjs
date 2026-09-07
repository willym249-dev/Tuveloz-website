// Real page navigation, with a new visitor for every button. No form is submitted.
import assert from "node:assert/strict";
import { chromium, webkit } from "playwright";

const origin = process.env.SIGNUP_CHECK_ORIGIN ?? "http://localhost:3000";
const engines = process.env.SIGNUP_CHECK_ENGINE === "chromium" ? { chromium }
  : process.env.SIGNUP_CHECK_ENGINE === "webkit" ? { webkit } : { chromium, webkit };
const draftKey = "tuveloz-provider-signup-draft-v1";

for (const [engine, browserType] of Object.entries(engines)) {
  const browser = await browserType.launch();
  try {
    for (const language of ["en", "es"]) {
      for (const destination of ["account", "provider"]) {
        const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
        // A navigation check cannot accidentally create an account or application.
        await context.route("**/*", async (route) => {
          if (!["GET", "HEAD"].includes(route.request().method())) return route.abort();
          const url = new URL(route.request().url());
          if (url.origin === origin && url.protocol === "http:"
            && ["localhost", "127.0.0.1"].includes(url.hostname) && route.request().isNavigationRequest()) {
            // WebKit upgrades even loopback HTTP when production CSP asks for HTTPS.
            // The local dev server has no TLS. Adjust only that directive in this
            // test's loopback responses; production headers are never altered.
            const response = await route.fetch();
            const headers = response.headers();
            if (headers["content-security-policy"]) {
              headers["content-security-policy"] = headers["content-security-policy"]
                .split(";").filter((part) => part.trim() !== "upgrade-insecure-requests").join(";");
            }
            return route.fulfill({ response, headers });
          }
          return route.continue();
        });
        const page = await context.newPage();
        try {
          await page.goto(`${origin}${language === "es" ? "/es" : "/"}`, { waitUntil: "domcontentloaded" });
          await page.waitForFunction(() => {
            const section = document.querySelector(".final-cta");
            return section && getComputedStyle(section).display === "flex";
          });
          assert.equal(await page.evaluate((key) => localStorage.getItem(key), draftKey), null,
            "the visitor must have no saved application before clicking");
          const cta = page.locator(".final-cta");
          const button = cta.locator(destination === "account" ? 'a[href*="/account"]' : 'a[href*="/join"]');
          await button.scrollIntoViewIfNeeded();
          await button.click();
          await page.waitForURL((url) => destination === "account"
            ? url.pathname === "/account" : /\/(?:es\/)?join$/.test(url.pathname), { waitUntil: "domcontentloaded" });
          if (destination === "account") {
            assert.equal(new URL(page.url()).searchParams.get("mode"), "create");
            await page.locator('input[type="email"]').waitFor({ state: "visible" });
            await page.locator('input[type="password"]').nth(1).waitFor({ state: "visible" });
            assert.equal(await page.locator('input[type="password"]').count(), 2,
              "create-account form, not sign-in, must open");
          } else {
            // Check the form's actual position, not just the URL or presence in the DOM.
            await page.waitForFunction(() => {
              const target = document.getElementById("provider-apply");
              if (!target) return false;
              const { top } = target.getBoundingClientRect();
              return top >= 0 && top < innerHeight / 2;
            }, null, { timeout: 10000 });
            await page.waitForTimeout(1500); // Late page content must not push it offscreen.
            const position = await page.locator("#provider-apply").boundingBox();
            assert.ok(position.y >= 0 && position.y < 422, `application starts at ${position.y}px`);
            assert.equal(new URL(page.url()).hash, "#provider-apply");
          }
          console.log(`PASS ${engine} ${language}: fresh mobile visitor clicks bottom ${destination} button and sees signup`);
        } catch (error) {
          console.error(`FAIL ${engine} ${language} ${destination}: ${page.url()}`);
          if (process.env.SIGNUP_CHECK_SCREENSHOT) await page.screenshot({ path: process.env.SIGNUP_CHECK_SCREENSHOT });
          throw error;
        } finally {
          await context.close();
        }
      }
    }
  } finally {
    await browser.close();
  }
}
