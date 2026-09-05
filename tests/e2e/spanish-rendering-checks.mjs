import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import ts from "typescript";

function sourceModule(name) {
  const exports = {};
  const source = readFileSync(new URL(`../../lib/${name}.ts`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
  }).outputText;
  new Function("exports", compiled)(exports);
  return exports;
}
const { SPANISH_READY_PATHS, spanishPathFor } = sourceModule("spanish-routes");
const { spanishText } = sourceModule("spanish-dictionary");
const englishOnly = Object.keys(spanishText).filter((key) => key !== spanishText[key]);

/** Uses the account fixture's isolated browser/server; never submits an application. */
export async function assertSpanishRendering(browser, origin, log) {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (/hydration|server rendered|didn't match|Each child.*key/i.test(message.text())) {
      errors.push(message.text());
    }
  });
  page.on("response", (response) => {
    if (new URL(response.url()).pathname.startsWith("/es") && response.status() >= 400) {
      errors.push(`${response.status()} ${response.url()}`);
    }
  });
  const waitForLanguage = async (language) => {
    await page.waitForFunction((value) => document.documentElement.lang === value, language);
    await page.getByRole("button", { name: language === "es"
      ? "Change the whole page to English" : "Cambiar toda la página a español", exact: true }).waitFor();
  };
  try {
    for (const englishPath of SPANISH_READY_PATHS) {
      const path = spanishPathFor(englishPath);
      const response = await page.goto(`${origin}${path}`, { waitUntil: "domcontentloaded" });
      assert.equal(response.status(), 200, path);
      const raw = await response.text();
      assert.match(raw, /<html[^>]*lang="es"/, path);
      assert.ok(raw.includes(spanishText["Preparing to launch · Montgomery County, MD"]), `${path}: Spanish must come from the server`);
      await waitForLanguage("es");
      await page.waitForFunction((url) => document.querySelector('link[rel="canonical"]')?.getAttribute("href") === url,
        `https://tuveloz.com${path}`);
      assert.equal(await page.locator('meta[property="og:url"]').getAttribute("content"), `https://tuveloz.com${path}`);
      assert.equal(await page.locator('meta[property="og:locale"]').getAttribute("content"), "es_US");
      const untranslated = await page.evaluate((knownEnglish) => {
        const known = new Set(knownEnglish);
        const found = [];
        const excluded = "script, style, [data-language-control], [data-no-interface-translation], [data-manual-language]";
        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let node = walker.nextNode(); node; node = walker.nextNode()) {
          const text = node.nodeValue?.trim();
          if (text && !node.parentElement?.closest(excluded) && known.has(text)) found.push(text);
        }
        for (const element of document.querySelectorAll("[placeholder], [aria-label], [title]")) {
          if (element.closest(excluded)) continue;
          for (const attribute of ["placeholder", "aria-label", "title"]) {
            const text = element.getAttribute(attribute)?.trim();
            if (known.has(text)) found.push(text);
          }
        }
        return [...new Set(found)];
      }, englishOnly);
      assert.deepEqual(untranslated, [], `${path}: reviewed interface text stayed English`);
      assert.equal(await page.locator('[data-testid="vinext-dev-error-backdrop"]').count(), 0, path);
      assert.deepEqual(errors, [], `${path}: browser errors must fail, including hydration recovery`);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `${path}: mobile overflow`);
      log(`PASS — ${path}: Spanish SSR, hydration, copy, metadata and mobile width`);
    }

    // A real navigation must keep Spanish; entering a legal page must reset
    // the retained layout, including its launch banner, to reviewed English.
    await page.goto(`${origin}/es/join`, { waitUntil: "domcontentloaded" });
    await waitForLanguage("es");
    await page.getByRole("link", { name: "Vea cómo funciona →", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/es/how-it-works");
    await waitForLanguage("es");
    await page.locator('a[href="/terms"]').click();
    await page.waitForURL((url) => url.pathname === "/terms");
    await page.waitForFunction(() => document.documentElement.lang === "en"
      && document.querySelector(".tuveloz-launch-pause-heading strong")?.textContent?.startsWith("Preparing to launch"));
    assert.equal(await page.locator("h1").textContent(), "Terms of Use");
    assert.equal(await page.locator("[data-language-control]").count(), 0);

    // Changing language must keep the same checked service and entered email.
    await page.goto(`${origin}/join`, { waitUntil: "domcontentloaded" });
    await waitForLanguage("en");
    await page.locator(".provider-service-groups .service-group > summary").first().click();
    const service = page.locator('input[name="provider-service"]').first();
    const serviceValue = await service.getAttribute("value");
    await service.check();
    await page.locator('input[name="provider-email"]').fill("e2e-language@tuveloz.invalid");
    await page.getByRole("button", { name: "Cambiar toda la página a español", exact: true }).click();
    await waitForLanguage("es");
    assert.equal(await service.isChecked(), true);
    assert.equal(await service.getAttribute("value"), serviceValue);
    assert.equal(await page.locator('input[name="provider-email"]').inputValue(), "e2e-language@tuveloz.invalid");
    await page.getByRole("button", { name: "Continuar →", exact: true }).click();
    await page.locator('[data-signup-step="2"]').waitFor();
    await page.getByRole("button", { name: "← Regresar", exact: true }).click();
    await page.locator('[data-signup-step="1"]').waitFor();
    assert.equal(await service.isChecked(), true);
    assert.equal(await page.locator('input[name="provider-email"]').inputValue(), "e2e-language@tuveloz.invalid");
    await page.getByRole("button", { name: "Change the whole page to English", exact: true }).click();
    await waitForLanguage("en");
    assert.equal(await service.isChecked(), true);

    // Direct Spanish URLs return to their matching English URL without losing
    // the locally saved application draft or attribution/anchor.
    await page.goto(`${origin}/es/join?ref=local#provider-apply`, { waitUntil: "domcontentloaded" });
    await waitForLanguage("es");
    await page.getByRole("button", { name: "Change the whole page to English", exact: true }).click();
    await page.waitForURL((url) => url.pathname === "/join" && url.search === "?ref=local" && url.hash === "#provider-apply");
    await waitForLanguage("en");
    await page.waitForFunction(() => document.querySelector('input[name="provider-email"]')?.value === "e2e-language@tuveloz.invalid");
    assert.equal(await service.isChecked(), true);
    assert.deepEqual(errors, [], "Spanish and English navigation must not produce browser errors");
    log("PASS — language navigation, English legal layout, form forward/back steps and saved draft survive switching");
  } finally {
    await page.close();
  }
}
