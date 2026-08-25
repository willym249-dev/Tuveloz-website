# Case tracker and deadline watch

The structure every file runs on, and the specification for the job Zeo does.

**One principle governs this document: appeal deadlines are the least forgiving thing here.** Confirm each one against the plan in writing rather than assuming a rule, and diary it before any analysis begins. Whether a missed deadline can be revisited depends on the plan and the reason — do not tell a consumer either that it can or that it cannot.

---

## File numbering

`YYYY-NNN` — year, then sequential. `2026-001`, `2026-002`.

One file number per **client engagement**, not per bill. A single visit produces four to six bills from separate companies; they are accounts *inside* one file, lettered: `2026-001a` hospital, `2026-001b` radiology, `2026-001c` anesthesia. They share deadlines and a client, and separating them loses that.

The file number is what replaces the account number in de-identified working data, and it is the only thing Zeo ever sees.

---

## The clocks

| Deadline | Starts from | Why it matters |
| --- | --- | --- |
| **Internal appeal** | **Determine it per plan — do not assume.** Some run from the notice date, some from receipt, and the rule differs between Maryland-regulated plans and self-funded ERISA plans. Read the denial notice and confirm with the plan in writing | Missing it can end the claim. Whether anything can be done afterwards depends on the plan and the reason — **it is not automatically unrecoverable** |
| **External review** | The internal appeal denial | A further route, whose availability and forum depend on the plan type. Confirm; do not assume it is the last |
| **GFE dispute** | The bill date | Self-pay only. **Confirm the window and any collection protection from the primary source** — do not promise a consumer that collections stop |
| **240-day assistance window** | The **first** bill | Lets income be re-tested for a change in circumstances |
| **Chase date** | Every request made, plus what they promised | Half of what you win comes from being the only one tracking it |
| **Records destruction** | Engagement close | Suspended while any dispute is live |

**Diary the appeal deadline on the day of the first call**, before reading a single line item — and record *how* it was determined and who confirmed it, not just the date.

**Plan router, before any deadline is trusted.** Establish whether the plan is Maryland-regulated or a self-funded ERISA plan, because the rules, the forum, and the regulator differ. Note whether any ambulance charge is ground or air, since those follow different routes. The relevant bodies are the Maryland Insurance Administration, CMS, and the federal Employee Benefits Security Administration — confirm which applies before relying on any protection.

---

## Status states

Use exactly these. Ambiguous states are how files go quiet.

| State | Means |
| --- | --- |
| `intake` | Forms out, not yet returned |
| `awaiting-docs` | Forms signed, waiting on the client |
| `itemization-requested` | Call 1 made, waiting on the facility |
| `auditing` | Itemization in hand, review under way |
| `packet-sent` | Consumer signed and submitted; waiting on the facility |
| `assistance-pending` | Application in, awaiting decision |
| `appeal-filed` | Consumer filed with the plan |
| `escalated` | On the ladder — HEAU, regulator, compliance |
| `closed-changed` | A change confirmed in writing by the provider or plan |
| `closed-no-change` | Nothing found, or nothing moved |
| `closed-referred` | Conflict, lawsuit, or out of scope |

A file in `packet-sent` or `itemization-requested` with a chase date in the past is the definition of a file going quiet. That is what the watch exists to catch.

---

## The tracker

One row per account, not per file.

| File | Acct | Client | Facility | State | Baseline | Current | Next action | Chase date | Hard deadline |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 2026-001 | a | | | `auditing` | $ | $ | | | |

**Record these per case as well, because none of it can be reconstructed later:**

| Field | Why |
| --- | --- |
| Acquisition source and cost | Which channel, and what it cost to reach them |
| Active labour (hours) | Split: review, drafting, follow-up |
| Hold time and contacts | Minutes on hold; calls, letters, replies |
| Vendor and coder cost | Anything paid out on this case |
| Outcome | What changed, what did not, what was refused and why |
| Reversals | A change later reinstated, or a question that proved wrong |
| Contribution | Outcome minus every cost above, including your time at a real rate |
| Missed deadlines | Every one, with the cause |
| Incidents | Every privacy or handling near-miss, however small |

**Three cases is an operations rehearsal, not market proof.** It shows whether the process runs. It says nothing reliable about demand, outcomes, or price, and must never be described as evidence that the service works.

Keep it wherever you will actually look at it daily — but **it holds client names and facilities, so it is a record store like any other**: encrypted, access-controlled, backed up, and covered by the same deletion schedule. An unprotected spreadsheet on a synced drive is not acceptable.

---

## Zeo's specification

Zeo runs the deadline watch. It is the right job for it because it is always on and local, and because the job needs nothing sensitive.

**What Zeo is given — nothing else, ever:**

```
file: 2026-001
account: a
deadline_type: internal_appeal
due: 2026-09-14
chase: 2026-09-02
state: appeal-filed
```

File number, account letter, deadline type, dates, state. **No name, no facility, no bill content, no diagnosis.** That is minimisation, not anonymity — a case ID is a crosswalk to a real person, and whoever holds both sides can re-link them. **Running this on a home machine is not yet approved:** it needs an architecture and retention review covering the crosswalk, runtime, logs, and backups. Until that is done, **Zeo's durable memory gets non-private operating principles only** — no case IDs, no dates.

**What Zeo does:**

1. Every morning, report anything due in the next 14 days, in date order, most urgent first.
2. Flag any **hard deadline** inside 21 days separately and louder — those are the appeal windows.
3. Flag any file whose **chase date has passed** and whose state has not changed. This catches the silent ones.
4. Flag any file that has not changed state in 21 days, regardless of dates.
5. Say plainly when there is nothing due. A watch that only speaks up sometimes teaches you to ignore it.

**What Zeo must never do:** contact anyone, send anything, or take an action on a file. It reports. Every action goes through a person.

**A caution worth keeping.** The Zeo entries in this project's other working log record a search that failed silently for a year while reporting honest-sounding results. A deadline watch that quietly stops running is the same failure with worse consequences. So the daily report says *"nothing due"* out loud rather than staying silent — silence and failure must never look identical.

---

## The daily loop

1. Read Zeo's report.
2. Work anything with a hard deadline inside 21 days, before anything else.
3. Work the passed chase dates — a call and a written follow-up the same day.
4. Then new intake.
5. Update the tracker before you close the day. A file whose state is stale in the tracker is invisible to the watch, and invisible is how the unrecoverable one gets missed.

---

**Before stating any rule here as fact, read [`claims-register.md`](claims-register.md).**
