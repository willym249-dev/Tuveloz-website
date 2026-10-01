function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function validCustomerReview(value: unknown): value is {
  id: string; providerName: string; customerDisplayName: string;
  service: string; rating: number; comment: string;
} {
  return record(value)
    && ["id", "providerName", "customerDisplayName", "service", "comment"]
      .every(key => typeof value[key] === "string" && Boolean(value[key].trim()))
    && Number.isInteger(value.rating) && Number(value.rating) >= 1 && Number(value.rating) <= 5;
}

/** Missing or corrupt saved state must not authorize a retry of an uncertain write. */
export function validCustomerRequestSnapshot(value: unknown): boolean {
  if (!record(value) || !record(value.job) || !Array.isArray(value.quotes)) return false;
  const job = value.job;
  return typeof value.accessToken === "string" && Boolean(value.accessToken.trim())
    && typeof job.id === "string" && Boolean(job.id.trim())
    && typeof job.status === "string" && Boolean(job.status.trim())
    && typeof job.service === "string" && typeof job.isTestJob === "boolean"
    && value.quotes.every(quote => record(quote)
      && ["id", "status", "providerName"].every(key => typeof quote[key] === "string" && Boolean(quote[key].trim()))
      && typeof quote.declineReason === "string"
      && typeof quote.ratingAverage === "number" && Number.isFinite(quote.ratingAverage)
      && quote.ratingAverage >= 0 && quote.ratingAverage <= 5
      && Number.isInteger(quote.reviewCount) && Number(quote.reviewCount) >= 0)
    && Object.hasOwn(value, "review") && (value.review === null || validCustomerReview(value.review));
}

export function validQuoteFeedbackReply(value: unknown, action: "decline-quote" | "restore-quote", reason: string): boolean {
  return record(value) && value.ok === true
    && value.status === (action === "decline-quote" ? "declined" : "submitted")
    && value.declineReason === (action === "decline-quote" ? reason : "");
}
