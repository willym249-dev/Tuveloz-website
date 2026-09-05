import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";
import Stripe from "stripe";

const secret = "whsec_synthetic_contract_fixture";
const stripeUrl = import.meta.resolve("stripe");
let moduleId = 0;
async function load() {
  const stub = `data:text/javascript,${encodeURIComponent(`
    import Stripe from ${JSON.stringify(stripeUrl)};
    const stripe = new Stripe("sk_test_synthetic_contract_fixture");
    export const calls = [];
    export const getStripeIdentityClient = () => ({
      webhooks: stripe.webhooks,
      identity: { verificationSessions: { retrieve: async (id, options) => {
        calls.push({ id, options });
        // Stripe expands names with verified_outputs, but DOB requires its
        // own explicit expansion, confirmed against the restricted test API.
        return { id, status: "verified", verified_outputs: {
          first_name: "Synthetic", last_name: "Applicant",
          ...(options?.expand?.includes("verified_outputs.dob") ? { dob: { year: 1990, month: 1, day: 1 } } : {}),
        } };
      } } },
    });
    export const getStripeWebhookSecret = () => ${JSON.stringify(secret)};
    export const stripeWebhookCryptoProvider = () => Stripe.createSubtleCryptoProvider();
    export const stripeErrorResponse = () => Response.json({ error: "Failed closed" }, { status: 502 });
    export const claimStripeWebhookEvent = async () => ({ id: "claim", shouldProcess: true });
    export const completeStripeWebhookEvent = async () => {};
    export const failStripeWebhookEvent = async () => {};
    export const recordVerifiedStripeIdentitySession = async (_id, _created, session) => {
      if (!session.verified_outputs.dob) throw Error("Missing adult-verification input");
      calls.push({ verified: true }); return true;
    };
    export const recordStripeIdentityStatusEvent = async () => true;
    export const recordStripeIdentityRedactionEvent = async () => true;
    // ${moduleId++}
  `)}`;
  const source = stripTypeScriptTypes(await readFile(new URL("../app/api/stripe/webhooks/identity/route.ts", import.meta.url), "utf8"))
    .replace(/from "([^"]+)"/g, (_, name) => `from ${JSON.stringify(name === "stripe" ? stripeUrl : stub)}`);
  return { ...await import(`data:text/javascript,${encodeURIComponent(source)}`), ...await import(stub) };
}
function request(type, signingSecret = secret) {
  const payload = JSON.stringify({ id: "evt_fixture", created: Math.floor(Date.now() / 1000), type, livemode: false, data: { object: { id: "vs_fixture" } } });
  return new Request("https://tuveloz.invalid/api/stripe/webhooks/identity", {
    method: "POST", body: payload,
    headers: { "stripe-signature": Stripe.webhooks.generateTestHeaderString({ payload, secret: signingSecret }) },
  });
}

test("a signed verified event explicitly retrieves DOB without requesting ID numbers or images", async () => {
  const route = await load();
  const response = await route.POST(request("identity.verification_session.verified"));
  assert.equal(response.status, 200);
  assert.deepEqual(route.calls, [{ id: "vs_fixture", options: { expand: ["verified_outputs.dob"] } }, { verified: true }]);
  assert.deepEqual(await response.json(), { received: true });
});

test("status events do not request sensitive outputs and a bad signature never retrieves a session", async () => {
  const route = await load();
  assert.equal((await route.POST(request("identity.verification_session.processing"))).status, 200);
  assert.deepEqual(route.calls, [{ id: "vs_fixture", options: undefined }]);
  assert.equal((await route.POST(request("identity.verification_session.verified", "whsec_wrong"))).status, 400);
  assert.equal(route.calls.length, 1);
});
