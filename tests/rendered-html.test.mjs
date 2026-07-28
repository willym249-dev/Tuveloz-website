import assert from "node:assert/strict";
import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";

async function builtFiles(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const path = join(directory, entry.name);
    return entry.isDirectory() ? builtFiles(path) : [path];
  }));
  return nested.flat();
}

test("build contains separate tint, rain-guard, and sunshade services", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Window tint installation quote"));
  assert.ok(contents.includes("Rain guard / vent visor installation"));
  assert.ok(contents.includes("Vehicle sunshade installation"));
});

test("build contains permanent provider QR controls and privacy-safe scan totals", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Your permanent provider QR"));
  assert.ok(contents.includes("Total QR scans"));
  assert.ok(contents.includes("no customer or device tracking"));
});

test("build contains editable provider previews and printable QR business cards", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Live customer preview"));
  assert.ok(contents.includes("Tuveloz keeps every page clean, consistent, and professional."));
  assert.ok(contents.includes("Printable business cards"));
  assert.ok(contents.includes("Print 10 business cards"));
  assert.ok(contents.includes("provider-card-print-sheet"));
});

test("build clearly explains customer choice and provider freedom", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Choice for customers. Freedom for providers."));
  assert.ok(contents.includes("Compare providers and quotes"));
  assert.ok(contents.includes("Use one simple job workspace"));
  assert.ok(contents.includes("Request tools that help you grow"));
  assert.ok(contents.includes("Get approved. Review matching jobs. Run your business your way."));
});

test("build contains a simple, protected quote choice and factual private analytics", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Choose provider"));
  assert.ok(contents.includes("Not this one"));
  assert.ok(contents.includes("Confirm this quote?"));
  assert.ok(contents.includes("Confirm quote"));
  assert.ok(contents.includes("Go back"));
  assert.ok(contents.includes("View provider details"));
  assert.ok(contents.includes("Pass without sharing a reason"));
  assert.ok(contents.includes("Private analytics"));
  assert.ok(contents.includes("Accepted among decided quotes"));
  assert.ok(contents.includes("Optional feedback shown only as combined totals"));
});

test("build prefers confirmed vehicle choices and never invents motor data", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("My make is not listed"));
  assert.ok(contents.includes("My model is not listed"));
  assert.ok(contents.includes("No confirmed motor / engine choice was returned."));
  assert.ok(contents.includes("Tuveloz does not guess motor or engine details."));
  assert.ok(contents.includes("customer entered; provider must verify"));
  assert.ok(contents.includes("Motor/engine not provided"));
  assert.ok(contents.includes("Choose an official option above or type the engine here"));
  assert.ok(contents.includes("This typed value overrides the VIN or official choice"));
  assert.ok(contents.includes("Compare parts before you decide"));
  assert.ok(contents.includes("before choosing whether you or the provider should supply the parts"));
  assert.ok(contents.includes("Any special equipment or rental cost must be disclosed in the quote."));
});

test("build contains global language, optional budget details, repeat booking, and honest price guidance", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Change the whole page to English"));
  assert.ok(!contents.includes("About how much is your budget?"));
  assert.ok(contents.includes("Include a budget here only if you want providers to see one."));
  assert.ok(contents.includes("Compare all matching providers instead"));
  assert.ok(contents.includes("Request") && contents.includes("again"));
  assert.ok(contents.includes("Observed Tuveloz price guide"));
  assert.ok(contents.includes("Not enough real completed jobs yet to publish a trustworthy price."));
  assert.ok(contents.includes("at least 3 real, non-test, completed"));
});

test("build itemizes provider-supplied parts separately from labor", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("If the provider supplies parts, the quote will show separate labor"));
  assert.ok(contents.includes("Labor ($)"));
  assert.ok(contents.includes("Parts price ($)"));
  assert.ok(contents.includes("laborPriceCents"));
  assert.ok(contents.includes("partsPriceCents"));
});

test("build protects every important submission with a second confirmation", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Confirm and post"));
  assert.ok(contents.includes("Confirm and apply"));
  assert.ok(contents.includes("Confirm and send"));
  assert.ok(contents.includes("Confirm quote"));
  assert.ok(contents.includes("Yes, submit quote"));
  assert.ok(contents.includes("Yes, update status"));
  assert.ok(contents.includes("Yes, publish review"));
  assert.ok(contents.includes("Confirm and save checklist"));
  assert.ok(contents.includes("Confirm and save record"));
  assert.ok(contents.includes("Confirm and publish"));
  assert.ok(contents.includes("Confirm upload"));
  assert.ok(contents.includes("Confirm removal"));
  assert.ok(contents.includes("Go back"));
});

test("build limits active service to Montgomery County and collects DMV expansion demand", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("DMV vehicle-service marketplace"));
  assert.ok(contents.includes("Operating now in Montgomery County, Maryland"));
  assert.ok(contents.includes("Tuveloz currently operates only in Montgomery County, Maryland."));
  assert.ok(contents.includes("Bring Tuveloz to your DMV area."));
  assert.ok(contents.includes("Request my area"));
  assert.ok(contents.includes("Enter a Montgomery County ZIP code"));
  assert.ok(contents.includes("DMV expansion demand"));
  assert.ok(!contents.includes("Pilot launch: Montgomery County, MD and Fairfax County, VA."));
});

test("build gives mobile mechanics and service-truck operators clear prominence", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Mobile mechanics, service-truck operators, and shop-based"));
  assert.ok(contents.includes("Mobile mechanics & service trucks"));
  assert.ok(contents.includes("Mobile mechanic or service truck"));
  assert.ok(contents.includes("mobile mechanic/service-truck interest"));
});

test("layout uses the enlarged drop favicon with a cache-busting filename", async () => {
  const favicon = await readFile(
    new URL("../public/tuveloz-favicon-v2.svg", import.meta.url),
    "utf8",
  );
  const layout = await readFile(
    new URL("../app/layout.tsx", import.meta.url),
    "utf8",
  );

  assert.ok(layout.includes("/tuveloz-favicon-v2.svg"));
  assert.ok(favicon.includes("M16 21.4"));
  assert.ok(favicon.includes("#FF6A00"));
});

test("provider approval requires applicable state and local proof without requesting unnecessary documents", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");

  assert.ok(contents.includes("Tuveloz must receive and verify proof before approval"));
  assert.ok(contents.includes("If none applies, no document is needed."));
  assert.ok(contents.includes("repair-registration proof received and verified"));
  assert.ok(contents.includes("cannot be verified until the state and local requirements"));
});

test("build keeps customer and provider access on Tuveloz private links", async () => {
  const distDirectory = fileURLToPath(new URL("../dist", import.meta.url));
  const files = (await builtFiles(distDirectory))
    .filter((path) => [".js", ".html"].includes(extname(path)));
  const contents = (await Promise.all(files.map((path) => readFile(path, "utf8")))).join("\n");
  const homeSource = await readFile(
    new URL("../app/page.tsx", import.meta.url),
    "utf8",
  );

  assert.ok(contents.includes("Your workspace stays on Tuveloz."));
  assert.ok(contents.includes("Customers and approved providers use private Tuveloz links."));
  assert.ok(contents.includes("Need your private link again?"));
  assert.ok(contents.includes("Save this private link."));
  assert.ok(!homeSource.includes("header-sign-in"));
  assert.ok(!homeSource.includes("signedIn"));
  assert.ok(homeSource.includes("Workspace help"));
});
