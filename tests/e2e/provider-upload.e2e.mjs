// Real browser image decoding, resizing and upload-form behavior. Only synthetic
// documents and a loopback receiver are used; no account, vendor or mail is used.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdirSync, writeFileSync } from "node:fs";
import { createServer } from "node:http";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium, webkit } from "playwright";
import { build } from "vite";

const root = fileURLToPath(new URL("../..", import.meta.url));
const outputDir = process.argv[2] ? resolve(process.argv[2]) : null;
if (outputDir) mkdirSync(outputDir, { recursive: true });
const hash = bytes => createHash("sha256").update(bytes).digest("hex");
const builds = await build({
  root, configFile: false, envFile: false, logLevel: "error",
  define: { "process.env.NODE_ENV": '"production"' },
  build: {
    write: false,
    lib: { entry: resolve(root, "tests/e2e/fixtures/provider-upload.tsx"), name: "UploadFixture", formats: ["iife"] },
  },
});
const bundle = Array.isArray(builds) ? builds[0] : builds;
const assets = new Map(bundle.output.map(asset => [`/${asset.fileName}`, asset.type === "chunk" ? asset.code : asset.source]));
const js = bundle.output.find(asset => asset.type === "chunk").fileName;
const css = bundle.output.find(asset => asset.fileName.endsWith(".css")).fileName;
const uploads = [];
let nextStatus = 200;
const server = createServer(async (request, response) => {
  try {
    const path = request.url.split("?")[0];
    if (path === "/api/provider-evidence") {
      const chunks = [];
      for await (const chunk of request) chunks.push(chunk);
      const form = await new Request("http://127.0.0.1/api/provider-evidence", {
        method: "POST", headers: request.headers, body: Buffer.concat(chunks),
      }).formData();
      const file = form.get("document");
      const bytes = Buffer.from(await file.arrayBuffer());
      uploads.push({ bytes, name: file.name, type: file.type, size: file.size, issuer: form.get("issuer") });
      // Yield before success to exercise the old React currentTarget/reset bug.
      await new Promise(done => setTimeout(done, 25));
      response.writeHead(nextStatus, { "content-type": "application/json" });
      response.end(JSON.stringify(nextStatus === 200 ? { message: "fixture received" } : { error: "The document must be 3.5 MB or smaller." }));
      nextStatus = 200;
      return;
    }
    if (assets.has(path)) {
      response.writeHead(200, { "content-type": path.endsWith(".css") ? "text/css" : "text/javascript" });
      response.end(assets.get(path));
      return;
    }
    response.writeHead(200, { "content-type": "text/html" });
    response.end(`<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/${css}"></head><body><div id="root"></div><script src="/${js}"></script></body></html>`);
  } catch (error) {
    response.writeHead(500);
    response.end(String(error));
  }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const origin = `http://127.0.0.1:${server.address().port}`;
const report = { testedAt: new Date().toISOString(), maximumBytes: 3_500_000, browsers: [] };
let fixtures;

// Add valid JPEG comment segments when needed, never truncate the image data.
function largeJpeg(original) {
  const exif = Buffer.from("ffe100224578696600004d4d002a00000008000101120003000000010006000000000000", "hex");
  const parts = [original.subarray(0, 2), exif];
  let length = original.length + exif.length;
  while (length <= 3_500_000) {
    const comment = Buffer.alloc(60_004, 32);
    comment[0] = 255; comment[1] = 254; comment.writeUInt16BE(60_002, 2);
    parts.push(comment); length += comment.length;
  }
  return Buffer.concat([...parts, original.subarray(2)]);
}

try {
  for (const browserType of [chromium, webkit]) {
    const browser = await browserType.launch({ headless: true });
    try {
      const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      await page.route("**/*", route => route.request().url().startsWith(origin) || route.request().url().startsWith("blob:") ? route.continue() : route.abort());
      await page.goto(origin);
      await page.locator('input[type="file"]').waitFor();
      if (!fixtures) {
        const encoded = await page.evaluate(() => {
          const canvas = document.createElement("canvas");
          canvas.width = 3000; canvas.height = 4000;
          const ctx = canvas.getContext("2d");
          const pixels = ctx.createImageData(3000, 4000);
          let seed = 73;
          for (let y = 0; y < 4000; y++) for (let x = 0; x < 3000; x++) {
            const offset = (y * 3000 + x) * 4;
            const border = x < 350 || x >= 2650 || y < 350 || y >= 3650;
            for (let channel = 0; channel < 3; channel++) {
              seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
              pixels.data[offset + channel] = border ? seed >>> 24 : 255;
            }
            pixels.data[offset + 3] = 255;
          }
          ctx.putImageData(pixels, 0, 0);
          ctx.fillStyle = "#111111";
          ctx.font = "bold 72px Arial";
          ctx.fillText("SYNTHETIC DOCUMENT TEST", 450, 580);
          ctx.font = "48px Arial";
          const lines = [
            "EXAMPLE ONLY - NOT A REAL INSURANCE POLICY",
            "Business: Example Vehicle Services",
            "Policy number: SAMPLE-123456789",
            "Effective date: 01/01/2030",
            "Expiration date: 01/01/2031",
            "Named services: Synthetic test fixture only",
            "Keep the full page and all four corners visible.",
          ];
          lines.forEach((line, index) => ctx.fillText(line, 450, 820 + index * 150));
          for (const [color, x, y] of [["#ff0000", 70, 70], ["#0000ff", 2730, 70], ["#00ff00", 2730, 3730], ["#ff9900", 70, 3730]]) {
            ctx.fillStyle = color; ctx.fillRect(x, y, 200, 200);
          }
          return { png: canvas.toDataURL("image/png").split(",")[1], jpeg: canvas.toDataURL("image/jpeg", 0.94).split(",")[1] };
        });
        fixtures = { png: Buffer.from(encoded.png, "base64"), jpeg: largeJpeg(Buffer.from(encoded.jpeg, "base64")) };
        for (const file of Object.values(fixtures)) assert.ok(file.length > 3_500_000 && file.length <= 20_000_000);
      }
      const input = page.locator('input[type="file"]');
      const submit = page.locator('button[type="submit"]');
      const results = { browser: browserType.name(), cases: [], resized: [] };
      await page.locator('[name="expiresAt"]').fill("2031-01-01");
      const chooserPromise = page.waitForEvent("filechooser");
      await page.locator(".provider-document-picker").click();
      const chooser = await chooserPromise;
      await chooser.setFiles({ name: "synthetic-document.png", mimeType: "image/png", buffer: fixtures.png });
      await page.getByRole("img", { name: "Resized document preview" }).waitFor();
      const preview = await page.locator(".provider-document-preview img").evaluate(async img => {
        await img.decode();
        const bytes = await (await fetch(img.src)).arrayBuffer();
        const digest = await crypto.subtle.digest("SHA-256", bytes);
        return { width: img.naturalWidth, height: img.naturalHeight, size: bytes.byteLength, hash: [...new Uint8Array(digest)].map(value => value.toString(16).padStart(2, "0")).join("") };
      });
      assert.deepEqual([preview.width, preview.height], [2400, 3200]);
      assert.ok(preview.size <= 3_500_000);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true);
      const prior = uploads.length;
      await submit.click();
      assert.equal(uploads.length, prior, "resized photo requires a readability check");
      await page.getByRole("checkbox").check();
      await submit.click();
      await page.getByRole("status").filter({ hasText: "Uploaded privately" }).waitFor();
      assert.equal(uploads.length, prior + 1);
      assert.equal(hash(uploads.at(-1).bytes), preview.hash, "upload must contain the exact reviewed preview");
      assert.equal(await input.inputValue(), "");
      assert.equal(await page.getByRole("alert").count(), 0);
      results.cases.push("translated picker opens file chooser; photo preview matches upload; readability confirmation; async success resets without false error; mobile fits");
      results.resized.push({ kind: "png", inputBytes: fixtures.png.length, ...preview });
      if (outputDir) writeFileSync(resolve(outputDir, `${browserType.name()}-resized.jpg`), uploads.at(-1).bytes);

      await page.getByRole("button", { name: "Español", exact: true }).click();
      await input.setInputFiles({ name: "all-pages.pdf", mimeType: "application/pdf", buffer: Buffer.alloc(3_500_001) });
      await page.getByRole("alert").filter({ hasText: "Este PDF supera los 3.5 MB" }).waitFor();
      assert.match(await page.getByRole("alert").innerText(), /todas las páginas/);
      assert.equal(await submit.isDisabled(), true);
      await page.getByRole("button", { name: "English", exact: true }).click();
      assert.match(await page.getByRole("alert").innerText(), /This PDF is over 3.5 MB/);
      await page.getByRole("button", { name: "Español", exact: true }).click();
      results.cases.push("large PDF is blocked with all-pages guidance; displayed error translates immediately in both languages");

      await input.setInputFiles({ name: "rotated-phone.jpg", mimeType: "image/jpeg", buffer: fixtures.jpeg });
      await page.getByRole("img", { name: "Vista previa del documento reducido" }).waitFor();
      const rotated = await page.locator(".provider-document-preview img").evaluate(async img => {
        await img.decode();
        return { width: img.naturalWidth, height: img.naturalHeight };
      });
      assert.deepEqual(rotated, { width: 3200, height: 2400 }, "EXIF rotation must remain applied after resizing");
      await page.getByRole("checkbox", { name: "El documento completo se ve claro y se puede leer." }).check();
      await page.locator('[name="expiresAt"]').fill("2031-01-01");
      if (outputDir) await page.screenshot({ path: resolve(outputDir, `${browserType.name()}-spanish-mobile.png`), fullPage: true });
      await submit.click();
      await page.getByRole("status").filter({ hasText: "Documento enviado de forma privada" }).waitFor();
      assert.ok(uploads.at(-1).size <= 3_500_000);
      results.resized.push({ kind: "jpeg-exif-6", inputBytes: fixtures.jpeg.length, outputBytes: uploads.at(-1).size, ...rotated });
      results.cases.push("Spanish labels, preview, checkbox, button and success; JPEG EXIF orientation retained");

      await input.setInputFiles({ name: "broken.png", mimeType: "image/png", buffer: Buffer.alloc(3_600_000) });
      await page.getByRole("alert").filter({ hasText: "No pudimos preparar esta foto" }).waitFor();
      assert.equal(await submit.isDisabled(), true);
      const pdf = Buffer.from("%PDF-1.7\nSynthetic page one\nSynthetic page two\nSignature fixture\n%%EOF");
      await input.setInputFiles({ name: "all-pages.pdf", mimeType: "application/pdf", buffer: pdf });
      await page.locator('[name="expiresAt"]').fill("2031-01-01");
      nextStatus = 400;
      await submit.click();
      await page.getByRole("alert").filter({ hasText: "El documento debe tener un tamaño de 3.5 MB o menos." }).waitFor();
      assert.notEqual(await input.inputValue(), "", "failed upload preserves selected file");
      await submit.click();
      await page.getByRole("status").filter({ hasText: "Documento enviado" }).waitFor();
      assert.equal(hash(uploads.at(-1).bytes), hash(pdf), "PDF content must be unchanged");
      results.cases.push("corrupt photo fails safely; server size error translated; retry keeps file; PDF bytes preserved");

      await page.goto(`${origin}/?spanish&refresh-fails`);
      await page.getByRole("button", { name: "Español", exact: true }).waitFor();
      assert.equal(await page.locator("form").getAttribute("lang"), "es");
      await input.setInputFiles({ name: "all-pages.pdf", mimeType: "application/pdf", buffer: pdf });
      await page.locator('[name="expiresAt"]').fill("2031-01-01");
      await submit.click();
      await page.getByRole("status").filter({ hasText: "Su documento ya se envió" }).waitFor();
      assert.equal(await page.getByRole("alert").count(), 0);
      results.cases.push("provider's Spanish preference is honored; refresh failure never asks for duplicate upload");
      assert.deepEqual(errors, []);
      report.browsers.push(results);
      console.log(`[provider-upload] ${browserType.name()}: ${results.cases.length} scenarios passed; ${JSON.stringify(results.resized)}`);
    } finally {
      await browser.close();
    }
  }
} finally {
  await new Promise(done => server.close(done));
  if (outputDir) writeFileSync(resolve(outputDir, "verification.json"), JSON.stringify(report, null, 2));
}
