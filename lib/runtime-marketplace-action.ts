import {
  customerJobPostingPauseBlocks,
  MARKETPLACE_MODE,
  marketplaceActionAllowed,
  type MarketplaceAction,
} from "./launch-status";
import { runtimeRealMarketplaceReleaseIsApproved } from "./runtime-launch-readiness";

/**
 * Server-only action gate for real marketplace traffic. Test fixtures do not
 * query launch records; every real action requires fresh approval of both
 * database-backed launch-readiness stages in addition to the code-controlled
 * marketplace mode.
 */
export async function runtimeMarketplaceActionAllowed(
  action: MarketplaceAction,
  options: { testOnly?: boolean } = {},
) {
  if (options.testOnly === true) {
    return marketplaceActionAllowed(action, { testOnly: true });
  }
  if (
    customerJobPostingPauseBlocks(action)
    || String(MARKETPLACE_MODE) !== "live"
  ) {
    return false;
  }
  return marketplaceActionAllowed(action, {
    runtimeReleaseApproved: await runtimeRealMarketplaceReleaseIsApproved(),
  });
}
