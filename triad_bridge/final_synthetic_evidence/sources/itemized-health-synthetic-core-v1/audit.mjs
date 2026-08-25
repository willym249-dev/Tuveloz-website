/**
 * Deterministic synthetic bill/EOB reconciliation engine.
 *
 * This module accepts a strict, versioned canonical JSON shape. It does not
 * parse real bills, decide coding or medical necessity, or establish that a
 * charge is wrong. Real and merely redacted records remain out of scope.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

export const ENGINE_VERSION = "1.0.0";
export const RULES_VERSION = "audit-rules.v1";

export const GRADE = Object.freeze({
  DETERMINISTIC: "deterministic",
  REFERRAL: "referral",
});

const TOP_LEVEL_KEYS = new Set([
  "_comment",
  "schemaVersion",
  "file",
  "admission",
  "discharge",
  "lines",
  "billedTotal",
  "eob",
  "reconciliation",
  "patientBilledAmount",
]);

const LINE_KEYS = new Set([
  "n", "date", "rev", "code", "desc", "qty", "unit", "amount",
]);
const EOB_KEYS = new Set(["allowed", "planPaid", "patientResponsibility", "notCovered"]);
const RECONCILIATION_KEYS = new Set([
  "billDocumentRef", "eobDocumentRef", "billMatchKey", "eobMatchKey", "matchBasis",
]);
const NOT_COVERED_KEYS = new Set(["line", "reason"]);
const MAX_QUANTITY = 1_000_000;
const MAX_LINES = 10_000;
const MAX_NOT_COVERED = 10_000;
const MAX_STRING_LENGTH = 500;
export const MAX_INPUT_BYTES = 1_000_000;

const isObject = (value) => value !== null && typeof value === "object" && !Array.isArray(value);
const isFiniteNumber = (value) => typeof value === "number" && Number.isFinite(value);
const hasMoneyPrecision = (value) => Math.abs(value * 100 - Math.round(value * 100)) <= 1e-8;
const cents = (value) => Math.round(value * 100);
const money = (valueCents) => `$${(valueCents / 100).toFixed(2)}`;
const round = (value, places) => +value.toFixed(places);

function validDateOnly(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [year, month, day] = value.split("-").map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.getUTCFullYear() === year
    && parsed.getUTCMonth() === month - 1
    && parsed.getUTCDate() === day;
}

function validOffsetTimestamp(value) {
  if (typeof value !== "string") return false;
  const match = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,3})?)?(Z|([+-])(\d{2}):(\d{2}))$/.exec(value);
  if (!match || !validDateOnly(match[1])) return false;
  const hour = Number(match[2]);
  const minute = Number(match[3]);
  const second = match[4] === undefined ? 0 : Number(match[4]);
  if (hour > 23 || minute > 59 || second > 59) return false;
  if (match[5] !== "Z") {
    const offsetHour = Number(match[7]);
    const offsetMinute = Number(match[8]);
    if (offsetHour > 14 || offsetMinute > 59 || (offsetHour === 14 && offsetMinute !== 0)) return false;
  }
  return Number.isFinite(Date.parse(value));
}

function calendarDayNumber(timestamp) {
  const [year, month, day] = timestamp.slice(0, 10).split("-").map(Number);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function error(code, path, message) {
  return { code, path, message };
}

function requireString(errors, object, key, path = `/${key}`, maxLength = MAX_STRING_LENGTH) {
  if (!(key in object)) {
    errors.push(error("SCHEMA_REQUIRED", path, `${path} is required`));
    return false;
  }
  if (typeof object[key] !== "string" || object[key].trim() === "") {
    errors.push(error("SCHEMA_TYPE", path, `${path} must be a non-empty string`));
    return false;
  }
  if (object[key].length > maxLength) {
    errors.push(error("STRING_MAX_LENGTH", path, `${path} must not exceed ${maxLength} characters`));
    return false;
  }
  return true;
}

function invalidResult(errors) {
  return {
    status: "invalid",
    caseId: null,
    engineVersion: ENGINE_VERSION,
    rulesVersion: RULES_VERSION,
    errors,
    findings: [],
  };
}

/** Parse an untrusted CLI payload without allowing an unbounded JSON string. */
export function parseCaseInput(raw) {
  const buffer = Buffer.isBuffer(raw) ? raw : Buffer.from(String(raw), "utf8");
  if (buffer.byteLength > MAX_INPUT_BYTES) {
    return invalidResult([
      error("INPUT_MAX_BYTES", "/", `input must not exceed ${MAX_INPUT_BYTES} bytes`),
    ]);
  }
  try {
    return { status: "parsed", input: JSON.parse(buffer.toString("utf8")) };
  } catch {
    return invalidResult([error("JSON_INVALID", "/", "input must be valid JSON")]);
  }
}

function requireNumber(errors, object, key, path = `/${key}`) {
  if (!(key in object)) {
    errors.push(error("SCHEMA_REQUIRED", path, `${path} is required`));
    return false;
  }
  if (!isFiniteNumber(object[key])) {
    errors.push(error("SCHEMA_TYPE", path, `${path} must be a finite number`));
    return false;
  }
  return true;
}

function validateMoney(errors, value, path, { positive = false } = {}) {
  if (!isFiniteNumber(value)) return;
  if (positive ? value <= 0 : value < 0) {
    errors.push(error(
      positive ? "NUMBER_GT_ZERO" : "NUMBER_NONNEGATIVE",
      path,
      `${path} must be ${positive ? "greater than zero" : "nonnegative"}`,
    ));
  }
  if (!hasMoneyPrecision(value)) {
    errors.push(error("MONEY_PRECISION", path, `${path} must have no more than two decimal places`));
  }
  if (!Number.isSafeInteger(Math.round(value * 100))) {
    errors.push(error("NUMBER_SAFE_RANGE", path, `${path} is outside safe integer-cent range`));
  }
}

/**
 * Validate the canonical synthetic case. No partial audit is performed when
 * any error is present.
 */
export function validateCase(input) {
  const errors = [];
  if (!isObject(input)) {
    return {
      status: "invalid",
      valid: false,
      errors: [error("SCHEMA_TYPE", "/", "case must be an object")],
    };
  }

  if (!("schemaVersion" in input)) {
    errors.push(error("SCHEMA_REQUIRED", "/schemaVersion", "/schemaVersion is required"));
  } else if (input.schemaVersion !== "1.0") {
    errors.push(error("SCHEMA_CONST", "/schemaVersion", "/schemaVersion must equal 1.0"));
  }

  if ("_comment" in input) {
    if (typeof input._comment !== "string") {
      errors.push(error("SCHEMA_TYPE", "/_comment", "/_comment must be a string when present"));
    } else if (input._comment.length > MAX_STRING_LENGTH) {
      errors.push(error("STRING_MAX_LENGTH", "/_comment", `/_comment must not exceed ${MAX_STRING_LENGTH} characters`));
    }
  }

  requireString(errors, input, "file");
  const admissionString = requireString(errors, input, "admission");
  const dischargeString = requireString(errors, input, "discharge");

  if (admissionString && !validOffsetTimestamp(input.admission)) {
    errors.push(error("TIMESTAMP_INVALID", "/admission", "/admission must be an ISO timestamp with an explicit offset"));
  }
  if (dischargeString && !validOffsetTimestamp(input.discharge)) {
    errors.push(error("TIMESTAMP_INVALID", "/discharge", "/discharge must be an ISO timestamp with an explicit offset"));
  }
  if (validOffsetTimestamp(input.admission) && validOffsetTimestamp(input.discharge)) {
    if (Date.parse(input.discharge) <= Date.parse(input.admission)) {
      errors.push(error("DATE_ORDER", "/discharge", "/discharge must be later than /admission"));
    } else if (calendarDayNumber(input.discharge) < calendarDayNumber(input.admission)) {
      errors.push(error("DATE_ORDER_LOCAL", "/discharge", "/discharge local date must not precede /admission local date"));
    }
  }

  let linesAreArray = true;
  let linesWithinLimit = true;
  if (!("lines" in input)) {
    errors.push(error("SCHEMA_REQUIRED", "/lines", "/lines is required"));
    linesAreArray = false;
  } else if (!Array.isArray(input.lines)) {
    errors.push(error("SCHEMA_TYPE", "/lines", "/lines must be an array"));
    linesAreArray = false;
  } else if (input.lines.length === 0) {
    errors.push(error("ARRAY_MIN_ITEMS", "/lines", "/lines must contain at least one item"));
  } else if (input.lines.length > MAX_LINES) {
    errors.push(error("ARRAY_MAX_ITEMS", "/lines", `/lines must not contain more than ${MAX_LINES} items`));
    linesWithinLimit = false;
  }

  const lineNumbers = new Set();
  if (linesAreArray && linesWithinLimit) {
    input.lines.forEach((line, index) => {
      const base = `/lines/${index}`;
      if (!isObject(line)) {
        errors.push(error("SCHEMA_TYPE", base, `${base} must be an object`));
        return;
      }

      if (!("n" in line)) {
        errors.push(error("SCHEMA_REQUIRED", `${base}/n`, `${base}/n is required`));
      } else if (!Number.isSafeInteger(line.n) || line.n <= 0) {
        errors.push(error("INTEGER_SAFE_GT_ZERO", `${base}/n`, `${base}/n must be a positive safe integer`));
      } else if (lineNumbers.has(line.n)) {
        errors.push(error("LINE_NUMBER_DUPLICATE", `${base}/n`, `${base}/n repeats line ${line.n}`));
      } else {
        lineNumbers.add(line.n);
      }

      const dateString = requireString(errors, line, "date", `${base}/date`);
      if (dateString && !validDateOnly(line.date)) {
        errors.push(error("DATE_INVALID", `${base}/date`, `${base}/date must be a real YYYY-MM-DD date`));
      }
      const codeString = requireString(errors, line, "code", `${base}/code`);
      if (codeString && (line.code !== line.code.trim() || /\s/.test(line.code))) {
        errors.push(error("STRING_CANONICAL", `${base}/code`, `${base}/code must contain no whitespace`));
      }
      requireString(errors, line, "desc", `${base}/desc`);
      if ("rev" in line) {
        if (typeof line.rev !== "string") {
          errors.push(error("SCHEMA_TYPE", `${base}/rev`, `${base}/rev must be a string when present`));
        } else if (line.rev === "" || line.rev !== line.rev.trim() || /\s/.test(line.rev)) {
          errors.push(error("STRING_CANONICAL", `${base}/rev`, `${base}/rev must be a non-empty string containing no whitespace`));
        }
      }

      if (requireNumber(errors, line, "qty", `${base}/qty`) && line.qty <= 0) {
        errors.push(error("NUMBER_GT_ZERO", `${base}/qty`, `${base}/qty must be greater than zero`));
      } else if (isFiniteNumber(line.qty) && line.qty > MAX_QUANTITY) {
        errors.push(error("NUMBER_MAX", `${base}/qty`, `${base}/qty must not exceed ${MAX_QUANTITY}`));
      }
      if (requireNumber(errors, line, "unit", `${base}/unit`)) {
        validateMoney(errors, line.unit, `${base}/unit`);
      }
      if (requireNumber(errors, line, "amount", `${base}/amount`)) {
        validateMoney(errors, line.amount, `${base}/amount`);
      }
      if (isFiniteNumber(line.qty) && line.qty > 0 && line.qty <= MAX_QUANTITY
          && isFiniteNumber(line.unit) && line.unit >= 0
          && Number.isSafeInteger(Math.round(line.unit * 100))
          && !Number.isSafeInteger(Math.round(line.qty * Math.round(line.unit * 100)))) {
        errors.push(error("NUMBER_SAFE_RANGE", `${base}/qty`, `${base}/qty × /unit exceeds safe integer-cent range`));
      }

      for (const key of Object.keys(line).filter((key) => !LINE_KEYS.has(key)).sort()) {
        errors.push(error("SCHEMA_ADDITIONAL_PROPERTY", `${base}/${key}`, `${base}/${key} is not allowed`));
      }
    });

    let aggregateLineCents = 0n;
    let aggregateCanBeChecked = true;
    for (const line of input.lines) {
      if (!isObject(line) || !isFiniteNumber(line.amount) || line.amount < 0
          || !hasMoneyPrecision(line.amount)
          || !Number.isSafeInteger(cents(line.amount))) {
        aggregateCanBeChecked = false;
        break;
      }
      aggregateLineCents += BigInt(cents(line.amount));
    }
    if (aggregateCanBeChecked && aggregateLineCents > BigInt(Number.MAX_SAFE_INTEGER)) {
      errors.push(error("NUMBER_SAFE_RANGE", "/lines", "/lines aggregate amount exceeds safe integer-cent range"));
    }
  }

  if (requireNumber(errors, input, "billedTotal")) {
    validateMoney(errors, input.billedTotal, "/billedTotal");
  }

  if ("patientBilledAmount" in input) {
    if (!isFiniteNumber(input.patientBilledAmount)) {
      errors.push(error("SCHEMA_TYPE", "/patientBilledAmount", "/patientBilledAmount must be a finite number"));
    } else {
      validateMoney(errors, input.patientBilledAmount, "/patientBilledAmount");
    }
  }

  if ("eob" in input) {
    if (!isObject(input.eob)) {
      errors.push(error("SCHEMA_TYPE", "/eob", "/eob must be an object"));
    } else {
      for (const key of ["allowed", "planPaid", "patientResponsibility"]) {
        if (requireNumber(errors, input.eob, key, `/eob/${key}`)) {
          validateMoney(errors, input.eob[key], `/eob/${key}`);
        }
      }
      if (isFiniteNumber(input.eob.allowed) && isFiniteNumber(input.eob.planPaid)
          && input.eob.allowed >= 0 && input.eob.planPaid >= 0
          && input.eob.planPaid > input.eob.allowed) {
        errors.push(error("EOB_PLAN_PAID_EXCEEDS_ALLOWED", "/eob/planPaid", "/eob/planPaid must not exceed /eob/allowed"));
      }
      if (!("patientBilledAmount" in input)) {
        errors.push(error("SCHEMA_REQUIRED", "/patientBilledAmount", "/patientBilledAmount is required when /eob is present"));
      }
      if ("notCovered" in input.eob) {
        if (!Array.isArray(input.eob.notCovered)) {
          errors.push(error("SCHEMA_TYPE", "/eob/notCovered", "/eob/notCovered must be an array"));
        } else if (input.eob.notCovered.length > MAX_NOT_COVERED) {
          errors.push(error("ARRAY_MAX_ITEMS", "/eob/notCovered", `/eob/notCovered must not contain more than ${MAX_NOT_COVERED} items`));
        } else {
          const notCoveredLines = new Set();
          input.eob.notCovered.forEach((entry, index) => {
            const base = `/eob/notCovered/${index}`;
            if (!isObject(entry)) {
              errors.push(error("SCHEMA_TYPE", base, `${base} must be an object`));
              return;
            }
            if (!("line" in entry)) {
              errors.push(error("SCHEMA_REQUIRED", `${base}/line`, `${base}/line is required`));
            } else if (!Number.isSafeInteger(entry.line) || entry.line <= 0) {
              errors.push(error("INTEGER_SAFE_GT_ZERO", `${base}/line`, `${base}/line must be a positive safe integer`));
            } else if (linesAreArray && linesWithinLimit && !lineNumbers.has(entry.line)) {
              errors.push(error("REFERENCE_UNKNOWN_LINE", `${base}/line`, `${base}/line does not reference a bill line`));
            } else if (notCoveredLines.has(entry.line)) {
              errors.push(error("REFERENCE_DUPLICATE_LINE", `${base}/line`, `${base}/line repeats an earlier not-covered reference`));
            } else {
              notCoveredLines.add(entry.line);
            }
            requireString(errors, entry, "reason", `${base}/reason`);
            for (const key of Object.keys(entry).filter((key) => !NOT_COVERED_KEYS.has(key)).sort()) {
              errors.push(error("SCHEMA_ADDITIONAL_PROPERTY", `${base}/${key}`, `${base}/${key} is not allowed`));
            }
          });
        }
      }
      for (const key of Object.keys(input.eob).filter((key) => !EOB_KEYS.has(key)).sort()) {
        errors.push(error("SCHEMA_ADDITIONAL_PROPERTY", `/eob/${key}`, `/eob/${key} is not allowed`));
      }
    }
  }

  if ("eob" in input) {
    if (!("reconciliation" in input)) {
      errors.push(error("SCHEMA_REQUIRED", "/reconciliation", "/reconciliation is required when /eob is present"));
    } else if (!isObject(input.reconciliation)) {
      errors.push(error("SCHEMA_TYPE", "/reconciliation", "/reconciliation must be an object"));
    } else {
      const reconciliation = input.reconciliation;
      for (const key of ["billDocumentRef", "eobDocumentRef", "billMatchKey", "eobMatchKey", "matchBasis"]) {
        requireString(errors, reconciliation, key, `/reconciliation/${key}`, 128);
      }
      if (typeof reconciliation.billDocumentRef === "string"
          && reconciliation.billDocumentRef === reconciliation.eobDocumentRef) {
        errors.push(error("DOCUMENT_REF_DISTINCT", "/reconciliation/eobDocumentRef", "bill and EOB document references must be distinct"));
      }
      if (typeof reconciliation.billMatchKey === "string"
          && typeof reconciliation.eobMatchKey === "string"
          && reconciliation.billMatchKey !== reconciliation.eobMatchKey) {
        errors.push(error("RECONCILIATION_MISMATCH", "/reconciliation/eobMatchKey", "bill and EOB match keys must be equal"));
      }
      if (typeof reconciliation.matchBasis === "string"
          && reconciliation.matchBasis !== "synthetic_fixture") {
        errors.push(error("SCHEMA_CONST", "/reconciliation/matchBasis", "/reconciliation/matchBasis must equal synthetic_fixture"));
      }
      for (const key of Object.keys(reconciliation).filter((key) => !RECONCILIATION_KEYS.has(key)).sort()) {
        errors.push(error("SCHEMA_ADDITIONAL_PROPERTY", `/reconciliation/${key}`, `/reconciliation/${key} is not allowed`));
      }
    }
  } else if ("reconciliation" in input) {
    errors.push(error("SCHEMA_DEPENDENCY", "/reconciliation", "/reconciliation is allowed only when /eob is present"));
  }

  for (const key of Object.keys(input).filter((key) => !TOP_LEVEL_KEYS.has(key)).sort()) {
    errors.push(error("SCHEMA_ADDITIONAL_PROPERTY", `/${key}`, `/${key} is not allowed`));
  }

  return { status: errors.length === 0 ? "ok" : "invalid", valid: errors.length === 0, errors };
}

function finding(rule, suffix, grade, lines, evidence, question) {
  return {
    id: `${rule}:${suffix}`,
    rule,
    grade,
    lines,
    evidence,
    question,
  };
}

/** Run deterministic candidate-question checks against a validated case. */
export function auditCase(input) {
  const validation = validateCase(input);
  if (!validation.valid) {
    return invalidResult(validation.errors);
  }

  const findings = [];
  const lines = [...input.lines].sort((left, right) => left.n - right.n);
  const admissionDay = input.admission.slice(0, 10);
  const dischargeDay = input.discharge.slice(0, 10);
  const stayNights = calendarDayNumber(input.discharge) - calendarDayNumber(input.admission);
  const hours = (Date.parse(input.discharge) - Date.parse(input.admission)) / 3_600_000;

  for (const line of lines) {
    const expectedCents = Math.round(line.qty * cents(line.unit));
    const billedCents = cents(line.amount);
    if (expectedCents !== billedCents) {
      findings.push(finding(
        "LINE_ARITHMETIC_MISMATCH",
        `L${line.n}`,
        GRADE.DETERMINISTIC,
        [line.n],
        {
          quantity: line.qty,
          unitCents: cents(line.unit),
          expectedCents,
          billedCents,
        },
        `Line ${line.n} (${line.code}): quantity ${line.qty} × ${money(cents(line.unit))} comes to ${money(expectedCents)}, but ${money(billedCents)} is billed. Please check this line.`,
      ));
    }
  }

  const lineSumCents = lines.reduce((sum, line) => sum + cents(line.amount), 0);
  const billedTotalCents = cents(input.billedTotal);
  if (lineSumCents !== billedTotalCents) {
    findings.push(finding(
      "STATEMENT_TOTAL_MISMATCH",
      "CASE",
      GRADE.DETERMINISTIC,
      [],
      {
        lineSumCents,
        statedTotalCents: billedTotalCents,
      },
      `The line items add up to ${money(lineSumCents)}, but the statement total is ${money(billedTotalCents)}, a difference of ${money(Math.abs(lineSumCents - billedTotalCents))}. Please reconcile.`,
    ));
  }

  for (const line of lines) {
    if (line.date < admissionDay || line.date > dischargeDay) {
      findings.push(finding(
        "SERVICE_DATE_OUTSIDE_STAY",
        `L${line.n}`,
        GRADE.DETERMINISTIC,
        [line.n],
        { serviceDate: line.date, admissionDate: admissionDay, dischargeDate: dischargeDay },
        `Line ${line.n} (${line.code}) is dated ${line.date}, outside the ${admissionDay} to ${dischargeDay} stay. Please confirm this belongs on this account.`,
      ));
    }
  }

  // V1 stays precision-first: a free-text room description is not enough to
  // distinguish room-and-board from an operating/procedure room. Broader room
  // revenue-code support belongs in a versioned code table, not a prose guess.
  const isRoomAndBoard = (line) => line.rev === "0120";
  for (const line of lines.filter(isRoomAndBoard)) {
    if (line.qty > stayNights) {
      findings.push(finding(
        "ROOM_QUANTITY_EXCEEDS_NIGHTS",
        `L${line.n}`,
        GRADE.REFERRAL,
        [line.n],
        { billedQuantity: line.qty, stayNights },
        `Line ${line.n}: ${line.qty} room days are billed, while the admission and discharge dates span ${stayNights} night${stayNights === 1 ? "" : "s"}. Please check the room count.`,
      ));
    }
  }

  const seen = new Map();
  for (const line of lines) {
    // Serialize the tuple rather than joining with a user-controlled delimiter;
    // otherwise code "A|B" + desc "C" collides with code "A" + desc "B|C".
    const key = JSON.stringify([
      line.date,
      line.rev ?? "",
      line.code,
      line.desc.trim().replace(/\s+/g, " ").toLowerCase(),
      line.qty,
      cents(line.unit),
      cents(line.amount),
    ]);
    if (seen.has(key)) {
      const first = seen.get(key);
      findings.push(finding(
        "EXACT_DUPLICATE",
        `L${first}:L${line.n}`,
        GRADE.DETERMINISTIC,
        [first, line.n],
        {
          firstLine: first,
          duplicateLine: line.n,
          serviceDate: line.date,
          code: line.code,
          amountCents: cents(line.amount),
        },
        `Lines ${first} and ${line.n} both list ${line.code} on ${line.date} at ${money(cents(line.amount))}. Please confirm whether the service was provided twice.`,
      ));
    } else {
      seen.set(key, line.n);
    }
  }

  if (input.eob) {
    const patientBilledCents = cents(input.patientBilledAmount);
    const eobResponsibilityCents = cents(input.eob.patientResponsibility);
    if (patientBilledCents > eobResponsibilityCents) {
      findings.push(finding(
        "PATIENT_BILLED_EXCEEDS_EOB",
        "CASE",
        GRADE.DETERMINISTIC,
        [],
        {
          patientBilledCents,
          patientResponsibilityCents: eobResponsibilityCents,
          billDocumentRef: input.reconciliation.billDocumentRef,
          eobDocumentRef: input.reconciliation.eobDocumentRef,
          matchKey: input.reconciliation.billMatchKey,
        },
        `The statement asks for ${money(patientBilledCents)}, while the explanation of benefits lists patient responsibility as ${money(eobResponsibilityCents)} — ${money(patientBilledCents - eobResponsibilityCents)} more. Please reconcile.`,
      ));
    }
    for (const entry of [...(input.eob.notCovered ?? [])].sort((left, right) => left.line - right.line)) {
      const line = lines.find((item) => item.n === entry.line);
      findings.push(finding(
        "EOB_NOT_COVERED",
        `L${line.n}`,
        GRADE.DETERMINISTIC,
        [line.n],
        {
          line: line.n,
          reason: entry.reason,
          billDocumentRef: input.reconciliation.billDocumentRef,
          eobDocumentRef: input.reconciliation.eobDocumentRef,
          matchKey: input.reconciliation.billMatchKey,
        },
        `Line ${line.n} (${line.code}, ${money(cents(line.amount))}) is marked not covered on the explanation of benefits with reason “${entry.reason}”. Please ask the plan and provider how that reason affects patient responsibility.`,
      ));
    }
  }

  const byRule = {};
  for (const item of findings) byRule[item.rule] = (byRule[item.rule] ?? 0) + 1;

  return {
    status: "ok",
    caseId: input.file,
    engineVersion: ENGINE_VERSION,
    rulesVersion: RULES_VERSION,
    findings,
    summary: {
      total: findings.length,
      deterministic: findings.filter((item) => item.grade === GRADE.DETERMINISTIC).length,
      referral: findings.filter((item) => item.grade === GRADE.REFERRAL).length,
      byRule,
      lineSumCents,
      stayNights,
      hours: round(hours, 2),
    },
  };
}

function renderText(result) {
  if (result.status === "invalid") {
    console.log(`INVALID ${result.caseId ?? "unknown case"}`);
    for (const item of result.errors) console.log(`- ${item.code} ${item.path}: ${item.message}`);
    return;
  }

  console.log(`\nFile ${result.caseId} · SYNTHETIC · engine ${result.engineVersion} · rules ${result.rulesVersion}\n`);
  for (const [title, grade] of [
    ["ANSWERABLE FROM THESE DOCUMENTS", GRADE.DETERMINISTIC],
    ["NEEDS QUALIFIED REVIEW — NOT ANSWERABLE FROM THE BILL", GRADE.REFERRAL],
  ]) {
    const matches = result.findings.filter((item) => item.grade === grade);
    console.log(`— ${title} (${matches.length}) —`);
    matches.forEach((item, index) => console.log(`  ${index + 1}. [${item.id}] ${item.question}\n`));
  }
  console.log(`${result.summary.total} candidate questions. None asserts a charge is wrong.`);
}

function main(argv) {
  const jsonOutput = argv[0] === "--json";
  const file = jsonOutput ? argv[1] : argv[0];
  if (!file || argv.length > (jsonOutput ? 2 : 1)) {
    console.error("usage: node audit.mjs [--json] <case.json>");
    return 1;
  }

  let raw;
  try {
    raw = readFileSync(file);
  } catch {
    const result = invalidResult([error("FILE_READ", "/", "input file could not be read")]);
    if (jsonOutput) console.log(JSON.stringify(result));
    else renderText(result);
    return 2;
  }

  const parsed = parseCaseInput(raw);
  if (parsed.status === "invalid") {
    if (jsonOutput) console.log(JSON.stringify(parsed));
    else renderText(parsed);
    return 2;
  }

  const result = auditCase(parsed.input);
  if (jsonOutput) console.log(JSON.stringify(result));
  else renderText(result);
  return result.status === "ok" ? 0 : 2;
}

const invokedPath = process.argv[1] ? resolve(process.argv[1]) : "";
if (invokedPath && fileURLToPath(import.meta.url) === invokedPath) {
  process.exitCode = main(process.argv.slice(2));
}
