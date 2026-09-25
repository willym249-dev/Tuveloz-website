import { pathToFileURL } from "node:url";

const DEFAULT_URL = "https://tuveloz.com/api/health";
const DEFAULT_ATTEMPTS = 3;
const DEFAULT_RETRY_DELAY_MS = 10_000;

const pause = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

export function productionHealthErrors(payload, expectedCommit = "") {
  const errors = [];

  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return ["The health endpoint did not return a JSON object."];
  }

  const requiredValues = [
    ["status", payload.status, "ok"],
    ["checks.application", payload.checks?.application, "ready"],
    ["checks.database", payload.checks?.database, "ready"],
    ["checks.schema", payload.checks?.schema, "ready"],
    ["launch.mode", payload.launch?.mode, "onboarding_only"],
    ["launch.customerAccounts", payload.launch?.customerAccounts, "open"],
    ["launch.providerApplications", payload.launch?.providerApplications, "open"],
    ["launch.customerJobRequests", payload.launch?.customerJobRequests, "closed"],
    ["launch.customerPayments", payload.launch?.customerPayments, "closed"],
  ];

  for (const [name, actual, expected] of requiredValues) {
    if (actual !== expected) {
      errors.push(`${name} must be ${JSON.stringify(expected)}; received ${JSON.stringify(actual)}.`);
    }
  }

  if (typeof payload.release?.commit !== "string" || !/^[0-9a-f]{40}$/i.test(payload.release.commit)) {
    errors.push("release.commit must be a full Git commit SHA.");
  } else if (expectedCommit && payload.release.commit.toLowerCase() !== expectedCommit.toLowerCase()) {
    errors.push(`release.commit does not match the expected commit ${expectedCommit}.`);
  }

  if (!Array.isArray(payload.missingTables) || payload.missingTables.length !== 0) {
    errors.push("missingTables must be an empty array.");
  }

  if (!Array.isArray(payload.missingGuardedTriggers) || payload.missingGuardedTriggers.length !== 0) {
    errors.push("missingGuardedTriggers must be an empty array.");
  }

  if (!Number.isFinite(Date.parse(payload.checkedAt))) {
    errors.push("checkedAt must be a valid timestamp.");
  }

  return errors;
}

export async function checkProductionHealth({
  url = DEFAULT_URL,
  expectedCommit = "",
  attempts = DEFAULT_ATTEMPTS,
  retryDelayMs = DEFAULT_RETRY_DELAY_MS,
  fetchImpl = fetch,
} = {}) {
  let lastError = "No response received.";

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const requestUrl = new URL(url);
      requestUrl.searchParams.set("monitorAttempt", String(attempt));
      requestUrl.searchParams.set("monitorTime", String(Date.now()));
      const response = await fetchImpl(requestUrl, {
        headers: {
          "cache-control": "no-cache",
          "user-agent": "Tuveloz-Production-Health-Monitor",
        },
        signal: AbortSignal.timeout(15_000),
      });
      const body = await response.text();
      let payload;
      try {
        payload = JSON.parse(body);
      } catch {
        throw new Error(`HTTP ${response.status}; the health response was not valid JSON.`);
      }

      const errors = productionHealthErrors(payload, expectedCommit);
      if (response.ok && errors.length === 0) {
        return {
          checkedAt: payload.checkedAt,
          commit: payload.release.commit,
        };
      }

      lastError = `HTTP ${response.status}; ${errors.join(" ") || "The endpoint returned an unsuccessful response."}`;
    } catch (error) {
      lastError = error instanceof Error ? error.message : String(error);
    }

    if (attempt < attempts) {
      console.warn(`Production health attempt ${attempt} failed: ${lastError}`);
      await pause(retryDelayMs);
    }
  }

  throw new Error(`Tuveloz production health verification failed after ${attempts} attempts. ${lastError}`);
}

async function main() {
  const url = process.argv[2] || process.env.STATUS_URL || DEFAULT_URL;
  const expectedCommit = process.env.EXPECTED_COMMIT || "";
  const result = await checkProductionHealth({ url, expectedCommit });
  console.log(`Tuveloz production is healthy at ${result.checkedAt}.`);
  console.log(`Verified deployed commit ${result.commit}.`);
  console.log("Customer job requests and customer payments remain closed.");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
