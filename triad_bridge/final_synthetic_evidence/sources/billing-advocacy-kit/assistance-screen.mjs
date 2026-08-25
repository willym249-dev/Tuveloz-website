/**
 * QUARANTINED: the earlier executable encoded assistance thresholds and
 * applicability assumptions before the exact rule set received current source
 * and counsel review. Returning a result would make an unapproved screen look
 * operational, so both API and CLI fail closed.
 */
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ASSISTANCE_SCREEN_STATUS = "blocked_pending_rule_and_counsel_review";

export function screen() {
  return {
    status: "blocked",
    code: "ASSISTANCE_RULESET_NOT_APPROVED",
    message: "No eligibility result was computed. Use an official program source or a qualified reviewer.",
  };
}

const isCli = process.argv[1]
  && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isCli) {
  console.error(JSON.stringify(screen()));
  process.exit(2);
}
