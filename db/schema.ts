import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  primaryKey,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

export const customerRequests = sqliteTable(
  "customer_requests",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    zip: text("zip").notNull(),
    launchArea: text("launch_area").notNull().default(""),
    jurisdiction: text("jurisdiction").notNull().default(""),
    municipality: text("municipality").notNull().default(""),
    isTestJob: text("is_test_job").notNull().default("no"),
    vehicle: text("vehicle").notNull(),
    // Optional. Given so Tuveloz and the chosen provider can reach the
    // customer about this job; promotional texts need the separate opt-in
    // recorded in phone_contact_consents.
    contactPhone: text("contact_phone").notNull().default(""),
    service: text("service").notNull(),
    serviceCodes: text("service_codes").notNull().default("[]"),
    partsSource: text("parts_source").notNull().default("Not sure whether parts are needed — discuss with provider"),
    partsPreference: text("parts_preference").notNull().default("No preference"),
    laborOnlyPartsAcknowledgedAt: text("labor_only_parts_acknowledged_at")
      .notNull()
      .default(""),
    budgetRange: text("budget_range").notNull().default("Not provided"),
    serviceLocations: text("service_locations").notNull().default("Provider comes to me"),
    serviceAddress: text("service_address").notNull().default(""),
    details: text("details").notNull(),
    scheduledFor: text("scheduled_for").notNull().default(""),
    preferredProviderEmail: text("preferred_provider_email").notNull().default(""),
    preferredProviderName: text("preferred_provider_name").notNull().default(""),
    repeatOfRequestId: text("repeat_of_request_id").notNull().default(""),
    accessToken: text("access_token").notNull().default(""),
    issueImageKey: text("issue_image_key").notNull().default(""),
    issueImageType: text("issue_image_type").notNull().default(""),
    completionImageKey: text("completion_image_key").notNull().default(""),
    completionImageType: text("completion_image_type").notNull().default(""),
    status: text("status").notNull().default("new"),
    assignedPersonId: text("assigned_person_id").notNull().default(""),
    assignedSupervisorPersonId: text("assigned_supervisor_person_id").notNull().default(""),
    assignmentVersion: integer("assignment_version").notNull().default(0),
    approvedAt: text("approved_at").notNull().default(""),
    reminderSentAt: text("reminder_sent_at").notNull().default(""),
    reminderLastAttemptAt: text("reminder_last_attempt_at").notNull().default(""),
    policyVersion: text("policy_version").notNull().default(""),
    customerProviderDisclosureAcceptedAt: text("customer_provider_disclosure_accepted_at")
      .notNull()
      .default(""),
    termsAcceptedAt: text("terms_accepted_at").notNull().default(""),
    termsVersion: text("terms_version").notNull().default(""),
    rememberEmailConsent: text("remember_email_consent").notNull().default("no"),
    rememberEmailConsentText: text("remember_email_consent_text").notNull().default(""),
    marketingConsent: text("marketing_consent").notNull().default("no"),
    marketingConsentText: text("marketing_consent_text").notNull().default(""),
    consentVersion: text("consent_version").notNull().default(""),
    consentSource: text("consent_source").notNull().default(""),
    consentRecordedAt: text("consent_recorded_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("customer_requests_created_at_idx").on(table.createdAt),
    index("customer_requests_status_idx").on(table.status),
    index("customer_requests_email_idx").on(table.email),
    index("customer_requests_preferred_provider_idx").on(table.preferredProviderEmail),
    index("customer_requests_jurisdiction_status_idx").on(table.jurisdiction, table.status),
    index("customer_requests_scheduled_for_idx").on(table.scheduledFor),
    index("customer_requests_assigned_person_idx").on(table.assignedPersonId),
    index("customer_requests_assigned_supervisor_idx")
      .on(table.assignedSupervisorPersonId),
  ],
);

export const providerQuotes = sqliteTable(
  "provider_quotes",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    serviceCodes: text("service_codes").notNull().default("[]"),
    providerName: text("provider_name").notNull(),
    providerEmail: text("provider_email").notNull(),
    performingPersonId: text("performing_person_id").notNull().default(""),
    supervisorPersonId: text("supervisor_person_id").notNull().default(""),
    priceCents: text("price_cents").notNull(),
    laborPriceCents: text("labor_price_cents").notNull().default("0"),
    partsPriceCents: text("parts_price_cents").notNull().default("0"),
    laborOnlyPartsConfirmedAt: text("labor_only_parts_confirmed_at")
      .notNull()
      .default(""),
    // Matches CUSTOMER_SERVICE_FEE_RATE_BPS in lib/customer-fee.ts. Application
    // code always passes the rate explicitly, so this default is a fallback that
    // should never fire — but it read 1000 (10%) while the canonical rate is 500,
    // so anything that did fall through carried double the fee.
    customerFeeRateBps: integer("customer_fee_rate_bps").notNull().default(500),
    customerFeeCents: text("customer_fee_cents").notNull().default("0"),
    customerTotalCents: text("customer_total_cents").notNull().default("0"),
    partType: text("part_type").notNull().default("Customer supplied"),
    availability: text("availability").notNull(),
    scheduledFor: text("scheduled_for").notNull().default(""),
    message: text("message").notNull(),
    workmanshipWarranty: text("workmanship_warranty").notNull().default(""),
    scopeVersion: integer("scope_version").notNull().default(0),
    authorizationDecisionId: text("authorization_decision_id").notNull().default(""),
    status: text("status").notNull().default("submitted"),
    declineReason: text("decline_reason").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("provider_quotes_request_id_idx").on(table.requestId),
    index("provider_quotes_created_at_idx").on(table.createdAt),
    index("provider_quotes_performing_person_idx").on(table.performingPersonId),
    index("provider_quotes_supervisor_person_idx").on(table.supervisorPersonId),
    index("provider_quotes_scheduled_for_idx").on(table.scheduledFor),
    index("provider_quotes_authorization_decision_idx").on(table.authorizationDecisionId),
  ],
);

export const providerJobRecords = sqliteTable(
  "provider_job_records",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    providerEmail: text("provider_email").notNull(),
    jobStartDecisionId: text("job_start_decision_id").notNull().default(""),
    completionDecisionId: text("completion_decision_id").notNull().default(""),
    workStatus: text("work_status").notNull().default("scheduled"),
    timerStartedAt: text("timer_started_at").notNull().default(""),
    trackedSeconds: integer("tracked_seconds").notNull().default(0),
    billableMinutes: integer("billable_minutes").notNull().default(0),
    workNotes: text("work_notes").notNull().default(""),
    partsNotes: text("parts_notes").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("provider_job_records_request_provider_unique")
      .on(table.requestId, table.providerEmail),
    index("provider_job_records_provider_email_idx").on(table.providerEmail),
    index("provider_job_records_updated_at_idx").on(table.updatedAt),
    index("provider_job_records_start_decision_idx").on(table.jobStartDecisionId),
    index("provider_job_records_completion_decision_idx").on(table.completionDecisionId),
  ],
);

export const providerApplications = sqliteTable(
  "provider_applications",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    preferredLanguage: text("preferred_language").notNull().default("English"),
    service: text("service").notNull(),
    serviceArea: text("service_area").notNull(),
    businessMunicipality: text("business_municipality").notNull().default(""),
    workLocations: text("work_locations").notNull().default("I travel to customers"),
    businessServiceAddress: text("business_service_address").notNull().default(""),
    experience: text("experience").notNull(),
    insuranceStatus: text("insurance_status").notNull(),
    insuranceExpiresAt: text("insurance_expires_at").notNull().default(""),
    verificationStatus: text("verification_status").notNull().default("not reviewed"),
    isTestProvider: text("is_test_provider").notNull().default("no"),
    providerSelfAssessment: text("provider_self_assessment").notNull().default(""),
    serviceEligibilityStatuses: text("service_eligibility_statuses").notNull().default(""),
    approvedServices: text("approved_services").notNull().default(""),
    serviceRulesVersion: text("service_rules_version").notNull().default(""),
    serviceRulesAcknowledgedAt: text("service_rules_acknowledged_at").notNull().default(""),
    verificationChecklist: text("verification_checklist").notNull().default(""),
    verifiedAt: text("verified_at").notNull().default(""),
    verifiedBy: text("verified_by").notNull().default(""),
    accessToken: text("access_token").notNull().default(""),
    alertsEnabled: text("alerts_enabled").notNull().default("yes"),
    // This is the only Stripe value stored on the provider record. Onboarding
    // and capability status are always fetched from Stripe's V2 Accounts API.
    stripeAccountId: text("stripe_account_id"),
    status: text("status").notNull().default("new"),
    // Founding cohort standing, assigned once at first verification and never
    // recomputed. 0 = not in the cohort. See lib/founding-cohort.ts.
    foundingRank: integer("founding_rank").notNull().default(0),
    foundingRankAssignedAt: text("founding_rank_assigned_at").notNull().default(""),
    termsAcceptedAt: text("terms_accepted_at").notNull().default(""),
    termsVersion: text("terms_version").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("provider_applications_created_at_idx").on(table.createdAt),
    index("provider_applications_status_idx").on(table.status),
    index("provider_applications_founding_rank_idx").on(table.foundingRank),
    index("provider_applications_email_idx").on(table.email),
    index("provider_applications_stripe_account_idx").on(table.stripeAccountId),
  ],
);

/**
 * One normalized email may own only one non-declined provider application.
 * This separate claim table can be safely backfilled even when legacy data
 * contains duplicate active applications: the migration deterministically
 * claims the oldest record and leaves all legacy rows available for review.
 */
export const providerApplicationEmailClaims = sqliteTable(
  "provider_application_email_claims",
  {
    normalizedEmail: text("normalized_email").primaryKey(),
    providerId: text("provider_id").notNull(),
    challengeId: text("challenge_id").notNull().default(""),
    consumptionNonce: text("consumption_nonce").notNull().default(""),
    claimedAt: text("claimed_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("provider_application_email_claims_provider_unique")
      .on(table.providerId),
  ],
);

export const providerApplicationChallenges = sqliteTable(
  "provider_application_challenges",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    payloadHash: text("payload_hash").notNull(),
    codeHash: text("code_hash").notNull(),
    sourceHash: text("source_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    verifiedAt: text("verified_at").notNull().default(""),
    usedAt: text("used_at").notNull().default(""),
    consumptionNonce: text("consumption_nonce").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("provider_application_challenges_email_created_idx")
      .on(table.email, table.createdAt),
    index("provider_application_challenges_expires_idx").on(table.expiresAt),
    index("provider_application_challenges_source_created_idx")
      .on(table.sourceHash, table.createdAt),
    uniqueIndex("provider_application_challenges_consumption_nonce_unique")
      .on(table.consumptionNonce)
      .where(sql`${table.consumptionNonce} <> ''`),
  ],
);

/**
 * Immutable evidence for the normalized application and legal-document
 * manifest confirmed by an email challenge. OTP cleanup never removes it.
 */
export const providerApplicationSubmissionEvidence = sqliteTable(
  "provider_application_submission_evidence",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    normalizedEmail: text("normalized_email").notNull(),
    challengeId: text("challenge_id").notNull(),
    consumptionNonce: text("consumption_nonce").notNull(),
    normalizedSnapshot: text("normalized_snapshot").notNull(),
    payloadHash: text("payload_hash").notNull(),
    acceptedDocumentManifest: text("accepted_document_manifest").notNull(),
    verifiedAt: text("verified_at").notNull(),
    consumedAt: text("consumed_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("provider_application_submission_evidence_challenge_unique")
      .on(table.challengeId),
    uniqueIndex("provider_application_submission_evidence_nonce_unique")
      .on(table.consumptionNonce),
    index("provider_application_submission_evidence_provider_idx")
      .on(table.providerId, table.createdAt),
  ],
);

export const publicWriteRateLimits = sqliteTable(
  "public_write_rate_limits",
  {
    action: text("action").notNull(),
    keyHash: text("key_hash").notNull(),
    windowStartedAt: integer("window_started_at").notNull(),
    requestCount: integer("request_count").notNull().default(0),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.action, table.keyHash] }),
    index("public_write_rate_limits_updated_idx").on(table.updatedAt),
  ],
);

export const providerCredentialVerifications = sqliteTable(
  "provider_credential_verifications",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    requirementKey: text("requirement_key").notNull(),
    requirementLabel: text("requirement_label").notNull(),
    jurisdiction: text("jurisdiction").notNull(),
    credentialIdentifier: text("credential_identifier").notNull().default(""),
    issuingAuthority: text("issuing_authority").notNull(),
    legalBasisUrl: text("legal_basis_url").notNull(),
    officialLookupUrl: text("official_lookup_url").notNull(),
    status: text("status").notNull().default("pending"),
    verificationMethod: text("verification_method").notNull().default("official-online-record"),
    checkedAt: text("checked_at").notNull().default(""),
    expiresAt: text("expires_at").notNull().default(""),
    verifiedBy: text("verified_by").notNull().default(""),
    notes: text("notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("provider_credential_provider_requirement_unique")
      .on(table.providerId, table.requirementKey),
    index("provider_credential_provider_id_idx").on(table.providerId),
    index("provider_credential_status_idx").on(table.status),
    index("provider_credential_checked_at_idx").on(table.checkedAt),
  ],
);

export const stripePayments = sqliteTable(
  "stripe_payments",
  {
    id: text("id").primaryKey(),
    paymentType: text("payment_type").notNull(),
    requestId: text("request_id"),
    quoteId: text("quote_id"),
    scopeVersion: integer("scope_version").notNull().default(0),
    scopeAuthorizationDecisionId: text("scope_authorization_decision_id")
      .notNull()
      .default(""),
    authorizedPriceSnapshot: text("authorized_price_snapshot")
      .notNull()
      .default("{}"),
    stripeProductId: text("stripe_product_id"),
    stripePriceId: text("stripe_price_id"),
    productName: text("product_name").notNull(),
    providerApplicationId: text("provider_application_id").notNull(),
    connectedAccountId: text("connected_account_id").notNull(),
    customerEmail: text("customer_email").notNull().default(""),
    currency: text("currency").notNull().default("usd"),
    quantity: integer("quantity").notNull().default(1),
    providerAmountCents: integer("provider_amount_cents").notNull(),
    applicationFeeCents: integer("application_fee_cents").notNull(),
    customerTotalCents: integer("customer_total_cents").notNull(),
    settlementStrategy: text("settlement_strategy").notNull(),
    checkoutSessionId: text("checkout_session_id"),
    paymentIntentId: text("payment_intent_id"),
    chargeId: text("charge_id"),
    transferGroup: text("transfer_group"),
    transferId: text("transfer_id"),
    status: text("status").notNull().default("checkout_creating"),
    paidAt: text("paid_at").notNull().default(""),
    releasedAt: text("released_at").notNull().default(""),
    releasedBy: text("released_by").notNull().default(""),
    refundAmountCents: integer("refund_amount_cents").notNull().default(0),
    refundedAt: text("refunded_at").notNull().default(""),
    refundStatus: text("refund_status").notNull().default(""),
    refundUpdatedAt: text("refund_updated_at").notNull().default(""),
    refundFailureReason: text("refund_failure_reason").notNull().default(""),
    lastRefundId: text("last_refund_id").notNull().default(""),
    lastRefundEventCreated: integer("last_refund_event_created").notNull().default(0),
    lastRefundEventId: text("last_refund_event_id").notNull().default(""),
    disputeStatus: text("dispute_status").notNull().default(""),
    disputeUpdatedAt: text("dispute_updated_at").notNull().default(""),
    lastDisputeId: text("last_dispute_id").notNull().default(""),
    lastDisputeEventCreated: integer("last_dispute_event_created").notNull().default(0),
    lastDisputeEventId: text("last_dispute_event_id").notNull().default(""),
    policyAcceptedAt: text("policy_accepted_at").notNull().default(""),
    policyVersion: text("policy_version").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("stripe_payments_request_id_idx").on(table.requestId),
    index("stripe_payments_quote_id_idx").on(table.quoteId),
    index("stripe_payments_scope_authorization_idx")
      .on(table.scopeAuthorizationDecisionId),
    index("stripe_payments_provider_idx").on(table.providerApplicationId),
    index("stripe_payments_status_idx").on(table.status),
    uniqueIndex("stripe_payments_checkout_session_unique").on(table.checkoutSessionId),
    index("stripe_payments_payment_intent_idx").on(table.paymentIntentId),
  ],
);

// Stripe can redeliver the same webhook, deliver different event types out of
// order, or retry after a transient database failure. Keep a durable receipt
// for each endpoint/event pair so financial reconciliation is repeatable
// without treating an acknowledgement as proof that processing succeeded.
export const stripeWebhookEvents = sqliteTable(
  "stripe_webhook_events",
  {
    id: text("id").primaryKey(),
    endpoint: text("endpoint").notNull(),
    eventId: text("event_id").notNull(),
    eventType: text("event_type").notNull(),
    livemode: integer("livemode").notNull().default(0),
    connectedAccountId: text("connected_account_id").notNull().default(""),
    objectId: text("object_id").notNull().default(""),
    status: text("status").notNull().default("processing"),
    attemptCount: integer("attempt_count").notNull().default(1),
    receivedAt: text("received_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastAttemptAt: text("last_attempt_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    processedAt: text("processed_at").notNull().default(""),
    lastError: text("last_error").notNull().default(""),
  },
  (table) => [
    uniqueIndex("stripe_webhook_events_endpoint_event_unique")
      .on(table.endpoint, table.eventId),
    index("stripe_webhook_events_status_attempt_idx")
      .on(table.status, table.lastAttemptAt),
    index("stripe_webhook_events_received_at_idx").on(table.receivedAt),
  ],
);

// This table is fed only by the separate standard connected-account snapshot
// destination. V2 thin account-requirement events intentionally stay on their
// own endpoint and signing secret. A missing or adverse snapshot fails closed
// when an owner later attempts to release provider funds.
export const stripeConnectedAccountSnapshots = sqliteTable(
  "stripe_connected_account_snapshots",
  {
    connectedAccountId: text("connected_account_id").primaryKey(),
    providerApplicationId: text("provider_application_id").notNull().default(""),
    livemode: integer("livemode").notNull().default(0),
    payoutFailureHold: integer("payout_failure_hold").notNull().default(0),
    payoutHoldReason: text("payout_hold_reason").notNull().default(""),
    lastPayoutId: text("last_payout_id").notNull().default(""),
    lastPayoutStatus: text("last_payout_status").notNull().default(""),
    lastPayoutFailureCode: text("last_payout_failure_code").notNull().default(""),
    lastPayoutLivemode: integer("last_payout_livemode").notNull().default(0),
    lastPayoutEventCreated: integer("last_payout_event_created").notNull().default(0),
    lastPayoutEventId: text("last_payout_event_id").notNull().default(""),
    externalAccountHold: integer("external_account_hold").notNull().default(1),
    externalAccountHoldReason: text("external_account_hold_reason").notNull().default("no_snapshot"),
    lastExternalAccountId: text("last_external_account_id").notNull().default(""),
    lastExternalAccountType: text("last_external_account_type").notNull().default(""),
    lastExternalAccountStatus: text("last_external_account_status").notNull().default(""),
    lastExternalAccountLivemode: integer("last_external_account_livemode")
      .notNull()
      .default(0),
    lastExternalAccountEventCreated: integer("last_external_account_event_created")
      .notNull()
      .default(0),
    lastExternalAccountEventId: text("last_external_account_event_id").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("stripe_connected_account_snapshots_provider_idx")
      .on(table.providerApplicationId),
    index("stripe_connected_account_snapshots_payout_hold_idx")
      .on(table.payoutFailureHold, table.externalAccountHold),
    index("stripe_connected_account_snapshots_updated_at_idx").on(table.updatedAt),
  ],
);

export const stripeCustomers = sqliteTable(
  "stripe_customers",
  {
    customerEmail: text("customer_email").primaryKey(),
    // Tuveloz stores only Stripe's Customer identifier. Card numbers, CVCs,
    // billing credentials, and other sensitive payment data stay in Stripe.
    stripeCustomerId: text("stripe_customer_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("stripe_customers_customer_id_unique").on(table.stripeCustomerId),
    index("stripe_customers_updated_at_idx").on(table.updatedAt),
  ],
);

export const loginCodes = sqliteTable(
  "login_codes",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    usedAt: text("used_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("login_codes_email_role_idx").on(table.email, table.role),
    index("login_codes_expires_at_idx").on(table.expiresAt),
    index("login_codes_created_at_idx").on(table.createdAt),
  ],
);

export const authSessions = sqliteTable(
  "auth_sessions",
  {
    id: text("id").primaryKey(),
    tokenHash: text("token_hash").notNull(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    expiresAt: text("expires_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastSeenAt: text("last_seen_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("auth_sessions_token_hash_unique").on(table.tokenHash),
    index("auth_sessions_email_idx").on(table.email),
    index("auth_sessions_expires_at_idx").on(table.expiresAt),
  ],
);

export const accountCredentials = sqliteTable(
  "account_credentials",
  {
    email: text("email").primaryKey(),
    passwordHash: text("password_hash").notNull(),
    passwordSalt: text("password_salt").notNull(),
    passwordIterations: integer("password_iterations").notNull(),
    verifiedAt: text("verified_at").notNull(),
    failedAttempts: integer("failed_attempts").notNull().default(0),
    lockedUntil: text("locked_until").notNull().default(""),
    termsAcceptedAt: text("terms_accepted_at").notNull().default(""),
    termsVersion: text("terms_version").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("account_credentials_locked_until_idx").on(table.lockedUntil),
  ],
);

export const passwordVerificationCodes = sqliteTable(
  "password_verification_codes",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    purpose: text("purpose").notNull(),
    codeHash: text("code_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    usedAt: text("used_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("password_codes_email_role_purpose_idx")
      .on(table.email, table.role, table.purpose),
    index("password_codes_expires_at_idx").on(table.expiresAt),
    index("password_codes_created_at_idx").on(table.createdAt),
  ],
);

export const accountPhoneNumbers = sqliteTable(
  "account_phone_numbers",
  {
    email: text("email").primaryKey(),
    phoneE164: text("phone_e164").notNull(),
    verifiedAt: text("verified_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("account_phone_numbers_phone_unique").on(table.phoneE164),
  ],
);

export const phoneLoginCodes = sqliteTable(
  "phone_login_codes",
  {
    id: text("id").primaryKey(),
    phoneE164: text("phone_e164").notNull(),
    purpose: text("purpose").notNull(),
    email: text("email").notNull().default(""),
    codeHash: text("code_hash").notNull(),
    expiresAt: text("expires_at").notNull(),
    attempts: integer("attempts").notNull().default(0),
    usedAt: text("used_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("phone_login_codes_phone_purpose_idx").on(table.phoneE164, table.purpose),
    index("phone_login_codes_email_purpose_idx").on(table.email, table.purpose),
    index("phone_login_codes_expires_at_idx").on(table.expiresAt),
    index("phone_login_codes_created_at_idx").on(table.createdAt),
  ],
);

export const passkeyCredentials = sqliteTable(
  "passkey_credentials",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    webauthnUserId: text("webauthn_user_id").notNull(),
    publicKey: text("public_key").notNull(),
    counter: integer("counter").notNull().default(0),
    transports: text("transports").notNull().default("[]"),
    deviceType: text("device_type").notNull(),
    backedUp: text("backed_up").notNull().default("no"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    lastUsedAt: text("last_used_at").notNull().default(""),
  },
  (table) => [
    index("passkey_credentials_email_role_idx").on(table.email, table.role),
    index("passkey_credentials_webauthn_user_id_idx").on(table.webauthnUserId),
    index("passkey_credentials_last_used_at_idx").on(table.lastUsedAt),
  ],
);

export const providerProfiles = sqliteTable(
  "provider_profiles",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    slug: text("slug").notNull(),
    businessName: text("business_name").notNull(),
    headline: text("headline").notNull().default(""),
    about: text("about").notNull().default(""),
    yearsExperience: text("years_experience").notNull().default(""),
    availabilityStatus: text("availability_status").notNull().default("Available now"),
    availabilityNote: text("availability_note").notNull().default(""),
    businessHours: text("business_hours").notNull().default(""),
    customerSuppliedPartsPolicy: text("customer_supplied_parts_policy")
      .notNull()
      .default("Discuss before accepting"),
    logoImageKey: text("logo_image_key").notNull().default(""),
    logoImageType: text("logo_image_type").notNull().default(""),
    publicStatus: text("public_status").notNull().default("draft"),
    qrScanCount: integer("qr_scan_count").notNull().default(0),
    profileViewCount: integer("profile_view_count").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("provider_profiles_provider_id_unique").on(table.providerId),
    uniqueIndex("provider_profiles_slug_unique").on(table.slug),
    index("provider_profiles_public_status_idx").on(table.publicStatus),
  ],
);

export const providerGalleryItems = sqliteTable(
  "provider_gallery_items",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    imageKey: text("image_key").notNull(),
    imageType: text("image_type").notNull(),
    caption: text("caption").notNull().default(""),
    service: text("service").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("provider_gallery_items_provider_id_idx").on(table.providerId),
    index("provider_gallery_items_created_at_idx").on(table.createdAt),
  ],
);

export const jobReviews = sqliteTable(
  "job_reviews",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    providerName: text("provider_name").notNull(),
    providerEmail: text("provider_email").notNull(),
    customerDisplayName: text("customer_display_name").notNull(),
    service: text("service").notNull(),
    rating: integer("rating").notNull(),
    comment: text("comment").notNull(),
    providerReply: text("provider_reply").notNull().default(""),
    providerReplyAt: text("provider_reply_at").notNull().default(""),
    status: text("status").notNull().default("published"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("job_reviews_request_id_unique").on(table.requestId),
    index("job_reviews_provider_email_idx").on(table.providerEmail),
    index("job_reviews_created_at_idx").on(table.createdAt),
    index("job_reviews_status_idx").on(table.status),
  ],
);

// A service-aware inspection checklist the accepted provider fills in on a job.
// Items are seeded from the job's service codes but fully editable; the customer
// sees them read-only on their request. status is 'pending' | 'good' | 'attention'.
export const jobInspectionItems = sqliteTable(
  "job_inspection_items",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    providerEmail: text("provider_email").notNull(),
    label: text("label").notNull(),
    status: text("status").notNull().default("pending"),
    note: text("note").notNull().default(""),
    position: integer("position").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("job_inspection_items_request_id_idx").on(table.requestId),
    index("job_inspection_items_provider_email_idx").on(table.providerEmail),
  ],
);

// A confirmed appointment time the accepted provider sets on a job. The customer
// sees it on their request; a cron sweep emails a reminder before it arrives.
export const jobAppointments = sqliteTable(
  "job_appointments",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    providerEmail: text("provider_email").notNull(),
    appointmentAt: text("appointment_at").notNull().default(""),
    note: text("note").notNull().default(""),
    reminderSentAt: text("reminder_sent_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("job_appointments_request_id_unique").on(table.requestId),
    index("job_appointments_reminder_idx").on(table.reminderSentAt),
  ],
);

export const customerProfiles = sqliteTable(
  "customer_profiles",
  {
    email: text("email").primaryKey(),
    displayName: text("display_name").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("customer_profiles_updated_at_idx").on(table.updatedAt),
  ],
);

export const savedProviders = sqliteTable(
  "saved_providers",
  {
    id: text("id").primaryKey(),
    customerEmail: text("customer_email").notNull(),
    providerId: text("provider_id").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("saved_providers_customer_provider_unique")
      .on(table.customerEmail, table.providerId),
    index("saved_providers_customer_email_idx").on(table.customerEmail),
    index("saved_providers_created_at_idx").on(table.createdAt),
  ],
);

/**
 * Vehicles a customer account has saved so a repeat or multi-vehicle customer
 * does not retype them. A fleet customer is simply an account with several of
 * these; the rows carry no pricing, routing, or eligibility meaning.
 */
export const customerVehicles = sqliteTable(
  "customer_vehicles",
  {
    id: text("id").primaryKey(),
    customerEmail: text("customer_email").notNull(),
    label: text("label").notNull().default(""),
    year: text("year").notNull().default(""),
    make: text("make").notNull(),
    model: text("model").notNull(),
    trim: text("trim").notNull().default(""),
    color: text("color").notNull().default(""),
    plate: text("plate").notNull().default(""),
    vin: text("vin").notNull().default(""),
    notes: text("notes").notNull().default(""),
    archived: text("archived").notNull().default("no"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("customer_vehicles_email_idx").on(table.customerEmail, table.archived),
    index("customer_vehicles_created_at_idx").on(table.createdAt),
  ],
);

/**
 * Private maintenance reminders a customer keeps for their own vehicles. The
 * due date and mileage are always customer-entered — Tuveloz never invents a
 * manufacturer interval — and a reminder never requests service, holds a
 * price, contacts a provider, or affects eligibility.
 */
export const customerServiceReminders = sqliteTable(
  "customer_service_reminders",
  {
    id: text("id").primaryKey(),
    customerEmail: text("customer_email").notNull(),
    vehicle: text("vehicle").notNull(),
    service: text("service").notNull(),
    dueDate: text("due_date").notNull().default(""),
    dueMileage: integer("due_mileage").notNull().default(0),
    currentMileage: integer("current_mileage").notNull().default(0),
    note: text("note").notNull().default(""),
    sourceRequestId: text("source_request_id").notNull().default(""),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("customer_service_reminders_email_status_idx")
      .on(table.customerEmail, table.status, table.dueDate),
    index("customer_service_reminders_source_idx").on(table.sourceRequestId),
  ],
);

/**
 * Businesses that want multi-vehicle service when the marketplace opens.
 * Recording interest is not an account, a contract, or a promise of service.
 */
export const fleetInquiries = sqliteTable(
  "fleet_inquiries",
  {
    id: text("id").primaryKey(),
    companyName: text("company_name").notNull(),
    contactName: text("contact_name").notNull(),
    email: text("email").notNull(),
    // Given for contact about this request. Promotional texts additionally
    // require the recorded opt-in below — see lib/phone-contact-consent.ts.
    contactPhone: text("contact_phone").notNull().default(""),
    smsMarketingConsentText: text("sms_marketing_consent_text").notNull().default(""),
    smsMarketingConsentVersion: text("sms_marketing_consent_version").notNull().default(""),
    smsMarketingConsentedAt: text("sms_marketing_consented_at").notNull().default(""),
    smsMarketingRevokedAt: text("sms_marketing_revoked_at").notNull().default(""),
    fleetSize: text("fleet_size").notNull(),
    vehicleTypes: text("vehicle_types").notNull().default(""),
    municipality: text("municipality").notNull().default(""),
    servicesNeeded: text("services_needed").notNull().default(""),
    notes: text("notes").notNull().default(""),
    status: text("status").notNull().default("new"),
    requestKey: text("request_key").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("fleet_inquiries_request_key_unique").on(table.requestKey),
    index("fleet_inquiries_status_idx").on(table.status, table.createdAt),
    index("fleet_inquiries_created_at_idx").on(table.createdAt),
  ],
);

/**
 * One share code per account. A referral is attribution only — it carries no
 * payment, no ranking weight, and no routing preference.
 */
export const referralCodes = sqliteTable(
  "referral_codes",
  {
    code: text("code").primaryKey(),
    ownerRole: text("owner_role").notNull(),
    ownerEmail: text("owner_email").notNull(),
    status: text("status").notNull().default("active"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("referral_codes_owner_unique").on(table.ownerRole, table.ownerEmail),
    index("referral_codes_status_idx").on(table.status),
  ],
);

/**
 * A signup credited to a share code. The referred person's email is stored
 * only as a one-way key for deduplication — the joined record itself is the
 * link the owner reviews, so a referrer never gains access to who signed up.
 */
export const referralSignups = sqliteTable(
  "referral_signups",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull(),
    referrerRole: text("referrer_role").notNull(),
    referrerEmail: text("referrer_email").notNull(),
    referredRole: text("referred_role").notNull(),
    referredEntityId: text("referred_entity_id").notNull().default(""),
    referredKey: text("referred_key").notNull(),
    status: text("status").notNull().default("recorded"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("referral_signups_referred_unique").on(table.referredRole, table.referredKey),
    index("referral_signups_code_idx").on(table.code, table.createdAt),
    index("referral_signups_referrer_idx").on(table.referrerRole, table.referrerEmail),
  ],
);

/**
 * The one place that answers "may Tuveloz send this person a promotional
 * text?" for every entry point. Transactional contact about someone's own
 * request never consults this table — see lib/phone-contact-consent.ts.
 */
export const phoneContactConsents = sqliteTable(
  "phone_contact_consents",
  {
    id: text("id").primaryKey(),
    role: text("role").notNull(),
    email: text("email").notNull(),
    phone: text("phone").notNull(),
    source: text("source").notNull().default(""),
    smsMarketingConsentText: text("sms_marketing_consent_text").notNull().default(""),
    smsMarketingConsentVersion: text("sms_marketing_consent_version").notNull().default(""),
    smsMarketingConsentedAt: text("sms_marketing_consented_at").notNull().default(""),
    smsMarketingRevokedAt: text("sms_marketing_revoked_at").notNull().default(""),
    revokeToken: text("revoke_token").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("phone_contact_consents_role_email_unique").on(table.role, table.email),
    uniqueIndex("phone_contact_consents_revoke_token_unique").on(table.revokeToken),
    index("phone_contact_consents_marketing_idx")
      .on(table.smsMarketingRevokedAt, table.smsMarketingConsentedAt),
  ],
);

export const jobMessages = sqliteTable(
  "job_messages",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    senderEmail: text("sender_email").notNull(),
    senderRole: text("sender_role").notNull(),
    recipientEmail: text("recipient_email").notNull(),
    body: text("body").notNull(),
    // Optional image attachment. imageKey is the R2 object; scanStatus is
    // '' for text-only messages, else 'pending' | 'clean' | 'blocked'. An image
    // is NEVER served or shown unless scanStatus is 'clean' (fail-closed).
    imageKey: text("image_key").notNull().default(""),
    imageType: text("image_type").notNull().default(""),
    scanStatus: text("scan_status").notNull().default(""),
    scanAttemptedAt: text("scan_attempted_at").notNull().default(""),
    scanAttemptCount: integer("scan_attempt_count").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("job_messages_request_created_idx").on(table.requestId, table.createdAt),
    index("job_messages_recipient_email_idx").on(table.recipientEmail),
    index("job_messages_sender_email_idx").on(table.senderEmail),
    index("job_messages_scan_status_idx").on(table.scanStatus),
    index("job_messages_scan_attempted_idx").on(table.scanStatus, table.scanAttemptedAt),
  ],
);

export const launchFeedback = sqliteTable(
  "launch_feedback",
  {
    id: text("id").primaryKey(),
    audience: text("audience").notNull(),
    featureWanted: text("feature_wanted").notNull(),
    problemToSolve: text("problem_to_solve").notNull(),
    trustBuilder: text("trust_builder").notNull(),
    email: text("email").notNull().default(""),
    status: text("status").notNull().default("new"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("launch_feedback_created_at_idx").on(table.createdAt),
    index("launch_feedback_audience_idx").on(table.audience),
  ],
);

export const analyticsEvents = sqliteTable(
  "analytics_events",
  {
    id: text("id").primaryKey(),
    event: text("event").notNull(),
    props: text("props").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("analytics_events_event_created_at_idx").on(table.event, table.createdAt),
  ],
);

export const expansionInterests = sqliteTable(
  "expansion_interests",
  {
    id: text("id").primaryKey(),
    audience: text("audience").notNull(),
    providerType: text("provider_type").notNull().default(""),
    locality: text("locality").notNull(),
    state: text("state").notNull(),
    email: text("email").notNull(),
    requestKey: text("request_key").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("expansion_interests_request_key_unique").on(table.requestKey),
    index("expansion_interests_created_at_idx").on(table.createdAt),
    index("expansion_interests_area_idx").on(table.state, table.locality),
    index("expansion_interests_audience_idx").on(table.audience),
  ],
);


export const emailNotificationOutbox = sqliteTable(
  "email_notification_outbox",
  {
    id: text("id").primaryKey(),
    eventKey: text("event_key").notNull(),
    recipientEmail: text("recipient_email").notNull(),
    subject: text("subject").notNull(),
    textBody: text("text_body").notNull(),
    status: text("status").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    sentAt: text("sent_at").notNull().default(""),
  },
  (table) => [
    uniqueIndex("email_notification_outbox_event_key_unique").on(table.eventKey),
    index("email_notification_outbox_status_created_idx").on(table.status, table.createdAt),
    index("email_notification_outbox_recipient_idx").on(table.recipientEmail),
  ],
);

/**
 * Pre-launch email list. Separate from every operational address the site
 * already holds, because consent to be emailed marketing is a different thing
 * from having applied or created an account — an applicant expects operational
 * mail about their application, not launch announcements.
 *
 * The consent text and version are stored verbatim alongside the timestamp, so
 * what someone actually agreed to can be produced later rather than inferred
 * from whatever the form says today.
 */
export const launchUpdateSubscribers = sqliteTable(
  "launch_update_subscribers",
  {
    // Normalized (trimmed, lowercased) email is the identity, so re-subscribing
    // updates one row instead of creating duplicates that would double-send.
    email: text("email").primaryKey(),
    source: text("source").notNull().default(""),
    language: text("language").notNull().default("en"),
    consentText: text("consent_text").notNull().default(""),
    consentVersion: text("consent_version").notNull().default(""),
    consentedAt: text("consented_at").notNull().default(""),
    // Unsubscribing keeps the row: an empty unsubscribedAt means subscribed.
    // Deleting would let a later re-import silently resurrect the address.
    unsubscribedAt: text("unsubscribed_at").notNull().default(""),
    unsubscribeToken: text("unsubscribe_token").notNull(),
    // Highest sequence step already queued for this subscriber. Steps only
    // ever move forward, so a re-run of the cron cannot re-send a step.
    lastStepSent: integer("last_step_sent").notNull().default(-1),
    lastStepSentAt: text("last_step_sent_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("launch_update_subscribers_token_unique").on(table.unsubscribeToken),
    index("launch_update_subscribers_step_idx").on(table.unsubscribedAt, table.lastStepSent),
  ],
);

export const providerPathwayProfiles = sqliteTable(
  "provider_pathway_profiles",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    providerPersonId: text("provider_person_id").notNull().default(""),
    relationshipPath: text("relationship_path").notNull(),
    providerLevel: text("provider_level").notNull(),
    sponsoringProviderId: text("sponsoring_provider_id").notNull().default(""),
    registrationHolderId: text("registration_holder_id").notNull().default(""),
    pathwayVersion: integer("pathway_version").notNull().default(1),
    status: text("status").notNull().default("pending"),
    policyVersion: text("policy_version").notNull(),
    holdReasonCodes: text("hold_reason_codes").notNull().default("[]"),
    noEmployeeAttestedAt: text("no_employee_attested_at").notNull().default(""),
    noEmployeeAttestationExpiresAt: text("no_employee_attestation_expires_at")
      .notNull()
      .default(""),
    effectiveAt: text("effective_at").notNull().default(""),
    validThrough: text("valid_through").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("provider_pathway_profiles_provider_version_unique")
      .on(table.providerId, table.pathwayVersion),
    index("provider_pathway_profiles_provider_status_idx")
      .on(table.providerId, table.status),
    index("provider_pathway_profiles_person_idx").on(table.providerPersonId),
    index("provider_pathway_profiles_sponsor_status_idx")
      .on(table.sponsoringProviderId, table.status),
    index("provider_pathway_profiles_valid_through_idx").on(table.validThrough),
  ],
);

export const providerPersonnel = sqliteTable(
  "provider_personnel",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    personId: text("person_id").notNull(),
    relationshipType: text("relationship_type").notNull(),
    personnelRole: text("personnel_role").notNull().default("technician"),
    providerLevel: text("provider_level").notNull().default(""),
    rosterVersion: integer("roster_version").notNull().default(1),
    status: text("status").notNull().default("pending"),
    identityVerifiedAt: text("identity_verified_at").notNull().default(""),
    ageVerifiedAt: text("age_verified_at").notNull().default(""),
    identityVerificationProvider: text("identity_verification_provider")
      .notNull()
      .default(""),
    identityVerificationReference: text("identity_verification_reference")
      .notNull()
      .default(""),
    identityVerificationCheckedAt: text("identity_verification_checked_at")
      .notNull()
      .default(""),
    identityVerificationValidThrough: text("identity_verification_valid_through")
      .notNull()
      .default(""),
    ageVerificationProvider: text("age_verification_provider")
      .notNull()
      .default(""),
    ageVerificationReference: text("age_verification_reference")
      .notNull()
      .default(""),
    ageVerificationCheckedAt: text("age_verification_checked_at")
      .notNull()
      .default(""),
    ageVerificationValidThrough: text("age_verification_valid_through")
      .notNull()
      .default(""),
    employmentStartedAt: text("employment_started_at").notNull().default(""),
    employmentEndedAt: text("employment_ended_at").notNull().default(""),
    // The sponsoring employer retains any I-9 or work-authorization documents.
    // TUVELOZ stores only attestation timestamps and never SSNs or document numbers.
    employerAttestedAt: text("employer_attested_at").notNull().default(""),
    workAuthorizationAttestedAt: text("work_authorization_attested_at")
      .notNull()
      .default(""),
    lawfulPayAttestedAt: text("lawful_pay_attested_at").notNull().default(""),
    employerAttestedByPersonId: text("employer_attested_by_person_id")
      .notNull()
      .default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("provider_personnel_provider_person_roster_version_unique")
      .on(table.providerId, table.personId, table.rosterVersion),
    index("provider_personnel_provider_status_idx").on(table.providerId, table.status),
    index("provider_personnel_provider_person_status_idx")
      .on(table.providerId, table.personId, table.status),
    index("provider_personnel_person_status_idx").on(table.personId, table.status),
    index("provider_personnel_employment_end_idx").on(table.employmentEndedAt),
  ],
);

/**
 * One row per Stripe Identity attempt. The row contains only Stripe and
 * TUVELOZ references plus non-sensitive decision state. Names, dates of birth,
 * document numbers, and document/selfie files are deliberately never stored.
 */
export const providerIdentityVerificationSessions = sqliteTable(
  "provider_identity_verification_sessions",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    personId: text("person_id").notNull(),
    applicationSubmissionEvidenceId: text("application_submission_evidence_id")
      .notNull(),
    personNameSourceType: text("person_name_source_type").notNull(),
    personNameSourceId: text("person_name_source_id").notNull(),
    accountSessionHash: text("account_session_hash").notNull(),
    certificationVersion: text("certification_version").notNull(),
    attemptNumber: integer("attempt_number").notNull(),
    stripeVerificationSessionId: text("stripe_verification_session_id")
      .notNull()
      .default(""),
    stripeVerificationReportId: text("stripe_verification_report_id")
      .notNull()
      .default(""),
    stripeStatus: text("stripe_status").notNull().default("creating"),
    decisionStatus: text("decision_status").notNull().default("pending"),
    failureCode: text("failure_code").notNull().default(""),
    livemode: integer("livemode").notNull().default(0),
    consentedAt: text("consented_at").notNull(),
    checkedAt: text("checked_at").notNull().default(""),
    verifiedAt: text("verified_at").notNull().default(""),
    redactedAt: text("redacted_at").notNull().default(""),
    lastStripeEventId: text("last_stripe_event_id").notNull().default(""),
    lastStripeEventCreated: integer("last_stripe_event_created").notNull().default(0),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("provider_identity_verification_stripe_session_unique")
      .on(table.stripeVerificationSessionId)
      .where(sql`${table.stripeVerificationSessionId} <> ''`),
    uniqueIndex("provider_identity_verification_attempt_unique")
      .on(
        table.providerId,
        table.personId,
        table.attemptNumber,
      ),
    uniqueIndex("provider_identity_verification_one_active_unique")
      .on(table.providerId, table.personId)
      .where(sql`${table.decisionStatus} = 'pending' and ${table.stripeStatus} in ('creating', 'requires_input', 'processing', 'verified')`),
    index("provider_identity_verification_provider_person_idx")
      .on(table.providerId, table.personId, table.createdAt),
    index("provider_identity_verification_application_evidence_idx")
      .on(table.applicationSubmissionEvidenceId),
    index("provider_identity_verification_status_idx")
      .on(table.decisionStatus, table.stripeStatus, table.updatedAt),
  ],
);

export const providerEvidenceSubmissions = sqliteTable(
  "provider_evidence_submissions",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    personId: text("person_id").notNull().default(""),
    requirementKey: text("requirement_key").notNull(),
    serviceCode: text("service_code").notNull().default(""),
    jurisdiction: text("jurisdiction").notNull(),
    evidenceType: text("evidence_type").notNull(),
    evidenceScope: text("evidence_scope").notNull().default("{}"),
    // Restricted evidence storage is for approved business, credential, and
    // insurance evidence only—not SSNs or work-authorization documents.
    storageKey: text("storage_key").notNull().default(""),
    contentType: text("content_type").notNull().default(""),
    documentHash: text("document_hash").notNull().default(""),
    issuer: text("issuer").notNull().default(""),
    sourceUrl: text("source_url").notNull().default(""),
    effectiveAt: text("effective_at").notNull().default(""),
    expiresAt: text("expires_at").notNull().default(""),
    status: text("status").notNull().default("pending"),
    submittedAt: text("submitted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    reviewedAt: text("reviewed_at").notNull().default(""),
    reviewedBy: text("reviewed_by").notNull().default(""),
    reviewDecisionId: text("review_decision_id").notNull().default(""),
    reasonCodes: text("reason_codes").notNull().default("[]"),
    reviewNotes: text("review_notes").notNull().default(""),
    authenticityVerificationMethod: text("authenticity_verification_method")
      .notNull()
      .default(""),
    authenticityVerifiedBy: text("authenticity_verified_by")
      .notNull()
      .default(""),
    authenticityVerificationReference: text("authenticity_verification_reference")
      .notNull()
      .default(""),
    authenticitySourceUrl: text("authenticity_source_url").notNull().default(""),
    authenticityVerifiedAt: text("authenticity_verified_at").notNull().default(""),
    authenticityValidThrough: text("authenticity_valid_through").notNull().default(""),
    supersedesEvidenceId: text("supersedes_evidence_id").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("provider_evidence_provider_requirement_status_idx")
      .on(table.providerId, table.requirementKey, table.status),
    index("provider_evidence_person_service_jurisdiction_idx")
      .on(table.personId, table.serviceCode, table.jurisdiction),
    index("provider_evidence_expiration_idx").on(table.expiresAt),
    index("provider_evidence_review_decision_idx").on(table.reviewDecisionId),
    index("provider_evidence_supersedes_idx").on(table.supersedesEvidenceId),
  ],
);

export const agreementAcceptances = sqliteTable(
  "agreement_acceptances",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    personId: text("person_id").notNull().default(""),
    jurisdiction: text("jurisdiction").notNull().default(""),
    agreementKey: text("agreement_key").notNull(),
    agreementVersion: text("agreement_version").notNull(),
    agreementHash: text("agreement_hash").notNull(),
    agreementText: text("agreement_text").notNull(),
    acceptedByName: text("accepted_by_name").notNull(),
    acceptedByTitle: text("accepted_by_title").notNull().default(""),
    acceptanceAction: text("acceptance_action").notNull().default("affirmative-checkbox"),
    acceptedAt: text("accepted_at").notNull(),
    ipAddress: text("ip_address").notNull().default(""),
    sessionId: text("session_id").notNull().default(""),
    deviceContext: text("device_context").notNull().default("{}"),
    providerApplicationSubmissionEvidenceId: text(
      "provider_application_submission_evidence_id",
    ).notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("agreement_acceptances_provider_person_jurisdiction_key_version_unique")
      .on(
        table.providerId,
        table.personId,
        table.jurisdiction,
        table.agreementKey,
        table.agreementVersion,
      ),
    index("agreement_acceptances_provider_time_idx").on(table.providerId, table.acceptedAt),
    index("agreement_acceptances_person_time_idx").on(table.personId, table.acceptedAt),
    index("agreement_acceptances_key_version_idx")
      .on(table.agreementKey, table.agreementVersion),
    index("agreement_acceptances_provider_application_submission_idx")
      .on(table.providerApplicationSubmissionEvidenceId),
  ],
);

export const providerServiceEligibility = sqliteTable(
  "provider_service_eligibility",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    personId: text("person_id").notNull().default(""),
    serviceCode: text("service_code").notNull(),
    jurisdiction: text("jurisdiction").notNull(),
    relationshipPath: text("relationship_path").notNull(),
    providerLevel: text("provider_level").notNull(),
    eligibilityState: text("eligibility_state").notNull().default("blocked"),
    reasonCodes: text("reason_codes").notNull().default("[]"),
    requirementVersions: text("requirement_versions").notNull().default("{}"),
    evidenceDecisionIds: text("evidence_decision_ids").notNull().default("[]"),
    rulesEngineVersion: text("rules_engine_version").notNull(),
    policyVersion: text("policy_version").notNull(),
    calculatedAt: text("calculated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    validThrough: text("valid_through").notNull().default(""),
    nextExpirationAt: text("next_expiration_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("provider_service_eligibility_provider_person_service_jurisdiction_unique")
      .on(table.providerId, table.personId, table.serviceCode, table.jurisdiction),
    index("provider_service_eligibility_provider_state_idx")
      .on(table.providerId, table.eligibilityState),
    index("provider_service_eligibility_person_state_idx")
      .on(table.personId, table.eligibilityState),
    index("provider_service_eligibility_service_jurisdiction_state_idx")
      .on(table.serviceCode, table.jurisdiction, table.eligibilityState),
    index("provider_service_eligibility_valid_through_idx").on(table.validThrough),
  ],
);

export const serviceActivationDecisions = sqliteTable(
  "service_activation_decisions",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    personId: text("person_id").notNull().default(""),
    serviceCode: text("service_code").notNull(),
    jurisdiction: text("jurisdiction").notNull(),
    stage: text("stage").notNull(),
    decisionVersion: integer("decision_version").notNull().default(1),
    decision: text("decision").notNull(),
    eligibilityId: text("eligibility_id").notNull().default(""),
    reasonCodes: text("reason_codes").notNull().default("[]"),
    requirementVersions: text("requirement_versions").notNull().default("{}"),
    evidenceDecisionIds: text("evidence_decision_ids").notNull().default("[]"),
    jobContext: text("job_context").notNull().default("{}"),
    policyVersion: text("policy_version").notNull(),
    rulesEngineVersion: text("rules_engine_version").notNull(),
    decisionSource: text("decision_source").notNull().default("rules-engine"),
    decidedBy: text("decided_by").notNull().default("system"),
    decidedAt: text("decided_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    validThrough: text("valid_through").notNull().default(""),
    supersedesDecisionId: text("supersedes_decision_id").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("service_activation_provider_person_service_jurisdiction_stage_version_unique")
      .on(
        table.providerId,
        table.personId,
        table.serviceCode,
        table.jurisdiction,
        table.stage,
        table.decisionVersion,
      ),
    index("service_activation_lookup_idx")
      .on(table.providerId, table.personId, table.serviceCode, table.jurisdiction, table.stage),
    index("service_activation_eligibility_idx").on(table.eligibilityId),
    index("service_activation_decided_at_idx").on(table.decidedAt),
    index("service_activation_valid_through_idx").on(table.validThrough),
  ],
);

export const jobScopeVersions = sqliteTable(
  "job_scope_versions",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    quoteId: text("quote_id").notNull().default(""),
    version: integer("version").notNull(),
    serviceCodes: text("service_codes").notNull().default("[]"),
    jurisdiction: text("jurisdiction").notNull(),
    scheduledFor: text("scheduled_for").notNull().default(""),
    scopeDetails: text("scope_details").notNull().default("{}"),
    priceBreakdown: text("price_breakdown").notNull().default("{}"),
    partsResponsibility: text("parts_responsibility").notNull().default(""),
    changeReason: text("change_reason").notNull().default(""),
    createdByProviderId: text("created_by_provider_id").notNull().default(""),
    createdByPersonId: text("created_by_person_id").notNull().default(""),
    providerApprovedAt: text("provider_approved_at").notNull().default(""),
    customerAuthorizedAt: text("customer_authorized_at").notNull().default(""),
    authorizationDecisionId: text("authorization_decision_id").notNull().default(""),
    supersedesScopeVersionId: text("supersedes_scope_version_id").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("job_scope_versions_request_version_unique").on(table.requestId, table.version),
    index("job_scope_versions_quote_idx").on(table.quoteId),
    index("job_scope_versions_authorization_decision_idx").on(table.authorizationDecisionId),
    index("job_scope_versions_scheduled_for_idx").on(table.scheduledFor),
    index("job_scope_versions_created_at_idx").on(table.createdAt),
  ],
);

export const supervisionCheckpoints = sqliteTable(
  "supervision_checkpoints",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    scopeVersion: integer("scope_version").notNull(),
    providerId: text("provider_id").notNull(),
    performingPersonId: text("performing_person_id").notNull(),
    supervisorPersonId: text("supervisor_person_id").notNull(),
    serviceCodes: text("service_codes").notNull().default("[]"),
    jurisdiction: text("jurisdiction").notNull(),
    checkpointType: text("checkpoint_type").notNull(),
    checkpointSequence: integer("checkpoint_sequence").notNull().default(1),
    supervisionLevel: text("supervision_level").notNull(),
    performingPersonCheckedInAt: text("performing_person_checked_in_at")
      .notNull()
      .default(""),
    supervisorCheckedInAt: text("supervisor_checked_in_at").notNull().default(""),
    locationResult: text("location_result").notNull().default(""),
    coLocationResult: text("co_location_result").notNull().default(""),
    abilityToInterveneAttestedAt: text("ability_to_intervene_attested_at")
      .notNull()
      .default(""),
    supervisorAttestedAt: text("supervisor_attested_at").notNull().default(""),
    checkpointData: text("checkpoint_data").notNull().default("{}"),
    notes: text("notes").notNull().default(""),
    occurredAt: text("occurred_at").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("supervision_checkpoints_request_scope_type_sequence_unique")
      .on(table.requestId, table.scopeVersion, table.checkpointType, table.checkpointSequence),
    index("supervision_checkpoints_provider_request_idx")
      .on(table.providerId, table.requestId),
    index("supervision_checkpoints_performing_person_idx").on(table.performingPersonId),
    index("supervision_checkpoints_supervisor_idx").on(table.supervisorPersonId),
    index("supervision_checkpoints_occurred_at_idx").on(table.occurredAt),
  ],
);

export const jobAuthorizationSnapshots = sqliteTable(
  "job_authorization_snapshots",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    quoteId: text("quote_id").notNull().default(""),
    stage: text("stage").notNull(),
    scopeVersion: integer("scope_version").notNull(),
    assignmentVersion: integer("assignment_version").notNull().default(0),
    decisionVersion: integer("decision_version").notNull().default(1),
    providerId: text("provider_id").notNull(),
    performingPersonId: text("performing_person_id").notNull(),
    supervisorPersonId: text("supervisor_person_id").notNull().default(""),
    serviceCodes: text("service_codes").notNull().default("[]"),
    jurisdiction: text("jurisdiction").notNull(),
    scheduledFor: text("scheduled_for").notNull().default(""),
    decision: text("decision").notNull(),
    reasonCodes: text("reason_codes").notNull().default("[]"),
    eligibilitySnapshotIds: text("eligibility_snapshot_ids").notNull().default("[]"),
    serviceActivationDecisionIds: text("service_activation_decision_ids")
      .notNull()
      .default("[]"),
    evidenceDecisionIds: text("evidence_decision_ids").notNull().default("[]"),
    supervisionCheckpointIds: text("supervision_checkpoint_ids").notNull().default("[]"),
    agreementVersions: text("agreement_versions").notNull().default("{}"),
    insuranceCoverageDeterminationId: text("insurance_coverage_determination_id")
      .notNull()
      .default(""),
    locationRuleResult: text("location_rule_result").notNull().default(""),
    scopeCheckResult: text("scope_check_result").notNull().default(""),
    jobControlProfile: text("job_control_profile").notNull().default("{}"),
    customerProviderDisclosureAcceptedAt: text("customer_provider_disclosure_accepted_at")
      .notNull()
      .default(""),
    policyVersion: text("policy_version").notNull(),
    rulesEngineVersion: text("rules_engine_version").notNull(),
    decidedAt: text("decided_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    validThrough: text("valid_through").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("job_authorization_request_stage_scope_assignment_decision_unique")
      .on(
        table.requestId,
        table.stage,
        table.scopeVersion,
        table.assignmentVersion,
        table.decisionVersion,
      ),
    index("job_authorization_provider_stage_idx").on(table.providerId, table.stage),
    index("job_authorization_performer_schedule_idx")
      .on(table.performingPersonId, table.scheduledFor),
    index("job_authorization_supervisor_idx").on(table.supervisorPersonId),
    index("job_authorization_decision_validity_idx")
      .on(table.decision, table.validThrough),
    index("job_authorization_quote_idx").on(table.quoteId),
  ],
);

export const providerAuditEvents = sqliteTable(
  "provider_audit_events",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    personId: text("person_id").notNull().default(""),
    requestId: text("request_id").notNull().default(""),
    serviceCode: text("service_code").notNull().default(""),
    jurisdiction: text("jurisdiction").notNull().default(""),
    eventType: text("event_type").notNull(),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    eventVersion: integer("event_version").notNull().default(1),
    actorType: text("actor_type").notNull(),
    actorId: text("actor_id").notNull(),
    outcome: text("outcome").notNull(),
    reasonCodes: text("reason_codes").notNull().default("[]"),
    metadata: text("metadata").notNull().default("{}"),
    policyVersion: text("policy_version").notNull().default(""),
    previousEventHash: text("previous_event_hash").notNull().default(""),
    eventHash: text("event_hash").notNull(),
    occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("provider_audit_events_event_hash_unique").on(table.eventHash),
    index("provider_audit_events_provider_time_idx").on(table.providerId, table.occurredAt),
    index("provider_audit_events_person_time_idx").on(table.personId, table.occurredAt),
    index("provider_audit_events_request_time_idx").on(table.requestId, table.occurredAt),
    index("provider_audit_events_entity_idx").on(table.entityType, table.entityId),
    index("provider_audit_events_type_time_idx").on(table.eventType, table.occurredAt),
    index("provider_audit_events_service_jurisdiction_idx")
      .on(table.serviceCode, table.jurisdiction),
  ],
);

export const providerAppeals = sqliteTable(
  "provider_appeals",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    evidenceSubmissionId: text("evidence_submission_id").notNull().default(""),
    serviceCode: text("service_code").notNull().default(""),
    appealType: text("appeal_type").notNull(),
    reason: text("reason").notNull(),
    supportingEvidenceIds: text("supporting_evidence_ids").notNull().default("[]"),
    status: text("status").notNull().default("submitted"),
    submittedByEmail: text("submitted_by_email").notNull(),
    submittedAt: text("submitted_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    dueAt: text("due_at").notNull().default(""),
    reviewedBy: text("reviewed_by").notNull().default(""),
    reviewedAt: text("reviewed_at").notNull().default(""),
    decision: text("decision").notNull().default(""),
    decisionReason: text("decision_reason").notNull().default(""),
    resolutionNotes: text("resolution_notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("provider_appeals_provider_status_idx").on(table.providerId, table.status),
    index("provider_appeals_evidence_idx").on(table.evidenceSubmissionId),
    index("provider_appeals_service_idx").on(table.serviceCode),
    index("provider_appeals_status_due_idx").on(table.status, table.dueAt),
  ],
);

export const dataRightsRequests = sqliteTable(
  "data_rights_requests",
  {
    id: text("id").primaryKey(),
    requesterEmail: text("requester_email").notNull(),
    requesterRole: text("requester_role").notNull(),
    providerId: text("provider_id").notNull().default(""),
    requestType: text("request_type").notNull(),
    scope: text("scope").notNull().default("account_and_documents"),
    details: text("details").notNull().default(""),
    identityVerificationStatus: text("identity_verification_status")
      .notNull()
      .default("account_session_verified"),
    status: text("status").notNull().default("submitted"),
    receivedAt: text("received_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    dueAt: text("due_at").notNull().default(""),
    legalHold: text("legal_hold").notNull().default("no"),
    resolvedAt: text("resolved_at").notNull().default(""),
    resolvedBy: text("resolved_by").notNull().default(""),
    responseSummary: text("response_summary").notNull().default(""),
    deletionCompletedAt: text("deletion_completed_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("data_rights_requester_time_idx").on(table.requesterEmail, table.receivedAt),
    index("data_rights_provider_status_idx").on(table.providerId, table.status),
    index("data_rights_status_due_idx").on(table.status, table.dueAt),
    index("data_rights_type_status_idx").on(table.requestType, table.status),
  ],
);

export const complianceReminders = sqliteTable(
  "compliance_reminders",
  {
    id: text("id").primaryKey(),
    providerId: text("provider_id").notNull(),
    evidenceSubmissionId: text("evidence_submission_id").notNull().default(""),
    serviceCode: text("service_code").notNull().default(""),
    reminderType: text("reminder_type").notNull(),
    dueAt: text("due_at").notNull(),
    channel: text("channel").notNull().default("email"),
    recipientEmail: text("recipient_email").notNull(),
    status: text("status").notNull().default("scheduled"),
    scheduledAt: text("scheduled_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    sentAt: text("sent_at").notNull().default(""),
    lastAttemptAt: text("last_attempt_at").notNull().default(""),
    attempts: integer("attempts").notNull().default(0),
    eventKey: text("event_key").notNull(),
    metadata: text("metadata").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("compliance_reminders_event_key_unique").on(table.eventKey),
    index("compliance_reminders_provider_due_idx").on(table.providerId, table.dueAt),
    index("compliance_reminders_status_due_idx").on(table.status, table.dueAt),
    index("compliance_reminders_evidence_idx").on(table.evidenceSubmissionId),
  ],
);

export const evidenceFileScans = sqliteTable(
  "evidence_file_scans",
  {
    id: text("id").primaryKey(),
    evidenceSubmissionId: text("evidence_submission_id").notNull(),
    providerId: text("provider_id").notNull(),
    scanProvider: text("scan_provider").notNull().default("manual_external_review"),
    scanEngineVersion: text("scan_engine_version").notNull().default(""),
    status: text("status").notNull().default("pending"),
    threatName: text("threat_name").notNull().default(""),
    fileHash: text("file_hash").notNull(),
    requestedAt: text("requested_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    completedAt: text("completed_at").notNull().default(""),
    reviewedBy: text("reviewed_by").notNull().default(""),
    reviewNotes: text("review_notes").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("evidence_file_scans_evidence_status_idx")
      .on(table.evidenceSubmissionId, table.status),
    index("evidence_file_scans_provider_status_idx").on(table.providerId, table.status),
    index("evidence_file_scans_requested_at_idx").on(table.requestedAt),
  ],
);

export const customerAgreementAcceptances = sqliteTable(
  "customer_agreement_acceptances",
  {
    id: text("id").primaryKey(),
    customerEmail: text("customer_email").notNull(),
    requestId: text("request_id").notNull().default(""),
    quoteId: text("quote_id").notNull().default(""),
    scopeVersion: integer("scope_version").notNull().default(0),
    scopeSnapshot: text("scope_snapshot").notNull().default("{}"),
    agreementKey: text("agreement_key").notNull(),
    agreementVersion: text("agreement_version").notNull(),
    agreementHash: text("agreement_hash").notNull(),
    agreementText: text("agreement_text").notNull(),
    acceptedByName: text("accepted_by_name").notNull(),
    acceptanceAction: text("acceptance_action").notNull().default("affirmative-checkbox"),
    acceptedAt: text("accepted_at").notNull(),
    ipAddress: text("ip_address").notNull().default(""),
    sessionId: text("session_id").notNull().default(""),
    deviceContext: text("device_context").notNull().default("{}"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("customer_agreement_request_quote_key_version_scope_unique")
      .on(
        table.requestId,
        table.quoteId,
        table.agreementKey,
        table.agreementVersion,
        table.scopeVersion,
      ),
    index("customer_agreement_customer_time_idx").on(table.customerEmail, table.acceptedAt),
    index("customer_agreement_request_idx").on(table.requestId),
    index("customer_agreement_quote_idx").on(table.quoteId),
  ],
);

export const jobLifecycleEvents = sqliteTable(
  "job_lifecycle_events",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    quoteId: text("quote_id").notNull().default(""),
    providerId: text("provider_id").notNull().default(""),
    actorRole: text("actor_role").notNull(),
    actorId: text("actor_id").notNull(),
    eventType: text("event_type").notNull(),
    fromStatus: text("from_status").notNull().default(""),
    toStatus: text("to_status").notNull().default(""),
    scopeVersion: integer("scope_version").notNull().default(0),
    authorizationSnapshotId: text("authorization_snapshot_id").notNull().default(""),
    reasonCode: text("reason_code").notNull().default(""),
    details: text("details").notNull().default("{}"),
    previousEventHash: text("previous_event_hash").notNull().default(""),
    eventHash: text("event_hash").notNull(),
    occurredAt: text("occurred_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("job_lifecycle_events_hash_unique").on(table.eventHash),
    index("job_lifecycle_request_time_idx").on(table.requestId, table.occurredAt),
    index("job_lifecycle_provider_time_idx").on(table.providerId, table.occurredAt),
    index("job_lifecycle_type_time_idx").on(table.eventType, table.occurredAt),
  ],
);

export const jobCancellations = sqliteTable(
  "job_cancellations",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    quoteId: text("quote_id").notNull().default(""),
    requestedByRole: text("requested_by_role").notNull(),
    requestedByEmail: text("requested_by_email").notNull(),
    cancellationType: text("cancellation_type").notNull(),
    reason: text("reason").notNull(),
    status: text("status").notNull().default("submitted"),
    scheduledFor: text("scheduled_for").notNull().default(""),
    requestedAt: text("requested_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    noticeHours: integer("notice_hours").notNull().default(0),
    providerTravelStarted: text("provider_travel_started").notNull().default("no"),
    partsCommittedCents: integer("parts_committed_cents").notNull().default(0),
    workPerformedCents: integer("work_performed_cents").notNull().default(0),
    proposedRefundCents: integer("proposed_refund_cents").notNull().default(0),
    retainedAmountCents: integer("retained_amount_cents").notNull().default(0),
    decisionBy: text("decision_by").notNull().default(""),
    decisionAt: text("decision_at").notNull().default(""),
    decisionReason: text("decision_reason").notNull().default(""),
    paymentAdjustmentId: text("payment_adjustment_id").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("job_cancellations_request_status_idx").on(table.requestId, table.status),
    index("job_cancellations_requested_at_idx").on(table.requestedAt),
    index("job_cancellations_type_status_idx").on(table.cancellationType, table.status),
  ],
);

export const jobIncidents = sqliteTable(
  "job_incidents",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    quoteId: text("quote_id").notNull().default(""),
    providerId: text("provider_id").notNull().default(""),
    reporterRole: text("reporter_role").notNull(),
    reporterEmail: text("reporter_email").notNull(),
    incidentType: text("incident_type").notNull(),
    severity: text("severity").notNull(),
    summary: text("summary").notNull(),
    occurredAt: text("occurred_at").notNull(),
    locationSummary: text("location_summary").notNull().default(""),
    injuryReported: text("injury_reported").notNull().default("no"),
    propertyDamageReported: text("property_damage_reported").notNull().default("no"),
    emergencyServicesContacted: text("emergency_services_contacted").notNull().default("no"),
    workStoppedAt: text("work_stopped_at").notNull().default(""),
    insurerNotifiedAt: text("insurer_notified_at").notNull().default(""),
    evidenceReferences: text("evidence_references").notNull().default("[]"),
    status: text("status").notNull().default("open"),
    holdPayments: text("hold_payments").notNull().default("yes"),
    assignedTo: text("assigned_to").notNull().default(""),
    resolution: text("resolution").notNull().default(""),
    resolvedAt: text("resolved_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("job_incidents_request_status_idx").on(table.requestId, table.status),
    index("job_incidents_provider_status_idx").on(table.providerId, table.status),
    index("job_incidents_severity_status_idx").on(table.severity, table.status),
    index("job_incidents_occurred_at_idx").on(table.occurredAt),
  ],
);

export const jobChangeOrders = sqliteTable(
  "job_change_orders",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    quoteId: text("quote_id").notNull().default(""),
    priorScopeVersion: integer("prior_scope_version").notNull(),
    proposedScopeVersion: integer("proposed_scope_version").notNull(),
    serviceCodes: text("service_codes").notNull().default("[]"),
    scopeDetails: text("scope_details").notNull().default("{}"),
    priceBreakdown: text("price_breakdown").notNull().default("{}"),
    reason: text("reason").notNull(),
    requestedByProviderId: text("requested_by_provider_id").notNull(),
    requestedByPersonId: text("requested_by_person_id").notNull().default(""),
    status: text("status").notNull().default("pending_customer"),
    providerApprovedAt: text("provider_approved_at").notNull().default(""),
    customerAuthorizedAt: text("customer_authorized_at").notNull().default(""),
    customerDeclinedAt: text("customer_declined_at").notNull().default(""),
    authorizationSnapshotId: text("authorization_snapshot_id").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("job_change_orders_request_scope_unique")
      .on(table.requestId, table.proposedScopeVersion),
    index("job_change_orders_request_status_idx").on(table.requestId, table.status),
    index("job_change_orders_provider_status_idx")
      .on(table.requestedByProviderId, table.status),
  ],
);

export const providerInvoices = sqliteTable(
  "provider_invoices",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    quoteId: text("quote_id").notNull().default(""),
    providerId: text("provider_id").notNull(),
    invoiceNumber: text("invoice_number").notNull(),
    scopeVersion: integer("scope_version").notNull(),
    serviceCodes: text("service_codes").notNull().default("[]"),
    laborAmountCents: integer("labor_amount_cents").notNull().default(0),
    partsAmountCents: integer("parts_amount_cents").notNull().default(0),
    taxAmountCents: integer("tax_amount_cents").notNull().default(0),
    otherAmountCents: integer("other_amount_cents").notNull().default(0),
    totalAmountCents: integer("total_amount_cents").notNull().default(0),
    partsDescription: text("parts_description").notNull().default(""),
    returnedPartsChoice: text("returned_parts_choice").notNull().default("not_recorded"),
    warrantyProvider: text("warranty_provider").notNull().default("provider_business"),
    warrantyTerms: text("warranty_terms").notNull().default(""),
    workSummary: text("work_summary").notNull(),
    status: text("status").notNull().default("draft"),
    issuedAt: text("issued_at").notNull().default(""),
    customerViewedAt: text("customer_viewed_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("provider_invoices_provider_number_unique")
      .on(table.providerId, table.invoiceNumber),
    uniqueIndex("provider_invoices_request_scope_unique")
      .on(table.requestId, table.scopeVersion),
    index("provider_invoices_request_status_idx").on(table.requestId, table.status),
    index("provider_invoices_provider_status_idx").on(table.providerId, table.status),
  ],
);

export const paymentAdjustments = sqliteTable(
  "payment_adjustments",
  {
    id: text("id").primaryKey(),
    paymentId: text("payment_id").notNull().default(""),
    requestId: text("request_id").notNull(),
    quoteId: text("quote_id").notNull().default(""),
    adjustmentType: text("adjustment_type").notNull(),
    amountCents: integer("amount_cents").notNull(),
    currency: text("currency").notNull().default("usd"),
    status: text("status").notNull().default("requested"),
    reasonCode: text("reason_code").notNull(),
    details: text("details").notNull().default("{}"),
    requestedByRole: text("requested_by_role").notNull(),
    requestedById: text("requested_by_id").notNull(),
    requestedAt: text("requested_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    decidedBy: text("decided_by").notNull().default(""),
    decidedAt: text("decided_at").notNull().default(""),
    providerImpactCents: integer("provider_impact_cents").notNull().default(0),
    customerImpactCents: integer("customer_impact_cents").notNull().default(0),
    stripeRefundId: text("stripe_refund_id").notNull().default(""),
    stripeDisputeId: text("stripe_dispute_id").notNull().default(""),
    transferReversalId: text("transfer_reversal_id").notNull().default(""),
    idempotencyKey: text("idempotency_key").notNull(),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("payment_adjustments_idempotency_unique").on(table.idempotencyKey),
    index("payment_adjustments_request_status_idx").on(table.requestId, table.status),
    index("payment_adjustments_payment_idx").on(table.paymentId),
    index("payment_adjustments_type_status_idx").on(table.adjustmentType, table.status),
  ],
);

export const launchGateDecisions = sqliteTable(
  "launch_gate_decisions",
  {
    id: text("id").primaryKey(),
    gateKey: text("gate_key").notNull(),
    gateVersion: integer("gate_version").notNull().default(1),
    category: text("category").notNull(),
    serviceCode: text("service_code").notNull().default(""),
    jurisdiction: text("jurisdiction").notNull().default(""),
    status: text("status").notNull().default("pending"),
    required: text("required").notNull().default("yes"),
    evidenceReference: text("evidence_reference").notNull().default(""),
    approvedBy: text("approved_by").notNull().default(""),
    approvedAt: text("approved_at").notNull().default(""),
    validThrough: text("valid_through").notNull().default(""),
    notes: text("notes").notNull().default(""),
    decidedBy: text("decided_by").notNull().default(""),
    supersedesDecisionId: text("supersedes_decision_id").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("launch_gate_key_version_unique").on(table.gateKey, table.gateVersion),
    index("launch_gate_category_status_idx").on(table.category, table.status),
    index("launch_gate_service_jurisdiction_status_idx")
      .on(table.serviceCode, table.jurisdiction, table.status),
    index("launch_gate_valid_through_idx").on(table.validThrough),
  ],
);

// These tables originated as hand-authored production migrations (0033-0035).
// Keeping them in the Drizzle schema prevents future generated migrations from
// treating the deployed tables as schema drift.
export const jobAuthorizations = sqliteTable(
  "job_authorizations",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    sourceQuoteId: text("source_quote_id").notNull().default(""),
    providerEmail: text("provider_email").notNull(),
    providerName: text("provider_name").notNull(),
    customerEmail: text("customer_email").notNull(),
    authorizationType: text("authorization_type").notNull(),
    title: text("title").notNull(),
    description: text("description").notNull(),
    laborCents: integer("labor_cents").notNull().default(0),
    partsCents: integer("parts_cents").notNull().default(0),
    otherFeesCents: integer("other_fees_cents").notNull().default(0),
    totalCents: integer("total_cents").notNull().default(0),
    estimatedCompletionAt: text("estimated_completion_at").notNull().default(""),
    diagnosticOnly: text("diagnostic_only").notNull().default("no"),
    workmanshipWarranty: text("workmanship_warranty").notNull().default(""),
    partsWarranty: text("parts_warranty").notNull().default(""),
    replacedPartsReturn: text("replaced_parts_return").notNull().default("not-requested"),
    status: text("status").notNull().default("pending"),
    providerTermsVersion: text("provider_terms_version").notNull().default(""),
    customerTermsVersion: text("customer_terms_version").notNull().default(""),
    supersedesAuthorizationId: text("supersedes_authorization_id").notNull().default(""),
    responseNote: text("response_note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    respondedAt: text("responded_at").notNull().default(""),
    withdrawnAt: text("withdrawn_at").notNull().default(""),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("job_authorizations_request_created_idx").on(table.requestId, table.createdAt),
    index("job_authorizations_provider_status_idx").on(table.providerEmail, table.status),
    index("job_authorizations_customer_status_idx").on(table.customerEmail, table.status),
    uniqueIndex("job_authorizations_source_quote_unique")
      .on(table.sourceQuoteId)
      .where(sql`${table.sourceQuoteId} <> ''`),
    check(
      "job_authorizations_authorization_type_check",
      sql`${table.authorizationType} in ('accepted-quote', 'work-order', 'change-order', 'diagnostic-follow-up', 'scope-update')`,
    ),
    check(
      "job_authorizations_status_check",
      sql`${table.status} in ('pending', 'accepted', 'declined', 'withdrawn', 'superseded')`,
    ),
    check(
      "job_authorizations_diagnostic_only_check",
      sql`${table.diagnosticOnly} in ('yes', 'no')`,
    ),
    check(
      "job_authorizations_replaced_parts_return_check",
      sql`${table.replacedPartsReturn} in ('requested', 'not-requested', 'not-applicable')`,
    ),
    check("job_authorizations_labor_cents_check", sql`${table.laborCents} >= 0`),
    check("job_authorizations_parts_cents_check", sql`${table.partsCents} >= 0`),
    check("job_authorizations_other_fees_cents_check", sql`${table.otherFeesCents} >= 0`),
    check(
      "job_authorizations_total_cents_check",
      sql`${table.totalCents} = ${table.laborCents} + ${table.partsCents} + ${table.otherFeesCents}`,
    ),
  ],
);

export const jobAuthorizationEvents = sqliteTable(
  "job_authorization_events",
  {
    id: text("id").primaryKey(),
    authorizationId: text("authorization_id").notNull(),
    requestId: text("request_id").notNull(),
    actorEmail: text("actor_email").notNull(),
    actorRole: text("actor_role").notNull(),
    action: text("action").notNull(),
    note: text("note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("job_authorization_events_authorization_idx")
      .on(table.authorizationId, table.createdAt),
    index("job_authorization_events_request_idx").on(table.requestId, table.createdAt),
    check(
      "job_authorization_events_actor_role_check",
      sql`${table.actorRole} in ('customer', 'provider', 'system')`,
    ),
  ],
);

export const accountCommunicationPreferences = sqliteTable(
  "account_communication_preferences",
  {
    email: text("email").notNull(),
    role: text("role").notNull(),
    marketingEmail: text("marketing_email").notNull().default("no"),
    productUpdateEmail: text("product_update_email").notNull().default("no"),
    optionalReminderEmail: text("optional_reminder_email").notNull().default("yes"),
    // Scoped to "customer requests are open, plus essential launch updates".
    // Separate from marketingEmail on purpose — this consent does not extend
    // to a broader marketing list, and revoking either must not touch the
    // other. The provenance columns record when, against which policy bundle
    // version, and from which surface the consent was given.
    launchNotificationEmail: text("launch_notification_email").notNull().default("no"),
    launchNotificationConsentAt: text("launch_notification_consent_at").notNull().default(""),
    launchNotificationConsentVersion: text("launch_notification_consent_version").notNull().default(""),
    launchNotificationConsentSource: text("launch_notification_consent_source").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    primaryKey({ columns: [table.email, table.role] }),
    index("account_communication_preferences_updated_idx").on(table.updatedAt),
    check(
      "account_communication_preferences_role_check",
      sql`${table.role} in ('customer', 'provider')`,
    ),
    check(
      "account_communication_preferences_marketing_email_check",
      sql`${table.marketingEmail} in ('yes', 'no')`,
    ),
    check(
      "account_communication_preferences_product_update_email_check",
      sql`${table.productUpdateEmail} in ('yes', 'no')`,
    ),
    check(
      "account_communication_preferences_optional_reminder_email_check",
      sql`${table.optionalReminderEmail} in ('yes', 'no')`,
    ),
  ],
);

export const privacyRequests = sqliteTable(
  "privacy_requests",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    role: text("role").notNull(),
    requestType: text("request_type").notNull(),
    relatedRequestId: text("related_request_id").notNull().default(""),
    details: text("details").notNull().default(""),
    status: text("status").notNull().default("submitted"),
    identitySource: text("identity_source").notNull().default("signed-in-account"),
    resolutionNote: text("resolution_note").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    resolvedAt: text("resolved_at").notNull().default(""),
  },
  (table) => [
    index("privacy_requests_account_created_idx").on(table.email, table.role, table.createdAt),
    index("privacy_requests_status_created_idx").on(table.status, table.createdAt),
    uniqueIndex("privacy_requests_one_active_type_unique")
      .on(table.email, table.role, table.requestType)
      .where(sql`${table.status} in ('submitted', 'in-review')`),
    check("privacy_requests_role_check", sql`${table.role} in ('customer', 'provider')`),
    check(
      "privacy_requests_request_type_check",
      sql`${table.requestType} in ('access', 'correction', 'account-closure', 'limit-processing', 'opt-out', 'appeal')`,
    ),
    check(
      "privacy_requests_status_check",
      sql`${table.status} in ('submitted', 'in-review', 'completed', 'denied', 'withdrawn')`,
    ),
    check(
      "privacy_requests_identity_source_check",
      sql`${table.identitySource} in ('signed-in-account', 'support-verified')`,
    ),
  ],
);

export const jobEvidenceItems = sqliteTable(
  "job_evidence_items",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    providerEmail: text("provider_email").notNull(),
    customerEmail: text("customer_email").notNull(),
    uploadedByEmail: text("uploaded_by_email").notNull(),
    uploadedByRole: text("uploaded_by_role").notNull(),
    evidenceType: text("evidence_type").notNull(),
    imageKey: text("image_key").notNull().default(""),
    imageType: text("image_type").notNull().default(""),
    note: text("note").notNull().default(""),
    odometerMiles: integer("odometer_miles").notNull().default(0),
    technicianName: text("technician_name").notNull().default(""),
    recordVersion: text("record_version").notNull().default("job-evidence-2026-07-31"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("job_evidence_items_request_created_idx").on(table.requestId, table.createdAt),
    index("job_evidence_items_customer_idx").on(table.customerEmail, table.createdAt),
    index("job_evidence_items_provider_idx").on(table.providerEmail, table.createdAt),
    check(
      "job_evidence_items_uploaded_by_role_check",
      sql`${table.uploadedByRole} in ('customer', 'provider')`,
    ),
    check(
      "job_evidence_items_evidence_type_check",
      sql`${table.evidenceType} in ('customer-condition', 'provider-before-work', 'progress', 'receipt-note', 'completion-note')`,
    ),
    check("job_evidence_items_odometer_miles_check", sql`${table.odometerMiles} >= 0`),
    check(
      "job_evidence_items_content_check",
      sql`trim(${table.imageKey}) <> '' or trim(${table.note}) <> ''`,
    ),
  ],
);
