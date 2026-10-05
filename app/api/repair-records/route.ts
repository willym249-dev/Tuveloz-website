import { env } from "cloudflare:workers";
import { getAccountSession } from "../../../lib/account-auth";
import {
  ELECTRONIC_SIGNATURE_NOTICE,
  MANUFACTURER_SPECIAL_POLICY_NOTICE,
  MARYLAND_CUSTOMER_RIGHTS_HEADING,
  MARYLAND_CUSTOMER_RIGHTS_TEXT,
  MARYLAND_REPAIR_RECORDS_VERSION,
  MONTGOMERY_COUNTY_WRITTEN_ESTIMATE_STANDARD,
  REPAIR_FACILITY_RESPONSIBILITY_NOTICE,
  REPAIR_AUTHORIZATION_PROVIDER_CERTIFICATION,
  REPAIR_INVOICE_PROVIDER_CERTIFICATION,
  parseRepairLineItems,
  repairLineItemTotals,
  sha256RepairRecord,
  stableRepairRecordJson,
  type RepairLineItem,
} from "../../../lib/maryland-repair-records";
import { isSameOriginRequest } from "../../../lib/request-security";
import { realRepairRecordGates, repairRecordAccess, repairRecordProviderReady } from "../../../lib/repair-record-access";

const NO_STORE_HEADERS = { "cache-control": "private, no-store" };
const MAX_TEXT_AMOUNT = 10_000_000;

type AccountRole = "customer" | "provider";

type ParticipantJob = {
  requestId: string;
  requestStatus: string;
  vehicle: string;
  service: string;
  serviceCodes: string;
  jurisdiction: string;
  municipality: string;
  serviceAddress: string;
  customerName: string;
  customerEmail: string;
  quoteId: string;
  quotePriceCents: string;
  quoteServiceCodes: string;
  scopeVersion: number;
  assignmentVersion: number;
  providerId: string;
  providerName: string;
  providerEmail: string;
  providerBusinessAddress: string;
  isTestJob: string;
  isTestProvider: string;
};

type AuthorizationRecord = {
  id: string;
  requestId: string;
  quoteId: string;
  providerId: string;
  providerEmail: string;
  providerName: string;
  providerBusinessName: string;
  providerBusinessAddress: string;
  providerBusinessPhone: string;
  countyRegistrationNumber: string;
  customerEmail: string;
  customerName: string;
  customerAddress: string;
  vehicleYear: string;
  vehicleMakeModel: string;
  vehicleTag: string;
  vehicleVin: string;
  odometerReading: number;
  scopeVersion: number;
  serviceCodes: string;
  customerInstructions: string;
  providerDiagnosis: string;
  laborBillingMethod: string;
  laborDisclosure: string;
  estimatedCompletionAt: string;
  completionDisclosure: string;
  estimateFeeCents: number;
  surchargeCents: number;
  surchargeDescription: string;
  laborAmountCents: number;
  partsAmountCents: number;
  taxAmountCents: number;
  otherAmountCents: number;
  totalAmountCents: number;
  replacedPartsChoice: string;
  customerRightsHeading: string;
  customerRightsText: string;
  manufacturerNotice: string;
  responsibilityNotice: string;
  providerRepresentativeName: string;
  providerRepresentativeTitle: string;
  providerSignedAt: string;
  status: string;
  presentedAt: string;
  customerSignatureName: string;
  customerSignatureAction: string;
  customerSignatureAt: string;
  customerSignatureIp: string;
  customerSignatureSessionId: string;
  customerSignatureDevice: string;
  documentSnapshot: string;
  documentHash: string;
  createdAt: string;
  updatedAt: string;
};

type InvoiceRecord = {
  id: string;
  requestId: string;
  quoteId: string;
  providerId: string;
  invoiceNumber: string;
  scopeVersion: number;
  serviceCodes: string;
  laborAmountCents: number;
  partsAmountCents: number;
  taxAmountCents: number;
  otherAmountCents: number;
  totalAmountCents: number;
  partsDescription: string;
  returnedPartsChoice: string;
  warrantyProvider: string;
  warrantyTerms: string;
  workSummary: string;
  status: string;
  issuedAt: string;
  customerViewedAt: string;
  authorizationRecordId: string;
  providerBusinessName: string;
  providerBusinessAddress: string;
  providerBusinessPhone: string;
  countyRegistrationNumber: string;
  customerName: string;
  customerAddress: string;
  vehicleYear: string;
  vehicleMakeModel: string;
  vehicleTag: string;
  vehicleVin: string;
  odometerReading: number;
  customerInstructions: string;
  providerDiagnosis: string;
  laborBillingMethod: string;
  laborDisclosure: string;
  mechanicIdentifiers: string;
  providerRepresentativeName: string;
  providerRepresentativeTitle: string;
  providerSignedAt: string;
  warrantyWorkStatement: string;
  manufacturerNotice: string;
  responsibilityNotice: string;
  customerSignatureName: string;
  customerSignatureAction: string;
  customerSignatureAt: string;
  customerSignatureIp: string;
  customerSignatureSessionId: string;
  customerSignatureDevice: string;
  customerCopyDeliveryMethod: string;
  customerCopyDeliveredTo: string;
  customerCopyDeliveredAt: string;
  providerCopyRetainedAt: string;
  documentSnapshot: string;
  documentHash: string;
  createdAt: string;
  updatedAt: string;
};

type StoredLineItem = RepairLineItem & {
  id: string;
  sortOrder: number;
};

function response(body: unknown, status = 200) {
  return Response.json(body, { status, headers: NO_STORE_HEADERS });
}

function clean(value: unknown, maximum: number) {
  return typeof value === "string" ? value.trim().slice(0, maximum) : "";
}

function cleanEmail(value: string) {
  return value.trim().toLowerCase();
}

function laborOnlyRepairItems(items: readonly RepairLineItem[]) {
  return items.every((item) => (
    item.lineType === "labor"
    || (
      item.lineType === "part"
      && item.unitAmountCents === 0
      && item.lineAmountCents === 0
    )
  ));
}

function integer(value: unknown, minimum = 0, maximum = MAX_TEXT_AMOUNT) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= minimum && number <= maximum
    ? number
    : null;
}

function requestIp(request: Request) {
  return clean(
    request.headers.get("cf-connecting-ip")
      || request.headers.get("x-forwarded-for")?.split(",")[0]
      || "",
    128,
  );
}

function deviceContext(request: Request) {
  return JSON.stringify({
    userAgent: clean(request.headers.get("user-agent"), 600),
    language: clean(request.headers.get("accept-language"), 120),
  });
}

function parseStringList(value: unknown, maximum = 20) {
  const items = Array.isArray(value) ? value : [];
  const result = items
    .map((item) => clean(item, 120))
    .filter(Boolean)
    .slice(0, maximum);
  return [...new Set(result)];
}

function validFutureOrCurrentDate(value: unknown) {
  const raw = clean(value, 50);
  if (!raw) return "";
  const time = Date.parse(raw);
  if (!Number.isFinite(time) || time < Date.now() - 24 * 60 * 60 * 1000) return "";
  return new Date(time).toISOString();
}

async function participantJobs(role: AccountRole, email: string, requestId = "") {
  const roleClause = role === "provider"
    ? "lower(quote.provider_email) = lower(?)"
    : "lower(request.email) = lower(?)";
  const result = await env.DB.prepare(
    `SELECT request.id AS requestId,
            request.status AS requestStatus,
            request.vehicle,
            request.service,
            request.service_codes AS serviceCodes,
            request.jurisdiction,
            request.municipality,
            request.service_address AS serviceAddress,
            request.name AS customerName,
            lower(request.email) AS customerEmail,
            quote.id AS quoteId,
            quote.price_cents AS quotePriceCents,
            quote.service_codes AS quoteServiceCodes,
            quote.scope_version AS scopeVersion,
            request.assignment_version AS assignmentVersion,
            provider.id AS providerId,
            provider.name AS providerName,
            lower(provider.email) AS providerEmail,
            provider.business_service_address AS providerBusinessAddress,
            request.is_test_job AS isTestJob,
            provider.is_test_provider AS isTestProvider
       FROM customer_requests request
       INNER JOIN provider_quotes quote
         ON quote.request_id = request.id
        AND quote.status = 'accepted'
       INNER JOIN provider_applications provider
         ON lower(provider.email) = lower(quote.provider_email)
      WHERE ${roleClause}
        AND (? = '' OR request.id = ?)
        AND ((request.is_test_job = 'yes' AND provider.is_test_provider = 'yes')
          OR (request.is_test_job = 'no' AND provider.is_test_provider = 'no'))
        AND (SELECT count(*) FROM provider_quotes accepted
          WHERE accepted.request_id = request.id AND accepted.status = 'accepted') = 1
      ORDER BY datetime(request.created_at) DESC
      LIMIT 50`,
  ).bind(email, requestId, requestId).all<ParticipantJob>();
  return result.results ?? [];
}

async function participantJob(requestId: string, role: AccountRole, email: string) {
  const jobs = await participantJobs(role, email, requestId);
  return jobs.find((job) => job.requestId === requestId) ?? null;
}

class RepairRecordError extends Error {
  constructor(message: string, readonly status = 409, readonly code = "REPAIR_RECORD_STALE") { super(message); }
}

async function writableJob(role: AccountRole, email: string, payload: Record<string, unknown>, invoice: boolean) {
  if (typeof payload.expectedQuoteId !== "string" || !payload.expectedQuoteId
    || !Number.isSafeInteger(payload.expectedScopeVersion)) {
    throw new RepairRecordError("Refresh and submit the exact displayed quote and scope.", 400);
  }
  const job = await participantJob(clean(payload.requestId, 80), role, email);
  if (!job) throw new RepairRecordError("This job does not belong to this account and job type.", 404);
  if (job.quoteId !== payload.expectedQuoteId || job.scopeVersion !== payload.expectedScopeVersion) {
    throw new RepairRecordError("The accepted job scope changed. Refresh and review it again.");
  }
  await requireWriteAccess(job, invoice);
  return job;
}

async function requireWriteAccess(job: ParticipantJob, invoice: boolean) {
  const access = repairRecordAccess(job, await realRepairRecordGates());
  if (!(invoice ? access.invoiceWritesAllowed : access.authorizationWritesAllowed)) {
    throw new RepairRecordError(access.writeBlockReason || "This repair-record action is paused.", 503, "REPAIR_RECORD_WRITES_PAUSED");
  }
  if (!(await repairRecordProviderReady(job, invoice))) {
    throw new RepairRecordError("The selected provider's current service, assignment or evidence does not permit this record action.", 409, "REPAIR_RECORD_PROVIDER_NOT_READY");
  }
}

function expectDocument(payload: Record<string, unknown>, record: AuthorizationRecord | InvoiceRecord) {
  if (!clean(payload.expectedRecordId, 80) || !clean(payload.expectedDocumentHash, 128)) {
    throw new RepairRecordError("Submit the exact document displayed for review.", 400);
  }
  if (payload.expectedRecordId !== record.id || payload.expectedDocumentHash !== record.documentHash) {
    throw new RepairRecordError("The displayed document changed. Refresh and review the exact record again.");
  }
}

function expectDraft(payload: Record<string, unknown>, record: AuthorizationRecord | InvoiceRecord | null) {
  if (typeof payload.expectedRecordId !== "string" || typeof payload.expectedUpdatedAt !== "string") {
    throw new RepairRecordError("Submit the displayed draft identity and revision.", 400);
  }
  if (payload.expectedRecordId !== (record?.id ?? "") || payload.expectedUpdatedAt !== (record?.updatedAt ?? "")) {
    throw new RepairRecordError("This draft changed in another request. Refresh before replacing any saved work.");
  }
}

function nextRecordTime(prior = "") {
  const previous = Date.parse(prior);
  return new Date(Math.max(Date.now(), Number.isFinite(previous) ? previous + 1 : 0)).toISOString();
}

type RecordGuard = { table: "repair_authorization_records" | "provider_invoices"; row: AuthorizationRecord | InvoiceRecord | null };

// D1 batches execute in one transaction. A failed snapshot assertion aborts
// the entire batch, including the acceptance and all line-item mutations.
// This SELECT has no side effects when the captured source is still current.
function snapshotAssertion(condition: string, bindings: (string | number)[]) {
  return env.DB.prepare(`SELECT json_extract(CASE WHEN ${condition} THEN 'true' ELSE 'REPAIR_RECORD_STALE' END, '$')`).bind(...bindings);
}

async function guardedBatch(job: ParticipantJob, invoice: boolean, records: RecordGuard[], statements: ReturnType<typeof env.DB.prepare>[]) {
  await requireWriteAccess(job, invoice);
  const jobGuard = snapshotAssertion(`EXISTS (
    SELECT 1 FROM customer_requests request
    JOIN provider_quotes quote ON quote.request_id = request.id AND quote.status = 'accepted'
    JOIN provider_applications provider ON lower(provider.email) = lower(quote.provider_email)
    WHERE request.id = ? AND quote.id = ? AND provider.id = ?
      AND json_array(request.status, lower(request.email), request.is_test_job, request.assignment_version,
        request.service_codes, request.jurisdiction, quote.scope_version, quote.price_cents,
        quote.service_codes, lower(provider.email), provider.is_test_provider)
        = ?
      AND (SELECT count(*) FROM provider_quotes accepted WHERE accepted.request_id = request.id AND accepted.status = 'accepted') = 1
  )`, [job.requestId, job.quoteId, job.providerId, JSON.stringify([
    job.requestStatus, job.customerEmail, job.isTestJob, job.assignmentVersion,
    job.serviceCodes, job.jurisdiction, job.scopeVersion, job.quotePriceCents,
    job.quoteServiceCodes, job.providerEmail, job.isTestProvider,
  ])]);
  const guards = records.map(({ table, row }) => {
    if (!row) return snapshotAssertion(`NOT EXISTS (SELECT 1 FROM ${table} WHERE request_id = ? AND scope_version = ?)`, [job.requestId, job.scopeVersion]);
    const entries = Object.entries(row);
    const columns = entries.map(([name]) => name.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`));
    return snapshotAssertion(`EXISTS (SELECT 1 FROM ${table} WHERE id = ? AND json_array(${columns.join(",")}) = ?)`,
      [row.id, JSON.stringify(entries.map(([, value]) => value))]);
  });
  const itemGuards = records.flatMap(({ table, row }) => {
    if (!row?.documentHash) return [];
    const snapshot = JSON.parse(row.documentSnapshot) as { lineItems: RepairLineItem[] };
    const itemTable = table === "provider_invoices" ? "provider_invoice_items" : "repair_authorization_items";
    const parentColumn = table === "provider_invoices" ? "invoice_id" : "authorization_id";
    return [snapshotAssertion(`(SELECT coalesce(json_group_array(json(item)), '[]') FROM (
      SELECT json_array(line_type, description, part_number, part_condition, quantity, unit_amount_cents,
        line_amount_cents, labor_minutes, mechanic_identifier) AS item
      FROM ${itemTable} WHERE ${parentColumn} = ? ORDER BY sort_order ASC, created_at ASC
    )) = ?`, [row.id, JSON.stringify(snapshot.lineItems.map((item) => [item.lineType, item.description, item.partNumber,
      item.partCondition, item.quantity, item.unitAmountCents, item.lineAmountCents, item.laborMinutes, item.mechanicIdentifier]))])];
  });
  try {
    return await env.DB.batch([jobGuard, ...guards, ...itemGuards, ...statements]);
  } catch (error) {
    if (String(error).includes("malformed JSON")) throw new RepairRecordError("The job or document changed while saving. Refresh and review the current record.");
    throw error;
  }
}

async function authorizationFor(job: ParticipantJob) {
  return env.DB.prepare(
    `SELECT id,
            request_id AS requestId,
            quote_id AS quoteId,
            provider_id AS providerId,
            provider_email AS providerEmail,
            provider_name AS providerName,
            provider_business_name AS providerBusinessName,
            provider_business_address AS providerBusinessAddress,
            provider_business_phone AS providerBusinessPhone,
            county_registration_number AS countyRegistrationNumber,
            customer_email AS customerEmail,
            customer_name AS customerName,
            customer_address AS customerAddress,
            vehicle_year AS vehicleYear,
            vehicle_make_model AS vehicleMakeModel,
            vehicle_tag AS vehicleTag,
            vehicle_vin AS vehicleVin,
            odometer_reading AS odometerReading,
            scope_version AS scopeVersion,
            service_codes AS serviceCodes,
            customer_instructions AS customerInstructions,
            provider_diagnosis AS providerDiagnosis,
            labor_billing_method AS laborBillingMethod,
            labor_disclosure AS laborDisclosure,
            estimated_completion_at AS estimatedCompletionAt,
            completion_disclosure AS completionDisclosure,
            estimate_fee_cents AS estimateFeeCents,
            surcharge_cents AS surchargeCents,
            surcharge_description AS surchargeDescription,
            labor_amount_cents AS laborAmountCents,
            parts_amount_cents AS partsAmountCents,
            tax_amount_cents AS taxAmountCents,
            other_amount_cents AS otherAmountCents,
            total_amount_cents AS totalAmountCents,
            replaced_parts_choice AS replacedPartsChoice,
            customer_rights_heading AS customerRightsHeading,
            customer_rights_text AS customerRightsText,
            manufacturer_notice AS manufacturerNotice,
            responsibility_notice AS responsibilityNotice,
            provider_representative_name AS providerRepresentativeName,
            provider_representative_title AS providerRepresentativeTitle,
            provider_signed_at AS providerSignedAt,
            status,
            presented_at AS presentedAt,
            customer_signature_name AS customerSignatureName,
            customer_signature_action AS customerSignatureAction,
            customer_signature_at AS customerSignatureAt,
            customer_signature_ip AS customerSignatureIp,
            customer_signature_session_id AS customerSignatureSessionId,
            customer_signature_device AS customerSignatureDevice,
            document_snapshot AS documentSnapshot,
            document_hash AS documentHash,
            created_at AS createdAt,
            updated_at AS updatedAt
       FROM repair_authorization_records
      WHERE request_id = ? AND scope_version = ? AND quote_id = ? AND provider_id = ?
      LIMIT 1`,
  ).bind(job.requestId, job.scopeVersion, job.quoteId, job.providerId).first<AuthorizationRecord>();
}

async function authorizationItems(authorizationId: string) {
  if (!authorizationId) return [];
  const result = await env.DB.prepare(
    `SELECT id,
            line_type AS lineType,
            description,
            part_number AS partNumber,
            part_condition AS partCondition,
            quantity,
            unit_amount_cents AS unitAmountCents,
            line_amount_cents AS lineAmountCents,
            labor_minutes AS laborMinutes,
            mechanic_identifier AS mechanicIdentifier,
            sort_order AS sortOrder
       FROM repair_authorization_items
      WHERE authorization_id = ?
      ORDER BY sort_order ASC, created_at ASC`,
  ).bind(authorizationId).all<StoredLineItem>();
  return result.results ?? [];
}

async function invoiceFor(job: ParticipantJob) {
  return env.DB.prepare(
    `SELECT id,
            request_id AS requestId,
            quote_id AS quoteId,
            provider_id AS providerId,
            invoice_number AS invoiceNumber,
            scope_version AS scopeVersion,
            service_codes AS serviceCodes,
            labor_amount_cents AS laborAmountCents,
            parts_amount_cents AS partsAmountCents,
            tax_amount_cents AS taxAmountCents,
            other_amount_cents AS otherAmountCents,
            total_amount_cents AS totalAmountCents,
            parts_description AS partsDescription,
            returned_parts_choice AS returnedPartsChoice,
            warranty_provider AS warrantyProvider,
            warranty_terms AS warrantyTerms,
            work_summary AS workSummary,
            status,
            issued_at AS issuedAt,
            customer_viewed_at AS customerViewedAt,
            authorization_record_id AS authorizationRecordId,
            provider_business_name AS providerBusinessName,
            provider_business_address AS providerBusinessAddress,
            provider_business_phone AS providerBusinessPhone,
            county_registration_number AS countyRegistrationNumber,
            customer_name AS customerName,
            customer_address AS customerAddress,
            vehicle_year AS vehicleYear,
            vehicle_make_model AS vehicleMakeModel,
            vehicle_tag AS vehicleTag,
            vehicle_vin AS vehicleVin,
            odometer_reading AS odometerReading,
            customer_instructions AS customerInstructions,
            provider_diagnosis AS providerDiagnosis,
            labor_billing_method AS laborBillingMethod,
            labor_disclosure AS laborDisclosure,
            mechanic_identifiers AS mechanicIdentifiers,
            provider_representative_name AS providerRepresentativeName,
            provider_representative_title AS providerRepresentativeTitle,
            provider_signed_at AS providerSignedAt,
            warranty_work_statement AS warrantyWorkStatement,
            manufacturer_notice AS manufacturerNotice,
            responsibility_notice AS responsibilityNotice,
            customer_signature_name AS customerSignatureName,
            customer_signature_action AS customerSignatureAction,
            customer_signature_at AS customerSignatureAt,
            customer_signature_ip AS customerSignatureIp,
            customer_signature_session_id AS customerSignatureSessionId,
            customer_signature_device AS customerSignatureDevice,
            customer_copy_delivery_method AS customerCopyDeliveryMethod,
            customer_copy_delivered_to AS customerCopyDeliveredTo,
            customer_copy_delivered_at AS customerCopyDeliveredAt,
            provider_copy_retained_at AS providerCopyRetainedAt,
            document_snapshot AS documentSnapshot,
            document_hash AS documentHash,
            created_at AS createdAt,
            updated_at AS updatedAt
       FROM provider_invoices
      WHERE request_id = ? AND scope_version = ? AND quote_id = ? AND provider_id = ?
      LIMIT 1`,
  ).bind(job.requestId, job.scopeVersion, job.quoteId, job.providerId).first<InvoiceRecord>();
}

async function invoiceItems(invoiceId: string) {
  if (!invoiceId) return [];
  const result = await env.DB.prepare(
    `SELECT id,
            line_type AS lineType,
            description,
            part_number AS partNumber,
            part_condition AS partCondition,
            quantity,
            unit_amount_cents AS unitAmountCents,
            line_amount_cents AS lineAmountCents,
            labor_minutes AS laborMinutes,
            mechanic_identifier AS mechanicIdentifier,
            sort_order AS sortOrder
       FROM provider_invoice_items
      WHERE invoice_id = ?
      ORDER BY sort_order ASC, created_at ASC`,
  ).bind(invoiceId).all<StoredLineItem>();
  return result.results ?? [];
}

async function recordData(job: ParticipantJob, gates: Awaited<ReturnType<typeof realRepairRecordGates>>) {
  const authorization = await authorizationFor(job);
  const invoice = await invoiceFor(job);
  const [authorizationLineItems, invoiceLineItems] = await Promise.all([
    authorizationItems(authorization?.id ?? ""),
    invoiceItems(invoice?.id ?? ""),
  ]);
  return {
    ...job,
    ...repairRecordAccess(job, gates),
    authorization: authorization
      ? { ...authorization, lineItems: authorizationLineItems }
      : null,
    invoice: invoice
      ? { ...invoice, lineItems: invoiceLineItems }
      : null,
  };
}

async function responseData(role: AccountRole, email: string, requestId = "") {
  const jobs = await participantJobs(role, email, requestId);
  const gates = await realRepairRecordGates();
  return {
    testOnly: jobs.length > 0 && jobs.every((job) => job.isTestJob === "yes" && job.isTestProvider === "yes"),
    realJobsEnabled: gates.authorization && gates.invoice,
    role,
    email,
    version: MARYLAND_REPAIR_RECORDS_VERSION,
    legalNotices: {
      customerRightsHeading: MARYLAND_CUSTOMER_RIGHTS_HEADING,
      customerRightsText: MARYLAND_CUSTOMER_RIGHTS_TEXT,
      writtenEstimateStandard: MONTGOMERY_COUNTY_WRITTEN_ESTIMATE_STANDARD,
      manufacturerNotice: MANUFACTURER_SPECIAL_POLICY_NOTICE,
      responsibilityNotice: REPAIR_FACILITY_RESPONSIBILITY_NOTICE,
      electronicSignatureNotice: ELECTRONIC_SIGNATURE_NOTICE,
    },
    jobs: await Promise.all(jobs.map((job) => recordData(job, gates))),
  };
}

async function savedResponse(role: AccountRole, email: string, receipt: {
  requestId: string; recordId: string; documentHash: string; action: string; status: string; alreadySigned?: boolean;
}) {
  // A failed follow-up read does not undo a committed write. Keep the exact
  // receipt separate so clients can preserve confirmation and refresh safely.
  try {
    return response({ ...(await responseData(role, email, receipt.requestId)), ...receipt, ok: true, paymentReleased: false });
  } catch {
    return response({ ...receipt, ok: true, paymentReleased: false, snapshotRefreshRequired: true });
  }
}

function authorizationSnapshot(input: {
  job: ParticipantJob;
  fields: Record<string, unknown>;
  lineItems: RepairLineItem[];
  totals: ReturnType<typeof repairLineItemTotals>;
  providerSignedAt: string;
}) {
  return {
    version: MARYLAND_REPAIR_RECORDS_VERSION,
    documentType: "repair_authorization_and_written_estimate",
    requestId: input.job.requestId,
    quoteId: input.job.quoteId,
    providerId: input.job.providerId,
    scopeVersion: input.job.scopeVersion,
    serviceCodes: JSON.parse(input.job.serviceCodes || "[]"),
    ...input.fields,
    ...input.totals,
    lineItems: input.lineItems,
    customerRightsHeading: MARYLAND_CUSTOMER_RIGHTS_HEADING,
    customerRightsText: MARYLAND_CUSTOMER_RIGHTS_TEXT,
    writtenEstimateStandard: MONTGOMERY_COUNTY_WRITTEN_ESTIMATE_STANDARD,
    manufacturerNotice: MANUFACTURER_SPECIAL_POLICY_NOTICE,
    responsibilityNotice: REPAIR_FACILITY_RESPONSIBILITY_NOTICE,
    providerSignedAt: input.providerSignedAt,
    providerCertification: input.providerSignedAt ? REPAIR_AUTHORIZATION_PROVIDER_CERTIFICATION : "",
  };
}

async function saveAuthorization(
  request: Request,
  role: AccountRole,
  email: string,
  payload: Record<string, unknown>,
) {
  if (role !== "provider") return response({ error: "Only the selected provider can prepare the repair authorization." }, 403);
  const job = await writableJob(role, email, payload, false);

  const existing = await authorizationFor(job);
  expectDraft(payload, existing);
  if (existing && existing.status !== "draft") {
    return response({ error: "A presented or signed authorization is immutable. Use a separately customer-approved change order for later changes." }, 409);
  }

  const lineItems = parseRepairLineItems(payload.lineItems);
  if (!lineItems) return response({ error: "Enter valid labor lines and optional customer-supplied-part descriptions." }, 400);
  if (!laborOnlyRepairItems(lineItems)) {
    return response({
      error: "This Tuveloz record is labor only. A customer-supplied part may be identified with a zero amount, but no parts, tax, sublet, reimbursement, or other charge may be included.",
      code: "LABOR_ONLY_REPAIR_RECORD_REQUIRED",
    }, 400);
  }
  const totals = repairLineItemTotals(lineItems);
  if (totals.totalAmountCents <= 0 || totals.totalAmountCents !== Number(job.quotePriceCents)) {
    return response({ error: "The written estimate total must exactly match the currently accepted provider quote." }, 409);
  }

  const status = clean(payload.status, 20);
  const providerBusinessName = clean(payload.providerBusinessName, 180);
  const providerBusinessAddress = clean(payload.providerBusinessAddress, 300);
  const providerBusinessPhone = clean(payload.providerBusinessPhone, 60);
  const countyRegistrationNumber = clean(payload.countyRegistrationNumber, 120);
  const customerName = clean(payload.customerName, 180);
  const customerAddress = clean(payload.customerAddress, 300);
  const vehicleYear = clean(payload.vehicleYear, 20);
  const vehicleMakeModel = clean(payload.vehicleMakeModel, 180);
  const vehicleTag = clean(payload.vehicleTag, 40);
  const vehicleVin = clean(payload.vehicleVin, 40);
  const odometerReading = integer(payload.odometerReading, 0, 10_000_000);
  const customerInstructions = clean(payload.customerInstructions, 2400);
  const providerDiagnosis = clean(payload.providerDiagnosis, 2400);
  const laborBillingMethod = clean(payload.laborBillingMethod, 60);
  const laborDisclosure = clean(payload.laborDisclosure, 1200);
  const estimatedCompletionAt = validFutureOrCurrentDate(payload.estimatedCompletionAt);
  const completionDisclosure = clean(payload.completionDisclosure, 600);
  const estimateFeeCents = integer(payload.estimateFeeCents, 0);
  const surchargeCents = integer(payload.surchargeCents, 0);
  const surchargeDescription = clean(payload.surchargeDescription, 600);
  const replacedPartsChoice = clean(payload.replacedPartsChoice, 40);
  const providerRepresentativeName = clean(payload.providerRepresentativeName, 180);
  const providerRepresentativeTitle = clean(payload.providerRepresentativeTitle, 120);

  if (
    !["draft", "presented"].includes(status)
    || !providerBusinessName
    || !providerBusinessAddress
    || !providerBusinessPhone
    || !countyRegistrationNumber
    || !customerName
    || !customerAddress
    || !vehicleYear
    || !vehicleMakeModel
    || !vehicleTag
    || odometerReading === null
    || !customerInstructions
    || !providerDiagnosis
    || !["clock_hour", "flat_rate_manual", "other_flat_rate"].includes(laborBillingMethod)
    || !laborDisclosure
    || (!estimatedCompletionAt && !completionDisclosure)
    || estimateFeeCents === null
    || estimateFeeCents !== 0
    || surchargeCents === null
    || surchargeCents !== 0
    || surchargeDescription
    || !["return", "customer_declined", "warranty_return", "not_applicable"].includes(replacedPartsChoice)
    || !providerRepresentativeName
    || !providerRepresentativeTitle
    || (status === "presented" && payload.providerCertified !== true)
  ) {
    return response({
      error: "Complete the provider, customer, vehicle, diagnosis, labor disclosure, completion, customer-supplied-parts record, and provider-signature fields. Separate estimate fees and surcharges cannot be charged through Tuveloz.",
    }, 400);
  }

  const now = nextRecordTime(existing?.updatedAt);
  const providerSignedAt = status === "presented" ? now : "";
  const fields = {
    providerEmail: cleanEmail(job.providerEmail),
    providerName: job.providerName,
    providerBusinessName,
    providerBusinessAddress,
    providerBusinessPhone,
    countyRegistrationNumber,
    customerEmail: cleanEmail(job.customerEmail),
    customerName,
    customerAddress,
    vehicleYear,
    vehicleMakeModel,
    vehicleTag,
    vehicleVin,
    odometerReading,
    customerInstructions,
    providerDiagnosis,
    laborBillingMethod,
    laborDisclosure,
    estimatedCompletionAt,
    completionDisclosure,
    estimateFeeCents,
    surchargeCents,
    surchargeDescription,
    replacedPartsChoice,
    providerRepresentativeName,
    providerRepresentativeTitle,
  };
  const snapshotObject = authorizationSnapshot({
    job,
    fields,
    lineItems,
    totals,
    providerSignedAt,
  });
  const documentSnapshot = stableRepairRecordJson(snapshotObject);
  const documentHash = status === "presented"
    ? await sha256RepairRecord(documentSnapshot)
    : "";
  const id = existing?.id ?? crypto.randomUUID();

  const statements = [];
  if (existing) {
    statements.push(env.DB.prepare(
      `UPDATE repair_authorization_records
          SET provider_business_name = ?, provider_business_address = ?,
              provider_business_phone = ?, county_registration_number = ?,
              customer_name = ?, customer_address = ?, vehicle_year = ?,
              vehicle_make_model = ?, vehicle_tag = ?, vehicle_vin = ?,
              odometer_reading = ?, customer_instructions = ?, provider_diagnosis = ?,
              labor_billing_method = ?, labor_disclosure = ?, estimated_completion_at = ?,
              completion_disclosure = ?, estimate_fee_cents = ?, surcharge_cents = ?,
              surcharge_description = ?, labor_amount_cents = ?, parts_amount_cents = ?,
              tax_amount_cents = ?, other_amount_cents = ?, total_amount_cents = ?,
              replaced_parts_choice = ?, provider_representative_name = ?,
              provider_representative_title = ?, provider_signed_at = ?, status = ?,
              presented_at = ?, document_snapshot = ?, document_hash = ?, updated_at = ?
        WHERE id = ? AND status = 'draft'`,
    ).bind(
      providerBusinessName, providerBusinessAddress, providerBusinessPhone,
      countyRegistrationNumber, customerName, customerAddress, vehicleYear,
      vehicleMakeModel, vehicleTag, vehicleVin, odometerReading,
      customerInstructions, providerDiagnosis, laborBillingMethod, laborDisclosure,
      estimatedCompletionAt, completionDisclosure, estimateFeeCents, surchargeCents,
      surchargeDescription, totals.laborAmountCents, totals.partsAmountCents,
      totals.taxAmountCents, totals.otherAmountCents, totals.totalAmountCents,
      replacedPartsChoice, providerRepresentativeName, providerRepresentativeTitle,
      providerSignedAt, status, status === "presented" ? now : "",
      documentSnapshot, documentHash, now, id,
    ));
    statements.push(env.DB.prepare(
      `DELETE FROM repair_authorization_items WHERE authorization_id = ?`,
    ).bind(id));
  } else {
    statements.push(env.DB.prepare(
      `INSERT INTO repair_authorization_records (
         id, request_id, quote_id, provider_id, provider_email, provider_name,
         provider_business_name, provider_business_address, provider_business_phone,
         county_registration_number, customer_email, customer_name, customer_address,
         vehicle_year, vehicle_make_model, vehicle_tag, vehicle_vin, odometer_reading,
         scope_version, service_codes, customer_instructions, provider_diagnosis,
         labor_billing_method, labor_disclosure, estimated_completion_at,
         completion_disclosure, estimate_fee_cents, surcharge_cents,
         surcharge_description, labor_amount_cents, parts_amount_cents,
         tax_amount_cents, other_amount_cents, total_amount_cents,
         replaced_parts_choice, customer_rights_heading, customer_rights_text,
         manufacturer_notice, responsibility_notice, provider_representative_name,
         provider_representative_title, provider_signed_at, status, presented_at,
         document_snapshot, document_hash, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      id, job.requestId, job.quoteId, job.providerId, cleanEmail(job.providerEmail),
      job.providerName, providerBusinessName, providerBusinessAddress,
      providerBusinessPhone, countyRegistrationNumber, cleanEmail(job.customerEmail),
      customerName, customerAddress, vehicleYear, vehicleMakeModel, vehicleTag,
      vehicleVin, odometerReading, job.scopeVersion, job.serviceCodes,
      customerInstructions, providerDiagnosis, laborBillingMethod, laborDisclosure,
      estimatedCompletionAt, completionDisclosure, estimateFeeCents, surchargeCents,
      surchargeDescription, totals.laborAmountCents, totals.partsAmountCents,
      totals.taxAmountCents, totals.otherAmountCents, totals.totalAmountCents,
      replacedPartsChoice, MARYLAND_CUSTOMER_RIGHTS_HEADING,
      MARYLAND_CUSTOMER_RIGHTS_TEXT, MANUFACTURER_SPECIAL_POLICY_NOTICE,
      REPAIR_FACILITY_RESPONSIBILITY_NOTICE, providerRepresentativeName,
      providerRepresentativeTitle, providerSignedAt, status,
      status === "presented" ? now : "", documentSnapshot, documentHash, now, now,
    ));
  }
  lineItems.forEach((item, index) => {
    statements.push(env.DB.prepare(
      `INSERT INTO repair_authorization_items (
         id, authorization_id, line_type, description, part_number, part_condition,
         quantity, unit_amount_cents, line_amount_cents, labor_minutes,
         mechanic_identifier, sort_order, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(), id, item.lineType, item.description, item.partNumber,
      item.partCondition, item.quantity, item.unitAmountCents, item.lineAmountCents,
      item.laborMinutes, item.mechanicIdentifier, index, now,
    ));
  });
  await guardedBatch(job, false, [{ table: "repair_authorization_records", row: existing }], statements);
  return savedResponse(role, email, { requestId: job.requestId, recordId: id, action: "save-authorization", status, documentHash });
}

async function signAuthorization(
  request: Request,
  role: AccountRole,
  email: string,
  payload: Record<string, unknown>,
) {
  if (role !== "customer") return response({ error: "Only the customer can sign the repair authorization." }, 403);
  const job = await writableJob(role, email, payload, false);
  const authorization = await authorizationFor(job);
  if (!authorization || !["presented", "signed"].includes(authorization.status)) {
    return response({ error: "A provider-presented repair authorization is required before signing." }, 409);
  }
  const acceptedByName = clean(payload.acceptedByName, 180);
  if (acceptedByName.length < 2 || payload.signatureAccepted !== true) {
    return response({ error: "Type your name and affirmatively sign the exact written estimate and authorization." }, 400);
  }
  expectDocument(payload, authorization);
  await verifyDocument(job, authorization);
  if (authorization.customerSignatureAt) return signedRetry(role, email, job, authorization, "sign-authorization", acceptedByName);
  const session = await getAccountSession(request);
  if (!session) return response({ error: "Your signed-in session is required." }, 401);
  const now = new Date().toISOString();
  const signatureAction = "typed-name-and-affirmative-repair-authorization-checkbox";
  const agreementText = `${authorization.documentSnapshot}\n${ELECTRONIC_SIGNATURE_NOTICE}`;
  try { await guardedBatch(job, false, [{ table: "repair_authorization_records", row: authorization }], [
    env.DB.prepare(
      `INSERT INTO customer_agreement_acceptances (
         id, customer_email, request_id, quote_id, scope_version, scope_snapshot,
         agreement_key, agreement_version, agreement_hash, agreement_text,
         accepted_by_name, acceptance_action, accepted_at, ip_address,
         session_id, device_context, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'maryland_repair_authorization', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(), cleanEmail(email), job.requestId, job.quoteId,
      job.scopeVersion, authorization.documentSnapshot, MARYLAND_REPAIR_RECORDS_VERSION,
      authorization.documentHash, agreementText, acceptedByName, signatureAction,
      now, requestIp(request), session.id, deviceContext(request), now,
    ),
    env.DB.prepare(
      `UPDATE repair_authorization_records
          SET status = 'signed', customer_signature_name = ?,
              customer_signature_action = ?, customer_signature_at = ?,
              customer_signature_ip = ?, customer_signature_session_id = ?,
              customer_signature_device = ?, updated_at = ?
        WHERE id = ? AND status = 'presented' AND document_hash = ?`,
    ).bind(
      acceptedByName, signatureAction, now, requestIp(request), session.id,
      deviceContext(request), now, authorization.id, authorization.documentHash,
    ),
  ]); } catch (error) {
    if (error instanceof RepairRecordError && error.status === 409) {
      const current = await authorizationFor(job);
      if (current?.id === authorization.id && current.documentHash === authorization.documentHash && current.customerSignatureAt) {
        return signedRetry(role, email, job, current, "sign-authorization", acceptedByName);
      }
    }
    throw error;
  }
  return savedResponse(role, email, { requestId: job.requestId, recordId: authorization.id, documentHash: authorization.documentHash, action: "sign-authorization", status: "signed" });
}

function invoiceSnapshot(input: {
  job: ParticipantJob;
  authorization: AuthorizationRecord;
  lineItems: RepairLineItem[];
  totals: ReturnType<typeof repairLineItemTotals>;
  fields: Record<string, unknown>;
  issuedAt: string;
}) {
  return {
    version: MARYLAND_REPAIR_RECORDS_VERSION,
    documentType: "provider_final_repair_invoice",
    requestId: input.job.requestId,
    quoteId: input.job.quoteId,
    providerId: input.job.providerId,
    scopeVersion: input.job.scopeVersion,
    authorizationRecordId: input.authorization.id,
    authorizationDocumentHash: input.authorization.documentHash,
    serviceCodes: JSON.parse(input.job.serviceCodes || "[]"),
    ...input.fields,
    ...input.totals,
    lineItems: input.lineItems,
    manufacturerNotice: MANUFACTURER_SPECIAL_POLICY_NOTICE,
    responsibilityNotice: REPAIR_FACILITY_RESPONSIBILITY_NOTICE,
    issuedAt: input.issuedAt,
    providerCertification: input.issuedAt ? REPAIR_INVOICE_PROVIDER_CERTIFICATION : "",
  };
}

async function saveInvoice(
  request: Request,
  role: AccountRole,
  email: string,
  payload: Record<string, unknown>,
) {
  if (role !== "provider") return response({ error: "Only the selected provider can prepare the provider invoice." }, 403);
  const job = await writableJob(role, email, payload, true);
  const authorization = await authorizationFor(job);
  if (!authorization || authorization.status !== "signed") {
    return response({ error: "The customer's signed repair authorization is required before a final invoice can issue." }, 409);
  }
  await verifyDocument(job, authorization);
  if (!(await signatureAcceptance(job, authorization, "maryland_repair_authorization"))) {
    throw new RepairRecordError("The signed repair authorization has no matching customer acceptance evidence.");
  }
  const existing = await invoiceFor(job);
  expectDraft(payload, existing);
  if (existing?.status === "final") {
    return response({ error: "A final invoice is immutable. Later issues must use the incident, dispute, or correction process." }, 409);
  }
  const lineItems = parseRepairLineItems(payload.lineItems);
  if (!lineItems) return response({ error: "Enter valid labor lines and optional customer-supplied-part descriptions." }, 400);
  if (!laborOnlyRepairItems(lineItems)) {
    return response({
      error: "This Tuveloz invoice is labor only. A customer-supplied part may be identified with a zero amount, but no parts, tax, sublet, reimbursement, or other charge may be included.",
      code: "LABOR_ONLY_REPAIR_RECORD_REQUIRED",
    }, 400);
  }
  const totals = repairLineItemTotals(lineItems);
  if (totals.totalAmountCents !== authorization.totalAmountCents) {
    return response({ error: "The final provider invoice total must exactly match the customer-signed authorized provider amount." }, 409);
  }
  const status = clean(payload.status, 20);
  const workSummary = clean(payload.workSummary, 3000);
  const warrantyProvider = clean(payload.warrantyProvider, 60);
  const warrantyTerms = clean(payload.warrantyTerms, 2000);
  const warrantyWorkStatement = clean(payload.warrantyWorkStatement, 1200);
  const returnedPartsChoice = clean(payload.returnedPartsChoice, 60);
  const mechanicIdentifiers = parseStringList(payload.mechanicIdentifiers, 40);
  const providerRepresentativeName = clean(payload.providerRepresentativeName, 180);
  const providerRepresentativeTitle = clean(payload.providerRepresentativeTitle, 120);
  if (
    !["draft", "final"].includes(status)
    || workSummary.length < 10
    || !["provider_business", "manufacturer", "none_offered"].includes(warrantyProvider)
    || warrantyTerms.length < 5
    || warrantyWorkStatement.length < 5
    || !["returned", "customer_declined", "warranty_return", "not_applicable"].includes(returnedPartsChoice)
    || mechanicIdentifiers.length === 0
    || !providerRepresentativeName
    || !providerRepresentativeTitle
    || (status === "final" && payload.providerCertified !== true)
  ) {
    return response({ error: "Complete the itemized work, warranty-work statement, warranty terms, replaced-parts result, mechanic identifiers, and provider representative certification." }, 400);
  }
  if (status === "final" && job.requestStatus.toLowerCase() !== "completed") {
    return response({ error: "Record the authorized job as completed before issuing the final invoice." }, 409);
  }

  const now = nextRecordTime(existing?.updatedAt);
  const invoiceId = existing?.id ?? crypto.randomUUID();
  const invoiceNumber = existing?.invoiceNumber
    || `TVZ-${job.requestId.replace(/[^A-Za-z0-9]/g, "").slice(-10).toUpperCase()}-${job.scopeVersion}`;
  const partsDescription = lineItems
    .filter((item) => item.lineType === "part")
    .map((item) => `${item.partNumber}: ${item.description} (${item.partCondition})`)
    .join("; ")
    .slice(0, 1600);
  const fields = {
    invoiceNumber,
    providerBusinessName: authorization.providerBusinessName,
    providerBusinessAddress: authorization.providerBusinessAddress,
    providerBusinessPhone: authorization.providerBusinessPhone,
    countyRegistrationNumber: authorization.countyRegistrationNumber,
    customerName: authorization.customerName,
    customerAddress: authorization.customerAddress,
    vehicleYear: authorization.vehicleYear,
    vehicleMakeModel: authorization.vehicleMakeModel,
    vehicleTag: authorization.vehicleTag,
    vehicleVin: authorization.vehicleVin,
    odometerReading: authorization.odometerReading,
    customerInstructions: authorization.customerInstructions,
    providerDiagnosis: authorization.providerDiagnosis,
    laborBillingMethod: authorization.laborBillingMethod,
    laborDisclosure: authorization.laborDisclosure,
    mechanicIdentifiers,
    providerRepresentativeName,
    providerRepresentativeTitle,
    warrantyWorkStatement,
    warrantyProvider,
    warrantyTerms,
    returnedPartsChoice,
    workSummary,
  };
  const issuedAt = status === "final" ? now : "";
  const snapshot = stableRepairRecordJson(invoiceSnapshot({
    job,
    authorization,
    lineItems,
    totals,
    fields,
    issuedAt,
  }));
  const documentHash = status === "final" ? await sha256RepairRecord(snapshot) : "";

  const statements = [];
  if (existing) {
    statements.push(env.DB.prepare(
      `UPDATE provider_invoices
          SET quote_id = ?, provider_id = ?, invoice_number = ?, service_codes = ?,
              labor_amount_cents = ?, parts_amount_cents = ?, tax_amount_cents = ?,
              other_amount_cents = ?, total_amount_cents = ?, parts_description = ?,
              returned_parts_choice = ?, warranty_provider = ?, warranty_terms = ?,
              work_summary = ?, status = 'draft', issued_at = '', authorization_record_id = ?,
              provider_business_name = ?, provider_business_address = ?,
              provider_business_phone = ?, county_registration_number = ?, customer_name = ?,
              customer_address = ?, vehicle_year = ?, vehicle_make_model = ?, vehicle_tag = ?,
              vehicle_vin = ?, odometer_reading = ?, customer_instructions = ?,
              provider_diagnosis = ?, labor_billing_method = ?, labor_disclosure = ?,
              mechanic_identifiers = ?, provider_representative_name = ?,
              provider_representative_title = ?, provider_signed_at = ?,
              warranty_work_statement = ?, manufacturer_notice = ?, responsibility_notice = ?,
              document_snapshot = ?, document_hash = ?, updated_at = ?
        WHERE id = ? AND status = 'draft'`,
    ).bind(
      job.quoteId, job.providerId, invoiceNumber, job.serviceCodes,
      totals.laborAmountCents, totals.partsAmountCents, totals.taxAmountCents,
      totals.otherAmountCents, totals.totalAmountCents, partsDescription,
      returnedPartsChoice, warrantyProvider, warrantyTerms, workSummary,
      authorization.id, authorization.providerBusinessName,
      authorization.providerBusinessAddress, authorization.providerBusinessPhone,
      authorization.countyRegistrationNumber, authorization.customerName,
      authorization.customerAddress, authorization.vehicleYear,
      authorization.vehicleMakeModel, authorization.vehicleTag, authorization.vehicleVin,
      authorization.odometerReading, authorization.customerInstructions,
      authorization.providerDiagnosis, authorization.laborBillingMethod,
      authorization.laborDisclosure, JSON.stringify(mechanicIdentifiers),
      providerRepresentativeName, providerRepresentativeTitle,
      status === "final" ? now : "", warrantyWorkStatement,
      MANUFACTURER_SPECIAL_POLICY_NOTICE, REPAIR_FACILITY_RESPONSIBILITY_NOTICE,
      snapshot, documentHash, now, invoiceId,
    ));
    statements.push(env.DB.prepare(
      `DELETE FROM provider_invoice_items WHERE invoice_id = ?`,
    ).bind(invoiceId));
  } else {
    statements.push(env.DB.prepare(
      `INSERT INTO provider_invoices (
         id, request_id, quote_id, provider_id, invoice_number, scope_version,
         service_codes, labor_amount_cents, parts_amount_cents, tax_amount_cents,
         other_amount_cents, total_amount_cents, parts_description,
         returned_parts_choice, warranty_provider, warranty_terms, work_summary,
         status, issued_at, customer_viewed_at, authorization_record_id,
         provider_business_name, provider_business_address, provider_business_phone,
         county_registration_number, customer_name, customer_address, vehicle_year,
         vehicle_make_model, vehicle_tag, vehicle_vin, odometer_reading,
         customer_instructions, provider_diagnosis, labor_billing_method,
         labor_disclosure, mechanic_identifiers, provider_representative_name,
         provider_representative_title, provider_signed_at, warranty_work_statement,
         manufacturer_notice, responsibility_notice, document_snapshot, document_hash,
         created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', '', '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      invoiceId, job.requestId, job.quoteId, job.providerId, invoiceNumber,
      job.scopeVersion, job.serviceCodes, totals.laborAmountCents,
      totals.partsAmountCents, totals.taxAmountCents, totals.otherAmountCents,
      totals.totalAmountCents, partsDescription, returnedPartsChoice,
      warrantyProvider, warrantyTerms, workSummary, authorization.id,
      authorization.providerBusinessName, authorization.providerBusinessAddress,
      authorization.providerBusinessPhone, authorization.countyRegistrationNumber,
      authorization.customerName, authorization.customerAddress,
      authorization.vehicleYear, authorization.vehicleMakeModel,
      authorization.vehicleTag, authorization.vehicleVin,
      authorization.odometerReading, authorization.customerInstructions,
      authorization.providerDiagnosis, authorization.laborBillingMethod,
      authorization.laborDisclosure, JSON.stringify(mechanicIdentifiers),
      providerRepresentativeName, providerRepresentativeTitle,
      status === "final" ? now : "", warrantyWorkStatement,
      MANUFACTURER_SPECIAL_POLICY_NOTICE, REPAIR_FACILITY_RESPONSIBILITY_NOTICE,
      snapshot, documentHash, now, now,
    ));
  }
  lineItems.forEach((item, index) => {
    statements.push(env.DB.prepare(
      `INSERT INTO provider_invoice_items (
         id, invoice_id, line_type, description, part_number, part_condition,
         quantity, unit_amount_cents, line_amount_cents, labor_minutes,
         mechanic_identifier, sort_order, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(), invoiceId, item.lineType, item.description,
      item.partNumber, item.partCondition, item.quantity, item.unitAmountCents,
      item.lineAmountCents, item.laborMinutes, item.mechanicIdentifier, index, now,
    ));
  });
  if (status === "final") {
    statements.push(env.DB.prepare(
      `UPDATE provider_invoices
          SET status = 'final', issued_at = ?, provider_signed_at = ?,
              document_snapshot = ?, document_hash = ?, updated_at = ?
        WHERE id = ? AND status = 'draft'`,
    ).bind(now, now, snapshot, documentHash, now, invoiceId));
  }
  await guardedBatch(job, true, [
    { table: "repair_authorization_records", row: authorization },
    { table: "provider_invoices", row: existing },
  ], [signatureEvidenceAssertion(job, authorization, "maryland_repair_authorization"), ...statements]);
  return savedResponse(role, email, { requestId: job.requestId, recordId: invoiceId, documentHash, action: "save-invoice", status });
}

async function verifyDocument(job: ParticipantJob, record: AuthorizationRecord | InvoiceRecord) {
  if (!record.documentHash || await sha256RepairRecord(record.documentSnapshot) !== record.documentHash) {
    throw new RepairRecordError("The stored document could not be verified as unchanged.");
  }
  let snapshot: Record<string, unknown>;
  try { snapshot = JSON.parse(record.documentSnapshot); } catch { throw new RepairRecordError("The document snapshot is invalid."); }
  if (!snapshot || snapshot.requestId !== job.requestId || snapshot.quoteId !== job.quoteId
    || snapshot.providerId !== job.providerId || snapshot.scopeVersion !== job.scopeVersion
    || snapshot.totalAmountCents !== record.totalAmountCents) {
    throw new RepairRecordError("The document does not match the current accepted job and scope.");
  }
  const isInvoice = "invoiceNumber" in record;
  if (snapshot.documentType !== (isInvoice ? "provider_final_repair_invoice" : "repair_authorization_and_written_estimate")
    || snapshot.version !== MARYLAND_REPAIR_RECORDS_VERSION) throw new RepairRecordError("The document type or version is invalid.");
  for (const [key, value] of Object.entries(record)) {
    if (!(key in snapshot)) continue;
    const displayed = key === "serviceCodes" || key === "mechanicIdentifiers" ? JSON.parse(String(value)) : value;
    if (stableRepairRecordJson(displayed) !== stableRepairRecordJson(snapshot[key])) {
      throw new RepairRecordError("The displayed document fields differ from its signed snapshot.");
    }
  }
  const storedItems = isInvoice ? await invoiceItems(record.id) : await authorizationItems(record.id);
  const items = parseRepairLineItems(storedItems);
  const snapshotItems = parseRepairLineItems(snapshot.lineItems);
  if (!items || !snapshotItems || stableRepairRecordJson(items) !== stableRepairRecordJson(snapshotItems)) {
    throw new RepairRecordError("The displayed itemized work differs from the exact document snapshot.");
  }
}

function signatureEvidence(job: ParticipantJob, record: AuthorizationRecord | InvoiceRecord, key: string) {
  return {
    condition: `(SELECT count(*) FROM customer_agreement_acceptances
      WHERE request_id = ? AND quote_id = ? AND scope_version = ? AND lower(customer_email) = ?
        AND agreement_key = ? AND agreement_version = ? AND agreement_hash = ? AND scope_snapshot = ? AND agreement_text = ?
        AND accepted_by_name = ? AND acceptance_action = ? AND accepted_at = ?
        AND session_id = ? AND ip_address = ? AND device_context = ?) = 1`,
    bindings: [job.requestId, job.quoteId, job.scopeVersion, job.customerEmail, key, MARYLAND_REPAIR_RECORDS_VERSION,
      record.documentHash, record.documentSnapshot, `${record.documentSnapshot}\n${ELECTRONIC_SIGNATURE_NOTICE}`, record.customerSignatureName, record.customerSignatureAction,
      record.customerSignatureAt, record.customerSignatureSessionId, record.customerSignatureIp, record.customerSignatureDevice],
  };
}

async function signatureAcceptance(job: ParticipantJob, record: AuthorizationRecord | InvoiceRecord, key: string) {
  if (!record.customerSignatureAt || !record.customerSignatureName || !record.customerSignatureSessionId) return false;
  const evidence = signatureEvidence(job, record, key);
  const row = await env.DB.prepare(`SELECT ${evidence.condition} AS matched`).bind(...evidence.bindings).first<{ matched: number }>();
  return row?.matched === 1;
}

function signatureEvidenceAssertion(job: ParticipantJob, record: AuthorizationRecord | InvoiceRecord, key: string) {
  const evidence = signatureEvidence(job, record, key);
  return snapshotAssertion(evidence.condition, evidence.bindings);
}

async function signedRetry(role: AccountRole, email: string, job: ParticipantJob, record: AuthorizationRecord | InvoiceRecord,
  action: "sign-authorization" | "sign-invoice", acceptedByName: string) {
  const currentJob = await participantJob(job.requestId, role, email);
  if (!currentJob || stableRepairRecordJson(currentJob) !== stableRepairRecordJson(job)) {
    throw new RepairRecordError("The accepted job changed. Refresh before relying on this signature receipt.");
  }
  await requireWriteAccess(currentJob, action === "sign-invoice");
  const currentRecord = action === "sign-invoice" ? await invoiceFor(currentJob) : await authorizationFor(currentJob);
  if (!currentRecord || currentRecord.id !== record.id || currentRecord.documentHash !== record.documentHash) {
    throw new RepairRecordError("The signed record changed. Refresh and review the saved document.");
  }
  record = currentRecord;
  await verifyDocument(currentJob, record);
  const key = action === "sign-invoice" ? "provider_final_invoice_signature" : "maryland_repair_authorization";
  if (record.customerSignatureName !== acceptedByName || !(await signatureAcceptance(job, record, key))) {
    throw new RepairRecordError("This document already has a different or unverified signature. Refresh and review the saved record.");
  }
  return savedResponse(role, email, { requestId: job.requestId, recordId: record.id, documentHash: record.documentHash,
    action, status: "signed", alreadySigned: true });
}

function validExistingCopyDestination(invoice: InvoiceRecord, email: string) {
  return (!invoice.customerCopyDeliveryMethod || invoice.customerCopyDeliveryMethod === "secure-account-copy")
    && (!invoice.customerCopyDeliveredTo || cleanEmail(invoice.customerCopyDeliveredTo) === email);
}

async function signInvoice(
  request: Request,
  role: AccountRole,
  email: string,
  payload: Record<string, unknown>,
) {
  if (role !== "customer") return response({ error: "Only the customer can sign the provider's final invoice." }, 403);
  const job = await writableJob(role, email, payload, true);
  const invoice = await invoiceFor(job);
  if (!invoice || invoice.status !== "final") return response({ error: "A final provider invoice is required before signing." }, 409);
  const acceptedByName = clean(payload.acceptedByName, 180);
  if (acceptedByName.length < 2 || payload.signatureAccepted !== true) {
    return response({ error: "Type your name and affirmatively sign the exact final provider invoice." }, 400);
  }
  expectDocument(payload, invoice);
  await verifyDocument(job, invoice);
  if (invoice.customerSignatureAt) return signedRetry(role, email, job, invoice, "sign-invoice", acceptedByName);
  if (!validExistingCopyDestination(invoice, email)) throw new RepairRecordError("The existing copy destination requires review; it cannot be replaced by signing.");
  const session = await getAccountSession(request);
  if (!session) return response({ error: "Your signed-in session is required." }, 401);
  const now = new Date().toISOString();
  const signatureAction = "typed-name-and-affirmative-final-invoice-checkbox";
  const agreementText = `${invoice.documentSnapshot}\n${ELECTRONIC_SIGNATURE_NOTICE}`;
  try { await guardedBatch(job, true, [{ table: "provider_invoices", row: invoice }], [
    env.DB.prepare(
      `INSERT INTO customer_agreement_acceptances (
         id, customer_email, request_id, quote_id, scope_version, scope_snapshot,
         agreement_key, agreement_version, agreement_hash, agreement_text,
         accepted_by_name, acceptance_action, accepted_at, ip_address,
         session_id, device_context, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, 'provider_final_invoice_signature', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(
      crypto.randomUUID(), cleanEmail(email), job.requestId, job.quoteId,
      job.scopeVersion, invoice.documentSnapshot, MARYLAND_REPAIR_RECORDS_VERSION,
      invoice.documentHash, agreementText, acceptedByName, signatureAction,
      now, requestIp(request), session.id, deviceContext(request), now,
    ),
    env.DB.prepare(
      `UPDATE provider_invoices
          SET customer_signature_name = ?, customer_signature_action = ?,
              customer_signature_at = ?, customer_signature_ip = ?,
              customer_signature_session_id = ?, customer_signature_device = ?,
              customer_viewed_at = CASE WHEN customer_viewed_at = '' THEN ? ELSE customer_viewed_at END,
              customer_copy_delivery_method = CASE WHEN customer_copy_delivery_method = '' THEN 'secure-account-copy' ELSE customer_copy_delivery_method END,
              customer_copy_delivered_to = CASE WHEN customer_copy_delivered_to = '' THEN ? ELSE customer_copy_delivered_to END,
              customer_copy_delivered_at = CASE WHEN customer_copy_delivered_at = '' THEN ? ELSE customer_copy_delivered_at END,
              provider_copy_retained_at = CASE WHEN provider_copy_retained_at = '' THEN ? ELSE provider_copy_retained_at END, updated_at = ?
        WHERE id = ? AND status = 'final' AND customer_signature_at = '' AND document_hash = ?`,
    ).bind(
      acceptedByName, signatureAction, now, requestIp(request), session.id,
      deviceContext(request), now, cleanEmail(email), now, now, now,
      invoice.id, invoice.documentHash,
    ),
  ]); } catch (error) {
    if (error instanceof RepairRecordError && error.status === 409) {
      const current = await invoiceFor(job);
      if (current?.id === invoice.id && current.documentHash === invoice.documentHash && current.customerSignatureAt) {
        return signedRetry(role, email, job, current, "sign-invoice", acceptedByName);
      }
    }
    throw error;
  }
  return savedResponse(role, email, { requestId: job.requestId, recordId: invoice.id, documentHash: invoice.documentHash,
    action: "sign-invoice", status: "signed-and-delivered" });
}

async function receiveInvoiceCopy(role: AccountRole, email: string, payload: Record<string, unknown>) {
  if (role !== "customer") return response({ error: "Only the customer can acknowledge receiving their invoice copy." }, 403);
  const job = await writableJob(role, email, payload, true);
  const invoice = await invoiceFor(job);
  if (!invoice || invoice.status !== "final") throw new RepairRecordError("A final invoice is required.");
  expectDocument(payload, invoice);
  if (payload.copyReceived !== true) throw new RepairRecordError("Confirm that you received and can retain this exact secure-account copy.", 400);
  await verifyDocument(job, invoice);
  if (!(await signatureAcceptance(job, invoice, "provider_final_invoice_signature"))) {
    throw new RepairRecordError("Copy recovery requires the existing genuine signature and its matching acceptance. This action cannot sign an invoice.");
  }
  if (!validExistingCopyDestination(invoice, email)) throw new RepairRecordError("The existing copy destination requires review and cannot be overwritten.");
  if (!invoice.customerCopyDeliveryMethod || !invoice.customerCopyDeliveredTo || !invoice.customerCopyDeliveredAt || !invoice.providerCopyRetainedAt) {
    const now = new Date().toISOString();
    await guardedBatch(job, true, [{ table: "provider_invoices", row: invoice }], [
      signatureEvidenceAssertion(job, invoice, "provider_final_invoice_signature"),
      env.DB.prepare(`UPDATE provider_invoices
        SET customer_copy_delivery_method = CASE WHEN customer_copy_delivery_method = '' THEN 'secure-account-copy' ELSE customer_copy_delivery_method END,
            customer_copy_delivered_to = CASE WHEN customer_copy_delivered_to = '' THEN ? ELSE customer_copy_delivered_to END,
            customer_copy_delivered_at = CASE WHEN customer_copy_delivered_at = '' THEN ? ELSE customer_copy_delivered_at END,
            provider_copy_retained_at = CASE WHEN provider_copy_retained_at = '' THEN ? ELSE provider_copy_retained_at END,
            customer_viewed_at = CASE WHEN customer_viewed_at = '' THEN ? ELSE customer_viewed_at END,
            updated_at = ?
        WHERE id = ? AND document_hash = ? AND customer_signature_at <> ''`)
        .bind(email, now, now, now, now, invoice.id, invoice.documentHash),
    ]);
  }
  return savedResponse(role, email, { requestId: job.requestId, recordId: invoice.id, documentHash: invoice.documentHash,
    action: "receive-invoice-copy", status: "copy-received" });
}

export async function GET(request: Request) {
  const session = await getAccountSession(request);
  if (!session || (session.role !== "customer" && session.role !== "provider")) {
    return response({ error: "Sign in to a customer or provider account." }, 401);
  }
  return response(await responseData(session.role, cleanEmail(session.email), clean(new URL(request.url).searchParams.get("requestId"), 80)));
}

export async function POST(request: Request) {
  if (!isSameOriginRequest(request)) {
    return response({ error: "This repair-record action must come from Tuveloz." }, 403);
  }
  const session = await getAccountSession(request);
  if (!session || (session.role !== "customer" && session.role !== "provider")) {
    return response({ error: "Sign in to a customer or provider account." }, 401);
  }
  const payload = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!payload) return response({ error: "Submit a valid repair-record action." }, 400);
  const action = clean(payload.action, 50);
  const role = session.role as AccountRole;
  const email = cleanEmail(session.email);
  try {
    if (action === "save-authorization") {
      return await saveAuthorization(request, role, email, payload);
    }
    if (action === "sign-authorization") {
      return await signAuthorization(request, role, email, payload);
    }
    if (action === "save-invoice") {
      return await saveInvoice(request, role, email, payload);
    }
    if (action === "sign-invoice") {
      return await signInvoice(request, role, email, payload);
    }
    if (action === "receive-invoice-copy") return await receiveInvoiceCopy(role, email, payload);
    return response({ error: "Unsupported repair-record action." }, 400);
  } catch (error) {
    if (error instanceof RepairRecordError) return response({ error: error.message, code: error.code, snapshotRefreshRequired: true }, error.status);
    console.error("Unable to save Maryland repair record", error);
    return response({ error: "The repair-record result could not be confirmed. Refresh the saved records before retrying. This action does not move money.", snapshotRefreshRequired: true }, 503);
  }
}
