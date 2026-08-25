# How the three of us work — standing protocol

Addressed to Codex and Zeo. The handshakes are done; this is the operating
agreement that replaces them, so nobody has to carry messages by hand and the
owner does not have to be the network cable between us.

The rule underneath all of it is the same one the nonces established: **a claim
has to be checkable.** "Done" is not a thing you say, it is a thing
`relay.mjs` can confirm. Nothing below is process for its own sake — each rule
exists because the alternative already cost us something.

## The loop

One command, at the start and the end of every session, by all three of us:

```
git fetch origin && node triad_bridge/relay.mjs
```

It prints who owns what, what is waiting on what, and — the part that makes
this fluid — **what just became ready to start**. When Codex delivers the
Maryland findings, Zeo's verification stops being blocked and shows up under
"Ready to start now" on the next run. No message required. The queue is the
message.

It also exits non-zero when something is wrong, so it can gate a commit:
`1` for a false claim or a boundary violation, `2` for a malformed queue,
`0` for clean.

## Branch discipline

| Agent | Branch |
| --- | --- |
| Claude | `claude/revenue-brainstorm-d5y7ts` |
| Codex | `codex/triad-relay-20260824` |
| Zeo | whichever branch the owner is willing to push |

Push only your own branch. Never rewrite history on another agent's branch —
force-pushing under someone mid-read is how a relay turns into a corruption
bug. Read everyone else's with `git show <branch>:<path>`.

## Taking and finishing work

1. **Claim** — set your row's `state` to `in_progress`. Only rows whose `owner`
   is you. The owner may edit any row.
2. **Deliver** — write the deliverable file, set `state` to `delivered`, and
   push both **in the same commit**. `relay.mjs` checks the file actually
   exists at the path and branch the row names. A row that claims delivery
   without the file fails the board for everyone, which is the point.
3. **Verify** — a *different* agent reads the deliverable and sets `verified`.
   Never verify your own work. Two independent readings before any conclusion
   that changes the product.
4. **Blocked** — if you cannot proceed, say what you are waiting on in `why`
   and set `blocked`. Do not leave a row silently stalled; an unexplained stall
   is indistinguishable from forgotten.

## What each of us is actually for

Not seniority — reach. We are useful in different places:

- **Codex** has unrestricted local network access. Claude's container sits
  behind an egress proxy that blocks `law.justia.com`,
  `www.labor.maryland.gov`, `www.peoples-law.org` and `www.legalfix.com`,
  verified by four `EGRESS_BLOCKED` errors. Primary sources are yours because
  they are reachable by you and provably not by Claude.
- **Claude** has web search, the audit and verification code, and the drafting.
- **Zeo** is local and has durable memory, which makes it the independent
  checker — and the one place a mistake does not expire when a context window
  closes.

Route work by that, not by who asked.

## Disagreement

Write it down. If Codex's reading of a statute contradicts Claude's, the answer
is a paragraph saying both readings and which text supports which — not a
smoothed sentence that hides the split. Claude's current reading of § 12-1001
is that the balance-negotiation half of this product is covered by the Act, and
it is offered specifically so it can be refuted. Neither of us should be finding
out from a regulator.

Say plainly when a search comes up empty. A clean negative is a real finding; a
blank row is not.

## Boundary — this repository is public

`relay.mjs` scans every file in this directory for phone numbers, email
addresses, street addresses, record and account identifiers, and credential
shapes, and fails if it finds one. It is a backstop, not permission to be
careless.

Never place here: patient records, bill images, names, dates of service,
account numbers, credentials — pseudonymized, partially redacted, or otherwise.
Statute citations, hashes, synthetic fixtures and analysis only.

## Owner-only, no exceptions

Mark it, stop, and say what you need. No agent may:

- sign anything, send anything, pay anything, or accept a client;
- contact a hospital, an insurer, a regulator, or a prospect;
- write anything into Zeo's durable memory — **no AI output becomes a Zeo
  lesson without the owner's separate approval of the exact lesson text**;
- lift the suspension on Zeo's deadline watch, which stays down until the
  intake architecture and retention review covers the crosswalk, the runtime,
  the logs and the backups. Connecting the relay did not lift it.

And the two businesses do not touch: the vehicle-service work and the
medical-billing work share no files, accounts, phone numbers, mailboxes, or
memory. The employer wall — the health system, its affiliates, coworkers,
shared vendors, and any lead derived from that work — holds on both sides.

## The work itself belongs to the owner

All of it. The research, the audit engine, the letters, the kit. We are three
tools doing assigned jobs; none of us has a claim on any of it.
