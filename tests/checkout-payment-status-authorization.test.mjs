import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const read = (path) => readFile(new URL(`../${path}`, import.meta.url), "utf8");

test("Stripe session IDs never authorize payment-status disclosure by themselves", async () => {
  const route = await read("app/api/stripe/checkout/route.ts");
  const get = route.slice(
    route.indexOf("export async function GET"),
    route.indexOf("export async function POST"),
  );
  const sessionBranch = get.slice(
    get.indexOf("if (sessionId)"),
    get.indexOf('runtimeMarketplaceActionAllowed("checkout")'),
  );

  assert.match(sessionBranch, /getAccountSession\(request\)/);
  assert.match(sessionBranch, /accountSession\?\.role === "customer"/);
  assert.match(sessionBranch, /payment\.customerEmail\.toLowerCase\(\)/);
  assert.match(sessionBranch, /payment\.paymentType === "product"/);
  assert.match(sessionBranch, /\? !payment\.requestId/);
  assert.match(sessionBranch, /request\.headers\.get\(REQUEST_ACCESS_TOKEN_HEADER\)/);
  assert.match(sessionBranch, /privateTokenMatches = payment\.paymentType === "quote"/);
  assert.match(
    sessionBranch,
    /customerRequest\.customerEmail\.toLowerCase\(\)[\s\S]{0,100}payment\.customerEmail\.toLowerCase\(\)/,
  );
  assert.match(sessionBranch, /constantTimeTokenMatch\(privateRequestToken, customerRequest\.accessToken\)/);
  assert.match(sessionBranch, /if \(!signedInCustomerMatches && !privateTokenMatches\)/);
  assert.match(sessionBranch, /status: 404, headers: PRIVATE_NO_STORE_HEADERS/);
  assert.match(sessionBranch, /publicPaymentSummary\(payment\)/);
  assert.ok(
    sessionBranch.indexOf("if (!signedInCustomerMatches && !privateTokenMatches)")
      < sessionBranch.indexOf("publicPaymentSummary(payment)"),
  );
  assert.match(route, /"cache-control": "private, no-store"/);
});

test("customer-specific checkout readiness responses are private and never cached", async () => {
  const route = await read("app/api/stripe/checkout/route.ts");
  const readinessBranch = route.slice(
    route.indexOf('const quoteId = clean(searchParams.get("quoteId")'),
    route.indexOf("export async function POST"),
  );

  assert.match(readinessBranch, /status: 404, headers: PRIVATE_NO_STORE_HEADERS/);
  assert.match(
    readinessBranch,
    /reason: "Test jobs never create real or sandbox payments\."[\s\S]{0,100}headers: PRIVATE_NO_STORE_HEADERS/,
  );
  assert.match(
    readinessBranch,
    /response\.headers\.set\("cache-control", PRIVATE_NO_STORE_HEADERS\["cache-control"\]\)/,
  );
  assert.equal(
    (readinessBranch.match(/headers: PRIVATE_NO_STORE_HEADERS/g) ?? []).length,
    6,
  );
});

test("guest checkout keeps the private request token out of Stripe and URL parameters", async () => {
  const [card, success, route] = await Promise.all([
    read("app/components/quote-payment-card.tsx"),
    read("app/success/page.tsx"),
    read("app/api/stripe/checkout/route.ts"),
  ]);

  assert.match(card, /sessionStorage\.setItem\(CHECKOUT_STATUS_TOKEN_KEY, accessToken\)/);
  assert.match(card, /"x-tuveloz-request-token": accessToken/);
  assert.doesNotMatch(card, /token: accessToken,[\s\S]{0,120}fetch\(`\/api\/stripe\/checkout\?\$\{query\}`/);
  assert.ok(
    card.indexOf("sessionStorage.setItem(CHECKOUT_STATUS_TOKEN_KEY, accessToken)")
      < card.indexOf("window.location.assign(result.url)"),
  );
  assert.match(success, /sessionStorage\.getItem\(CHECKOUT_STATUS_TOKEN_KEY\)/);
  assert.match(success, /\[REQUEST_ACCESS_TOKEN_HEADER\]: privateRequestToken/);
  assert.doesNotMatch(success, /searchParams\.get\("token"\)/);
  assert.doesNotMatch(route, /searchParams\.get\("token"\)/);
  assert.match(route, /request\.headers\.get\(REQUEST_ACCESS_TOKEN_HEADER\)/);
  assert.match(
    route,
    /success_url: `\$\{rootUrl\}\/success\?session_id=\{CHECKOUT_SESSION_ID\}`/,
  );
  assert.doesNotMatch(route, /success_url:[^\n]*token=/);
});
