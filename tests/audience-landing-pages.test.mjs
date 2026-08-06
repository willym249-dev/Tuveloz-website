import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");
const forCustomers = await source("app/for-customers/page.tsx");
const join = await source("app/join/page.tsx");
const homepage = await source("app/page.tsx");
const sitemap = await source("app/sitemap.ts");

test("each audience has its own landing route", () => {
  assert.match(forCustomers, /TuvelozPublic view="request"/);
  assert.match(join, /TuvelozPublic view="provider"/);
  assert.match(homepage, /return <TuvelozPublic view="home" \/>/);

  // Distinct titles, so the two pages are not competing duplicates.
  const title = (page) => page.match(/title:\s*"([^"]+)"/)?.[1];
  assert.notEqual(title(forCustomers), title(join));
  assert.match(title(forCustomers), /customer/i);
  assert.match(title(join), /provider/i);
});

test("both landing pages are listed for search engines", () => {
  assert.match(sitemap, /path: "\/for-customers"/);
  assert.match(sitemap, /path: "\/join"/);
});

test("each view emits exactly one h1, and it is the hero's", () => {
  // Sections below the hero used to promote their own heading to h1 for their
  // audience, which left /join, /about and the customer page with two
  // competing h1s. Every h1 now lives in the hero's branches.
  const heroStart = homepage.indexOf('<section className="hero"');
  const heroEnd = homepage.indexOf('className="hero-visual"');
  const beforeHero = homepage.slice(0, heroStart);
  const afterHero = homepage.slice(heroEnd);

  assert.equal((beforeHero.match(/<h1[\s>]/g) || []).length, 0);
  assert.equal(
    (afterHero.match(/<h1[\s>]/g) || []).length,
    0,
    "no section below the hero may emit an h1",
  );
  assert.equal(
    (homepage.slice(heroStart, heroEnd).match(/<h1[\s>]/g) || []).length,
    5,
    "expected one h1 per hero audience branch",
  );
});

test("the customer landing page cannot submit a job while posting is paused", () => {
  // The request view reaches the same section the homepage uses, so the paused
  // branch must offer account signup only — never the request form.
  const requestSection = homepage.slice(homepage.indexOf('className="section request-section"'));
  const pausedBranch = requestSection.slice(
    requestSection.indexOf("{CUSTOMER_JOB_POSTING_PAUSED ? ("),
  );
  const formAt = pausedBranch.indexOf("<form");
  const elseAt = pausedBranch.indexOf(") : (");

  assert.ok(formAt === -1 || formAt > elseAt, "the request form must sit in the unpaused branch");
  assert.match(pausedBranch, /Prepare for launch without submitting a job/);
});
