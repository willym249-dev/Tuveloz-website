import { spawnSync } from "node:child_process";
import { readFile } from "node:fs/promises";
import { registerHooks } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import process from "node:process";

// One report answering "what does Tuveloz still need?". It reads four things
// that otherwise live in four places:
//
//   1. the three marketplace locks, from source
//   2. runtime configuration — .env.example against the deployed vars/secrets
//   3. the 18 launch gates — the catalogue in code against the decisions
//      recorded in production D1
//   4. deadlines, by running scripts/check-deadlines.mjs
//
// It reports. It changes nothing, and a gate can only be answered by the owner
// in /admin/launch-readiness, never from here.
//
// Usage:  npm run readiness
//         npm run readiness -- --offline   (skip the two Cloudflare reads)
//         npm run readiness -- --json
//         npm run readiness -- --strict    (exit 1 when something required is missing)

const args = new Set(process.argv.slice(2));
const OFFLINE = args.has("--offline");
const STRICT = args.has("--strict");
const AS_JSON = args.has("--json");

// `npm run deploy` breaks on a home path with a space in it, so wrangler is
// invoked through node directly rather than through the npm bin shim.
const WRANGLER = "node_modules/wrangler/bin/wrangler.js";
const TODAY = new Date().toISOString().slice(0, 10);

const missing = [];
const note = (area, detail) => missing.push({ area, detail });

function runNode(argv, extraEnv = {}) {
  const result = spawnSync(process.execPath, argv, {
    encoding: "utf8",
    env: { ...process.env, ...extraEnv },
    maxBuffer: 32 * 1024 * 1024,
  });
  const output = `${result.stdout || ""}${result.stderr || ""}`;
  return { ok: result.status === 0, output };
}

// Wrangler prints a banner before its JSON, so the payload is taken from the
// first bracket to the last. An exit code alone is not trusted here.
function runWranglerJson(argv) {
  const { output } = runNode([WRANGLER, ...argv]);
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");
  if (start === -1 || end <= start) {
    return { data: null, output };
  }
  try {
    return { data: JSON.parse(output.slice(start, end + 1)), output };
  } catch {
    return { data: null, output };
  }
}

async function readSource(path) {
  return readFile(path, "utf8").catch(() => "");
}

// --- 1. The three marketplace locks ----------------------------------------

async function readLocks() {
  const [launchStatus, stripe, phoneAuth] = await Promise.all([
    readSource("lib/launch-status.ts"),
    readSource("lib/stripe.ts"),
    readSource("lib/phone-auth.ts"),
  ]);

  const constant = (source, name) => {
    const match = source.match(new RegExp(`${name}\\s*=\\s*([^;]+);`));
    return match ? match[1].replace(/\s+as const$/, "").trim() : "unreadable";
  };

  return [
    { name: "CUSTOMER_JOB_POSTING_PAUSED", file: "lib/launch-status.ts", value: constant(launchStatus, "CUSTOMER_JOB_POSTING_PAUSED") },
    { name: "MARKETPLACE_MODE", file: "lib/launch-status.ts", value: constant(launchStatus, "MARKETPLACE_MODE") },
    { name: "STRIPE_LIVE_MODE_ENABLED", file: "lib/stripe.ts", value: constant(stripe, "STRIPE_LIVE_MODE_ENABLED") },
    { name: "PHONE_SMS_LIVE_MODE_ENABLED", file: "lib/phone-auth.ts", value: constant(phoneAuth, "PHONE_SMS_LIVE_MODE_ENABLED") },
  ];
}

// --- 2. Runtime configuration ----------------------------------------------

// Deployment credentials, not Worker configuration. They belong in a local
// .env or in CI, and they will never appear in the Worker's vars or secrets.
const DEPLOY_CREDENTIALS = new Set(["CLOUDFLARE_ACCOUNT_ID", "CLOUDFLARE_API_TOKEN"]);

// Keys that only become required once a related setting is switched on. While
// the condition is unmet they are reported as not-yet-needed rather than as a
// gap, so a deliberately fail-closed subsystem does not read as broken.
const CONDITIONAL = {
  EVIDENCE_SCAN_WEBHOOK_SECRET: {
    when: (vars) => (vars.get("EVIDENCE_SCAN_PROVIDER") || "unconfigured") !== "unconfigured",
    because: "EVIDENCE_SCAN_PROVIDER is unconfigured",
  },
  CLOUDMERSIVE_API_KEY: {
    when: (vars) => vars.get("EVIDENCE_SCAN_PROVIDER") === "cloudmersive",
    because: "EVIDENCE_SCAN_PROVIDER is not cloudmersive",
  },
};

// Keys whose comment block in .env.example says the key is optional are
// reported, but never counted as missing.
function parseEnvExample(text) {
  const keys = [];
  let comment = [];

  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (trimmed === "") {
      comment = [];
      continue;
    }
    if (trimmed.startsWith("#")) {
      comment.push(trimmed.slice(1).trim());
      continue;
    }
    const match = trimmed.match(/^([A-Z0-9_]+)=/);
    if (!match) continue;
    // Only a comment block that opens with "Optional" marks the key optional.
    // Matching the word anywhere would catch RESEND_API_KEY, whose comment
    // reads "Required for passwordless sign-in and optional provider alerts".
    keys.push({ key: match[1], optional: /^optional\b/i.test(comment.join(" ")) });
  }

  return keys;
}

// wrangler.jsonc carries comments, so it is not JSON.parse-able as written.
function parseWranglerVars(text) {
  const block = text.match(/"vars"\s*:\s*\{([\s\S]*?)\n\s*\}/);
  const vars = new Map();
  if (!block) return vars;
  for (const line of block[1].split("\n")) {
    const match = line.trim().match(/^"([A-Z0-9_]+)"\s*:\s*"([^"]*)"/);
    if (match) vars.set(match[1], match[2]);
  }
  return vars;
}

async function checkConfiguration() {
  const [envExample, wranglerConfig] = await Promise.all([
    readSource(".env.example"),
    readSource("wrangler.jsonc"),
  ]);

  const declared = parseEnvExample(envExample);
  const vars = parseWranglerVars(wranglerConfig);

  let secrets = null;
  let secretsNote = "";
  if (OFFLINE) {
    secretsNote = "skipped (--offline)";
  } else {
    const { data } = runWranglerJson(["secret", "list"]);
    if (Array.isArray(data)) {
      secrets = new Set(data.map((entry) => entry.name));
    } else {
      secretsNote = "could not be read — is wrangler logged in?";
    }
  }

  const rows = [];
  for (const declaration of declared) {
    const { key } = declaration;
    let { optional } = declaration;
    let waitingOn = "";

    const conditional = CONDITIONAL[key];
    if (conditional && !conditional.when(vars)) {
      optional = true;
      waitingOn = conditional.because;
    }

    if (DEPLOY_CREDENTIALS.has(key)) {
      rows.push({ key, optional, waitingOn, where: "deploy credential", state: "local or CI only" });
      continue;
    }

    if (vars.has(key)) {
      const value = vars.get(key);
      const empty = value.trim() === "";
      rows.push({ key, optional, waitingOn, where: "wrangler.jsonc vars", state: empty ? "empty" : "set" });
      if (empty && !optional) note("configuration", `${key} is declared in wrangler.jsonc but empty`);
      continue;
    }

    if (secrets === null) {
      rows.push({ key, optional, waitingOn, where: "secret", state: "unknown" });
      continue;
    }

    if (secrets.has(key)) {
      rows.push({ key, optional, waitingOn, where: "secret", state: "set" });
      continue;
    }

    rows.push({ key, optional, waitingOn, where: "secret", state: "missing" });
    if (!optional) note("configuration", `${key} has no var and no secret`);
  }

  return { rows, secretsNote };
}

// --- 3. Launch gates --------------------------------------------------------

async function readGateCatalog() {
  // lib/*.ts use extension-less relative imports, which Node's ESM resolver
  // rejects even with type stripping. This retries a failed relative specifier
  // with .ts appended, which is enough for the launch-readiness module.
  registerHooks({
    resolve(specifier, context, nextResolve) {
      try {
        return nextResolve(specifier, context);
      } catch (error) {
        if (specifier.startsWith(".")) return nextResolve(`${specifier}.ts`, context);
        throw error;
      }
    },
  });

  const launchReadiness = await import("../lib/launch-readiness.ts");
  return launchReadiness.LAUNCH_GATE_CATALOG;
}

function readGateDecisions() {
  const { data } = runWranglerJson([
    "d1",
    "execute",
    "tuveloz-db",
    "--remote",
    "--json",
    "--command",
    "select gate_key, gate_version, status, approved_at, valid_through from launch_gate_decisions",
  ]);

  const rows = Array.isArray(data) ? data[0]?.results : null;
  if (!Array.isArray(rows)) return null;

  // gate_key + gate_version is unique; the highest version is the live decision.
  const latest = new Map();
  for (const row of rows) {
    const previous = latest.get(row.gate_key);
    if (!previous || Number(row.gate_version) > Number(previous.gate_version)) {
      latest.set(row.gate_key, row);
    }
  }
  return latest;
}

async function checkGates() {
  const catalog = await readGateCatalog();

  if (OFFLINE) {
    return { gates: catalog.map((gate) => ({ ...gate, state: "unknown" })), decisionsNote: "skipped (--offline)" };
  }

  const decisions = readGateDecisions();
  if (decisions === null) {
    note("launch gates", "the decisions table could not be read, so gate state is unknown");
    return {
      gates: catalog.map((gate) => ({ ...gate, state: "unknown" })),
      decisionsNote: "could not be read — is wrangler logged in?",
    };
  }

  const gates = catalog.map((gate) => {
    const decision = decisions.get(gate.key);

    if (!decision) {
      if (gate.required) note("launch gates", `${gate.key} — no decision recorded`);
      return { ...gate, state: "pending", detail: "no decision recorded" };
    }

    const expired =
      decision.valid_through && decision.valid_through < TODAY ? decision.valid_through : "";

    if (decision.status === "approved" && expired) {
      if (gate.required) note("launch gates", `${gate.key} — approval expired ${expired}`);
      return { ...gate, state: "expired", detail: `approval expired ${expired}` };
    }

    if (decision.status === "approved" && gate.requiresValidThrough && !decision.valid_through) {
      if (gate.required) note("launch gates", `${gate.key} — approved with no valid-through date`);
      return { ...gate, state: "incomplete", detail: "approved with no valid-through date" };
    }

    if (decision.status !== "approved" && decision.status !== "not_applicable" && gate.required) {
      note("launch gates", `${gate.key} — ${decision.status}`);
    }

    return { ...gate, state: decision.status, detail: decision.approved_at || "" };
  });

  return { gates, decisionsNote: `${decisions.size} decision${decisions.size === 1 ? "" : "s"} recorded` };
}

// --- 4. Deadlines -----------------------------------------------------------

function checkDeadlines() {
  const reportPath = join(tmpdir(), "tuveloz-readiness-deadlines.md");
  const { ok, output } = runNode(["scripts/check-deadlines.mjs"], {
    DEADLINE_REPORT_PATH: reportPath,
    GITHUB_OUTPUT: "",
  });

  if (!ok) return { text: "scripts/check-deadlines.mjs did not run", clean: false };

  const text = output.trim();
  const clean = /^Nothing is overdue/.test(text);
  if (!clean) note("deadlines", "something is overdue or due soon — see the deadline section");
  return { text, clean };
}

// --- Report -----------------------------------------------------------------

const locks = await readLocks();
const configuration = await checkConfiguration();
const gateReport = await checkGates();
const deadlines = checkDeadlines();

if (AS_JSON) {
  console.log(
    JSON.stringify(
      {
        checkedAt: TODAY,
        offline: OFFLINE,
        locks,
        configuration: configuration.rows,
        gates: gateReport.gates.map(({ key, title, stage, required, state, detail }) => ({
          key,
          title,
          stage,
          required,
          state,
          detail,
        })),
        deadlines: deadlines.text,
        missing,
      },
      null,
      2,
    ),
  );
} else {
  const line = (text = "") => console.log(text);

  line(`Tuveloz readiness — ${TODAY}${OFFLINE ? " (offline)" : ""}`);
  line();

  line("MARKETPLACE LOCKS");
  for (const lock of locks) line(`  ${lock.name} = ${lock.value}   (${lock.file})`);
  line("  These are deliberate. Nothing in this report is a reason to change one.");
  line();

  line(`LAUNCH GATES — ${gateReport.decisionsNote}`);
  const byState = new Map();
  for (const gate of gateReport.gates) {
    byState.set(gate.state, (byState.get(gate.state) || 0) + 1);
  }
  for (const [state, count] of byState) line(`  ${count} ${state}`);
  for (const gate of gateReport.gates) {
    if (gate.state === "approved") continue;
    const flag = gate.required ? "required" : "optional";
    line(`  - ${gate.key} [${flag}] — ${gate.detail || gate.state}`);
    line(`      ${gate.title}`);
    line(`      authority: ${gate.authority.join(", ")}`);
  }
  line("  Answer these in /admin/launch-readiness. They are evidence records, not switches.");
  line();

  line(`CONFIGURATION — .env.example against the deployed Worker${configuration.secretsNote ? ` — secrets ${configuration.secretsNote}` : ""}`);
  const problems = configuration.rows.filter((row) => row.state === "missing" || row.state === "empty" || row.state === "unknown");
  if (problems.length === 0) {
    line("  Every declared key is set as a var or a secret.");
  } else {
    for (const row of problems) {
      const why = row.waitingOn ? `not needed yet — ${row.waitingOn}` : row.optional ? "optional" : "required";
      line(`  - ${row.key} [${why}] — ${row.state} (${row.where})`);
    }
  }
  line();

  line("DEADLINES — docs/OPEN-ITEMS.md");
  for (const deadlineLine of deadlines.text.split("\n")) line(`  ${deadlineLine}`);
  line();

  line("WHAT IS MISSING");
  if (missing.length === 0) {
    line("  Nothing required is outstanding in the four places this checks.");
  } else {
    for (const item of missing) line(`  [${item.area}] ${item.detail}`);
    line();
    line(`  ${missing.length} item${missing.length === 1 ? "" : "s"}. Undated rows in docs/OPEN-ITEMS.md are not counted here.`);
  }
}

if (STRICT && missing.length > 0) process.exit(1);
