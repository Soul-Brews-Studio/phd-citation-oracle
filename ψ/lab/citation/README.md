# citation — Citation Oracle's own maw plugin ✦

Local **index / search / visualize** over the PhD **literature corpus** — a real
maw plugin, installed project-locally under `.maw/` (not the global
`~/.maw/plugins`). Same shape as [muninn](https://github.com/laris-co/muninn-oracle)
(`ψ/lab/muninn`), tuned for papers: the unit is a paper, the color is its topic —
**The Constellation**.

## Setup (one-time, or after pulling this repo fresh)

```bash
cd /opt/Code/github.com/Soul-Brews-Studio/phd-citation-oracle
direnv allow                         # loads .envrc → MAW_HOME=$PWD/.maw
maw plugin install ψ/lab/citation    # copies source into .maw/plugins/citation
cd .maw/plugins/citation && bun install && bun pm trust --all
cd -
```

`.envrc` sets `MAW_HOME` so `maw plugin install` / `maw citation` resolve to this
repo's own `.maw/` — and `repoRoot()` derives from `dirname($MAW_HOME)` (muninn's
hard-won lesson: `maw` cds into the plugin's install dir, so `process.cwd()` is
useless for finding the repo).

## Usage

```bash
maw citation status                          # corpus + arra backend + LanceDB + CF embed, one check
maw citation index [corpus.jsonl]            # embed papers (default artifacts/literature_corpus.jsonl) → LanceDB
maw citation search <query> [-k N] [--json]  # semantic search over indexed papers
maw citation visualize [--port N]            # 3D constellation — papers as stars, topics as colors (default :5556)
```

`search` / `index` / `visualize`-search need the **shared** local embed worker
(no Cloudflare token — reuses your `wrangler` login). **Reuse the one already
running**, don't start your own:

```bash
cd ~/.maw/plugins/cf-embed/worker && wrangler dev --port 18787
```

## Data

- **Corpus**: `artifacts/literature_corpus.jsonl` — 56 papers
  (`id / title / journal / topic / summary / thesis_relevance`), our own working
  copy; upstream is `DustBoy-Phd-Oracle/artifacts/literature_corpus.jsonl`.
- **Index**: LanceDB at `$MAW_HOME/citation-data/lancedb` (stable across
  `--force` reinstalls, which wipe the plugin's own tree). `mergeInsert("id")`
  makes re-indexing idempotent.
- **Embeddings**: `@cf/baai/bge-m3`, 1024-dim, multilingual — genuinely neural,
  the upgrade from the June TF-IDF maps.

## After editing `src/index.ts`

The installed copy is a plain file copy, not a symlink — re-sync:

```bash
maw plugin install ψ/lab/citation --force
cd .maw/plugins/citation && bun install && bun pm trust --all
```

## Roadmap

- `bib` — JSONL → BibTeX keys (needs full author/year, from `LITERATURE_REVIEW_PAPERS.md`)
- `graph` — citation edges (claim ↔ source) for the related-work chapter

Not built yet — *cite what's real*.
