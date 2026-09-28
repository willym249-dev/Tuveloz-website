import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { stripTypeScriptTypes } from "node:module";
import test from "node:test";

// Run the real client factory, SDK and release constants with fake credentials.
// A client must never make a network request just to validate configuration.
test("payment key validation preserves the code-controlled launch lock", async t => {
  const runtime = {};
  globalThis.__stripeKeyGuardEnv = runtime;
  const originalFetch = globalThis.fetch;
  let networkCalls = 0;
  globalThis.fetch = async () => {
    networkCalls++;
    throw Error("Network access is forbidden in the key-guard fixture");
  };
  try {
    const envModule = `data:text/javascript,${encodeURIComponent(
      "export const env = globalThis.__stripeKeyGuardEnv;",
    )}`;
    const source = stripTypeScriptTypes(await readFile(
      new URL("../lib/stripe.ts", import.meta.url), "utf8",
    )).replace('"cloudflare:workers"', JSON.stringify(envModule))
      .replace('from "stripe"', `from ${JSON.stringify(import.meta.resolve("stripe"))}`)
      .replace('"./launch-status"', JSON.stringify(new URL("../lib/launch-status.ts", import.meta.url).href));
    const api = await import(`data:text/javascript,${encodeURIComponent(source)}`);

    await t.test("standard and restricted live keys stay blocked even with the environment switch enabled", () => {
      for (const key of ["sk_live_synthetic_guard_fixture", "rk_live_synthetic_guard_fixture"]) {
        for (const allow of ["false", "true"]) {
          runtime.STRIPE_SECRET_KEY = key;
          runtime.STRIPE_ALLOW_LIVE_MODE = allow;
          assert.equal(api.stripeLiveModeEnabled(), false);
          assert.throws(() => api.getStripeClient(), error => {
            assert.ok(error instanceof api.StripeConfigurationError);
            assert.match(error.message, /live mode is code-disabled/);
            assert.ok(!error.message.includes(key));
            return true;
          }, `${key.split("_", 2).join("_")} with env=${allow}`);
        }
      }
    });

    await t.test("standard and restricted sandbox keys remain usable", () => {
      for (const key of ["sk_test_synthetic_guard_fixture", "rk_test_synthetic_guard_fixture"]) {
        runtime.STRIPE_SECRET_KEY = ` ${key} `;
        assert.equal(typeof api.getStripeClient().checkout.sessions.create, "function");
        assert.equal(api.stripeLiveModeEnabled(), false);
      }
    });

    await t.test("missing, public, webhook, organization and unknown keys fail before a request", () => {
      for (const key of [undefined, "", "your_stripe_key", "pk_test_synthetic", "pk_live_synthetic",
        "whsec_synthetic", "sk_org_synthetic", "unrecognized_synthetic", "sk_test_", "rk_live_"]) {
        runtime.STRIPE_SECRET_KEY = key;
        assert.throws(() => api.getStripeClient(), api.StripeConfigurationError);
      }
    });
    assert.equal(networkCalls, 0);
  } finally {
    globalThis.fetch = originalFetch;
    delete globalThis.__stripeKeyGuardEnv;
  }
});
