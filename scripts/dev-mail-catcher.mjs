// Local-only mail catcher.
//
// The app posts Resend-shaped JSON to `${RESEND_BASE_URL}/emails`. Mailpit and
// friends speak SMTP, which a Worker cannot originate, so this stands in for
// Resend directly: same request shape, same response shape, nothing leaves the
// machine. A test can then read the verification code it just triggered.
//
// Never run this anywhere that serves real users. It binds loopback only, and
// lib/resend-endpoint.ts refuses non-loopback overrides for the same reason.
//
//   node scripts/dev-mail-catcher.mjs --port 3210 --out .mail-catcher.jsonl
//
// GET  /messages        -> every captured message, newest last
// GET  /messages/latest -> the most recent, or 404
// POST /reset           -> forget everything

import { createServer } from "node:http";
import { appendFileSync, writeFileSync } from "node:fs";

const args = process.argv.slice(2);
const readArg = (flag, fallback) => {
  const i = args.indexOf(flag);
  return i > -1 && args[i + 1] ? args[i + 1] : fallback;
};

const port = Number(readArg("--port", "3210"));
const outFile = readArg("--out", "");
const messages = [];

// A six-digit run of digits is the shape every verification code in this app
// uses. Pulling it out here keeps tests from re-implementing the parse.
const extractCode = (text) => (String(text ?? "").match(/\b(\d{6})\b/) ?? [])[1] ?? "";

const readBody = (req) => new Promise((resolve, reject) => {
  const chunks = [];
  req.on("data", (c) => chunks.push(c));
  req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
  req.on("error", reject);
});

const json = (res, status, payload) => {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    "content-type": "application/json",
    "content-length": Buffer.byteLength(body),
  });
  res.end(body);
};

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${port}`);

  if (req.method === "POST" && url.pathname === "/emails") {
    let payload;
    try {
      payload = JSON.parse(await readBody(req));
    } catch {
      return json(res, 400, { name: "validation_error", message: "invalid JSON" });
    }

    const captured = {
      id: `caught_${messages.length + 1}`,
      receivedAt: new Date().toISOString(),
      from: payload.from ?? "",
      to: Array.isArray(payload.to) ? payload.to : [payload.to].filter(Boolean),
      subject: payload.subject ?? "",
      text: payload.text ?? "",
      html: payload.html ?? "",
      code: extractCode(payload.text ?? payload.html ?? ""),
    };
    messages.push(captured);
    if (outFile) {
      appendFileSync(outFile, `${JSON.stringify(captured)}\n`);
    }
    console.log(`caught → ${captured.to.join(", ")} | ${captured.subject}`
      + (captured.code ? ` | code ${captured.code}` : ""));
    // Resend answers with the message id; mirror that so callers that check
    // response.ok and read `id` behave identically against either backend.
    return json(res, 200, { id: captured.id });
  }

  if (req.method === "GET" && url.pathname === "/messages") {
    return json(res, 200, { count: messages.length, messages });
  }

  if (req.method === "GET" && url.pathname === "/messages/latest") {
    const latest = messages[messages.length - 1];
    return latest ? json(res, 200, latest) : json(res, 404, { message: "no messages" });
  }

  if (req.method === "POST" && url.pathname === "/reset") {
    messages.length = 0;
    if (outFile) writeFileSync(outFile, "");
    return json(res, 200, { ok: true });
  }

  return json(res, 404, { message: "not found" });
});

server.listen(port, "127.0.0.1", () => {
  console.log(`mail catcher listening on http://127.0.0.1:${port}`);
  console.log(`point RESEND_BASE_URL at it: http://127.0.0.1:${port}`);
});
