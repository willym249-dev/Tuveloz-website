# Extraction procedure: `mobile/` → `tuveloz-app`

This project is temporarily housed in `mobile/` inside the `Tuveloz-website`
repository. It shares no code with the website — see
[ADR 0001](decisions/0001-project-location.md) — and is designed to become a
standalone repository.

This document is the procedure for that move. It exists so the extraction is a
mechanical operation somebody can execute in ten minutes, not a research task.

**These steps have been rehearsed, not just written.** The Step 1 export was
run against this commit into a directory simulating a fresh GitHub clone, and
at the new root `npm ci` (958 packages), `npm run verify` and
`npx expo export --platform android` all succeeded. 91 files came across and no
`node_modules` leaked. The only steps that have _not_ been executed are the two
that require GitHub permissions this project's automation does not have:
creating the repository and granting the app access to it.

**Delete this file once the extraction is complete.**

---

## Prerequisites (owner, manual — cannot be automated)

Repository creation is not available to the automation working on this project;
these two steps must be done by hand in GitHub.

1. **Create the repository** at <https://github.com/new>

   | Field             | Value               |
   | ----------------- | ------------------- |
   | Owner             | `willym249-dev`     |
   | Repository name   | `tuveloz-app`       |
   | Visibility        | **Private**         |
   | Add a README file | ✅ checked          |
   | Add .gitignore    | **Node**            |
   | Add a license     | None (decide later) |

   GitHub names the default branch `main`, which is what this project expects.

2. **Grant the Claude GitHub App access to the new repository.**
   GitHub → Settings → Applications → Claude → Configure → Repository access →
   add `tuveloz-app`, or select "All repositories".

   Skipping this produces a `404` on every operation even though the
   repository exists. It is the single most common way this goes wrong.

---

## Step 1 — Extract the files

The recommended method takes the tracked contents of `mobile/` and makes them
the root of a brand-new repository with a single initial commit. No website
commits, no shared ancestry, no shared lockfile.

```bash
# From anywhere. Adjust the two paths to suit your machine.
WEBSITE=~/code/Tuveloz-website          # existing clone, on the foundation branch
TARGET=~/code/tuveloz-app               # fresh clone of the new empty repo

git -C "$WEBSITE" checkout claude/tuveloz-project-foundation-k1rutr
git clone git@github.com:willym249-dev/tuveloz-app.git "$TARGET"

# `git archive` exports only tracked files, so node_modules, .expo and every
# other ignored path are excluded automatically. --strip-components=1 removes
# the leading `mobile/` so its contents land at the repository root.
git -C "$WEBSITE" archive HEAD mobile | tar -x -C "$TARGET" --strip-components=1
```

`tar` merges into the existing clone, so the README GitHub generated is
replaced by this project's README, and the Node `.gitignore` is replaced by the
Expo-aware one. That is intended — both generated files are placeholders.

<details>
<summary>Alternative: <code>git subtree split</code> (preserves per-file history)</summary>

Only worth it if `mobile/` has accumulated several commits worth keeping. At
the time of writing it has one, so the two approaches produce identical
results and the method above is simpler.

```bash
git -C "$WEBSITE" subtree split --prefix=mobile -b extracted-app
git -C "$TARGET" remote add source "$WEBSITE"
git -C "$TARGET" fetch source extracted-app
git -C "$TARGET" reset --hard source/extracted-app
git -C "$TARGET" remote remove source          # do not leave this attached
```

The rewritten commits contain only `mobile/` paths — no website files and no
shared commit SHAs — but they do carry the original commit messages and
authorship. Remove the `source` remote afterwards so the new repository has no
reference to the website.

</details>

## Step 2 — Verify before committing anything

Run the same commands CI runs. They must all pass at the new root.

```bash
cd "$TARGET"
npm ci
npm run verify        # typecheck && lint && format:check
```

Then confirm the app still bundles:

```bash
npx expo export --platform android --output-dir /tmp/tuveloz-export-check
rm -rf /tmp/tuveloz-export-check
```

If `npm ci` fails, the lockfile did not come across — check that
`package-lock.json` is present at the root.

## Step 3 — Commit and push

```bash
cd "$TARGET"
git add -A
git commit -m "Add the Tuveloz app foundation (Phase 1)"
git push origin main

git checkout -b claude/app-foundation
git push -u origin claude/app-foundation
```

Development continues on `claude/app-foundation`. `main` is never committed to
directly.

## Step 4 — Post-extraction adjustments

Eleven references assume the project lives in `mobile/`. Each one is listed
here with what it should become.

### In the new repository

| File                                      | Line(s)    | Change                                                                                                                                              |
| ----------------------------------------- | ---------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `README.md`                               | ~12        | Remove the blockquote about living in a directory of the website repo; keep the statement that the app is separate from the website                 |
| `README.md`                               | ~38        | `cd mobile` → `cd tuveloz-app`                                                                                                                      |
| `README.md`                               | ~76        | The directory tree is headed `mobile/` → rename to `tuveloz-app/`                                                                                   |
| `PROJECT_STATUS.md`                       | ~84        | Replace the "lives in `mobile/` inside the website repository" bullet with a statement that extraction is complete                                  |
| `src/lib/env.ts`                          | ~53        | Error text says `mobile/.env.example` → `.env.example`                                                                                              |
| `supabase/README.md`                      | ~10        | `mobile/.env` → `.env`                                                                                                                              |
| `.github/workflows/verify.yml`            | ~3–7       | Delete the "this workflow is INERT" note — it is now live                                                                                           |
| `docs/decisions/0001-project-location.md` | header     | Mark **Superseded by 0008**                                                                                                                         |
| `docs/DECISIONS.md`                       | table      | Update 0001's status; add the row for 0008                                                                                                          |
| `docs/EXTRACTION.md`                      | whole file | Delete it — the procedure is done                                                                                                                   |
| `ROADMAP.md`                              | ~75        | Phase 4 mentions "the existing Cloudflare Worker in the website repository" — still accurate, but reword to make clear it is a different repository |

Then write **ADR 0008 — the app is a standalone repository**, superseding 0001.
It should record: that extraction happened, the date, that no website code or
git history came across, and that the website README pointer was removed.

Finally, re-run `npm run verify` and commit the adjustments.

### In the website repository

Once the new repository is confirmed working, and **not before**:

1. Remove the four-line "Related project: the Tuveloz mobile app" section from
   the root `README.md`.
2. Close the draft pull request that carries `mobile/` (it must **not** be
   merged).
3. Delete the branch `claude/tuveloz-project-foundation-k1rutr`.

Deleting that branch destroys the only pushed copy of this work, so do it only
after `tuveloz-app` has the code and a green verify run.

---

## What must be true when this is finished

- [ ] `tuveloz-app` exists, is private, default branch `main`
- [ ] The contents of `mobile/` are at the repository root
- [ ] `package.json`, `package-lock.json`, all configs and all docs came across
- [ ] All seven ADRs plus the decision log are present
- [ ] `npm ci && npm run verify` passes at the new root
- [ ] `npx expo export --platform android` bundles
- [ ] CI runs automatically on push and pull request
- [ ] No remote, submodule or path in the new repository refers to
      `Tuveloz-website`
- [ ] `git log` in the new repository contains no website commits
- [ ] Development continues on `claude/app-foundation`
- [ ] No credentials or `.env` file is committed anywhere
