---
pattern: "Never `git add -A` without reading the staged file list — in a public repo it is one keystroke from publishing a credential, and a symlinked secret is the only reason my own mistake was a near-miss instead of a breach"
date: 2026-07-25
source: "rrr: phd-citation-oracle"
concepts: [git, security, credentials, public-repo, staging, near-miss, habit]
---

# Review what you stage — especially in a public repo

## What happened

I committed a feature with `git add -A`. It swept in `.codex/` — a coder-team runtime directory
that had appeared in the repo minutes earlier — **19 entries, into a repository I had personally
made public twenty minutes before**. My commit message described the feature and never mentioned
the 19 unexpected files, because I never looked at what I was staging.

Nat caught it, not me: *"เราอย่าหลุด Authentication เข้าไปนะครับ"*.

**The outcome was luck.** `.codex/auth.json` happened to be a **symlink**, so git stored a
34-byte path string (`/Users/nat/.codex-team/5/auth.json`) instead of the credential it points
at. Had it been a regular file, I would have published a live OAuth token to the internet.

What did go public for ~15 minutes: codex session logs, sqlite state (goals/memories/logs, incl.
a 1.4 MB WAL), an installation id, a session transcript, and `config.toml`. One truncated ES256
JWT was in the logs; I could not determine whether it was live, and said so rather than guessing.

The bitter part: **I had written the fix earlier in the same session.** My own lesson file from
the previous retrospective says to review before you ship. I wrote it, then didn't do it, in the
highest-stakes moment of the day.

## The habit that replaces it

```bash
git add -A
git diff --cached --name-only                 # actually read this
git diff --cached --name-only | rg -i '\.env|auth|token|secret|credential|\.pem|\.key$|sqlite' \
  && echo "⚠ STOP" || echo "✓ clean"
git commit ...
```

Three seconds. I have run it on every commit since, and it is the reason the four subsequent
commits were clean.

## Rules

- **`git add -A` is not a neutral act in a public repo.** Stage, print the list, grep it, then
  commit. A tool directory can appear in your working tree between commits without you doing
  anything.
- **Keep credentials as symlinks into a directory outside the repo.** It converts a catastrophic
  mistake into a path disclosure. Worth doing deliberately rather than benefiting from it by
  accident, as I did.
- **When something leaks, flip visibility first, assess second.** Private is reversible;
  published is not. Assessment done while still exposed is worse assessment.
- **Report what did NOT leak with the same precision as what did.** "The token is safe because
  auth.json is a symlink and git stored only a path" is what lets a person decide whether to
  rotate. "There was a leak" and "it's fine" are both useless.
- **Don't resolve an unknown by guessing.** The JWT was truncated. "I could not determine
  whether this is live, so re-auth to be certain" beats a confident claim in either direction.
- **Scan a directory before bundling it, not after.** Later the same session I was asked to
  commit `.maw/`; I scanned first, found 487 MB of `node_modules` plus machine-specific state,
  and wrote a bootstrap script instead. That is the same lesson applied in time.

Related: [[verify-in-the-users-environment]] — the other half of the pattern, where the failure
was reporting a result my method hadn't established.
