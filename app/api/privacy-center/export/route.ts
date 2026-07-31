import { env } from "cloudflare:workers";
import { getAccountSession, providerAccountFor } from "../../../../lib/account-auth";

type AccountRole = "customer" | "provider";

type AccountRecord = {
  email: string;
  verifiedAt: string;
  termsAcceptedAt: string;
  termsVersion: string;
  createdAt: string;
  updatedAt: string;
};

function cleanEmail(value: string) {
  return value.trim().toLowerCase();
}

async function signedInAccount(request: Request) {
  const session = await getAccountSession(request);
  if (!session || (session.role !== "customer" && session.role !== "provider")) return null;
  if (session.role === "provider" && !(await providerAccountFor(session.email))) return null;
  return { email: cleanEmail(session.email), role: session.role as AccountRole };
}

async function rows<T>(sql: string, values: unknown[] = []) {
  const statement = env.DB.prepare(sql);
  const result = values.length > 0
    ? await statement.bind(...values).all<T>()
    : await statement.all<T>();
  return result.results ?? [];
}

async function commonExport(email: string, role: AccountRole) {
  const [account, preferences, privacyRequests, notifications, messages] = await Promise.all([
    env.DB.prepare(
      `SELECT email,
              verified_at AS verifiedAt,
              terms_accepted_at AS termsAcceptedAt,
              terms_version AS termsVersion,
              created_at AS createdAt,
              updated_at AS updatedAt
         FROM account_credentials
        WHERE lower(email) = lower(?) LIMIT 1`,
    ).bind(email).first<AccountRecord>(),
    rows(
      `SELECT marketing_email AS marketingEmail,
              product_update_email AS productUpdateEmail,
              optional_reminder_email AS optionalReminderEmail,
              created_at AS createdAt,
              updated_at AS updatedAt
         FROM account_communication_preferences
        WHERE lower(email) = lower(?) AND role = ?`,
      [email, role],
    ),
    rows(
      `SELECT id,
              request_type AS requestType,
              related_request_id AS relatedRequestId,
              details,
              status,
              resolution_note AS resolutionNote,
              created_at AS createdAt,
              updated_at AS updatedAt,
              resolved_at AS resolvedAt
         FROM privacy_requests
        WHERE lower(email) = lower(?) AND role = ?
        ORDER BY datetime(created_at) DESC`,
      [email, role],
    ),
    rows(
      `SELECT title, body, href,
              read_at AS readAt,
              created_at AS createdAt
         FROM account_notifications
        WHERE lower(email) = lower(?) AND role = ?
        ORDER BY datetime(created_at) DESC`,
      [email, role],
    ),
    rows(
      `SELECT request_id AS requestId,
              sender_role AS senderRole,
              CASE WHEN lower(sender_email) = lower(?) THEN 'sent' ELSE 'received' END AS direction,
              body,
              created_at AS createdAt
         FROM job_messages
        WHERE lower(sender_email) = lower(?) OR lower(recipient_email) = lower(?)
        ORDER BY datetime(created_at) DESC`,
      [email, email, email],
    ),
  ]);

  return {
    account: account ?? { email, role },
    communicationPreferences: preferences,
    privacyRequests,
    accountNotifications: notifications,
    jobMessages: messages,
  };
}

async function customerExport(email: string) {
  const [
    profile,
    serviceArea,
    requests,
    quotes,
    appointments,
    savedProviders,
    reviews,
    authorizations,
    payments,
    evidence,
  ] = await Promise.all([
    rows(
      `SELECT display_name AS displayName,
              created_at AS createdAt,
              updated_at AS updatedAt
         FROM customer_profiles
        WHERE lower(email) = lower(?)`,
      [email],
    ),
    rows(
      `SELECT municipality, zip,
              service_locations AS serviceLocations,
              service_address AS serviceAddress,
              updated_at AS updatedAt
         FROM account_service_area_settings
        WHERE lower(email) = lower(?) AND role = 'customer'`,
      [email],
    ),
    rows(
      `SELECT id, name, zip,
              launch_area AS launchArea,
              municipality,
              vehicle,
              service,
              parts_source AS partsSource,
              parts_preference AS partsPreference,
              budget_range AS budgetRange,
              service_locations AS serviceLocations,
              service_address AS serviceAddress,
              details,
              preferred_provider_name AS preferredProviderName,
              repeat_of_request_id AS repeatOfRequestId,
              CASE WHEN trim(issue_image_key) <> '' THEN 1 ELSE 0 END AS issueImageAvailable,
              CASE WHEN trim(completion_image_key) <> '' THEN 1 ELSE 0 END AS completionImageAvailable,
              status,
              terms_accepted_at AS termsAcceptedAt,
              terms_version AS termsVersion,
              marketing_consent AS marketingConsent,
              created_at AS createdAt
         FROM customer_requests
        WHERE lower(email) = lower(?)
        ORDER BY datetime(created_at) DESC`,
      [email],
    ),
    rows(
      `SELECT quote.id,
              quote.request_id AS requestId,
              quote.provider_name AS providerName,
              quote.price_cents AS priceCents,
              quote.labor_price_cents AS laborPriceCents,
              quote.parts_price_cents AS partsPriceCents,
              quote.customer_fee_cents AS customerFeeCents,
              quote.customer_total_cents AS customerTotalCents,
              quote.part_type AS partType,
              quote.availability,
              quote.message,
              quote.status,
              quote.created_at AS createdAt
         FROM provider_quotes quote
         INNER JOIN customer_requests request ON request.id = quote.request_id
        WHERE lower(request.email) = lower(?)
        ORDER BY datetime(quote.created_at) DESC`,
      [email],
    ),
    rows(
      `SELECT id,
              request_id AS requestId,
              provider_name AS providerName,
              service,
              requested_by_role AS requestedByRole,
              starts_at AS startsAt,
              alternate_at AS alternateAt,
              confirmed_start_at AS confirmedStartAt,
              note,
              status,
              created_at AS createdAt,
              updated_at AS updatedAt
         FROM appointments
        WHERE lower(customer_email) = lower(?)
        ORDER BY datetime(created_at) DESC`,
      [email],
    ),
    rows(
      `SELECT saved.provider_id AS providerId,
              COALESCE(NULLIF(profile.business_name, ''), provider.name) AS providerName,
              saved.created_at AS savedAt
         FROM saved_providers saved
         INNER JOIN provider_applications provider ON provider.id = saved.provider_id
         LEFT JOIN provider_profiles profile ON profile.provider_id = provider.id
        WHERE lower(saved.customer_email) = lower(?)
        ORDER BY datetime(saved.created_at) DESC`,
      [email],
    ),
    rows(
      `SELECT review.id,
              review.request_id AS requestId,
              review.provider_name AS providerName,
              review.service,
              review.rating,
              review.comment,
              review.status,
              review.created_at AS createdAt
         FROM job_reviews review
         INNER JOIN customer_requests request ON request.id = review.request_id
        WHERE lower(request.email) = lower(?)
        ORDER BY datetime(review.created_at) DESC`,
      [email],
    ),
    rows(
      `SELECT id,
              request_id AS requestId,
              provider_name AS providerName,
              authorization_type AS authorizationType,
              title,
              description,
              labor_cents AS laborCents,
              parts_cents AS partsCents,
              other_fees_cents AS otherFeesCents,
              total_cents AS totalCents,
              estimated_completion_at AS estimatedCompletionAt,
              diagnostic_only AS diagnosticOnly,
              workmanship_warranty AS workmanshipWarranty,
              parts_warranty AS partsWarranty,
              replaced_parts_return AS replacedPartsReturn,
              status,
              response_note AS responseNote,
              created_at AS createdAt,
              responded_at AS respondedAt,
              updated_at AS updatedAt
         FROM job_authorizations
        WHERE lower(customer_email) = lower(?)
        ORDER BY datetime(created_at) DESC`,
      [email],
    ),
    rows(
      `SELECT id,
              payment_type AS paymentType,
              request_id AS requestId,
              product_name AS productName,
              currency,
              quantity,
              provider_amount_cents AS providerAmountCents,
              application_fee_cents AS applicationFeeCents,
              customer_total_cents AS customerTotalCents,
              status,
              paid_at AS paidAt,
              refund_amount_cents AS refundAmountCents,
              refunded_at AS refundedAt,
              dispute_status AS disputeStatus,
              created_at AS createdAt,
              updated_at AS updatedAt
         FROM stripe_payments
        WHERE lower(customer_email) = lower(?)
        ORDER BY datetime(created_at) DESC`,
      [email],
    ),
    rows(
      `SELECT id,
              request_id AS requestId,
              uploaded_by_role AS uploadedByRole,
              evidence_type AS evidenceType,
              CASE WHEN trim(image_key) <> '' THEN 1 ELSE 0 END AS imageAvailable,
              note,
              odometer_miles AS odometerMiles,
              technician_name AS technicianName,
              created_at AS createdAt
         FROM job_evidence_items
        WHERE lower(customer_email) = lower(?)
        ORDER BY datetime(created_at) DESC`,
      [email],
    ),
  ]);

  return {
    customerProfile: profile,
    customerServiceArea: serviceArea,
    jobRequests: requests,
    quotesReceived: quotes,
    appointments,
    savedProviders,
    reviewsSubmitted: reviews,
    jobAuthorizations: authorizations,
    paymentSummaries: payments,
    privateJobEvidenceMetadata: evidence,
  };
}

async function providerExport(email: string) {
  const provider = await providerAccountFor(email);
  if (!provider) return {};
  const providerId = provider.id;
  const [
    application,
    profile,
    quotes,
    jobRecords,
    appointments,
    reviews,
    authorizations,
    payments,
    credentials,
    evidence,
  ] = await Promise.all([
    rows(
      `SELECT id, name, email,
              preferred_language AS preferredLanguage,
              service,
              service_area AS serviceArea,
              business_municipality AS businessMunicipality,
              work_locations AS workLocations,
              business_service_address AS businessServiceAddress,
              experience,
              insurance_status AS insuranceStatus,
              insurance_expires_at AS insuranceExpiresAt,
              verification_status AS verificationStatus,
              approved_services AS approvedServices,
              alerts_enabled AS alertsEnabled,
              status,
              terms_accepted_at AS termsAcceptedAt,
              terms_version AS termsVersion,
              created_at AS createdAt
         FROM provider_applications
        WHERE id = ? LIMIT 1`,
      [providerId],
    ),
    rows(
      `SELECT slug,
              business_name AS businessName,
              headline,
              about,
              years_experience AS yearsExperience,
              availability_status AS availabilityStatus,
              availability_note AS availabilityNote,
              business_hours AS businessHours,
              public_status AS publicStatus,
              created_at AS createdAt,
              updated_at AS updatedAt
         FROM provider_profiles
        WHERE provider_id = ?`,
      [providerId],
    ),
    rows(
      `SELECT id,
              request_id AS requestId,
              provider_name AS providerName,
              price_cents AS priceCents,
              labor_price_cents AS laborPriceCents,
              parts_price_cents AS partsPriceCents,
              part_type AS partType,
              availability,
              message,
              status,
              decline_reason AS declineReason,
              created_at AS createdAt
         FROM provider_quotes
        WHERE lower(provider_email) = lower(?)
        ORDER BY datetime(created_at) DESC`,
      [email],
    ),
    rows(
      `SELECT request_id AS requestId,
              work_status AS workStatus,
              tracked_seconds AS trackedSeconds,
              billable_minutes AS billableMinutes,
              work_notes AS workNotes,
              parts_notes AS partsNotes,
              updated_at AS updatedAt
         FROM provider_job_records
        WHERE lower(provider_email) = lower(?)
        ORDER BY datetime(updated_at) DESC`,
      [email],
    ),
    rows(
      `SELECT id,
              request_id AS requestId,
              service,
              requested_by_role AS requestedByRole,
              starts_at AS startsAt,
              alternate_at AS alternateAt,
              confirmed_start_at AS confirmedStartAt,
              note,
              status,
              created_at AS createdAt,
              updated_at AS updatedAt
         FROM appointments
        WHERE provider_id = ?
        ORDER BY datetime(created_at) DESC`,
      [providerId],
    ),
    rows(
      `SELECT id,
              request_id AS requestId,
              customer_display_name AS customerDisplayName,
              service,
              rating,
              comment,
              status,
              created_at AS createdAt
         FROM job_reviews
        WHERE lower(provider_email) = lower(?)
        ORDER BY datetime(created_at) DESC`,
      [email],
    ),
    rows(
      `SELECT id,
              request_id AS requestId,
              authorization_type AS authorizationType,
              title,
              description,
              labor_cents AS laborCents,
              parts_cents AS partsCents,
              other_fees_cents AS otherFeesCents,
              total_cents AS totalCents,
              estimated_completion_at AS estimatedCompletionAt,
              diagnostic_only AS diagnosticOnly,
              workmanship_warranty AS workmanshipWarranty,
              parts_warranty AS partsWarranty,
              replaced_parts_return AS replacedPartsReturn,
              status,
              response_note AS responseNote,
              created_at AS createdAt,
              responded_at AS respondedAt,
              updated_at AS updatedAt
         FROM job_authorizations
        WHERE lower(provider_email) = lower(?)
        ORDER BY datetime(created_at) DESC`,
      [email],
    ),
    rows(
      `SELECT id,
              payment_type AS paymentType,
              request_id AS requestId,
              product_name AS productName,
              currency,
              quantity,
              provider_amount_cents AS providerAmountCents,
              application_fee_cents AS applicationFeeCents,
              customer_total_cents AS customerTotalCents,
              status,
              paid_at AS paidAt,
              released_at AS releasedAt,
              refund_amount_cents AS refundAmountCents,
              dispute_status AS disputeStatus,
              created_at AS createdAt,
              updated_at AS updatedAt
         FROM stripe_payments
        WHERE provider_application_id = ?
        ORDER BY datetime(created_at) DESC`,
      [providerId],
    ),
    rows(
      `SELECT requirement_key AS requirementKey,
              requirement_label AS requirementLabel,
              jurisdiction,
              credential_identifier AS credentialIdentifier,
              issuing_authority AS issuingAuthority,
              status,
              verification_method AS verificationMethod,
              checked_at AS checkedAt,
              expires_at AS expiresAt,
              created_at AS createdAt,
              updated_at AS updatedAt
         FROM provider_credential_verifications
        WHERE provider_id = ?
        ORDER BY datetime(created_at) DESC`,
      [providerId],
    ),
    rows(
      `SELECT id,
              request_id AS requestId,
              uploaded_by_role AS uploadedByRole,
              evidence_type AS evidenceType,
              CASE WHEN trim(image_key) <> '' THEN 1 ELSE 0 END AS imageAvailable,
              note,
              odometer_miles AS odometerMiles,
              technician_name AS technicianName,
              created_at AS createdAt
         FROM job_evidence_items
        WHERE lower(provider_email) = lower(?)
        ORDER BY datetime(created_at) DESC`,
      [email],
    ),
  ]);

  return {
    providerApplication: application,
    providerPublicProfile: profile,
    quotesSubmitted: quotes,
    providerJobRecords: jobRecords,
    appointments,
    reviewsReceived: reviews,
    jobAuthorizations: authorizations,
    paymentSummaries: payments,
    officialCredentialCheckRecords: credentials,
    privateJobEvidenceMetadata: evidence,
  };
}

export async function GET(request: Request) {
  const account = await signedInAccount(request);
  if (!account) {
    return Response.json(
      { error: "Sign in to export your Tuveloz account data." },
      { status: 401, headers: { "cache-control": "private, no-store" } },
    );
  }

  try {
    const [common, roleData] = await Promise.all([
      commonExport(account.email, account.role),
      account.role === "customer"
        ? customerExport(account.email)
        : providerExport(account.email),
    ]);
    const exportDocument = {
      generatedAt: new Date().toISOString(),
      accountRole: account.role,
      accountEmail: account.email,
      scope: "Tuveloz account and marketplace records linked to this signed-in role",
      ...common,
      ...roleData,
      excludedForSecurityOrOtherPeoplePrivacy: [
        "Password hashes, password salts, verification codes, passkey public-key material, authentication tokens, and session identifiers",
        "Complete card numbers, bank-account numbers, tax identity documents, and other data held by Stripe rather than Tuveloz",
        "Internal security signals, fraud-prevention methods, and unrelated information belonging to another customer or provider",
        "Private image file bytes; the export records whether a private image exists, while image access remains protected inside the relevant job workspace",
      ],
    };
    const date = new Date().toISOString().slice(0, 10);
    return new Response(JSON.stringify(exportDocument, null, 2), {
      headers: {
        "content-type": "application/json; charset=utf-8",
        "content-disposition": `attachment; filename="tuveloz-${account.role}-data-${date}.json"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (error) {
    console.error("Unable to generate Tuveloz privacy export", error);
    return Response.json(
      { error: "Tuveloz could not generate the account export." },
      { status: 503, headers: { "cache-control": "private, no-store" } },
    );
  }
}
