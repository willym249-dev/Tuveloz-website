import {
  CUSTOMER_JOB_POSTING_PAUSED_DETAIL,
  CUSTOMER_JOB_POSTING_PAUSED_MESSAGE,
} from "../../../lib/launch-status";

/**
 * New customer job submissions are intentionally paused during provider-network
 * growth. The full request implementation remains available in Git history and
 * can be restored when Tuveloz is ready to accept new jobs and payments.
 */
export async function POST() {
  return Response.json(
    {
      error: CUSTOMER_JOB_POSTING_PAUSED_MESSAGE,
      detail: CUSTOMER_JOB_POSTING_PAUSED_DETAIL,
      code: "CUSTOMER_JOB_POSTING_PAUSED",
      customerAccountSignupAvailable: true,
      providerSignupAvailable: true,
    },
    {
      status: 503,
      headers: {
        "cache-control": "no-store",
        "retry-after": "86400",
      },
    },
  );
}
