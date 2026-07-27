import { sql } from "drizzle-orm";
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export const customerRequests = sqliteTable(
  "customer_requests",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    email: text("email").notNull(),
    zip: text("zip").notNull(),
    launchArea: text("launch_area").notNull().default(""),
    municipality: text("municipality").notNull().default(""),
    isTestJob: text("is_test_job").notNull().default("no"),
    vehicle: text("vehicle").notNull(),
    service: text("service").notNull(),
    partsSource: text("parts_source").notNull().default("Either is okay"),
    partsPreference: text("parts_preference").notNull().default("No preference"),
    budgetRange: text("budget_range").notNull().default("I'm flexible"),
    serviceLocations: text("service_locations").notNull().default("Provider comes to me"),
    serviceAddress: text("service_address").notNull().default(""),
    details: text("details").notNull(),
    preferredProviderEmail: text("preferred_provider_email").notNull().default(""),
    preferredProviderName: text("preferred_provider_name").notNull().default(""),
    repeatOfRequestId: text("repeat_of_request_id").notNull().default(""),
    accessToken: text("access_token").notNull().default(""),
    issueImageKey: text("issue_image_key").notNull().default(""),
    issueImageType: text("issue_image_type").notNull().default(""),
    completionImageKey: text("completion_image_key").notNull().default(""),
    completionImageType: text("completion_image_type").notNull().default(""),
    status: text("status").notNull().default("new"),
    approvedAt: text("approved_at").notNull().default(""),
    reminderSentAt: text("reminder_sent_at").notNull().default(""),
    reminderLastAttemptAt: text("reminder_last_attempt_at").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("customer_requests_created_at_idx").on(table.createdAt),
    index("customer_requests_status_idx").on(table.status),
    index("customer_requests_preferred_provider_idx").on(table.preferredProviderEmail),
  ],
);

export const providerQuotes = sqliteTable(
  "provider_quotes",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    providerName: text("provider_name").notNull(),
    providerEmail: text("provider_email").notNull(),
    priceCents: text("price_cents").notNull(),
    laborPriceCents: text("labor_price_cents").notNull().default("0"),
    partsPriceCents: text("parts_price_cents").notNull().default("0"),
    partType: text("part_type").notNull().default("Not specified"),
    availability: text("availability").notNull(),
    message: text("message").notNull(),
    status: text("status").notNull().default("submitted"),
    declineReason: text("decline_reason").notNull().default(""),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("provider_quotes_request_id_idx").on(table.requestId),
    index("provider_quotes_created_at_idx").on(table.createdAt),
  ],
);

export const providerJobRecords = sqliteTable(
  "provider_job_records",
  {
    id: text("id").primaryKey(),
    requestId: text("request_id").notNull(),
    providerEmail: text("provider_email").notNull(),
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
    status: text("status").notNull().default("new"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("provider_applications_created_at_idx").on(table.createdAt),
    index("provider_applications_status_idx").on(table.status),
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
