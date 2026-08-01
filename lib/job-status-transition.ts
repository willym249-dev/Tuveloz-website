export const JOB_STATUS_TRANSITION_TARGETS = [
  "on my way",
  "arrived",
  "completed",
] as const;

export type JobStatusTransitionTarget =
  (typeof JOB_STATUS_TRANSITION_TARGETS)[number];

type TravelOrArrivalStatus = Exclude<JobStatusTransitionTarget, "completed">;

type JobStatusTransitionSuccessInput =
  | {
      status: TravelOrArrivalStatus;
      lifecycleEventId: string;
    }
  | {
      status: "completed";
      lifecycleEventId: string;
      authorizationDecisionId: string;
      trackedSeconds: number;
    };

export function isJobStatusTransitionTarget(
  value: string,
): value is JobStatusTransitionTarget {
  return (JOB_STATUS_TRANSITION_TARGETS as readonly string[]).includes(value);
}

/**
 * Builds the acknowledgement returned only after the corresponding immutable
 * lifecycle event has been appended. Travel and arrival transitions do not
 * create an eligibility authorization, so their decision fields are omitted.
 * Completion includes its separately persisted completion authorization.
 */
export function jobStatusTransitionSuccessPayload(
  input: JobStatusTransitionSuccessInput,
) {
  if (input.status === "completed") {
    return {
      ok: true as const,
      status: input.status,
      lifecycleEventId: input.lifecycleEventId,
      authorizationDecisionId: input.authorizationDecisionId,
      // Preserve the original completion-response field for clients that
      // already consume it while making its meaning explicit above.
      decisionId: input.authorizationDecisionId,
      trackedSeconds: input.trackedSeconds,
    };
  }
  return {
    ok: true as const,
    status: input.status,
    lifecycleEventId: input.lifecycleEventId,
  };
}
