// Full rendered public-page inventory and actual navigation/disclosure checks.
// Run against the isolated dev site. Form success/failure actions have dedicated
// fixtures; this audit never sends a form or visits an external destination.
import assert from "node:assert/strict";
import { readdirSync, mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { chromium, webkit } from "playwright";

const origin = process.env.PUBLIC_AUDIT_ORIGIN ?? "http://localhost:3027";
assert.ok(["localhost", "127.0.0.1"].includes(new URL(origin).hostname), "Use the isolated local site");
const output = resolve(process.env.PUBLIC_AUDIT_OUTPUT ?? "../public-actions-audit");
mkdirSync(output, { recursive: true });
const report = { at: new Date().toISOString(), pages: [], actions: [], issues: [], externalLinks: [] };
const sitemap = await (await fetch(`${origin}/sitemap.xml`)).text();
const routes = new Set([...sitemap.matchAll(/<loc>(.*?)<\/loc>/g)].map(match => new URL(match[1]).pathname));
for (const file of readdirSync("app", { recursive: true })) {
  const normalized = String(file).replaceAll("\\", "/");
  if (normalized.endsWith("/page.tsx") && !normalized.includes("[") && !normalized.startsWith("admin/")
    && !normalized.startsWith("components/")) routes.add(`/${normalized.slice(0, -9)}`);
}
const linkPaths = process.env.PUBLIC_AUDIT_LINK_PATHS?.split(",");
const requestedPaths = process.env.PUBLIC_AUDIT_PATHS?.split(",");
const signedOutDestinations = {
  "/customer": "/account?role=customer", "/notifications": "/account", "/job-evidence": "/account",
  "/job-authorizations": "/account", "/job-authorizations/documents": "/account",
  "/privacy-center": "/account?role=customer&privacy=1", "/tracking": "/account",
  ...Object.fromEntries(["/provider-jobs", "/provider-jobs/parts", "/provider-jobs/toolkit", "/provider-onboarding", "/provider-service-area", "/provider-services"].map(path => [path, "/account?role=provider"])),
};
const browsers = process.env.PUBLIC_AUDIT_ENGINE === "webkit" ? { webkit } : { chromium };
const writeReport = () => writeFileSync(resolve(output, "report.json"), JSON.stringify(report, null, 2));
for (const [engine, type] of Object.entries(browsers)) {
  const browser = await type.launch();
  try {
    for (const path of [...routes].sort().filter(path => !requestedPaths || requestedPaths.includes(path))) {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
      await context.route("**/*", async route => {
        const request = route.request();
        if (!["GET", "HEAD"].includes(request.method())) return route.abort();
        if (new URL(request.url()).origin !== origin) return route.abort();
        if (request.isNavigationRequest()) {
          const response = await route.fetch();
          const headers = response.headers();
          if (headers["content-security-policy"]) headers["content-security-policy"] = headers["content-security-policy"]
            .split(";").filter(value => value.trim() !== "upgrade-insecure-requests").join(";");
          return route.fulfill({ response, headers });
        }
        return route.continue();
      });
      const page = await context.newPage();
      page.setDefaultTimeout(7000);
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      const go = async () => {
        const ready = page.waitForResponse(response => new URL(response.url()).pathname === "/api/account");
        const response = await page.goto(origin + path, { waitUntil: "domcontentloaded" });
        assert.equal(response.status(), 200, `page status: ${path}`);
        await ready;
        await page.waitForTimeout(200);
        if (signedOutDestinations[path]) {
          await page.waitForURL(origin + signedOutDestinations[path]);
          await page.locator(".account-login-form").waitFor();
        } else {
          await page.locator(".account-loading").waitFor({ state: "hidden" });
        }
        if (new URL(page.url()).pathname === "/account") {
          await page.waitForFunction(() => {
            const email = document.querySelector('input[name="email"]');
            return email && !email.disabled;
          });
        }
        if (["/", "/join", "/post-job", "/about", "/ai", "/faq", "/safety", "/how-it-works"].includes(new URL(page.url()).pathname.replace(/^\/es(?=\/|$)/, "") || "/")) {
          await page.locator(".site-language-button").waitFor();
        }
      };
      try {
        await go();
        const inventory = await page.evaluate(() => {
          const visible = element => Boolean(element.getClientRects().length && getComputedStyle(element).visibility !== "hidden");
          const label = element => (element.getAttribute("aria-label") || element.textContent || "").replace(/\s+/g, " ").trim();
          return {
            title: document.title, url: location.href, h1: [...document.querySelectorAll("h1")].map(label),
            overflow: document.documentElement.scrollWidth > innerWidth + 2,
            links: [...document.querySelectorAll("a")].map((element, index) => ({ index, label: label(element), href: element.getAttribute("href"), visible: visible(element), shared: Boolean(element.closest("header,footer")), menu: Boolean(element.closest("#main-navigation")) })),
            controls: [...document.querySelectorAll('button,summary,input,select,textarea,[role="button"]')].map(element => ({
              tag: element.tagName, label: label(element), name: element.getAttribute("name"), type: element.getAttribute("type"),
              visible: visible(element), disabled: element.disabled, expanded: element.getAttribute("aria-expanded"),
            })),
            headings: [...document.querySelectorAll("h1,h2,h3")].filter(visible).map(label),
          };
        });
        report.pages.push({ path, engine, ...inventory });
        if (inventory.overflow) report.issues.push({ path, issue: "horizontal-overflow" });
        for (const link of inventory.links) {
          if (!link.href || link.href === "#") report.issues.push({ path, issue: "empty-link", link });
          else if (new URL(link.href, origin + path).origin !== origin) report.externalLinks.push({ path, ...link });
        }
        // Exercise every rendered disclosure, including all FAQ answers.
        const details = await page.locator("details").count();
        for (let index = 0; index < details; index++) {
          const detail = page.locator("details").nth(index);
          const summary = detail.locator(":scope > summary");
          if (!(await summary.isVisible())) continue;
          const before = await detail.getAttribute("open");
          const label = await summary.innerText();
          await summary.click();
          assert.notEqual(await detail.getAttribute("open"), before, label);
          await summary.click();
          assert.equal(await detail.getAttribute("open"), before, label);
          report.actions.push({ path, engine, label, kind: "disclosure", result: "passed" });
        }
        const toggles = page.locator('button[aria-controls][aria-expanded]').filter({ visible: true });
        for (let index = 0; index < await toggles.count(); index++) {
          const menu = toggles.nth(index);
          const controlled = await menu.getAttribute("aria-controls");
          await menu.click();
          await page.waitForFunction(id => document.querySelector(`button[aria-controls="${id}"]`)?.getAttribute("aria-expanded") === "true", controlled);
          assert.equal(await menu.getAttribute("aria-expanded"), "true");
          assert.ok(await page.locator(`[id=${JSON.stringify(controlled)}]`).isVisible());
          await menu.click();
          await page.waitForFunction(id => document.querySelector(`button[aria-controls="${id}"]`)?.getAttribute("aria-expanded") === "false", controlled);
          assert.equal(await menu.getAttribute("aria-expanded"), "false");
          report.actions.push({ path, engine, kind: "expand-collapse", label: await menu.innerText(), result: "passed" });
        }
        if (process.env.PUBLIC_AUDIT_LINKS === "1" && (!linkPaths || linkPaths.includes(path))) {
          const seen = new Set();
          for (const link of inventory.links) {
            if ((!link.visible && !link.menu) || !link.href || link.href === "#") continue;
            const target = new URL(link.href, origin + path);
            if (target.origin !== origin || target.pathname.startsWith("/api/")) continue;
            // Shared header/footer implementations get a dedicated full check on
            // home and FAQ. Main-content links are clicked on every route.
            if (link.shared && !["/", "/faq", "/es", "/es/faq"].includes(path)) continue;
            const key = `${link.href}|${link.label}`;
            if (seen.has(key)) continue;
            seen.add(key);
            const action = { path, engine, label: link.label, href: link.href, kind: "link" };
            try {
              await go();
              if (link.menu) await page.locator('button[aria-controls="main-navigation"]').click();
              const candidate = link.menu
                ? page.locator(`#main-navigation a[href=${JSON.stringify(link.href)}]`).first()
                : page.locator(`a[href=${JSON.stringify(link.href)}]`).filter({ visible: true }).first();
              await candidate.scrollIntoViewIfNeeded();
              await candidate.click();
              await page.waitForTimeout(1400);
              const actual = new URL(page.url());
              const expected = new URL(signedOutDestinations[target.pathname] ?? target.href, origin);
              assert.equal(actual.pathname, expected.pathname, "destination page");
              assert.equal(actual.search, expected.search, "destination options");
              if (signedOutDestinations[target.pathname]) await page.locator(".account-login-form").waitFor();
              if (target.hash) {
                assert.equal(actual.hash, target.hash, "destination section");
                const box = await page.locator(`[id=${JSON.stringify(decodeURIComponent(target.hash.slice(1)))}]`).boundingBox();
                assert.ok(box && box.y < 844 && box.y + box.height > 0, `section must be on screen: ${box?.y}`);
              }
              assert.equal(await page.getByText("404", { exact: true }).count(), 0, "destination must exist");
              Object.assign(action, { result: "passed", destination: actual.href });
            } catch (error) {
              Object.assign(action, { result: "failed", error: error.message });
              report.issues.push(action);
            }
            report.actions.push(action);
            writeReport();
            if (action.result === "failed") console.log(`FAILED LINK ${engine} ${path} ${link.href}: ${action.error}`);
          }
        }
        if (errors.length) report.issues.push({ path, issue: "browser-errors", errors: [...new Set(errors)] });
        console.log(`CHECKED ${engine} ${path}: ${inventory.links.length} links, ${inventory.controls.length} controls`);
      } catch (error) {
        report.issues.push({ path, engine, issue: "page-check-failed", error: error.message, actualUrl: page.url() });
        await page.screenshot({ path: resolve(output, engine + path.replaceAll("/", "-") + "-failure.png"), fullPage: true }).catch(() => {});
        console.log(`FAILED ${path}: ${error.message}`);
      } finally {
        writeReport();
        await context.close();
      }
    }
  } finally { await browser.close(); }
}
console.log(JSON.stringify({ pages: report.pages.length, actions: report.actions.length, issues: report.issues }, null, 2));
if (report.issues.length) process.exitCode = 1;
