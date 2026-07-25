# Handoff: Citation Oracle day one → a standalone `citation` runner

**Date**: 2026-07-25 17:15 (GMT+7)
📡 Session: c59ddec8 | phd-citation-oracle | 14:14 → 17:15 (~3h) | 19 commits
**Repo**: PUBLIC · https://github.com/Soul-Brews-Studio/phd-citation-oracle

## Context

**Oracle**: Citation Oracle ✦ (—) | **Human**: Nat Weerawan (they/them)
**Mode**: Fast (parent-consulted) | **Memory**: auto | **Team**: solo, federated via `maw`

## What We Did

- **Born** — `/awaken --fast`, but asked the live parent (`102-dustboy-phd`) who I should be
  first. Theme: The Constellation. Domain: the corpus, `.bib`, the citation graph.
- **Resolved the lost-image dig** (4 oracles) — the genuinely *neural* embedding images were
  bongbaeng's MiniLM renders, already committed in digger's own artifacts. Corrected digger's
  "no neural image exists" claim against its own files; it patched wiki #147.
- **Built `maw citation`** — `status · cards · index · search · serve · graph`, 1,364 lines.
- **Markdown paper cards** (`ψ/papers/`, 62) as the canonical corpus — filename = citekey =
  `\cite{}` key, `## Notes` survives regeneration. `index --vault` puts papers *and* the
  oracle's own notes in one index.
- **Ingested Gemini's AOD report** via a 10-agent workflow → 6 new cards, 2 enriched,
  **8 Crossref-verified DOIs** (0/56 → 8/62). **Caught a fabricated citation** (Gemini's
  "Chen et al." is really She et al. 2019 — wrong author *and* title) and a false duplicate.
- **Zero-dependency rewrite** — dropped LanceDB + sharp. **487 MB → 140 KB**. Plain-file vector
  store, ollama local-GPU embeddings (6.2 s for 73 items), cloud embedder still optional.
- **4 MIT skills**: `gemini-deep-research`, `paper-card`, `research-ingest`, `research-harvest`.
- **Open sourced**, with an honest-caveats section and a Thai manual (`ψ/papers/README.md`).
- **Security incident, mine**: `git add -A` swept `.codex/` into the then-public repo. Nat
  caught it. Only a symlinked `auth.json` kept it a near-miss. Remediated, lesson written,
  the review-before-commit habit now runs on every commit.

## Next Session: a standalone `citation` runner (Nat's stated goal)

> *"create more runner to wrap maw citation — it should be callable if we have no maw engine installed"*

**Good news: most of the work is already done.** Removing the native deps means the entry point
already runs standalone — `bun ψ/lab/citation/src/index.ts status` works today and correctly
auto-detects ollama. Verified this session.

**The only real gap is root resolution.** Without `maw`, `MAW_HOME` is unset, so:

| Location | Line | Falls back to | Consequence without maw |
|---|---|---|---|
| `repoRoot()` | ~220 | `process.cwd()` | run from `/tmp` → looks for `/tmp/ψ/papers`, finds 0 cards |
| `STORE_DIR` | ~145 | `${cwd}/citation-data/store` | store lands wherever you happened to `cd` |

**Suggested shape** (not prescriptive):
1. `findRepoRoot()` — walk up from `import.meta.dir` (and then cwd) looking for a directory
   containing `CLAUDE.md` **and** `ψ/`; fall back to `git rev-parse --show-toplevel`; only then
   `cwd`. Prefer `MAW_HOME` when present so maw behaviour is unchanged.
2. Derive `STORE_DIR` from that root — e.g. `<root>/.citation/store` when there's no `MAW_HOME`,
   so the store follows the corpus rather than the shell.
3. `bin/citation` — a small executable shim (`#!/usr/bin/env bun`) importing the same handler,
   so `./bin/citation search "..."` works with no maw at all.
4. Decide whether `bun` counts as "no deps" — it's the runtime. If a truly bun-free path is
   wanted, that's a compiled binary (`bun build --compile`), worth its own decision.
5. Keep `maw citation` working identically — the runner is an *additional* entry, not a
   replacement.

## Pending

- [ ] Standalone runner — root resolution + `bin/citation` shim (above)
- [ ] `maw citation bib` — JSONL/cards → BibTeX; unblocked for the 8 cards with verified DOIs
- [ ] Resolve the 9 `status: needs-authors` cards via Crossref (blocks a complete `.bib`)
- [ ] `/research-harvest` the AOD report — synthesis table, 3 disagreements, verification queue,
      and 3 critical gaps (one may be a genuine contribution: no published TROPOMI AOD
      validation over mainland SE Asia 2021–2026)
- [ ] Verify EPA/600/R-20/280 and EU Directive 2008/50/EC Annex I thresholds (secondary-sourced)
- [ ] Get the parent's `artifacts/comparison/multi_source_comparison_overall.csv` so Lin's CCC,
      Bland–Altman LoA and a Deming slope can actually be computed
- [ ] `codex login` — closes the only live-risk part of the `.codex` exposure
- [ ] Optional: purge `.codex` blobs from history at `29931f8` (needs a force-push waiver)

## Key Files

- `ψ/lab/citation/src/index.ts` — the plugin (root resolution at ~220, store at ~145)
- `ψ/lab/citation/src/page.html` — the interactive constellation (real HTML, loaded by the TS)
- `ψ/papers/README.md` — the Thai manual: adding papers, manual indexing, troubleshooting
- `scripts/setup-citation.sh` — fresh-clone bootstrap (the closest thing to a runner today)
- `ψ/writing/research/2026-07-25_se-asia-satellite-aod-validation.md` — filed report + `## Review`
- `ψ/memory/learnings/2026-07-25_review-what-you-stage.md` — the incident lesson
- `.claude/skills/` — 4 MIT skills

## State

Working tree **clean**, 19 commits pushed, no open PRs, no branches beyond `main`, no issues.
Store: 73 × 1024-dim (292 KB) at `$MAW_HOME/citation-data/store`, model `ollama:bge-m3`.
