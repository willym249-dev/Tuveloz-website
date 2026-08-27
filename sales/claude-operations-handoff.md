# BriefReceipt operations handoff

- **Status:** active — reconstructed
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-27
- **Purpose:** The standing operating context for BriefReceipt, a separate
  small business run by this repository's owner. Read this before doing any
  BriefReceipt work; treat `claude-operations-state.json` as the source of
  truth for funnel numbers.

> **Provenance.** The owner committed an original version of this handoff as
> `b77b91c` (CLAUDE.md plus this file plus the state JSON). That commit was
> verified absent from `origin` (willym249-dev/Tuveloz-website) on 2026-08-27 —
> it never left the owner's machine. This file is a reconstruction from the
> owner's handoff message of 2026-08-27 in the operating conversation, which
> remains the visible operating thread.

## What BriefReceipt is

A one-person service that compares a supplied campaign brief against finished
Instagram posts and returns one plain receipt per post — required tags,
mentions, and dates, present or missing, line by line.

**The offer:** $99 one-time founding pilot. One supplied brief compared with up
to 10 finished Instagram posts; one plain receipt per post within two business
days — the clock starts only after complete intake and accepted payment.

**Boundaries of the service:** no Instagram password ever needed; no legal
advice; the customer makes every final approval and payment decision.

## Team protocol

- **Claude is the operating lead** — this conversation thread is the visible
  operating record, and durable state lives in `sales/` in this repository.
- **Zeo is first reviewer** only when its genuine Zeo-owned route is available.
  Observed 2026-08-27: **BLOCKED, `route_not_ready`** — no approved Zeo-owned
  chat checkpoint or attested BrainGateway is installed. **Never substitute
  Qwen, Ollama, or any other model and call it Zeo.**
- **Codex is an asynchronous verifier**, used only for requested or
  higher-risk checks. Conserve Codex credits; zero were spent this session.
- **Never claim a conversation with Zeo or Codex happened** unless a real
  response or verification packet exists and is referenced.

## Funnel definitions — the words mean exactly this

| Term | Meaning |
|------|---------|
| Draft | Text written and stored; nothing has left the building |
| Attempt | A send was tried; delivery not yet confirmed |
| Confirmed send | Evidence exists the message actually went through |
| Reply | The recipient wrote back, any content |
| Qualified lead | A reply showing real interest in the pilot from someone who could buy it |
| Paid pilot | Intake complete AND payment accepted |
| Settled revenue | Money actually settled, after fees and refund windows |

Never report a number one column to the right of what the evidence supports.

## External-action boundary

None of the following happens without the owner's exact confirmation **for
that specific action**: sending a message, publishing a post, entering
credentials anywhere, enabling payments, accepting money, transmitting private
intake. Payment and private-intake routes are disabled and unverified as of
2026-08-27.

**Data handling:** never store passwords, OTPs, phone numbers, birth dates,
cookies, payment-card data, or private messages — not in this repository, not
in scratch files. Prospect records are company-level facts from public pages
only.

## How a session operates

1. Read this file, then `claude-operations-state.json`, then the newest dated
   files in `sales/`.
2. Do no-spend work: research from official public sources, drafting,
   state maintenance. Label evidence with its date; anything that cannot be
   refreshed is reported as dated, not current.
3. Update the state JSON — every number keyed to a date and a basis.
4. Commit to the designated branch. Uncommitted work dies with the session.
5. Queue external actions as **pending owner confirmations** in the state
   JSON; never perform them.

## File map

| File | What it is |
|------|------------|
| `claude-operations-handoff.md` | This file — standing context |
| `claude-operations-state.json` | Source of truth for funnel numbers and status |
| `prospect-research-2026-08-27.md` | Qualified prospect list with sources |
| `outreach-drafts-2026-08-27.md` | First-contact and follow-up drafts (nothing sent) |
| `instagram-post-drafts-2026-08-27.md` | Two educational post drafts (not published) |
| `pilot-intake-checklist-2026-08-27.md` | What "complete intake" means; route stays disabled until owner-verified |
