import { and, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  customerRequests,
  providerApplications,
  providerQuotes,
} from "../../../db/schema";
import {
  CUSTOMER_JOB_SERVICE_OPTIONS,
  parseJobServices,
} from "../../../lib/service-matching";

const MINIMUM_COMPLETED_JOBS = 3;
const allowedServices = new Set<string>(CUSTOMER_JOB_SERVICE_OPTIONS);

export async function GET(request: Request) {
  const requestedServices = [...new Set(
    new URL(request.url).searchParams
      .getAll("service")
      .map((service) => service.trim())
      .filter((service) => allowedServices.has(service)),
  )];

  if (requestedServices.length === 0) {
    return Response.json({ guidance: [], minimumSample: MINIMUM_COMPLETED_JOBS });
  }

  const rows = await getDb().select({
    requestId: customerRequests.id,
    service: customerRequests.service,
    priceCents: providerQuotes.priceCents,
  }).from(customerRequests)
    .innerJoin(providerQuotes, and(
      eq(providerQuotes.requestId, customerRequests.id),
      eq(providerQuotes.status, "accepted"),
    ))
    .innerJoin(providerApplications, and(
      eq(providerApplications.email, providerQuotes.providerEmail),
      eq(providerApplications.status, "approved"),
      eq(providerApplications.verificationStatus, "verified"),
      eq(providerApplications.isTestProvider, "no"),
    ))
    .where(and(
      eq(customerRequests.status, "completed"),
      eq(customerRequests.isTestJob, "no"),
    ));

  const completedPrices = new Map<string, number[]>();
  const seenRequests = new Set<string>();
  for (const row of rows) {
    const services = parseJobServices(row.service);
    const priceCents = Number(row.priceCents);
    if (
      services.length !== 1
      || !requestedServices.includes(services[0])
      || !Number.isSafeInteger(priceCents)
      || priceCents <= 0
      || seenRequests.has(row.requestId)
    ) {
      continue;
    }
    seenRequests.add(row.requestId);
    const prices = completedPrices.get(services[0]) ?? [];
    prices.push(priceCents);
    completedPrices.set(services[0], prices);
  }

  return Response.json({
    minimumSample: MINIMUM_COMPLETED_JOBS,
    source: "Completed, non-test Tuveloz jobs with accepted quotes from verified providers",
    guidance: requestedServices.map((service) => {
      const prices = completedPrices.get(service) ?? [];
      if (prices.length < MINIMUM_COMPLETED_JOBS) {
        return {
          service,
          available: false,
          sampleCount: prices.length,
          message: "Not enough real completed jobs yet to publish a trustworthy price.",
        };
      }
      return {
        service,
        available: true,
        sampleCount: prices.length,
        averageCents: Math.round(
          prices.reduce((total, price) => total + price, 0) / prices.length,
        ),
        lowCents: Math.min(...prices),
        highCents: Math.max(...prices),
      };
    }),
  });
}
