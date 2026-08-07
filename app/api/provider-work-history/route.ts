import { and, asc, eq } from "drizzle-orm";
import { getDb } from "../../../db";
import {
  agreementAcceptances,
  providerWorkHistoryEntries,
} from "../../../db/schema";
import { getAccountSession, providerApplicationFor } from "../../../lib/account-auth";
import { isStrictSameOriginWriteRequest } from "../../../lib/request-security";
import {
  InvalidJsonBodyError,
  readLimitedJsonObject,
  RequestBodyTooLargeError,
} from "../../../lib/limited-json";
import {
  normalizeWorkHistoryEntry,
  WORK_HISTORY_AGREEMENT_KEY,
  WORK_HISTORY_ATTESTATION_TEXT,
  WORK_HISTORY_ATTESTATION_VERSION,
  WORK_HISTORY_CATEGORIES,
  WorkHistoryValidationError,
} from "../../../lib/provider-work-history";
import { providerApplicationRequestIp } from "../../../lib/provider-application-verification";

const NO_STORE_HEADERS = { "cache-control": "private, no-store, max-age=0" };
const MAX_JSON_BYTES = 24 * 1024;
const MAX_ENTRIES = 25;

async function activeProvider(request: Request) {
  const session = await getAccountSession(request);
  if (!session || session.role !== "provider") return null;
  // The application record, not the approved-provider lookup: work history is
  // filled in during onboarding, before anyone is approved.
  const provider = await providerApplicationFor(session.email);
  return provider ? { provider, session } : null;
}

function unauthorized() {
  return Response.json(
    {
      error: "Sign in as a provider to manage your work history.",
      errorEs: "Inicie sesión como proveedor para administrar su historial de trabajo.",
    },
    { status: 401, headers: NO_STORE_HEADERS },
  );
}

async function workHistoryState(providerId: string) {
  const db = getDb();
  const [entries, signature] = await Promise.all([
    db
      .select()
      .from(providerWorkHistoryEntries)
      .where(eq(providerWorkHistoryEntries.providerId, providerId))
      .orderBy(asc(providerWorkHistoryEntries.startMonth)),
    db
      .select()
      .from(agreementAcceptances)
      .where(and(
        eq(agreementAcceptances.providerId, providerId),
        eq(agreementAcceptances.agreementKey, WORK_HISTORY_AGREEMENT_KEY),
        eq(agreementAcceptances.agreementVersion, WORK_HISTORY_ATTESTATION_VERSION),
      ))
      .limit(1),
  ]);

  return {
    categories: WORK_HISTORY_CATEGORIES,
    attestationText: WORK_HISTORY_ATTESTATION_TEXT,
    attestationVersion: WORK_HISTORY_ATTESTATION_VERSION,
    // Editing after signing invalidates the signature: the attestation covers
    // the entries as they stood when it was signed, so a later edit has to be
    // re-signed before it counts for anything.
    signedAt: signature[0]?.acceptedAt ?? "",
    entries: entries.map((entry) => ({
      id: entry.id,
      employerName: entry.employerName,
      selfEmployed: entry.selfEmployed === "yes",
      city: entry.city,
      startMonth: entry.startMonth,
      endMonth: entry.endMonth,
      stillWorkingHere: entry.stillWorkingHere === "yes",
      workPerformed: entry.workPerformed,
      serviceCategory: entry.serviceCategory,
      referenceName: entry.referenceName,
      referencePhone: entry.referencePhone,
      referenceContactConsent: entry.referenceContactConsent === "yes",
      auditStatus: entry.auditStatus,
    })),
  };
}

export async function GET(request: Request) {
  const active = await activeProvider(request);
  if (!active) return unauthorized();
  return Response.json(
    await workHistoryState(active.provider.id),
    { headers: NO_STORE_HEADERS },
  );
}

export async function POST(request: Request) {
  if (!isStrictSameOriginWriteRequest(request)) {
    return Response.json(
      {
        error: "This request must come from TUVELOZ.",
        errorEs: "Esta solicitud debe venir de TUVELOZ.",
      },
      { status: 403, headers: NO_STORE_HEADERS },
    );
  }

  const active = await activeProvider(request);
  if (!active) return unauthorized();
  const providerId = active.provider.id;

  try {
    const body = await readLimitedJsonObject(request, MAX_JSON_BYTES);
    const rawEntries = Array.isArray(body.entries) ? body.entries : [];
    if (rawEntries.length > MAX_ENTRIES) {
      return Response.json(
        {
          error: `Keep the work history to ${MAX_ENTRIES} entries or fewer.`,
          errorEs: `Mantenga el historial de trabajo en ${MAX_ENTRIES} entradas o menos.`,
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const entries = rawEntries.map((entry) => normalizeWorkHistoryEntry(
      (entry ?? {}) as Record<string, unknown>,
    ));

    const signing = body.signAttestation === true;
    if (signing && entries.length === 0) {
      return Response.json(
        {
          error: "Add at least one job before signing.",
          errorEs: "Agregue al menos un trabajo antes de firmar.",
        },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }

    const db = getDb();
    const now = new Date().toISOString();

    // The attestation covers a specific set of entries, so a save replaces the
    // set wholesale and clears any signature that covered the previous one.
    await db
      .delete(providerWorkHistoryEntries)
      .where(eq(providerWorkHistoryEntries.providerId, providerId));
    await db
      .delete(agreementAcceptances)
      .where(and(
        eq(agreementAcceptances.providerId, providerId),
        eq(agreementAcceptances.agreementKey, WORK_HISTORY_AGREEMENT_KEY),
      ));

    if (entries.length) {
      await db.insert(providerWorkHistoryEntries).values(entries.map((entry) => ({
        id: crypto.randomUUID(),
        providerId,
        personId: "",
        employerName: entry.employerName,
        selfEmployed: entry.selfEmployed ? "yes" : "no",
        city: entry.city,
        startMonth: entry.startMonth,
        endMonth: entry.endMonth,
        stillWorkingHere: entry.stillWorkingHere ? "yes" : "no",
        workPerformed: entry.workPerformed,
        serviceCategory: entry.serviceCategory,
        referenceName: entry.referenceName,
        referencePhone: entry.referencePhone,
        referenceContactConsent: entry.referenceContactConsent ? "yes" : "no",
        auditStatus: "not_selected",
        createdAt: now,
        updatedAt: now,
      })));
    }

    if (signing) {
      await db.insert(agreementAcceptances).values({
        id: crypto.randomUUID(),
        providerId,
        personId: "",
        jurisdiction: "",
        agreementKey: WORK_HISTORY_AGREEMENT_KEY,
        agreementVersion: WORK_HISTORY_ATTESTATION_VERSION,
        agreementHash: "",
        // The record keeps the exact text signed, plus the entries it covered,
        // so a later edit can never be mistaken for what was attested to.
        agreementText: JSON.stringify({
          presentedText: WORK_HISTORY_ATTESTATION_TEXT,
          version: WORK_HISTORY_ATTESTATION_VERSION,
          entries,
        }),
        acceptedByName: active.provider.name || active.provider.email,
        acceptedByTitle: "",
        acceptanceAction: "affirmative-checkbox",
        acceptedAt: now,
        ipAddress: providerApplicationRequestIp(request),
        sessionId: "",
        deviceContext: "{}",
        createdAt: now,
      });
    }

    return Response.json(
      await workHistoryState(providerId),
      { headers: NO_STORE_HEADERS },
    );
  } catch (error) {
    if (error instanceof RequestBodyTooLargeError) {
      return Response.json(
        {
          error: "The work history is too large.",
          errorEs: "El historial de trabajo es demasiado grande.",
        },
        { status: 413, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof InvalidJsonBodyError) {
      return Response.json(
        { error: error.message, errorEs: error.message },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    if (error instanceof WorkHistoryValidationError) {
      return Response.json(
        { error: error.message, errorEs: error.messageEs || error.message },
        { status: 400, headers: NO_STORE_HEADERS },
      );
    }
    console.error("Unable to save provider work history", error);
    return Response.json(
      {
        error: "We could not save the work history. Please try again.",
        errorEs: "No pudimos guardar el historial de trabajo. Por favor intente de nuevo.",
      },
      { status: 500, headers: NO_STORE_HEADERS },
    );
  }
}
