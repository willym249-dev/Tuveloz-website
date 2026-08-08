import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb } from "../../../db";
import { customerRequests, jobMessages, providerQuotes } from "../../../db/schema";
import { getAccountSession, providerAccountFor } from "../../../lib/account-auth";
import { ImageValidationError, validateJobImage } from "../../../lib/job-images";
import { deleteJobMessageImage, storeJobMessageImage } from "../../../lib/job-message-images";
import { parseJobServices } from "../../../lib/service-matching";
import { isSameOriginRequest } from "../../../lib/request-security";
import {
  marketplacePausedMessage,
} from "../../../lib/launch-status";
import { runtimeMarketplaceActionAllowed } from "../../../lib/runtime-marketplace-action";

function marketplacePausedResponse() {
  return Response.json(
    {
      error: marketplacePausedMessage("job_start"),
      code: "MARKETPLACE_ONBOARDING_ONLY",
    },
    {
      status: 503,
      headers: { "cache-control": "no-store", "retry-after": "86400" },
    },
  );
}

async function sessionUsesIsolatedTestFixtures(session: AccountSession) {
  if (session.role !== "provider") return false;
  const provider = await providerAccountFor(session.email);
  return provider?.isTestProvider === "yes";
}

type AccountSession = NonNullable<Awaited<ReturnType<typeof getAccountSession>>>;

type Conversation = {
  requestId: string;
  vehicle: string;
  service: string;
  status: string;
  customerName: string;
  customerEmail: string;
  providerName: string;
  providerEmail: string;
};

function cleanMessage(value: unknown) {
  return String(value ?? "").replace(/\0/g, "").trim().slice(0, 1000);
}

function timestamp(value: string) {
  const normalized = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(value)
    ? `${value.replace(" ", "T")}Z`
    : value;
  return Date.parse(normalized);
}

async function conversationsFor(session: AccountSession): Promise<Conversation[]> {
  const db = getDb();
  if (session.role === "customer") {
    const requests = await db.select({
      id: customerRequests.id,
      vehicle: customerRequests.vehicle,
      service: customerRequests.service,
      status: customerRequests.status,
      name: customerRequests.name,
      email: customerRequests.email,
    }).from(customerRequests)
      .where(sql`lower(${customerRequests.email}) = ${session.email.toLowerCase()}`)
      .limit(200);
    if (requests.length === 0) return [];
    const acceptedQuotes = await db.select({
      requestId: providerQuotes.requestId,
      providerName: providerQuotes.providerName,
      providerEmail: providerQuotes.providerEmail,
    }).from(providerQuotes)
      .where(and(
        inArray(providerQuotes.requestId, requests.map((item) => item.id)),
        eq(providerQuotes.status, "accepted"),
      ));
    const requestById = new Map(requests.map((item) => [item.id, item]));
    return acceptedQuotes.flatMap((quote) => {
      const job = requestById.get(quote.requestId);
      return job ? [{
        requestId: job.id,
        vehicle: job.vehicle,
        service: parseJobServices(job.service).join(" + "),
        status: job.status,
        customerName: job.name,
        customerEmail: job.email,
        providerName: quote.providerName,
        providerEmail: quote.providerEmail,
      }] : [];
    });
  }

  const provider = await providerAccountFor(session.email);
  if (!provider) return [];
  const acceptedQuotes = await db.select({
    requestId: providerQuotes.requestId,
    providerName: providerQuotes.providerName,
    providerEmail: providerQuotes.providerEmail,
  }).from(providerQuotes)
    .where(and(
      sql`lower(${providerQuotes.providerEmail}) = ${provider.email.toLowerCase()}`,
      eq(providerQuotes.status, "accepted"),
    ));
  if (acceptedQuotes.length === 0) return [];
  const requests = await db.select({
    id: customerRequests.id,
    vehicle: customerRequests.vehicle,
    service: customerRequests.service,
    status: customerRequests.status,
    name: customerRequests.name,
    email: customerRequests.email,
  }).from(customerRequests)
    .where(and(
      inArray(customerRequests.id, acceptedQuotes.map((quote) => quote.requestId)),
      eq(customerRequests.isTestJob, provider.isTestProvider),
    ));
  const requestById = new Map(requests.map((item) => [item.id, item]));
  return acceptedQuotes.flatMap((quote) => {
    const job = requestById.get(quote.requestId);
    return job ? [{
      requestId: job.id,
      vehicle: job.vehicle,
      service: parseJobServices(job.service).join(" + "),
      status: job.status,
      customerName: job.name,
      customerEmail: job.email,
      providerName: quote.providerName,
      providerEmail: quote.providerEmail,
    }] : [];
  });
}

export async function GET(request: Request) {
  try {
    const session = await getAccountSession(request);
    if (!session) {
      return Response.json(
        { error: "Sign in to view job messages." },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }
    if (!(await runtimeMarketplaceActionAllowed("job_start", {
      testOnly: await sessionUsesIsolatedTestFixtures(session),
    }))) {
      return marketplacePausedResponse();
    }
    const conversations = await conversationsFor(session);
    if (conversations.length === 0) {
      return Response.json({ conversations: [] }, { headers: { "cache-control": "no-store" } });
    }
    const messages = await getDb().select({
      id: jobMessages.id,
      requestId: jobMessages.requestId,
      senderEmail: jobMessages.senderEmail,
      senderRole: jobMessages.senderRole,
      body: jobMessages.body,
      imageKey: jobMessages.imageKey,
      scanStatus: jobMessages.scanStatus,
      createdAt: jobMessages.createdAt,
    }).from(jobMessages)
      .where(inArray(jobMessages.requestId, conversations.map((item) => item.requestId)))
      .orderBy(asc(jobMessages.createdAt))
      .limit(500);
    const ownEmail = session.email.toLowerCase();

    return Response.json({
      conversations: conversations.map((conversation) => ({
        requestId: conversation.requestId,
        vehicle: conversation.vehicle,
        service: conversation.service,
        status: conversation.status,
        otherParty: session.role === "customer"
          ? conversation.providerName
          : conversation.customerName,
        messages: messages
          .filter((message) => message.requestId === conversation.requestId)
          .map((message) => ({
            id: message.id,
            senderRole: message.senderRole,
            mine: message.senderEmail.toLowerCase() === ownEmail,
            body: message.body,
            // Never leak the storage key; the image is only viewable once a scan
            // has cleared it. Anything else surfaces as pending or blocked.
            image: message.imageKey
              ? { status: message.scanStatus || "pending", viewable: message.scanStatus === "clean" }
              : null,
            createdAt: message.createdAt,
          })),
      })),
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Unable to load job messages", error);
    return Response.json(
      { error: "Messages are temporarily unavailable." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}

export async function POST(request: Request) {
  try {
    if (!isSameOriginRequest(request)) {
      return Response.json(
        { error: "This message must be sent from Tuveloz." },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    }
    const session = await getAccountSession(request);
    if (!session) {
      return Response.json(
        { error: "Sign in to send a job message." },
        { status: 401, headers: { "cache-control": "no-store" } },
      );
    }
    if (!(await runtimeMarketplaceActionAllowed("job_start", {
      testOnly: await sessionUsesIsolatedTestFixtures(session),
    }))) {
      return marketplacePausedResponse();
    }
    const contentType = request.headers.get("content-type") ?? "";
    const isMultipart = contentType.includes("multipart/form-data");
    let requestId = "";
    let body = "";
    let imageFile: unknown = null;
    if (isMultipart) {
      const form = await request.formData();
      requestId = String(form.get("requestId") ?? "").trim().slice(0, 100);
      body = cleanMessage(form.get("body"));
      imageFile = form.get("image");
    } else {
      const payload = await request.json() as { requestId?: unknown; body?: unknown };
      requestId = String(payload.requestId ?? "").trim().slice(0, 100);
      body = cleanMessage(payload.body);
    }

    let validatedImage: Awaited<ReturnType<typeof validateJobImage>> = null;
    try {
      validatedImage = await validateJobImage(imageFile, false);
    } catch (imageError) {
      if (imageError instanceof ImageValidationError) {
        return Response.json(
          { error: imageError.message },
          { status: 400, headers: { "cache-control": "no-store" } },
        );
      }
      throw imageError;
    }

    // A message needs text, an image, or both.
    if (!requestId || (!body && !validatedImage)) {
      return Response.json(
        { error: "Choose a job and add a message or a photo." },
        { status: 400, headers: { "cache-control": "no-store" } },
      );
    }

    const conversations = await conversationsFor(session);
    const conversation = conversations.find((item) => item.requestId === requestId);
    if (!conversation) {
      return Response.json(
        { error: "Messages are available only between the customer and accepted provider for this job." },
        { status: 403, headers: { "cache-control": "no-store" } },
      );
    }

    const senderEmail = session.email.toLowerCase();
    const [lastMessage] = await getDb().select({ createdAt: jobMessages.createdAt })
      .from(jobMessages)
      .where(and(
        eq(jobMessages.requestId, requestId),
        sql`lower(${jobMessages.senderEmail}) = ${senderEmail}`,
      ))
      .orderBy(desc(jobMessages.createdAt))
      .limit(1);
    const lastSentAt = lastMessage ? timestamp(lastMessage.createdAt) : Number.NaN;
    if (Number.isFinite(lastSentAt) && Date.now() - lastSentAt < 2_000) {
      return Response.json(
        { error: "Please wait a moment before sending another message." },
        { status: 429, headers: { "cache-control": "no-store" } },
      );
    }

    const messageId = crypto.randomUUID();
    // Store the image first; it starts 'pending' and is never served until a scan
    // clears it. If the DB insert then fails, delete the orphaned object.
    let imageKey = "";
    let imageType = "";
    if (validatedImage) {
      imageKey = await storeJobMessageImage(requestId, messageId, validatedImage);
      imageType = validatedImage.contentType;
    }

    const message = {
      id: messageId,
      requestId,
      senderEmail,
      senderRole: session.role,
      recipientEmail: (session.role === "customer"
        ? conversation.providerEmail
        : conversation.customerEmail).toLowerCase(),
      body,
      imageKey,
      imageType,
      scanStatus: imageKey ? "pending" : "",
    };
    try {
      await getDb().insert(jobMessages).values(message);
    } catch (insertError) {
      if (imageKey) await deleteJobMessageImage(imageKey).catch(() => undefined);
      throw insertError;
    }
    return Response.json({
      message: {
        id: message.id,
        senderRole: message.senderRole,
        mine: true,
        body: message.body,
        image: imageKey ? { status: "pending", viewable: false } : null,
        createdAt: new Date().toISOString(),
      },
    }, { headers: { "cache-control": "no-store" } });
  } catch (error) {
    console.error("Unable to send job message", error);
    return Response.json(
      { error: "Your message could not be sent." },
      { status: 503, headers: { "cache-control": "no-store" } },
    );
  }
}
