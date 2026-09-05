import { getDb } from "../db";
import { analyticsEvents } from "../db/schema";
import { cleanAnalyticsProps, PROVIDER_APPLICATION_SUBMITTED } from "./analytics-policy";

/** Supporting data must never roll back or fail a saved application. */
export async function recordProviderApplicationSubmitted(providerId: string, attribution: unknown) {
  try {
    await getDb().insert(analyticsEvents).values({
      id: `provider-application:${providerId}`,
      event: PROVIDER_APPLICATION_SUBMITTED,
      props: JSON.stringify(cleanAnalyticsProps(attribution)),
    }).onConflictDoNothing();
  } catch {
    // No contact details or database error text. The dashboard separately reads
    // the application table so lost telemetry cannot hide saved records.
    console.warn("Provider application saved; campaign telemetry unavailable.");
  }
}
