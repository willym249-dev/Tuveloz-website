import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const root = new URL("../", import.meta.url);
const route = readFileSync(new URL("app/api/stripe/checkout/route.ts", root), "utf8");
const compile = source => ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;

// Execute the actual customer preparation through session creation. Earlier
// authorization/consent and post-creation checks have their own route suites.
// These clients only capture synthetic requests; no SDK or network is loaded.
function harness({ signedIn = true, sameEmail = true, role = "customer", gates = [true],
  release = true, updateFailure = false, badReceipt = false } = {}) {
  const calls = { create: [], update: [], checkout: [], account: 0 };
  const customers = new Map();
  const idempotency = new Map();
  let gateIndex = 0;
  const allowed = async () => gates[Math.min(gateIndex++, gates.length - 1)];
  const stripeClient = {
    customers: {
      async create(params, options) {
        calls.create.push({ params, options });
        let customer = idempotency.get(options.idempotencyKey);
        if (!customer) {
          customer = { id: `cus_guest_${idempotency.size}`, ...params };
          idempotency.set(options.idempotencyKey, customer);
          customers.set(customer.id, customer);
        } else assert.deepEqual(params, customer.creationParams ?? params);
        customer.creationParams ??= structuredClone(params);
        return customer;
      },
      async update(id, params) {
        calls.update.push({ id, params });
        if (updateFailure === true || (updateFailure === "once" && calls.update.length === 1)) {
          throw new Error("Synthetic unavailable language update");
        }
        const customer = { ...(customers.get(id) ?? { id }), ...params };
        customers.set(id, customer);
        return badReceipt ? { ...customer, preferred_locales: [] } : customer;
      },
    },
    checkout: { sessions: { async create(params, options) {
      calls.checkout.push({ params, options });
      return { id: "cs_synthetic", url: "https://example.invalid/checkout" };
    } } },
  };
  const bindings = {
    stripeClient, customerEmail: "customer@example.invalid", paymentId: "synthetic-payment",
    getAccountSession: async () => signedIn ? { role,
      email: sameEmail ? "customer@example.invalid" : "other@example.invalid" } : null,
    getOrCreateStripeCustomer: async () => { calls.account++; return "cus_account"; },
    runtimeMarketplaceActionAllowed: allowed,
    StripeConfigurationError: class extends Error {},
    runtimeRealMarketplaceReleaseDecision: async () => ({ approved: release,
      providerOnboardingDecisionIds: [], transactionPilotDecisionIds: [], serviceActivationDecisionIds: [],
      checkedAt: "2026-10-01T00:00:00Z", validThrough: "2999-01-01" }),
    marketplacePausedResponse: () => ({ paused: true }),
    settlementStrategy: "separate_transfer", applicationFeeCents: 500,
    connectedAccountId: "acct_synthetic", transferGroup: "tuveloz_synthetic-payment", metadata: {},
    checkoutEligibilityValidThrough: "2999-01-01", lineItems: [{ price_data: { unit_amount: 10500 } }],
    hostedPaymentDisclosure: language => ({ locale: language }), rootUrl: "https://example.invalid",
    request: new Request("https://example.invalid/api/stripe/checkout"),
  };
  if (route.includes("prepareCheckoutReceiptCustomer")) {
    const exports = {};
    const source = readFileSync(new URL("lib/stripe-checkout-receipts.ts", root), "utf8");
    new Function("exports", "require", compile(source))(exports, () => bindings);
    Object.assign(bindings, exports);
  }
  const start = route.lastIndexOf("const accountSession = await getAccountSession(request);");
  const end = route.indexOf("if (!checkoutSession.url)", start);
  assert.ok(start > 0 && end > start);
  const body = compile(`async function run(body: { language: string }) {
    const checkoutLanguage = body.language;
    ${route.slice(start, end)}
    return checkoutSession;
  }`);
  const run = new Function(...Object.keys(bindings), `${body}; return run;`)(...Object.values(bindings));
  return { run, calls, customers, prepare: bindings.prepareCheckoutReceiptCustomer
    ? input => bindings.prepareCheckoutReceiptCustomer(stripeClient, input) : null };
}

for (const signedIn of [true, false]) for (const language of ["en", "es"]) {
  test(`${language} receipt language reaches Stripe before ${signedIn ? "account" : "guest"} checkout`, async () => {
    const fixture = harness({ signedIn });
    await fixture.run({ language });
    const session = fixture.calls.checkout[0].params;
    assert.equal(session.locale, language);
    assert.ok(session.customer, "a receipt needs a Customer with a language preference");
    assert.equal(fixture.customers.get(session.customer)?.preferred_locales[0], language);
    assert.equal(session.customer_email, undefined);
    assert.equal(session.invoice_creation, undefined, "no paid invoice feature is added");
    assert.equal(session.payment_intent_data.transfer_data, undefined);
    assert.equal(session.saved_payment_method_options?.payment_method_save, signedIn ? "enabled" : undefined);
    assert.equal(fixture.calls.account, signedIn ? 1 : 0);
    assert.equal(fixture.calls.create.length, signedIn ? 0 : 1);
    assert.deepEqual(fixture.calls.update[0].params, { preferred_locales: [language] });
  });
}

for (const settings of [{ sameEmail: false }, { role: "provider" }]) {
  test(`an unrelated signed-in account cannot supply saved cards: ${JSON.stringify(settings)}`, async () => {
    const fixture = harness(settings);
    await fixture.run({ language: "es" });
    assert.equal(fixture.calls.account, 0);
    assert.equal(fixture.calls.checkout[0].params.saved_payment_method_options, undefined);
    assert.ok(fixture.calls.checkout[0].params.customer.startsWith("cus_guest_"));
  });
}

test("a repeated guest attempt reuses only its payment-scoped customer", async () => {
  const fixture = harness({ signedIn: false });
  await fixture.run({ language: "es" });
  await fixture.run({ language: "es" });
  assert.equal(fixture.customers.size, 1);
  assert.deepEqual(fixture.calls.create[0], fixture.calls.create[1]);
  assert.equal(fixture.calls.create[0].options.idempotencyKey, "tuveloz-checkout-customer-synthetic-payment");
  assert.equal(fixture.calls.create[0].params.email, "customer@example.invalid");
  assert.deepEqual(fixture.calls.create[0].params.metadata, { tuveloz_payment_record_id: "synthetic-payment" });
});

test("a guest retries an interrupted preference update without creating another customer", async () => {
  const fixture = harness({ signedIn: false, updateFailure: "once" });
  await assert.rejects(fixture.run({ language: "es" }), /Synthetic unavailable/);
  assert.equal(fixture.calls.checkout.length, 0);
  await fixture.run({ language: "es" });
  assert.equal(fixture.calls.checkout.length, 1);
  assert.equal(fixture.customers.size, 1);
  assert.deepEqual(fixture.calls.create[0], fixture.calls.create[1]);
});

test("a signed-in language choice updates only the customer's preferred language", async () => {
  const fixture = harness();
  const input = { accountCustomerId: "cus_account", customerEmail: "customer@example.invalid", paymentId: "synthetic-payment" };
  await fixture.prepare({ ...input, language: "es" });
  await fixture.prepare({ ...input, language: "en" });
  assert.deepEqual(fixture.calls.update.map(call => call.params), [
    { preferred_locales: ["es"] }, { preferred_locales: ["en"] },
  ]);
  assert.ok(fixture.calls.update.every(call => call.id === "cus_account"));
  assert.equal(fixture.calls.create.length, 0);
});

test("a pause after language preparation still prevents opening checkout", async () => {
  for (const options of [{ gates: [true, false] }, { signedIn: false, gates: [true, true, false] }]) {
    const fixture = harness(options);
    assert.equal((await fixture.run({ language: "es" })).paused, true);
    assert.equal(fixture.calls.checkout.length, 0);
  }
});

for (const settings of [
  { release: false }, { gates: [false] }, { signedIn: false, gates: [false] },
  { signedIn: false, gates: [true, false] }, { updateFailure: true }, { badReceipt: true },
]) {
  test(`receipt preparation cannot open checkout on a failed check: ${JSON.stringify(settings)}`, async () => {
    const fixture = harness(settings);
    if (!settings.release && settings.release !== undefined) assert.equal((await fixture.run({ language: "es" })).paused, true);
    else await assert.rejects(fixture.run({ language: "es" }));
    assert.equal(fixture.calls.checkout.length, 0);
    if (settings.release === false || settings.gates?.[0] === false) {
      assert.equal(fixture.calls.create.length, 0);
      assert.equal(fixture.calls.update.length, 0);
    }
    if (settings.gates?.[1] === false) assert.equal(fixture.calls.update.length, 0);
  });
}
