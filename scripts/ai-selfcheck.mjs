/**
 * Exercises Tuveloz AI against a running site and checks the things that would
 * otherwise need a human to read answers one by one:
 *
 *   - a policy question comes back with sources attached
 *   - an answer about a provisional design keeps its hedge
 *   - a plain vehicle question does NOT pull policy material in
 *
 * Usage:  node scripts/ai-selfcheck.mjs [baseUrl]      (default localhost:3000)
 *         npm run ai:check
 *
 * Exits 0 and says so when the environment has no AI provider keys, so it is
 * safe to run anywhere, including in a deploy pipeline.
 */
const baseUrl = (process.argv[2] || process.env.BASE_URL || "http://localhost:3000").replace(/\/$/, "");

const HEDGE = /under review|subject to|still going through|still being|not final|not locked in|proposed|current design|the plan rather than|may change|before you count on|when we open|opens? at launch|not for real jobs yet/i;

const CASES = [
  {
    name: "customer fee question keeps its hedge and cites a page",
    body: { message: "How much does Tuveloz charge me in fees?", audience: "customer" },
    expect: { sources: true, hedge: true },
  },
  {
    name: "provider payout question keeps its hedge and cites a page",
    body: { message: "How and when do I get paid?", audience: "provider" },
    expect: { sources: true, hedge: true },
  },
  {
    name: "privacy question cites a page",
    body: { message: "Who can see my address?", audience: "customer" },
    expect: { sources: true, hedge: false },
  },
  {
    name: "a plain car problem stays vehicle guidance, no policy material",
    body: { message: "My car makes a clicking noise when I brake.", audience: "customer" },
    expect: { sources: false, hedge: false },
  },
];

let failures = 0;

for (const testCase of CASES) {
  let response;
  try {
    response = await fetch(`${baseUrl}/api/ai`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(testCase.body),
    });
  } catch (error) {
    console.error(`✗ could not reach ${baseUrl}: ${error.message}`);
    process.exit(1);
  }

  const payload = await response.json().catch(() => ({}));

  if (payload.code === "AI_UNCONFIGURED") {
    console.log("· skipped — this environment has no AI provider keys configured.");
    process.exit(0);
  }

  if (!response.ok || !payload.reply) {
    console.error(`✗ ${testCase.name}\n  HTTP ${response.status} ${payload.error || ""}`);
    failures += 1;
    continue;
  }

  const sourceCount = Array.isArray(payload.sources) ? payload.sources.length : 0;
  const problems = [];

  if (testCase.expect.sources && sourceCount === 0) problems.push("expected a cited source, got none");
  if (!testCase.expect.sources && sourceCount > 0) {
    problems.push(`expected no policy sources, got ${payload.sources.map((s) => s.href).join(", ")}`);
  }
  if (testCase.expect.hedge && !HEDGE.test(payload.reply)) {
    problems.push("answer reads as settled fact about a design that is still provisional");
  }

  if (problems.length) {
    failures += 1;
    console.error(`✗ ${testCase.name}`);
    for (const problem of problems) console.error(`    ${problem}`);
    console.error(`    reply: ${payload.reply.slice(0, 220)}…`);
  } else {
    console.log(`✓ ${testCase.name}${sourceCount ? ` (cited ${sourceCount})` : ""}`);
  }
}

if (failures) {
  console.error(`\n${failures} check(s) failed against ${baseUrl}`);
  process.exit(1);
}
console.log(`\nAll Tuveloz AI checks passed against ${baseUrl}`);
