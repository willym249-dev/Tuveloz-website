import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const source = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("/join is a dedicated provider page, not the customer homepage", async () => {
  const [page, landing] = await Promise.all([
    source("app/join/page.tsx"),
    source("app/join/provider-landing.tsx"),
  ]);

  // The provider ad click must not land on customer copy.
  assert.doesNotMatch(page, /TuvelozPublic/);
  assert.match(page, /ProviderLanding/);
  assert.match(page, /alternates: \{ canonical: "\/join" \}/);

  assert.match(landing, /Get local vehicle-service opportunities\./);
  assert.match(landing, /Free to join/);
  assert.match(landing, /Keep 100% of your quoted price/);
  assert.match(landing, /No exclusivity/);
  assert.match(landing, /Apply in about 5 minutes/);
  assert.match(landing, /<ProviderSignupForm \/>/);
  assert.match(landing, /track\("provider_signup_started"\)/);

  // Nothing that competes with the application belongs on this path.
  assert.doesNotMatch(landing, /expansion-form|feedback-form|Request my area|Send feedback/);
  assert.doesNotMatch(landing, /waitlist/i);
});

test("the provider application asks for a category before showing the job catalog", async () => {
  const form = await source("app/components/provider-signup-form.tsx");

  assert.match(form, /type SignupStep = 1 \| 2 \| 3 \| 4;/);
  assert.match(form, /name="provider-category"/);
  assert.match(form, /What kind of work do you do\?/);
  assert.match(form, /Pick the exact jobs you do/);

  // Only the chosen category's jobs render up front; the rest stay behind a
  // disclosure and only when they can still be combined.
  assert.match(form, /activeCategory\?\.services \?\? \[\]/);
  assert.match(form, /combinableCategories/);

  // Progress, time estimate, save-and-return, and what-happens-next.
  assert.match(form, /role="progressbar"/);
  assert.match(form, /ESTIMATED_MINUTES = 5/);
  assert.match(form, /about \$\{ESTIMATED_MINUTES\} minutes in total/);
  assert.match(form, /Save and finish later/);
  assert.match(form, /Your answers save themselves on this device/);
  assert.match(form, /What happens after you submit/);

  // Business-step edits still invalidate an outstanding verification code.
  assert.match(form, /closest\("\[data-signup-step='4'\]"\)/);
  assert.match(form, /data-signup-step="4"/);
});

test("the homepage separates customer and provider modes", async () => {
  const [homepage, layout] = await Promise.all([
    source("app/page.tsx"),
    source("app/components/audience-switch.tsx"),
  ]);

  assert.match(layout, /For customers/);
  assert.match(layout, /For providers/);
  assert.match(homepage, /<AudienceSwitch active=\{audience\} onSelect=\{chooseAudience\} \/>/);

  // Provider recruitment leads while customer jobs are closed.
  assert.match(homepage, /CUSTOMER_JOB_POSTING_PAUSED \? "providers" : "customers"/);
  assert.match(homepage, /Grow your vehicle-service business with local opportunities\./);
  assert.match(homepage, /Compare quotes from local vehicle-service providers\./);
  assert.match(homepage, /See how Tuveloz will work/);

  // Customer-only and provider-only sections are gated, and the long
  // two-audience page stays on /about.
  assert.match(homepage, /const showProviderSide = !isHome \|\| audience === "providers"/);
  assert.match(homepage, /const showCustomerSide = !isHome \|\| audience === "customers"/);
  assert.match(homepage, /\{!isHome && \(\n {6}<section className="section expansion-section"/);
  assert.match(homepage, /\{!isHome && \(\n {6}<section className="section feedback-section"/);

  // The homepage links to the dedicated application instead of embedding it.
  assert.doesNotMatch(homepage, /ProviderSignupForm/);
});

test("customers can join a waitlist without creating an account", async () => {
  const [homepage, route, lib] = await Promise.all([
    source("app/page.tsx"),
    source("app/api/customer-waitlist/route.ts"),
    source("lib/customer-waitlist.ts"),
  ]);

  assert.match(homepage, /Get notified when vehicle-service requests open\./);
  assert.match(homepage, /name="waitlist-email"/);
  assert.match(homepage, /name="waitlist-zip"/);
  assert.match(homepage, /name="waitlist-service"/);
  assert.doesNotMatch(homepage, /name="waitlist-password"/);
  // A full account stays available, just no longer the only option.
  assert.match(homepage, /Create customer account/);

  assert.match(route, /zipIsInsideCurrentLaunchArea/);
  assert.match(route, /customerWaitlistSignups/);
  assert.match(route, /CUSTOMER_WAITLIST_SERVICE_VALUES\.has\(service\)/);
  // Recording interest must not create an account, request, or payment.
  assert.doesNotMatch(route, /accountCredentials|customerRequests|stripe/i);

  assert.match(lib, /\/\^20\[89\]\\d\{2\}\$\//);
});

test("compliance detail lives on its own page and stays collapsed in the application", async () => {
  const [requirements, sitemap, form, landing] = await Promise.all([
    source("app/provider-requirements/page.tsx"),
    source("app/sitemap.ts"),
    source("app/components/provider-signup-form.tsx"),
    source("app/join/provider-landing.tsx"),
  ]);

  assert.match(requirements, /Montgomery County repair registration/);
  assert.match(requirements, /Insurance and coverage/);
  assert.match(requirements, /Environmental rules/);
  assert.match(requirements, /Service-specific rules/);
  assert.match(sitemap, /path: "\/provider-requirements"/);

  // The short version sits next to the form; the long version is one click away.
  assert.match(
    form,
    /Requirements depend on your services\. We'll show you exactly what applies before activation\./,
  );
  assert.match(form, /<details className="legal-note-details">/);
  assert.match(landing, /href="\/provider-requirements"/);
});

test("site metadata names the service and the place, and declares one entity", async () => {
  const layout = await source("app/layout.tsx");

  assert.match(layout, /Tuveloz — Vehicle-Service Marketplace in Montgomery County, MD/);
  assert.match(layout, /alternates: \{ canonical: "\/" \}/);
  assert.match(layout, /"@type": "WebSite"/);
  assert.match(layout, /legalName: "TUVELOZ LLC"/);
  // Tuveloz is the marketplace operator, never presented as a repair business.
  assert.doesNotMatch(layout, /AutoRepair|AutomotiveBusiness/);
});
