import assert from "node:assert/strict";
import test from "node:test";
import { calculateProportionalRefund } from "../lib/proportional-refund-calculation.ts";

const amounts = (labor, fee) => ({
  providerRefundCents: labor, customerFeeRefundCents: fee, customerRefundCents: labor + fee,
});
const input = (labor = 4000, originalLabor = 10000, originalFee = 500) => ({
  payment: { paymentId: "synthetic-payment", currency: "usd", providerAmountCents: originalLabor,
    customerFeeCents: originalFee, customerTotalCents: originalLabor + originalFee },
  operationId: "synthetic-next", providerRefundCents: labor, history: [],
});
const movement = (labor = 4000, fee = 200, status = "succeeded", id = "synthetic-prior") => ({
  ...amounts(labor, fee), paymentId: "synthetic-payment", operationId: id, status,
});
const blocked = (value, code) => assert.deepEqual(calculateProportionalRefund(value), { ok: false, code });

test("approved $40 labor refund returns $2 of the saved $5 fee", () => {
  assert.deepEqual(calculateProportionalRefund(input()), {
    ok: true, calculationOnly: true, paymentId: "synthetic-payment", operationId: "synthetic-next",
    allocation: amounts(4000, 200), cumulative: amounts(4000, 200), remaining: amounts(6000, 300),
  });
});

test("three $33.33 labor refunds return $1.67, $1.66 and $1.67 without penny drift", () => {
  const value = input(3333, 9999, 500);
  const expected = [[167, 6666, 333], [166, 3333, 167], [167, 0, 0]];
  for (let index = 0; index < expected.length; index++) {
    value.operationId = `synthetic-${index}`;
    const result = calculateProportionalRefund(value);
    assert.equal(result.ok, true);
    const [fee, remainingLabor, remainingFee] = expected[index];
    assert.deepEqual(result.allocation, amounts(3333, fee));
    assert.deepEqual(result.remaining, amounts(remainingLabor, remainingFee));
    value.history.push(movement(3333, fee, "succeeded", value.operationId));
  }
  assert.equal(value.history.reduce((sum, row) => sum + row.customerRefundCents, 0), 10499);
});

test("exact half-cent rounds up once and the final refund returns only the remainder", () => {
  const value = input(10, 20, 1);
  assert.deepEqual(calculateProportionalRefund(value).allocation, amounts(10, 1));
  value.history.push(movement(10, 1));
  const second = calculateProportionalRefund(value);
  assert.deepEqual(second.allocation, amounts(10, 0));
  assert.deepEqual(second.remaining, amounts(0, 0));
});

test("one hundred penny refunds return exactly the original $1.05", () => {
  const value = input(1, 100, 5);
  const feeSteps = [];
  for (let i = 1; i <= 100; i++) {
    value.operationId = `synthetic-cent-${i}`;
    const result = calculateProportionalRefund(value);
    assert.equal(result.ok, true);
    if (result.allocation.customerFeeRefundCents) feeSteps.push(i);
    value.history.push(movement(1, result.allocation.customerFeeRefundCents, "succeeded", value.operationId));
  }
  assert.deepEqual(feeSteps, [10, 30, 50, 70, 90]);
  assert.equal(value.history.reduce((sum, row) => sum + row.customerRefundCents, 0), 105);
  value.operationId = "synthetic-excess";
  blocked(value, "refund_limit_exceeded");
});

test("calculation uses the fee actually saved, including a zero fee, not today's rate", () => {
  assert.deepEqual(calculateProportionalRefund(input(5000, 10000, 499)).allocation, amounts(5000, 250));
  assert.deepEqual(calculateProportionalRefund(input(4000, 10000, 0)).allocation, amounts(4000, 0));
});

test("a final full labor refund includes every remaining fee cent", () => {
  const value = input(6666, 9999, 500);
  value.history.push(movement(3333, 167));
  assert.deepEqual(calculateProportionalRefund(value).allocation, amounts(6666, 333));
  assert.deepEqual(calculateProportionalRefund(input(10000)).allocation, amounts(10000, 500));
});

test("reservations, pending refunds and uncertain replies block another calculation", () => {
  for (const status of ["reserved", "pending", "uncertain"]) {
    const value = input();
    value.history.push(movement(1000, 50, "succeeded"), movement(2000, 100, status, "synthetic-in-flight"));
    blocked(value, "in_flight_refund");
    value.history[1].status = "succeeded";
    assert.deepEqual(calculateProportionalRefund(value).allocation, amounts(4000, 200));
  }
});

test("definitively failed or canceled attempts consume no balance but cannot reuse an operation ID", () => {
  for (const status of ["failed", "canceled"]) {
    const value = input(10000);
    value.history.push(movement(10000, 500, status));
    assert.deepEqual(calculateProportionalRefund(value).allocation, amounts(10000, 500));
    value.operationId = "synthetic-prior";
    blocked(value, "duplicate_operation");
  }
});

test("repeated requests and duplicate history rows require recovery rather than a new allocation", () => {
  const value = input();
  value.history.push(movement());
  value.operationId = "synthetic-prior";
  blocked(value, "duplicate_operation");
  value.operationId = "synthetic-next";
  value.history.push(movement());
  blocked(value, "duplicate_operation");
});

test("prior plus proposed refunds cannot exceed the original labor or fee", () => {
  const value = input(6001);
  value.history.push(movement());
  blocked(value, "refund_limit_exceeded");
  value.providerRefundCents = 6000;
  assert.deepEqual(calculateProportionalRefund(value).remaining, amounts(0, 0));
  value.history.push(movement(7000, 200, "succeeded", "synthetic-too-much-labor"));
  blocked(value, "refund_limit_exceeded");
  value.history = [movement(4000, 300), movement(1000, 201, "succeeded", "synthetic-too-much-fee")];
  blocked(value, "refund_limit_exceeded");
});

test("goodwill, legacy under-refunds and excess fee refunds require reconciliation", () => {
  for (const [labor, fee] of [[0, 100], [4000, 0], [4000, 199], [4000, 201], [4000, 500]]) {
    const value = input(); value.history.push(movement(labor, fee));
    blocked(value, "history_needs_reconciliation");
  }
});

test("only a valid paid USD split can be used", () => {
  for (const value of [null, [], {}, { payment: null }, { payment: [] }]) blocked(value, "invalid_payment");
  for (const change of [{ paymentId: "" }, { paymentId: " wrong " }, { currency: "eur" }, { currency: "USD" },
    { providerAmountCents: 0 }, { customerTotalCents: 10499 }, { customerFeeCents: 499 }]) {
    const value = input(); Object.assign(value.payment, change); blocked(value, "invalid_payment");
  }
  for (const key of ["providerAmountCents", "customerFeeCents", "customerTotalCents"]) {
    for (const amount of [-1, 1.5, "500", true, null, undefined, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
      const value = input(); value.payment[key] = amount; blocked(value, "invalid_payment");
    }
  }
  const overflowing = input(1, Number.MAX_SAFE_INTEGER, 1);
  blocked(overflowing, "invalid_payment");
});

test("refund requests reject zero, coercible values, invalid cents and blank IDs", () => {
  for (const amount of [0, -1, 1.1, "4000", false, null, undefined, NaN, Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    const value = input(); value.providerRefundCents = amount; blocked(value, "invalid_request");
  }
  for (const id of ["", " ", " id ", null, 1]) {
    const value = input(); value.operationId = id; blocked(value, "invalid_request");
  }
});

test("missing history, foreign payments and corrupt movements fail closed", () => {
  for (const history of [undefined, null, {}, [null], [[]], [{}]]) {
    const value = input(); value.history = history; blocked(value, "invalid_history");
  }
  for (const change of [{ paymentId: "another-payment" }, { operationId: "" }, { customerRefundCents: 4201 },
    { providerRefundCents: -1 }, { customerFeeRefundCents: "200" }, { customerRefundCents: true },
    { ...amounts(0, 0) }, { ...amounts(10001, 500) }, { ...amounts(100, 501) }]) {
    const value = input(); value.history.push({ ...movement(), ...change }); blocked(value, "invalid_history");
  }
});

test("unknown or unnormalized processor states are never treated as a failed refund", () => {
  for (const status of [undefined, null, 0, {}, { toString: () => "succeeded" }, "", "approved", "refund_succeeded", "requires_action"]) {
    const value = input(); value.history.push(movement(4000, 200, status));
    // Passing undefined to the fixture uses its default, so assign it explicitly.
    value.history[0].status = status;
    blocked(value, "invalid_history");
  }
});

test("integer products beyond safe floating-point precision still round exact halves correctly", () => {
  const original = 9007199254740490, half = 4503599627370245;
  const value = input(half, original, 501);
  assert.equal(value.payment.customerTotalCents, Number.MAX_SAFE_INTEGER);
  assert.deepEqual(calculateProportionalRefund(value).allocation, amounts(half, 251));
  value.history.push(movement(half, 251));
  assert.deepEqual(calculateProportionalRefund(value).allocation, amounts(half, 250));
  assert.deepEqual(calculateProportionalRefund(value).remaining, amounts(0, 0));
});

test("split-refund sequences preserve balances and match a single cumulative refund", () => {
  for (let original = 3; original <= 400; original++) {
    const fee = Math.round(original / 20), first = Math.floor(original / 3);
    const value = input(first, original, fee);
    let cumulativeLabor = 0, cumulativeFee = 0, cumulativeTotal = 0;
    for (const [index, labor] of [first, first, original - 2 * first].entries()) {
      value.providerRefundCents = labor; value.operationId = `synthetic-split-${index}`;
      const result = calculateProportionalRefund(value);
      assert.equal(result.ok, true);
      cumulativeLabor += labor;
      cumulativeFee += result.allocation.customerFeeRefundCents;
      cumulativeTotal += result.allocation.customerRefundCents;
      assert.ok(result.allocation.customerFeeRefundCents >= 0);
      assert.deepEqual(result.cumulative, amounts(cumulativeLabor, cumulativeFee));
      assert.equal(result.remaining.customerRefundCents + cumulativeTotal, original + fee);
      assert.deepEqual(result.cumulative, calculateProportionalRefund(input(cumulativeLabor, original, fee)).allocation);
      value.history.push(movement(labor, result.allocation.customerFeeRefundCents, "succeeded", value.operationId));
    }
    assert.equal(cumulativeLabor, original); assert.equal(cumulativeFee, fee);
    assert.equal(cumulativeTotal, original + fee);
  }
});

test("calculation does not mutate the snapshot or contact an external service", () => {
  const value = input(); value.history.push(movement());
  for (const row of value.history) Object.freeze(row);
  Object.freeze(value.history); Object.freeze(value.payment); Object.freeze(value);
  const before = structuredClone(value), originalFetch = globalThis.fetch;
  globalThis.fetch = () => { throw Error("Network forbidden in refund calculation"); };
  try {
    const result = calculateProportionalRefund(value);
    assert.equal(result.ok, true); assert.equal(result.calculationOnly, true);
    assert.deepEqual(value, before);
  } finally { globalThis.fetch = originalFetch; }
});
