/**
 * Synthetic-only regression contract for the deterministic audit engine.
 *
 * Run with:
 *   node --test audit.test.mjs
 *
 * The fixtures are invented and contain no PHI. The suite tests structured
 * results rather than scraping prose, fails closed on invalid inputs, and pins
 * stable IDs, ordering, grades, line references, and machine-readable evidence.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

import {
  auditCase,
  validateCase,
  parseCaseInput,
  ENGINE_VERSION,
  RULES_VERSION,
  MAX_INPUT_BYTES,
} from "./audit.mjs";

const ROOT = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(ROOT, "fixtures");

const EXPECTED_QUESTION_SHA256 = Object.freeze({
  "SYN-001:LINE_ARITHMETIC_MISMATCH:L8": "233e6c8cb7179c402775a5282fe03d3113c3f793b3269e80724df225c9f5622e",
  "SYN-001:STATEMENT_TOTAL_MISMATCH:CASE": "6543e37dfa3379096f1635100f9faf8ee33ec979b0a362bd2a39f6272a9086b3",
  "SYN-001:SERVICE_DATE_OUTSIDE_STAY:L6": "b490ef6d76503542fe8200a4c9e9e7a1f1bcde41a022886bc09265d58d9653f6",
  "SYN-001:ROOM_QUANTITY_EXCEEDS_NIGHTS:L4": "8838e7338413b3efd81c46bcd18794b6f292db0cf6bff5742f16b30c53e028a8",
  "SYN-001:EXACT_DUPLICATE:L2:L3": "9cac1c4309be6df01f7938fef9715320b81c96811728ff979db61b0b2016cd24",
  "SYN-001:PATIENT_BILLED_EXCEEDS_EOB:CASE": "0e5c918e4e322f75ef7da192984aebf08bc82e1ade068afea339a24c40d1bbe3",
  "SYN-001:EOB_NOT_COVERED:L5": "98a6c8a196ea568d5d817552f53c4251df3d937dfae6a381f2b4bf1f02440bcb",
  "SYN-004:LINE_ARITHMETIC_MISMATCH:L2": "c04b96b26c93b832564b824b29a00b3a3aeeeb72c560d9bc0d5bc19d26c84b77",
  "SYN-004:LINE_ARITHMETIC_MISMATCH:L7": "6a585bc37708d4265cdcf5a57450546cd40650b1dc273c3d2307d1b8f4ec084a",
  "SYN-004:SERVICE_DATE_OUTSIDE_STAY:L1": "010fc9cf81442f29d9a98d69d829e8534a432dbb0bbe3ee55fe477f3e8e7cdfd",
  "SYN-004:SERVICE_DATE_OUTSIDE_STAY:L8": "d97858b3c4d26e335eb62073690518a25cedf1430c0cf1c39a94cecb7b816562",
  "SYN-004:EXACT_DUPLICATE:L3:L4": "f43ea0ff1e6cd76df2b48686013cd0361d724e53febff498ec98f22ee4fe7936",
  "SYN-004:EXACT_DUPLICATE:L3:L5": "3d2a83666392fde9a0b199255ceab9fba0120b98cd83aad09077428d37792991",
  "SYN-004:EOB_NOT_COVERED:L6": "5b85c75faaeffc91b384ffb7850e0e7bf443841375072a0360b78bf0cde37b04",
  "SYN-004:EOB_NOT_COVERED:L8": "0d68213f1148195b12975fe44028486cc8bfc8bdbc714c8c465af7fa3101e0e0",
});

const finding = (id, rule, grade, lines, evidence) => ({
  id,
  rule,
  grade,
  lines,
  evidence,
});

const VALID_CASES = [
  {
    file: "01_all_rules.json",
    caseId: "SYN-001",
    findings: [
      finding(
        "LINE_ARITHMETIC_MISMATCH:L8",
        "LINE_ARITHMETIC_MISMATCH",
        "deterministic",
        [8],
        { quantity: 3, unitCents: 4100, expectedCents: 12300, billedCents: 13200 },
      ),
      finding(
        "STATEMENT_TOTAL_MISMATCH:CASE",
        "STATEMENT_TOTAL_MISMATCH",
        "deterministic",
        [],
        { lineSumCents: 835000, statedTotalCents: 842000 },
      ),
      finding(
        "SERVICE_DATE_OUTSIDE_STAY:L6",
        "SERVICE_DATE_OUTSIDE_STAY",
        "deterministic",
        [6],
        { serviceDate: "2026-04-05", admissionDate: "2026-04-02", dischargeDate: "2026-04-03" },
      ),
      finding(
        "ROOM_QUANTITY_EXCEEDS_NIGHTS:L4",
        "ROOM_QUANTITY_EXCEEDS_NIGHTS",
        "referral",
        [4],
        { billedQuantity: 2, stayNights: 1 },
      ),
      finding(
        "EXACT_DUPLICATE:L2:L3",
        "EXACT_DUPLICATE",
        "deterministic",
        [2, 3],
        { firstLine: 2, duplicateLine: 3, serviceDate: "2026-04-02", code: "80053", amountCents: 28900 },
      ),
      finding(
        "PATIENT_BILLED_EXCEEDS_EOB:CASE",
        "PATIENT_BILLED_EXCEEDS_EOB",
        "deterministic",
        [],
        {
          patientBilledCents: 143600,
          patientResponsibilityCents: 102400,
          billDocumentRef: "SYN-001-BILL",
          eobDocumentRef: "SYN-001-EOB",
          matchKey: "SYN-001-ENCOUNTER",
        },
      ),
      finding(
        "EOB_NOT_COVERED:L5",
        "EOB_NOT_COVERED",
        "deterministic",
        [5],
        {
          line: 5,
          reason: "included in synthetic room rate",
          billDocumentRef: "SYN-001-BILL",
          eobDocumentRef: "SYN-001-EOB",
          matchKey: "SYN-001-ENCOUNTER",
        },
      ),
    ],
    counts: {
      total: 7,
      deterministic: 6,
      referral: 1,
      byRule: {
        LINE_ARITHMETIC_MISMATCH: 1,
        STATEMENT_TOTAL_MISMATCH: 1,
        SERVICE_DATE_OUTSIDE_STAY: 1,
        ROOM_QUANTITY_EXCEEDS_NIGHTS: 1,
        EXACT_DUPLICATE: 1,
        PATIENT_BILLED_EXCEEDS_EOB: 1,
        EOB_NOT_COVERED: 1,
      },
    },
  },
  {
    file: "02_clean_control.json",
    caseId: "SYN-002",
    findings: [],
    counts: { total: 0, deterministic: 0, referral: 0, byRule: {} },
  },
  {
    file: "03_boundaries_nearmiss.json",
    caseId: "SYN-003",
    findings: [],
    counts: {
      total: 0,
      deterministic: 0,
      referral: 0,
      byRule: {},
    },
  },
  {
    file: "04_multiple_and_ordering.json",
    caseId: "SYN-004",
    findings: [
      finding(
        "LINE_ARITHMETIC_MISMATCH:L2",
        "LINE_ARITHMETIC_MISMATCH",
        "deterministic",
        [2],
        { quantity: 2, unitCents: 3000, expectedCents: 6000, billedCents: 6500 },
      ),
      finding(
        "LINE_ARITHMETIC_MISMATCH:L7",
        "LINE_ARITHMETIC_MISMATCH",
        "deterministic",
        [7],
        { quantity: 3, unitCents: 2000, expectedCents: 6000, billedCents: 6100 },
      ),
      finding(
        "SERVICE_DATE_OUTSIDE_STAY:L1",
        "SERVICE_DATE_OUTSIDE_STAY",
        "deterministic",
        [1],
        { serviceDate: "2026-07-09", admissionDate: "2026-07-10", dischargeDate: "2026-07-12" },
      ),
      finding(
        "SERVICE_DATE_OUTSIDE_STAY:L8",
        "SERVICE_DATE_OUTSIDE_STAY",
        "deterministic",
        [8],
        { serviceDate: "2026-07-13", admissionDate: "2026-07-10", dischargeDate: "2026-07-12" },
      ),
      finding(
        "EXACT_DUPLICATE:L3:L4",
        "EXACT_DUPLICATE",
        "deterministic",
        [3, 4],
        { firstLine: 3, duplicateLine: 4, serviceDate: "2026-07-10", code: "80053", amountCents: 10000 },
      ),
      finding(
        "EXACT_DUPLICATE:L3:L5",
        "EXACT_DUPLICATE",
        "deterministic",
        [3, 5],
        { firstLine: 3, duplicateLine: 5, serviceDate: "2026-07-10", code: "80053", amountCents: 10000 },
      ),
      finding(
        "EOB_NOT_COVERED:L6",
        "EOB_NOT_COVERED",
        "deterministic",
        [6],
        {
          line: 6,
          reason: "synthetic coverage reason A",
          billDocumentRef: "SYN-004-BILL",
          eobDocumentRef: "SYN-004-EOB",
          matchKey: "SYN-004-ENCOUNTER",
        },
      ),
      finding(
        "EOB_NOT_COVERED:L8",
        "EOB_NOT_COVERED",
        "deterministic",
        [8],
        {
          line: 8,
          reason: "synthetic coverage reason B",
          billDocumentRef: "SYN-004-BILL",
          eobDocumentRef: "SYN-004-EOB",
          matchKey: "SYN-004-ENCOUNTER",
        },
      ),
    ],
    counts: {
      total: 8,
      deterministic: 8,
      referral: 0,
      byRule: {
        LINE_ARITHMETIC_MISMATCH: 2,
        SERVICE_DATE_OUTSIDE_STAY: 2,
        EXACT_DUPLICATE: 2,
        EOB_NOT_COVERED: 2,
      },
    },
  },
];

const INVALID_CASES = [
  {
    file: "05_invalid_shape.json",
    errors: [
      { code: "SCHEMA_REQUIRED", path: "/file" },
      { code: "SCHEMA_TYPE", path: "/admission" },
      { code: "SCHEMA_TYPE", path: "/lines" },
      { code: "SCHEMA_TYPE", path: "/billedTotal" },
      { code: "SCHEMA_ADDITIONAL_PROPERTY", path: "/unexpected" },
    ],
  },
  {
    file: "06_invalid_semantics.json",
    errors: [
      { code: "DATE_ORDER", path: "/discharge" },
      { code: "LINE_NUMBER_DUPLICATE", path: "/lines/1/n" },
      { code: "DATE_INVALID", path: "/lines/2/date" },
      { code: "NUMBER_GT_ZERO", path: "/lines/3/qty" },
      { code: "NUMBER_NONNEGATIVE", path: "/lines/3/unit" },
      { code: "MONEY_PRECISION", path: "/lines/3/amount" },
      { code: "NUMBER_NONNEGATIVE", path: "/billedTotal" },
      { code: "REFERENCE_UNKNOWN_LINE", path: "/eob/notCovered/0/line" },
    ],
  },
];

function loadFixture(file) {
  return JSON.parse(readFileSync(join(FIXTURES, file), "utf8"));
}

function projectedFindings(result) {
  return result.findings.map(({ id, rule, grade, lines, evidence }) => ({
    id,
    rule,
    grade,
    lines,
    evidence,
  }));
}

function findingCounts(findings) {
  const byRule = {};
  for (const item of findings) {
    byRule[item.rule] = (byRule[item.rule] ?? 0) + 1;
  }
  return {
    total: findings.length,
    deterministic: findings.filter(({ grade }) => grade === "deterministic").length,
    referral: findings.filter(({ grade }) => grade === "referral").length,
    byRule,
  };
}

function assertSafeQuestions(findings) {
  const unsafe = /\b(?:is|are|was|were)\s+(?:definitely\s+)?(?:wrong|incorrect|fraudulent|illegal|upcoded|unbundled)\b|\bfraud(?:ulent)?\b|\billegal\b|\bupcod(?:e|ed|ing)\b|\bunbundl(?:e|ed|ing)\b/i;
  for (const item of findings) {
    assert.equal(typeof item.question, "string", `${item.id} question must be a string`);
    assert.notEqual(item.question.trim(), "", `${item.id} question must not be empty`);
    assert.doesNotMatch(item.question, unsafe, `${item.id} must not make an unsafe asserted claim`);
  }
}

function runCli(file) {
  return spawnSync(process.execPath, ["audit.mjs", "--json", join("fixtures", file)], {
    cwd: ROOT,
    encoding: "utf8",
    windowsHide: true,
  });
}

test("exports stable engine and rules versions", () => {
  assert.equal(ENGINE_VERSION, "1.0.0");
  assert.equal(RULES_VERSION, "audit-rules.v1");
});

test("fixture directory contains exactly the six synthetic contract cases", () => {
  assert.deepEqual(
    readdirSync(FIXTURES).filter((name) => name.endsWith(".json")).sort(),
    [
      "01_all_rules.json",
      "02_clean_control.json",
      "03_boundaries_nearmiss.json",
      "04_multiple_and_ordering.json",
      "05_invalid_shape.json",
      "06_invalid_semantics.json",
    ],
  );
});

for (const expected of VALID_CASES) {
  test(`${expected.file}: exact structured findings, ordering, and repeatability`, () => {
    const input = loadFixture(expected.file);
    const original = JSON.stringify(input);
    const validation = validateCase(input);
    assert.equal(validation.status, "ok");
    assert.equal(validation.valid, true);
    assert.deepEqual(validation.errors, []);

    const first = auditCase(input);
    const second = auditCase(input);

    assert.equal(first.status, "ok");
    assert.equal(first.caseId, expected.caseId);
    assert.equal(first.engineVersion, ENGINE_VERSION);
    assert.equal(first.rulesVersion, RULES_VERSION);
    assert.deepEqual(projectedFindings(first), expected.findings);
    assert.deepEqual(findingCounts(first.findings), expected.counts);
    assert.deepEqual(
      {
        total: first.summary.total,
        deterministic: first.summary.deterministic,
        referral: first.summary.referral,
        byRule: first.summary.byRule,
      },
      expected.counts,
    );
    assert.deepEqual(
      Object.keys(first.summary).sort(),
      ["byRule", "deterministic", "hours", "lineSumCents", "referral", "stayNights", "total"].sort(),
    );
    assert.equal(
      first.summary.lineSumCents,
      input.lines.reduce((sum, line) => sum + Math.round(line.amount * 100), 0),
    );
    const admissionDay = Date.UTC(...input.admission.slice(0, 10).split("-").map((value, index) => Number(value) - (index === 1 ? 1 : 0)));
    const dischargeDay = Date.UTC(...input.discharge.slice(0, 10).split("-").map((value, index) => Number(value) - (index === 1 ? 1 : 0)));
    assert.equal(first.summary.stayNights, (dischargeDay - admissionDay) / 86_400_000);
    assert.equal(first.summary.hours, +((Date.parse(input.discharge) - Date.parse(input.admission)) / 3_600_000).toFixed(2));
    for (const item of first.findings) {
      const key = `${first.caseId}:${item.id}`;
      assert.equal(
        createHash("sha256").update(item.question).digest("hex"),
        EXPECTED_QUESTION_SHA256[key],
        `${key} question text must match its reviewed digest`,
      );
    }
    assert.equal(new Set(first.findings.map(({ id }) => id)).size, first.findings.length);
    assert.equal(JSON.stringify(first), JSON.stringify(second), "two runs must be byte-identical canonical JSON");
    assert.equal(JSON.stringify(input), original, "auditCase must not mutate its input");
    assertSafeQuestions(first.findings);
  });
}

for (const expected of INVALID_CASES) {
  test(`${expected.file}: validation and audit fail closed with exact errors`, () => {
    const input = loadFixture(expected.file);
    const validation = validateCase(input);
    assert.equal(validation.status, "invalid");
    assert.equal(validation.valid, false);
    assert.deepEqual(validation.errors.map(({ code, path }) => ({ code, path })), expected.errors);

    const result = auditCase(input);
    assert.equal(result.status, "invalid");
    assert.equal(result.caseId, null);
    assert.deepEqual(result.findings, []);
    assert.deepEqual(result.errors.map(({ code, path }) => ({ code, path })), expected.errors);
    assert.equal(JSON.stringify(result), JSON.stringify(auditCase(input)), "invalid output must also be repeatable");
  });
}

test("strict timestamp validation rejects impossible dates and offsets", () => {
  const input = loadFixture("02_clean_control.json");
  input.admission = "2026-02-31T09:00:00-05:00";
  input.discharge = "2026-03-01T12:00:00+15:00";
  assert.deepEqual(
    validateCase(input).errors.map(({ code, path }) => ({ code, path })),
    [
      { code: "TIMESTAMP_INVALID", path: "/admission" },
      { code: "TIMESTAMP_INVALID", path: "/discharge" },
    ],
  );
  assert.deepEqual(auditCase(input).findings, []);
});

test("an empty line array fails closed", () => {
  const input = loadFixture("02_clean_control.json");
  input.lines = [];
  input.billedTotal = 0;
  assert.deepEqual(
    validateCase(input).errors.map(({ code, path }) => ({ code, path })),
    [{ code: "ARRAY_MIN_ITEMS", path: "/lines" }],
  );
  assert.deepEqual(auditCase(input).findings, []);
});

test("zero-duration and cross-offset local-date reversals fail closed", () => {
  const zeroDuration = loadFixture("02_clean_control.json");
  zeroDuration.discharge = zeroDuration.admission;
  assert.deepEqual(
    validateCase(zeroDuration).errors.map(({ code, path }) => ({ code, path })),
    [{ code: "DATE_ORDER", path: "/discharge" }],
  );

  const crossOffset = loadFixture("02_clean_control.json");
  crossOffset.admission = "2026-05-11T00:30:00+14:00";
  crossOffset.discharge = "2026-05-10T23:00:00-12:00";
  assert.deepEqual(
    validateCase(crossOffset).errors.map(({ code, path }) => ({ code, path })),
    [{ code: "DATE_ORDER_LOCAL", path: "/discharge" }],
  );
  assert.deepEqual(auditCase(crossOffset).findings, []);
});

test("duplicate EOB not-covered references fail closed before findings", () => {
  const input = loadFixture("02_clean_control.json");
  input.eob = {
    allowed: 1100,
    planPaid: 0,
    patientResponsibility: 1100,
    notCovered: [
      { line: 1, reason: "synthetic reason A" },
      { line: 1, reason: "synthetic reason B" },
    ],
  };
  input.reconciliation = {
    billDocumentRef: "SYN-DUP-REF-BILL",
    eobDocumentRef: "SYN-DUP-REF-EOB",
    billMatchKey: "SYN-DUP-REF",
    eobMatchKey: "SYN-DUP-REF",
    matchBasis: "synthetic_fixture",
  };
  assert.deepEqual(
    validateCase(input).errors.map(({ code, path }) => ({ code, path })),
    [{ code: "REFERENCE_DUPLICATE_LINE", path: "/eob/notCovered/1/line" }],
  );
  assert.deepEqual(auditCase(input).findings, []);
});

test("operating-room text and nonidentical same-price lines do not masquerade as exact duplicates", () => {
  const input = loadFixture("02_clean_control.json");
  input.lines[2] = {
    ...input.lines[2],
    rev: "0360",
    desc: "Synthetic operating room charge",
    qty: 3,
    amount: 1500,
  };
  input.lines.push({
    n: 4,
    date: "2026-05-11",
    rev: "0300",
    code: "S1002",
    desc: "Synthetic laboratory panel",
    qty: 3,
    unit: 25,
    amount: 75,
  });
  input.billedTotal = 1675;
  assert.equal(validateCase(input).status, "ok");
  assert.deepEqual(auditCase(input).findings, []);
});

test("huge finite quantities are rejected before unsafe arithmetic can serialize", () => {
  const input = loadFixture("02_clean_control.json");
  input.lines[0].qty = 1e308;
  const result = auditCase(input);
  assert.equal(result.status, "invalid");
  assert.deepEqual(
    result.errors.map(({ code, path }) => ({ code, path })),
    [{ code: "NUMBER_MAX", path: "/lines/0/qty" }],
  );
  assert.doesNotMatch(JSON.stringify(result), /"evidence":null|"(?:expectedCents|hours|unitsPerHour)":null/);
});

test("delimiter characters in code and description cannot collide into a false exact duplicate", () => {
  const input = loadFixture("02_clean_control.json");
  input.lines.push(
    {
      n: 4,
      date: "2026-05-11",
      rev: "0300",
      code: "A|B",
      desc: "C",
      qty: 1,
      unit: 10,
      amount: 10,
    },
    {
      n: 5,
      date: "2026-05-11",
      rev: "0300",
      code: "A",
      desc: "B|C",
      qty: 1,
      unit: 10,
      amount: 10,
    },
  );
  input.billedTotal = 1120;
  assert.equal(validateCase(input).status, "ok");
  assert.deepEqual(auditCase(input).findings, []);
});

test("finding IDs and output order are independent of source array order", () => {
  const canonical = loadFixture("04_multiple_and_ordering.json");
  const reordered = loadFixture("04_multiple_and_ordering.json");
  reordered.lines.reverse();
  reordered.eob.notCovered.reverse();
  assert.equal(validateCase(reordered).status, "ok");
  assert.equal(JSON.stringify(auditCase(reordered)), JSON.stringify(auditCase(canonical)));
});

test("aggregate line cents fail closed before JavaScript safe-integer overflow", () => {
  const input = loadFixture("02_clean_control.json");
  input.lines = [1, 2, 3].map((n) => ({
    n,
    date: "2026-05-11",
    rev: "0300",
    code: `HUGE${n}`,
    desc: `Synthetic huge amount ${n}`,
    qty: 1,
    unit: 40_000_000_000_000.01,
    amount: 40_000_000_000_000.01,
  }));
  assert.deepEqual(
    validateCase(input).errors.map(({ code, path }) => ({ code, path })),
    [{ code: "NUMBER_SAFE_RANGE", path: "/lines" }],
  );
  assert.deepEqual(auditCase(input).findings, []);
});

test("code and revenue-code whitespace is rejected rather than changing duplicate identity", () => {
  const input = loadFixture("02_clean_control.json");
  input.lines[0].code += " ";
  input.lines[2].rev += " ";
  assert.deepEqual(
    validateCase(input).errors.map(({ code, path }) => ({ code, path })),
    [
      { code: "STRING_CANONICAL", path: "/lines/0/code" },
      { code: "STRING_CANONICAL", path: "/lines/2/rev" },
    ],
  );
});

test("line numbers and EOB references must be safe integers", () => {
  const lineInput = loadFixture("02_clean_control.json");
  lineInput.lines[0].n = Number.MAX_SAFE_INTEGER + 1;
  assert.deepEqual(
    validateCase(lineInput).errors.map(({ code, path }) => ({ code, path })),
    [{ code: "INTEGER_SAFE_GT_ZERO", path: "/lines/0/n" }],
  );

  const referenceInput = loadFixture("01_all_rules.json");
  referenceInput.eob.notCovered[0].line = Number.MAX_SAFE_INTEGER + 1;
  assert.deepEqual(
    validateCase(referenceInput).errors.map(({ code, path }) => ({ code, path })),
    [{ code: "INTEGER_SAFE_GT_ZERO", path: "/eob/notCovered/0/line" }],
  );
});

test("EOB plan-paid amount cannot exceed its allowed amount", () => {
  const input = loadFixture("02_clean_control.json");
  input.eob = {
    allowed: 100,
    planPaid: 200,
    patientResponsibility: 100,
    notCovered: [],
  };
  input.patientBilledAmount = 100;
  input.reconciliation = {
    billDocumentRef: "SYN-EOB-CHECK-BILL",
    eobDocumentRef: "SYN-EOB-CHECK-EOB",
    billMatchKey: "SYN-EOB-CHECK",
    eobMatchKey: "SYN-EOB-CHECK",
    matchBasis: "synthetic_fixture",
  };
  assert.deepEqual(
    validateCase(input).errors.map(({ code, path }) => ({ code, path })),
    [{ code: "EOB_PLAN_PAID_EXCEEDS_ALLOWED", path: "/eob/planPaid" }],
  );
  assert.deepEqual(auditCase(input).findings, []);
});

test("bill and EOB reconciliation provenance is required and must match", () => {
  const missing = loadFixture("01_all_rules.json");
  delete missing.reconciliation;
  assert.deepEqual(
    validateCase(missing).errors.map(({ code, path }) => ({ code, path })),
    [{ code: "SCHEMA_REQUIRED", path: "/reconciliation" }],
  );

  const mismatch = loadFixture("01_all_rules.json");
  mismatch.reconciliation.eobMatchKey = "SYN-DIFFERENT-ENCOUNTER";
  assert.deepEqual(
    validateCase(mismatch).errors.map(({ code, path }) => ({ code, path })),
    [{ code: "RECONCILIATION_MISMATCH", path: "/reconciliation/eobMatchKey" }],
  );
  assert.deepEqual(auditCase(mismatch).findings, []);
});

test("untrusted input bytes, strings, and EOB entry counts are bounded", () => {
  const oversizedRaw = parseCaseInput(Buffer.alloc(MAX_INPUT_BYTES + 1, 0x20));
  assert.equal(oversizedRaw.status, "invalid");
  assert.deepEqual(
    oversizedRaw.errors.map(({ code, path }) => ({ code, path })),
    [{ code: "INPUT_MAX_BYTES", path: "/" }],
  );

  const oversizedString = loadFixture("02_clean_control.json");
  oversizedString.lines[0].desc = "X".repeat(501);
  assert.deepEqual(
    validateCase(oversizedString).errors.map(({ code, path }) => ({ code, path })),
    [{ code: "STRING_MAX_LENGTH", path: "/lines/0/desc" }],
  );

  const oversizedEntries = loadFixture("01_all_rules.json");
  oversizedEntries.eob.notCovered = Array.from(
    { length: 10_001 },
    () => ({ line: 5, reason: "synthetic bounded entry" }),
  );
  assert.deepEqual(
    validateCase(oversizedEntries).errors.map(({ code, path }) => ({ code, path })),
    [{ code: "ARRAY_MAX_ITEMS", path: "/eob/notCovered" }],
  );
  assert.deepEqual(auditCase(oversizedEntries).findings, []);
});

test("more than 10,000 lines fails closed before unbounded validation work", () => {
  const input = loadFixture("02_clean_control.json");
  input.lines = Array.from({ length: 10_001 }, (_, index) => ({
    n: index + 1,
    date: "2026-05-11",
    rev: "0300",
    code: `S${index + 1}`,
    desc: `Synthetic bounded line ${index + 1}`,
    qty: 1,
    unit: 0,
    amount: 0,
  }));
  input.billedTotal = 0;
  assert.deepEqual(
    validateCase(input).errors.map(({ code, path }) => ({ code, path })),
    [{ code: "ARRAY_MAX_ITEMS", path: "/lines" }],
  );
  assert.deepEqual(auditCase(input).findings, []);
});

test("aggregate contract is six fixtures, 15 expected findings, zero extras, two fail-closed cases", () => {
  assert.equal(VALID_CASES.length + INVALID_CASES.length, 6);
  assert.equal(VALID_CASES.reduce((sum, item) => sum + item.findings.length, 0), 15);
  assert.equal(INVALID_CASES.length, 2);
});

for (const expected of VALID_CASES) {
  test(`CLI --json ${expected.file}: exit 0, empty stderr, and API-equivalent JSON`, () => {
    const run = runCli(expected.file);
    assert.equal(run.status, 0);
    assert.equal(run.signal, null);
    assert.equal(run.stderr, "");
    const cli = JSON.parse(run.stdout);
    assert.equal(JSON.stringify(cli), JSON.stringify(auditCase(loadFixture(expected.file))));
  });
}

for (const expected of INVALID_CASES) {
  test(`CLI --json ${expected.file}: exit 2, no partial audit, raw input, or stack`, () => {
    const run = runCli(expected.file);
    assert.equal(run.status, 2);
    assert.equal(run.signal, null);
    assert.equal(run.stderr, "");
    assert.doesNotMatch(run.stdout, /(?:^|\n)\s*at\s+\S+|Error:|_comment|SYNTHETIC TEST DATA|Synthetic unknown reference/);

    const result = JSON.parse(run.stdout);
    assert.equal(result.status, "invalid");
    assert.deepEqual(result.findings, []);
    assert.deepEqual(result.errors.map(({ code, path }) => ({ code, path })), expected.errors);
  });
}
