import { desc } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  customerRequests,
  expansionInterests,
  launchFeedback,
  providerApplications,
  providerCredentialVerifications,
  providerQuotes,
} from "../../../db/schema";
import {
  OWNER_NO_STORE_HEADERS,
  ownerDataFailureResponse,
  ownerVerificationFailureResponse,
} from "../../../lib/owner-api-response";
import { verifyOwnerRequest } from "../../../lib/owner-auth";

const ADMIN_NO_STORE_HEADERS = {
  ...OWNER_NO_STORE_HEADERS,
  "cache-control": "no-store",
} as const;

export async function GET(request: Request) {
  const verification = await verifyOwnerRequest(request);
  if (!verification.ok) {
    return ownerVerificationFailureResponse({
      ok: false,
      reason: verification.reason,
    });
  }

  try {
    const db = getDb();
    const [requests, providers, credentials, feedback, quotes, expansion] = await Promise.all([
      db.select().from(customerRequests).orderBy(desc(customerRequests.createdAt)).limit(100),
      db.select().from(providerApplications).orderBy(desc(providerApplications.createdAt)).limit(100),
      db.select().from(providerCredentialVerifications).orderBy(desc(providerCredentialVerifications.updatedAt)).limit(500),
      db.select().from(launchFeedback).orderBy(desc(launchFeedback.createdAt)).limit(100),
      db.select().from(providerQuotes).orderBy(desc(providerQuotes.createdAt)).limit(250),
      db.select({
        id: expansionInterests.id,
        audience: expansionInterests.audience,
        providerType: expansionInterests.providerType,
        locality: expansionInterests.locality,
        state: expansionInterests.state,
        email: expansionInterests.email,
        createdAt: expansionInterests.createdAt,
      }).from(expansionInterests)
        .orderBy(desc(expansionInterests.createdAt))
        .limit(500),
    ]);
    const safeRequests = requests.map(({ accessToken, ...requestItem }) => {
      void accessToken;
      return requestItem;
    });
    const safeProviders = providers.map(({ accessToken, ...providerItem }) => {
      void accessToken;
      return {
        ...providerItem,
        credentialVerifications: credentials.filter(
          (credential) => credential.providerId === providerItem.id,
        ),
      };
    });
    return Response.json(
      { requests: safeRequests, providers: safeProviders, feedback, quotes, expansion },
      { headers: ADMIN_NO_STORE_HEADERS },
    );
  } catch (error) {
    return ownerDataFailureResponse(error, "primary data load");
  }
}
