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
  parseRepairLineItems,
  repairLineItemTotals,
  sha256RepairRecord,
  stableRepairRecordJson,
  type RepairLineItem,
} from "../../../lib/maryland-repair-records";
import { isSameOriginRequest } from "../../../lib/request-security";

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
  scopeVersion: number;
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

async function participantJobs(role: AccountRole, email: string) {
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
            quote.scope_version AS scopeVersion,
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
        AND request.is_test_job = 'yes'
        AND provider.is_test_provider = 'yes'
        AND request.status NOT IN ('cancelled','canceled')
      ORDER BY datetime(request.created_at) DESC
      LIMIT 50`,
  ).bind(email).all<ParticipantJob>();
  return result.results ?? [];
}

async function participantJob(requestId: string, role: AccountRole, email: string) {
  const jobs = await participantJobs(role, email);
  return jobs.find((job) => job.requestId === requestId) ?? null;
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
      WHERE request_id = ? AND scope_version = ?
      LIMIT 1`,
  ).bind(job.requestId, job.scopeVersion).first<AuthorizationRecord>();
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
      WHERE request_id = ? AND scope_version = ?
      LIMIT 1`,
  ).bind(job.requestId, job.scopeVersion).first<InvoiceRecord>();
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

async function recordData(job: ParticipantJob) {
  const authorization = await authorizationFor(job);
  const invoice = await invoiceFor(job);
  const [authorizationLineItems, invoiceLineItems] = await Promise.all([
    authorizationItems(authorization?.id ?? ""),
    invoiceItems(invoice?.id ?? ""),
  ]);
  return {
    ...job,
    authorization: authorization
      ? { ...authorization, lineItems: authorizationLineItems }
      : null,
    invoice: invoice
      ? { ...invoice, lineItems: invoiceLineItems }
      : null,
  };
}

async function responseData(role: AccountRole, email: string) {
  const jobs = await participantJobs(role, email);
  return {
    testOnly: true,
    realJobsEnabled: false,
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
    jobs: await Promise.all(jobs.map(recordData)),
  };
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
  };
}

async function saveAuthorization(
  request: Request,
  role: AccountRole,
  email: string,
  payload: Record<string, unknown>,
) {
  if (role !== "provider") return response({ error: "Only the selected provider can prepare the repair authorization." }, 403);
  const requestId = clean(payload.requestId, 80);
  const job = await participantJob(requestId, role, email);
  if (!job) return response({ error: "This isolated test job is not assigned to this provider." }, 404);

  const existing = await authorizationFor(job);
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

  const now = new Date().toISOString();
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
  await env.DB.batch(statements);
  return response({ ok: true, id, status, documentHash, ...(await responseData(role, email)) });
}

async function signAuthorization(
  request: Request,
  role: AccountRole,
  email: string,
  payload: Record<string, unknown>,
) {
  if (role !== "customer") return response({ error: "Only the customer can sign the repair authorization." }, 403);
  const requestId = clean(payload.requestId, 80);
  const job = await participantJob(requestId, role, email);
  if (!job) return response({ error: "This isolated test job does not belong to this customer." }, 404);
  const authorization = await authorizationFor(job);
  if (!authorization || authorization.status !== "presented") {
    return response({ error: "A provider-presented repair authorization is required before signing." }, 409);
  }
  const acceptedByName = clean(payload.acceptedByName, 180);
  if (acceptedByName.length < 2 || payload.signatureAccepted !== true) {
    return response({ error: "Type your name and affirmatively sign the exact written estimate and authorization." }, 400);
  }
  const calculatedHash = await sha256RepairRecord(authorization.documentSnapshot);
  if (!authorization.documentHash || calculatedHash !== authorization.documentHash) {
    return response({ error: "The presented authorization could not be verified as unchanged." }, 409);
  }
  const session = await getAccountSession(request);
  if (!session) return response({ error: "Your signed-in session is required." }, 401);
  const now = new Date().toISOString();
  const signatureAction = "typed-name-and-affirmative-repair-authorization-checkbox";
  const agreementText = `${authorization.documentSnapshot}\n${ELECTRONIC_SIGNATURE_NOTICE}`;
  await env.DB.batch([
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
  ]);
  return response({ ok: true, status: "signed", ...(await responseData(role, email)) });
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
  };
}

async function saveInvoice(
  request: Request,
  role: AccountRole,
  email: string,
  payload: Record<string, unknown>,
) {
  if (role !== "provider") return response({ error: "Only the selected provider can prepare the provider invoice." }, 403);
  const requestId = clean(payload.requestId, 80);
  const job = await participantJob(requestId, role, email);
  if (!job) return response({ error: "This isolated test job is not assigned to this provider." }, 404);
  const authorization = await authorizationFor(job);
  if (!authorization || authorization.status !== "signed") {
    return response({ error: "The customer's signed repair authorization is required before a final invoice can issue." }, 409);
  }
  const existing = await invoiceFor(job);
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

  const now = new Date().toISOString();
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
  await env.DB.batch(statements);
  return response({ ok: true, invoiceId, invoiceNumber, status, documentHash, ...(await responseData(role, email)) });
}

async function signInvoice(
  request: Request,
  role: AccountRole,
  email: string,
  payload: Record<string, unknown>,
) {
  if (role !== "customer") return response({ error: "Only the customer can sign the provider's final invoice." }, 403);
  const requestId = clean(payload.requestId, 80);
  const job = await participantJob(requestId, role, email);
  if (!job) return response({ error: "This isolated test job does not belong to this customer." }, 404);
  const invoice = await invoiceFor(job);
  if (!invoice || invoice.status !== "final") return response({ error: "A final provider invoice is required before signing." }, 409);
  if (invoice.customerSignatureAt) return response({ error: "This final invoice was already signed and delivered." }, 409);
  const acceptedByName = clean(payload.acceptedByName, 180);
  if (acceptedByName.length < 2 || payload.signatureAccepted !== true) {
    return response({ error: "Type your name and affirmatively sign the exact final provider invoice." }, 400);
  }
  const calculatedHash = await sha256RepairRecord(invoice.documentSnapshot);
  if (!invoice.documentHash || calculatedHash !== invoice.documentHash) {
    return response({ error: "The final provider invoice could not be verified as unchanged." }, 409);
  }
  const session = await getAccountSession(request);
  if (!session) return response({ error: "Your signed-in session is required." }, 401);
  const now = new Date().toISOString();
  const signatureAction = "typed-name-and-affirmative-final-invoice-checkbox";
  const agreementText = `${invoice.documentSnapshot}\n${ELECTRONIC_SIGNATURE_NOTICE}`;
  await env.DB.batch([
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
              customer_viewed_at = ?, customer_copy_delivery_method = 'secure-account-copy',
              customer_copy_delivered_to = ?, customer_copy_delivered_at = ?,
              provider_copy_retained_at = ?, updated_at = ?
        WHERE id = ? AND status = 'final' AND customer_signature_at = '' AND document_hash = ?`,
    ).bind(
      acceptedByName, signatureAction, now, requestIp(request), session.id,
      deviceContext(request), now, cleanEmail(email), now, now, now,
      invoice.id, invoice.documentHash,
    ),
  ]);
  return response({
    ok: true,
    status: "signed-and-delivered",
    deliveryMethod: "secure-account-copy",
    paymentReleased: false,
    ...(await responseData(role, email)),
  });
}

export async function GET(request: Request) {
  const session = await getAccountSession(request);
  if (!session || (session.role !== "customer" && session.role !== "provider")) {
    return response({ error: "Sign in to a customer or provider account." }, 401);
  }
  return response(await responseData(session.role, cleanEmail(session.email)));
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
    return response({ error: "Unsupported repair-record action." }, 400);
  } catch (error) {
    console.error("Unable to save Maryland repair record", error);
    return response({ error: "The repair record could not be saved. No authorization, invoice, signature, payment, or payout was changed." }, 500);
  }
}
