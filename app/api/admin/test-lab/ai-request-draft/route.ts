import { isVerifiedOwnerRequest } from "../../../../../lib/owner-auth";
import { isSameOriginRequest } from "../../../../../lib/request-security";
import {
  RequestDraftConfigurationError,
  RequestDraftUpstreamError,
  createRequestDraft,
  requestDraftingEnabled,
} from "../../../../../lib/ai/request-draft";
import {
  REQUEST_DRAFT_INPUT_LIMITS,
  containsRestrictedPersonalData,
} from "../../../../../lib/ai/request-draft-contract";

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function privateJson(body: unknown, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
    },
  });
}

export async function GET(request: Request) {
  if (!(await isVerifiedOwnerRequest(request))) {
    return privateJson(
      { error: "Signed owner verification is required for Tuveloz AI testing." },
      403,
    );
  }

  return privateJson({
    ok: true,
    enabled: requestDraftingEnabled(),
    mode: "owner_test_only",
    safeguards: {
      databaseWrites: false,
      jobSubmission: false,
      providerContact: false,
      payments: false,
      repairDiagnosis: false,
    },
  });
}

export async function POST(request: Request) {
  if (!(await isVerifiedOwnerRequest(request))) {
    return privateJson(
      { error: "Signed owner verification is required for Tuveloz AI testing." },
      403,
    );
  }
  if (!isSameOriginRequest(request)) {
    return privateJson(
      { error: "This AI test must be started from the Tuveloz owner workspace." },
      403,
    );
  }
  if (!request.headers.get("content-type")?.includes("application/json")) {
    return privateJson({ error: "Send the test description as JSON." }, 415);
  }

  let body: Record<string, unknown>;
  try {
    body = await request.json() as Record<string, unknown>;
  } catch {
    return privateJson({ error: "Enter a readable test description." }, 400);
  }

  const vehicle = clean(body.vehicle, REQUEST_DRAFT_INPUT_LIMITS.vehicle);
  const description = clean(body.description, REQUEST_DRAFT_INPUT_LIMITS.description);
  if (description.length < 12) {
    return privateJson(
      { error: "Describe the vehicle issue in at least 12 characters." },
      400,
    );
  }
  if (containsRestrictedPersonalData(`${vehicle}\n${description}`)) {
    return privateJson(
      {
        error: "Remove email addresses, payment numbers, Social Security numbers, VINs, and other identifying information before using the AI test.",
      },
      400,
    );
  }

  try {
    const draft = await createRequestDraft({ vehicle, description });
    return privateJson({
      ok: true,
      draft,
      ownerReviewRequired: true,
      submittedAnywhere: false,
    });
  } catch (error) {
    if (error instanceof RequestDraftConfigurationError) {
      return privateJson({ error: error.message, code: "AI_NOT_CONFIGURED" }, 503);
    }
    if (error instanceof RequestDraftUpstreamError) {
      return privateJson(
        {
          error: "The AI service could not create a safe draft. No job or message was submitted.",
          code: "AI_PROVIDER_ERROR",
        },
        502,
      );
    }
    console.error("Tuveloz AI request-draft test failed", error);
    return privateJson(
      {
        error: "The AI test could not be completed. No job or message was submitted.",
        code: "AI_TEST_FAILED",
      },
      500,
    );
  }
}
