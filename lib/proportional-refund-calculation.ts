export type RefundAmounts = {
  providerRefundCents: number;
  customerFeeRefundCents: number;
  customerRefundCents: number;
};

export type ProportionalRefundCalculation = {
  ok: true;
  calculationOnly: true;
  paymentId: string;
  operationId: string;
  allocation: RefundAmounts;
  cumulative: RefundAmounts;
  remaining: RefundAmounts;
} | {
  ok: false;
  code: "invalid_payment" | "invalid_request" | "invalid_history"
    | "duplicate_operation" | "in_flight_refund" | "refund_limit_exceeded"
    | "history_needs_reconciliation";
};

export type ProportionalRefundInput = {
  payment: {
    paymentId: string;
    currency: "usd";
    providerAmountCents: number;
    customerFeeCents: number;
    customerTotalCents: number;
  };
  operationId: string;
  // An independently reviewed labor amount, not a customer-total estimate.
  providerRefundCents: number;
  history: Array<RefundAmounts & {
    operationId: string;
    paymentId: string;
    // Normalized ledger states; failed/canceled require definitive evidence.
    status: "succeeded" | "reserved" | "pending" | "uncertain" | "failed" | "canceled";
  }>;
};

function record(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function identifier(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.trim() === value;
}

function cents(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function split(provider: number, fee: number): RefundAmounts {
  return {
    providerRefundCents: provider,
    customerFeeRefundCents: fee,
    customerRefundCents: provider + fee,
  };
}

function cumulativeFee(labor: number, originalLabor: number, originalFee: number) {
  // BigInt keeps multiplication and half-up cent rounding exact, even when
  // safe input integers have a product beyond Number.MAX_SAFE_INTEGER.
  const numerator = BigInt(labor) * BigInt(originalFee);
  const denominator = BigInt(originalLabor);
  return Number(numerator / denominator
    + (BigInt(2) * (numerator % denominator) >= denominator ? BigInt(1) : BigInt(0)));
}

/**
 * Pure calculation using one payment's complete, reconciled ledger snapshot.
 * No eligibility decision, database reservation, Stripe call or provider recovery.
 * A future caller must authenticate/review eligibility and atomically check the
 * snapshot and reserve the result. Two stale snapshots cannot prevent a race.
 * The owner screen may use an empty, locally recorded history for a clearly
 * labeled estimate. That does not verify Stripe balances or permit execution.
 */
export function calculateProportionalRefund(input: unknown): ProportionalRefundCalculation {
  if (!record(input) || !record(input.payment)) return { ok: false, code: "invalid_payment" };
  const payment = input.payment;
  if (!identifier(payment.paymentId) || payment.currency !== "usd"
    || !cents(payment.providerAmountCents) || payment.providerAmountCents === 0
    || !cents(payment.customerFeeCents) || !cents(payment.customerTotalCents)
    || BigInt(payment.providerAmountCents) + BigInt(payment.customerFeeCents)
      !== BigInt(payment.customerTotalCents)) return { ok: false, code: "invalid_payment" };
  if (!identifier(input.operationId) || !cents(input.providerRefundCents)
    || input.providerRefundCents === 0) return { ok: false, code: "invalid_request" };
  if (!Array.isArray(input.history)) return { ok: false, code: "invalid_history" };

  let priorLabor = BigInt(0), priorFee = BigInt(0);
  let inFlight = false;
  const seen = new Set<string>();
  for (const movement of input.history) {
    if (!record(movement) || !identifier(movement.operationId)
      || movement.paymentId !== payment.paymentId
      || !cents(movement.providerRefundCents) || !cents(movement.customerFeeRefundCents)
      || !cents(movement.customerRefundCents) || movement.customerRefundCents === 0
      || BigInt(movement.providerRefundCents) + BigInt(movement.customerFeeRefundCents)
        !== BigInt(movement.customerRefundCents)
      || movement.providerRefundCents > payment.providerAmountCents
      || movement.customerFeeRefundCents > payment.customerFeeCents
      || typeof movement.status !== "string"
      || !["succeeded", "reserved", "pending", "uncertain", "failed", "canceled"].includes(movement.status)) {
      return { ok: false, code: "invalid_history" };
    }
    if (seen.has(movement.operationId) || movement.operationId === input.operationId) {
      return { ok: false, code: "duplicate_operation" };
    }
    seen.add(movement.operationId);
    if (movement.status === "failed" || movement.status === "canceled") continue;
    priorLabor += BigInt(movement.providerRefundCents);
    priorFee += BigInt(movement.customerFeeRefundCents);
    if (movement.status !== "succeeded") inFlight = true;
  }
  if (priorLabor > BigInt(payment.providerAmountCents) || priorFee > BigInt(payment.customerFeeCents)) {
    return { ok: false, code: "refund_limit_exceeded" };
  }
  // Never plan another movement on an unresolved reservation or lost response.
  if (inFlight) return { ok: false, code: "in_flight_refund" };
  if (Number(priorFee) !== cumulativeFee(Number(priorLabor), payment.providerAmountCents, payment.customerFeeCents)) {
    // Goodwill fee-only refunds and legacy/manual allocations need reconciliation.
    return { ok: false, code: "history_needs_reconciliation" };
  }

  const nextLabor = priorLabor + BigInt(input.providerRefundCents);
  if (nextLabor > BigInt(payment.providerAmountCents)) return { ok: false, code: "refund_limit_exceeded" };
  const nextFee = cumulativeFee(Number(nextLabor), payment.providerAmountCents, payment.customerFeeCents);
  const allocation = split(input.providerRefundCents, nextFee - Number(priorFee));
  return {
    ok: true,
    calculationOnly: true,
    paymentId: payment.paymentId,
    operationId: input.operationId,
    allocation,
    cumulative: split(Number(nextLabor), nextFee),
    remaining: split(payment.providerAmountCents - Number(nextLabor), payment.customerFeeCents - nextFee),
  };
}
