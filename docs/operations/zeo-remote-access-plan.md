# Zeo remote access plan

- **Status:** draft
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-09
- **Applies to:** Zeo, the owner's local assistant — not to this repository's code or deployment
- **Source:** drafted by ChatGPT and pasted into a Claude Code session on 2026-08-09; filed here unverified

This records the proposed way to reach Zeo from a phone or work computer without
putting it on the public internet, and the limits the remote setup is meant to
keep. Nothing here is built yet.

## What Zeo is, for anyone reading this cold

Zeo is the owner's own assistant, running on the home PC. It is not part of the
Tuveloz application, has no code in this repository, and does not appear in any
build or deploy path. This document lives here because it is an operational
procedure the owner needs written down, not because Zeo ships with the product.

## What the remote setup is for

From a phone or a work computer, over a private connection:

- chat with Zeo
- add reminders and tasks
- request daily briefs
- inspect Tuveloz

## The recommended shape

Put Zeo on a **private network rather than a public website**: Tailscale, with
Tailscale Serve publishing the local interface to the owner's own devices only.

**Explicitly rejected:** Tailscale Funnel and router port-forwarding. Both expose
the service publicly, which is the thing this design exists to avoid.

Reference: [Tailscale Serve documentation](https://tailscale.com/kb/1312/serve).

## Access control

Two independent requirements, both needed:

1. The owner's private-device identity (the device must be on the tailnet).
2. Zeo's owner password.

## What stays gated

Remote access is deliberately narrower than sitting at the machine. Initially,
remote Zeo may chat, learn, manage tasks, and **draft** changes. These stay
approval-gated or local-only:

- applying code changes
- deletions
- publishing
- other sensitive or destructive actions

Zeo's audit log and its correction learning are preserved across the change —
the remote path must not become a way to act without a record.

## Build steps

1. Install Tailscale on the home PC and on the phone.
2. Add a local Zeo web interface.
3. Bind that interface to `127.0.0.1` only.
4. Publish it privately through Tailscale Serve.
5. Require Zeo's owner authentication.
6. Start it automatically with Windows.
7. Test remote chat, reminders, session timeout, and that unauthorized access is
   actually blocked.

## Prerequisites and standing constraints

- Tailscale is **not currently installed** on the home PC.
- The home PC must stay powered on, connected, and awake. If it sleeps, Zeo is
  unreachable — this is the main practical failure mode of the whole design.
- Workplace device and network rules still apply to the work computer. Check them
  before installing anything on it.

## What this does not do

This gives remote access to **Zeo**. It does not control Claude Code or Codex
conversations — those are separate sessions in separate places. Zeo's existing
advisor gateway can contact an external AI on its own, but doing so sends
selected information off the home PC, which is a separate decision from remote
access and should be treated as one.

## Open questions before building

- Session timeout length, and whether remote sessions expire faster than local.
- Whether "inspect Tuveloz" means read-only repository and dashboard access, and
  what it must never reach — production secrets and customer data in particular.
- Whether the audit log is reachable remotely, or only at the machine.
- Whether a lost or stolen phone has a one-step revocation path (removing the
  device from the tailnet) that the owner has actually practiced.
