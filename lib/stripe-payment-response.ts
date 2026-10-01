function record(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}
const cents = (value: unknown): value is number => typeof value === "number" && Number.isSafeInteger(value) && value >= 0;

export function validStripePayments(value: unknown): boolean {
  return Array.isArray(value) && value.every(payment => record(payment)
    && typeof payment.id === "string" && Boolean(payment.id.trim())
    && ["status", "productName", "paymentType", "customerEmail", "settlementStrategy", "createdAt", "refundStatus", "refundUpdatedAt", "refundFailureReason", "disputeStatus", "disputeUpdatedAt", "refundedAt"]
      .every(key => typeof payment[key] === "string")
    && ["providerName", "customerDisplayName", "jobStatus", "transferId", "connectedAccountSnapshotId", "transferAttemptStatus", "lastPayoutStatus", "lastExternalAccountStatus", "payoutHoldReason", "externalAccountHoldReason"]
      .every(key => payment[key] === null || typeof payment[key] === "string")
    && typeof payment.canRelease === "boolean" && typeof payment.customerHasAccount === "boolean"
    && cents(payment.providerAmountCents) && cents(payment.applicationFeeCents) && cents(payment.customerTotalCents)
    && payment.providerAmountCents + payment.applicationFeeCents === payment.customerTotalCents
    && cents(payment.refundAmountCents));
}

export function validStripeTransferConfirmation(value: unknown, paymentId: string): value is {
  ok: true; transferConfirmed: true; paymentId: string; transferId: string; releasedAt: string;
  transferReviewRequired: boolean; paymentStatus: string;
} {
  return record(value) && value.ok === true && value.transferConfirmed === true && value.paymentId === paymentId
    && typeof value.transferId === "string" && value.transferId.startsWith("tr_")
    && typeof value.releasedAt === "string" && Number.isFinite(Date.parse(value.releasedAt))
    && typeof value.transferReviewRequired === "boolean" && typeof value.paymentStatus === "string";
}
