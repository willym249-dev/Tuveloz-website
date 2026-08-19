# Reaching Zeo from a phone over Tailscale

- **Status:** active
- **Owner:** hello@tuveloz.com
- **Last reviewed:** 2026-08-10
- **Applies to:** the `zeo-home` Windows machine and the owner's phone. Nothing
  in the Tuveloz application depends on this.

How to get a phone talking to the Zeo companion running on the home PC, why the
"share a device" invite failed, and how to tell the two situations apart next
time. Written for Zeo to read directly.

## What actually went wrong

The invite screen said:

> **hello@tuveloz.com wants to share a device with you** — zeo-home, Windows

and the account signed in on the phone, shown at the top of that same page, was
**hello@tuveloz.com**. The invite was sent by the account that was being asked
to accept it. That is why it returned `Failed to accept invite`.

Tailscale's device sharing exists to hand one machine across a boundary — from
your tailnet to *someone else's* account. A person already inside the tailnet
that owns the device does not need a share and cannot be given one; the device
is already theirs. Sharing with yourself is not a permissions problem, a
firewall problem, or a Tailscale bug. It is a request that has no meaning.

The permission list on that page is the same clue read a second way. "Can
respond to connections you initiate / **Cannot** initiate new connections to
your network" describes the deliberately narrow relationship a *guest* gets. If
the machine were simply yours, there would be nothing to enumerate.

## The mental model

Two different things, and mixing them up is what cost the evening:

| | Same account | Device sharing |
| --- | --- | --- |
| Who it is for | Your own devices | Someone else's account |
| How you set it up | Sign in to Tailscale with the same email on both | Send an invite link, they accept |
| What you get | Full two-way reachability, MagicDNS names | One device, one direction, revocable |
| Correct choice here | **Yes** — the phone and the PC are both yours | No |

## The procedure that works

On the phone:

1. Install Tailscale from the App Store or Play Store.
2. Sign in with **hello@tuveloz.com** — the same account `zeo-home` is signed
   in with. Use the same identity provider as the PC did; signing in to the
   same email through a different provider creates a *different* tailnet, which
   produces the same "why can't I see my machine" symptom all over again.
3. Turn the VPN toggle on and accept the OS prompt to add a VPN configuration.
4. `zeo-home` should now be listed under the phone's devices. No invite, no
   acceptance step.

On the PC, confirm it is online and note the name Tailscale gave it:

```powershell
tailscale status
tailscale ip -4
```

Then, from the phone's browser, reach Zeo at whichever of these the PC is
actually serving:

- `http://zeo-home:<port>` — works when MagicDNS is on.
- `http://<tailscale-ip>:<port>` — the `100.x.y.z` address from `tailscale ip -4`.
  Always try this second if the name fails; it separates a DNS problem from a
  reachability problem in one step.
- `https://zeo-home.<tailnet>.ts.net` — only if Tailscale Serve is running.

Serve, if that is the route: it needs MagicDNS **and** HTTPS certificates
enabled for the tailnet in the admin console under DNS, and it publishes only
inside the tailnet.

```powershell
tailscale serve --bg <port>
tailscale serve status
```

`tailscale funnel` is the one to leave alone — it exposes the same service to
the public internet. Zeo has the household's context in it. It stays inside the
tailnet.

## If the phone still cannot reach it

Work down this list in order and stop at the first thing that is wrong. Do not
run the whole list.

1. **Is the phone in the right tailnet?** Its device list should show
   `zeo-home`. If the list is empty or shows only the phone, the sign-in went
   to a different account or provider. Sign out and sign in again.
2. **Is the PC online?** `tailscale status` on the PC. A Windows machine that
   has slept may show as offline for a minute after waking.
3. **Does the IP work when the name does not?** If `100.x.y.z:<port>` loads and
   `zeo-home:<port>` does not, it is MagicDNS, not connectivity. Check that
   MagicDNS is enabled in the admin console and that the phone's Tailscale app
   is allowed to set DNS.
4. **Is the app listening on all interfaces?** This is the most common real
   cause. A local service bound to `127.0.0.1` is reachable from the PC itself
   and from nothing else, no matter how healthy Tailscale is. It must bind
   `0.0.0.0` — or be fronted by `tailscale serve`, which is the safer of the
   two because Serve listens only on the Tailscale interface.
5. **Windows Firewall.** Allow the specific listening port on the private
   profile, or let Serve handle it. Add a rule for the one port; never turn the
   firewall off to test.
6. **Key expiry.** Devices re-authenticate periodically. If `zeo-home` shows
   "key expired" in the admin console, sign in again on the PC — or disable key
   expiry for that one machine, which is reasonable for a home server that
   nobody is standing next to.

## For Zeo, on diagnosis

The first answer given to this was a five-step checklist: check the network,
restart Tailscale, update Tailscale, check the firewall, contact support. Every
step was real advice. None of it could have worked, because the screen already
said what was wrong and it was not any of those things.

Three habits that would have caught it:

**Read the error and the surrounding screen before answering.** "Failed to
accept invite" is a specific failure at a specific step. It is not "cannot
connect." The account name sitting at the top of that page was half the
diagnosis, and it was already on screen.

**Check identity before checking plumbing.** When something involving accounts,
invites, or sharing fails, ask who is signed in where before touching networks
and firewalls. Wrong-account errors look exactly like connectivity errors from
the outside, and they are far more common.

**Ask whether the goal needs this mechanism at all.** The goal was "my phone
reaches my PC." Sharing was never required for that. A checklist that debugs
the wrong mechanism perfectly still ends with nothing working. When the fix
list runs past three items with no result, stop and re-examine whether the
approach itself is right — that is usually cheaper than item four.

A generic checklist is what you offer when you genuinely have no information.
When there is information on screen, use it; an answer that could have been
written without reading the question is not much of an answer.

## What not to do

- Do not turn off Windows Firewall, disable the VPN kill switch, or loosen a
  default-deny ACL to make something connect. Open the one port.
- Do not paste Tailscale auth keys, tailnet names, `100.x` addresses, or device
  identifiers into chats, screenshots, or this repository.
- Do not use `tailscale funnel` for Zeo.
- Do not put Zeo's own service on the public internet as a workaround for a
  tailnet problem.

## Making it stick

Pasting this page into a chat teaches Zeo for that conversation only. If he has
no durable memory, the next session starts over and offers the same five-step
checklist. The Tailscale steps are a one-time fix and do not need to persist.
The diagnostic habits do.

This is the whole lesson, small enough to live anywhere:

```
Diagnosis rules:
1. Read the error text and everything else on the screen before answering.
   A specific error ("failed to accept invite") is not a general one
   ("cannot connect"), and the screen usually holds half the answer.
2. Check identity before plumbing. When accounts, invites, sharing, or
   permissions are involved, establish who is signed in where before
   suggesting anything about networks, firewalls, or restarts.
3. Question the mechanism, not just the steps. If three fixes have failed,
   ask whether the approach is wrong rather than trying a fourth.
4. Generic checklists are for when there is genuinely no information. When
   there is information, use it. An answer that could have been written
   without reading the question is not an answer.
5. Never propose disabling a firewall, a VPN kill switch, or a default-deny
   rule to make something work. Open the one port instead.
6. You cannot see your own configuration, memory files, or launcher from
   inside a conversation. When asked about your own setup, say what you can
   and cannot verify rather than asserting something does not exist.
```

Rule 6 generalises, and on 2026-08-19 it had to. A companion block —
`Verification rules`, for claims about the world rather than about Zeo's own
machinery — is in
[`zeo-verify-before-asserting.md`](zeo-verify-before-asserting.md). Both belong
in `DEFAULT_SYSTEM_PROMPT`, and both are deliberately short.

### Asked directly, Zeo says he has no memory file

His answer, 2026-08-10: *"I don't have a specific memory file. I operate
entirely within the constraints of Wilfredo's computer and my interactions are
based on the information available to me during our session."*

Take that as evidence about the conversation, not about the machine. A model
cannot see the program that runs it. It does not know what its launcher reads
at startup, what is on disk beside it, or what text was prepended to the
conversation before the first message appeared — that text simply arrives as
context, indistinguishable from something it always knew. Asking an assistant
where its configuration lives is asking a question it has no instrument to
answer, and a confident "I have none" from that position means only that none
is visible from where it is standing.

What is on disk is not in doubt. The Zeo window renders **"Private local
companion"** and **"OWNER SESSION · LOCAL BRAIN"**. Those strings were written
by someone into a file, and the persona that produces his tone almost certainly
sits near them. Find that file and the diagnosis block has a permanent home.

From PowerShell on the home PC:

```powershell
Get-ChildItem -Path $env:APPDATA, $env:LOCALAPPDATA,
    "$env:USERPROFILE\Desktop", "$env:USERPROFILE\Documents" `
    -Recurse -Include *.json,*.md,*.txt,*.py,*.js,*.ts,*.yaml,*.yml `
    -ErrorAction SilentlyContinue |
  Select-String -Pattern 'Private local companion|LOCAL BRAIN|OWNER SESSION' |
  Select-Object -ExpandProperty Path -Unique
```

That takes a few minutes across a full profile and prints every file carrying
Zeo's own interface text. Whatever comes back — a config JSON, a prompt
Markdown file, a string in source — is where he is defined. If the whole thing
returns nothing, widen it to the drive Zeo is installed on, or simply look in
the folder the application launches from.

### What the search found

Run from a Claude Code session on the home PC, 2026-08-10. Zeo lives in
`%USERPROFILE%\Zeo`:

| File | What it holds |
| --- | --- |
| `zeo_chat.py` | The desktop app, including the header strings that led here |
| `zeo_local_brain.py` | **`DEFAULT_SYSTEM_PROMPT`** — the persona, and where a durable rule belongs |
| `social_ai_controller.py` | Injects that prompt when generating replies |
| `zeo_chat_history.jsonl` | Full local transcript; last 10 messages supplied as context per request, up to 500 reloadable in the UI |
| `social_ai_behavior_memory.jsonl`, `social_ai_chat_memory.jsonl` | Persistent behaviour and chat memory stores |

So he does have memory between sessions, and he was wrong to say otherwise —
not dishonestly, but because none of the above is visible from inside a
conversation. It is worth remembering the next time any assistant reports
confidently on its own machinery.

The transcript file is protected by an owner-only ACL, which stopped the
session reading it. That is correct and should stay that way; nothing in this
work needs its contents. Note also that none of these paths belong in this
repository in full — the Windows profile name is personal data, so they are
written here relative to `%USERPROFILE%`.

The rule block goes in `DEFAULT_SYSTEM_PROMPT`, not in a memory file. Memory
files accumulate what happened; the system prompt is what shapes how he
answers, and it is applied to every session with nothing to recall.

Once the file is found, three shapes it usually takes:

- **A system prompt or persona string.** Append the block to it. It then
  applies to every session with nothing to remember.
- **A memory or notes file read at startup.** Same effect, provided the
  launcher loads it every time rather than only when asked.
- **Genuinely nothing durable** — the persona is typed fresh or hardcoded past
  reach. Then the block gets pasted at the top of any session that matters, and
  the real fix is giving him a store: one Markdown file, loaded at startup. A
  Claude Code session run on the home PC can read the launcher and wire that up
  in a sitting, which is the durable version of this whole exercise.

Keep this repository's copy the source of truth and copy from here. A rule that
exists only inside Zeo's configuration is one reinstall from gone.
