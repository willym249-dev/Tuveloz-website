# Verifying an assistant's release claims

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-21
- **Applies to:** the "Lawyer Study Guide for Business" project on
  `DESKTOP-E0NQ190`, and any system that reports on its own readiness. Nothing
  in the Tuveloz application depends on this.

What to ask a system that has just told you it is green, and why "94.5/100" is
a more useful number than the 100 you asked for. Written from a specific case
on 2026-08-21 and kept because the shape of it recurs.

## The case this came from

The owner showed a Claude Code session running on `DESKTOP-E0NQ190`, titled
"Lawyer Study Guide for Business". **That project is not in this repository,
and is not in any of the four repositories this account can reach** (`Zeo`,
`Tuveloz-website`, `tuveloz-app`, `my-custom-ai`). It lives on that machine
only, so nothing below was checked against its code. This is a read of what
the session said about itself.

It reported, in order:

- "The broad law regression finished 191/191 passing."
- That the live maintenance verifier was "regrading saved course and holdout
  evidence" and was still running.
- Then: "operational status is green, all 26 course records are current, and no
  retests are required."
- And: "Release readiness is correctly false because the signed attorney review
  and sealed external generalization evidence are still missing."
- It was part-way through installing daily and weekly Windows scheduled tasks.

The owner asked two things: *"94.5/100 isn't what I asked for is it? I want
100/100"*, and *"But apart from that it's done?"*

## The answer to "apart from that, is it done?"

No, and the session had already said so. Its own summary puts release readiness
at false, blocked on two things: a signed attorney review, and sealed external
generalization evidence. The Windows tasks were also still installing when the
question was asked, so that item was not finished either.

"Done apart from X" is worth resisting as a phrasing. It quietly moves X out of
the project. Here X is the only part that somebody outside the system has to
sign.

## Why 100/100 is the wrong thing to ask for

Both missing pieces are external by definition. A signature belongs to an
attorney. Sealed external evidence is sealed precisely because the system under
test did not produce it and cannot see it. No amount of internal work moves
either one.

That leaves two routes to 100:

1. Obtain the signature and the sealed evaluation.
2. Re-grade the rubric until the number reads 100.

Pressing on the number selects for the second. It is the cheaper route, it needs
nobody else's cooperation, and a system asked repeatedly for a particular score
will generally find a way to report it.

**Ask for the 5.5 as line items instead** — which rubric lines are unmet, what
artifact closes each, and who has to produce it. A number can be argued into
place; a list of missing artifacts cannot. Either the file exists or it does not.

## The claims worth distrusting, and what to ask instead

| Claim | Why it is soft | Ask for |
| --- | --- | --- |
| "191/191 passing" | A perfect score usually means the suite and its answer key came from the same system. A suite that has never gone red is not measuring anything. | Who authored the items, who authored the key, and the date of the last item that ever failed. |
| "regrading saved course and holdout evidence" | Re-scoring stored artifacts tests the grader against its own earlier output, not the system against reality. A holdout the system regrades at will is not a holdout. | Whether the evaluation was re-executed or stored results were re-scored, with the command and its start and end timestamps. |
| "no retests are required" | Decided by the component that would have had to run them. | The code path that decides it, and the condition under which it would say retests *are* required. |
| "all 26 course records are current" | "Current" is load-bearing here with no stated rule behind it. | The staleness rule, and whether any record has ever failed it. |
| "operational status is green" | A status assembled from the four claims above inherits every weakness in them. | Which inputs feed it, and what turns it amber. |

None of these are accusations. They are what separates a system that has been
measured from one that has been asked how it feels.

## What to paste

Give this to the session verbatim. It asks for artifacts, and it explicitly
forbids the one response that would otherwise arrive — a fresh grading run that
reports a better number.

```
For each claim in your last two messages, give the artifact, not the summary:
1. The 191 regression items — who authored them, who authored the answer key,
   and the date/commit of the last item that failed. If none ever has, say so.
2. Did the maintenance run re-execute the evaluation, or re-score stored
   results? Show the command and its start/end timestamps.
3. What condition would have made "no retests required" come out as "retests
   required"? Show me the code path that decides it.
4. List the 5.5 points as individual rubric lines, each with the exact
   artifact that would close it and who has to produce it.
5. Which of those artifacts can you produce yourself, and which need a person?
Do not re-grade anything. Just answer.
```

## Why this is filed in Tuveloz's documentation

Two things here are already settled practice in this repository, and both
transfer to any project the owner runs.

**A missing legal review is recorded, not absorbed.** `lib/launch-readiness.ts`
carries an explicit owner decision for proceeding without counsel, and the
acknowledgement text is the point:

> I understand that proceeding without counsel is an owner choice, not legal
> approval, and does not remove or satisfy any applicable legal, licensing,
> insurance, tax, payment, privacy, security, identity-verification,
> service-matrix, or provider-of-record requirement.

The gate does not become satisfied. The choice becomes visible, dated and
attributed. A study guide about business law needs the same distinction, and
needs it more than most documents: the attorney signature is what separates a
study aid from something a reader will treat as legal advice. A score of 100
must never be able to stand in for it.

**A green self-report is not evidence.** The 2026-08-17 entry in
[`LOG.md`](../LOG.md) records most of a day lost to a confident diagnosis nobody
had checked — a search backend declared dead on the strength of other people's
reports, written up as settled fact by a session that could not reach a single
search host to test it.
[`evidence-scanner-activation.md`](evidence-scanner-activation.md) exists for
the same reason; it answers "how do I confirm it actually works rather than just
reporting success?" The instinct is already house style here. It applies to the
system doing the reporting as much as to the thing being reported on.

The session in this case had that instinct, once. It said it would "inspect the
actual registered actions and triggers rather than trusting the installer's
success message." That is exactly the right standard, and it was applied to the
installer and to nothing else in the same message.

## What would actually close it

1. A named Maryland attorney reviews and signs. Record the name, the date, and
   what scope was reviewed — not just that it happened.
2. Sealed external generalization evidence, produced by something that is not
   the system under test and that cannot see the course material.
3. Until both exist, release readiness stays false and the score stays under
   100. That is the system working, not the system being difficult.
4. If the owner decides to use the guide before the signature exists, record
   that as an owner choice the way Tuveloz records it — dated, attributed, and
   explicit that it is not legal approval — rather than letting the number rise
   to cover it.
