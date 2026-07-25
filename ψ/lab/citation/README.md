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
```

No `bun install` — the plugin has **no dependencies**. Or skip maw entirely and use
`./bin/citation` (see below); `scripts/setup-citation.sh` handles either path.

`.envrc` sets `MAW_HOME` so `maw plugin install` / `maw citation` resolve to this
repo's own `.maw/` — and `repoRoot()` derives from `dirname($MAW_HOME)` (muninn's
hard-won lesson: `maw` cds into the plugin's install dir, so `process.cwd()` is
useless for finding the repo).

## Usage

```bash
maw citation status                          # root + cards + store + embedder, one check
maw citation cards [corpus.jsonl]            # JSONL → one markdown card per paper in ψ/papers/ (+ INDEX.md)
maw citation index [--vault]                 # embed the cards → local store; --vault also indexes retros/lessons/research
maw citation search <query> [-k N] [--json]  # semantic search over papers (and notes, if --vault was used)
maw citation serve [--port N] [--threshold N] [--quiet]   # serve the interactive 2D constellation (:5556, verbose by default)
maw citation graph [--threshold N] [--out P] [--html [P]] [--verbose]  # 2D network → SVG (+ PNG if sharp present, + portable interactive HTML)
```

`serve` (alias: `visualize`) is **verbose by default** — it prints embedding model,
t-SNE time, similarity max/mean, edge density, isolated papers, per-topic counts and
the most-connected papers. `--quiet` trims it to the banner. If the port is busy
(an earlier `serve` still running) it steps to the next free one and says so.

### In the page

| Interaction | What you get |
|---|---|
| hover a star | topic, full title, journal |
| **click a star** | popup: full text, **distinctive terms** (what it's about), **nearest papers + the terms they share** (why they sit close), and **Open the original** links |
| click a legend row | filter that cluster in/out |
| search | embeds your query (shared worker) and highlights the top 10 |
| drag / scroll | pan / zoom |

**Why two papers sit close** — bge-m3 exposes no keywords, so the popup shows
IDF-weighted term overlap as *evidence*, clearly labelled as a lexical proxy, not
the cause. What gets embedded is stated in the popup too: `title + summary +
thesis_relevance`, concatenated.

**Open the original** — the corpus has no DOI/URL field yet, so links go out to
Google Scholar / Semantic Scholar / Crossref by title. If a paper ever gains a
`doi` or `url` field, the page links to it directly (already wired).

### Architecture

The interactive page is a **real HTML file**: [`src/page.html`](src/page.html).
`src/index.ts` loads it with `Bun.file(join(import.meta.dir, "page.html"))` and
substitutes the two font stacks plus one JSON data blob (`#cdata`). Edit the page
directly — real syntax highlighting, no template-string escaping. `maw plugin
install` copies it alongside the source, so it ships with the plugin.

> Gotcha, learned the hard way: never write a placeholder's literal name in
> `page.html`'s own comments — substitution is textual and the mention gets
> replaced instead of the real token (it silently produced a blank page once).
> The builder now fails loudly if any `{{` survives.

**`graph` vs `visualize`** — same t-SNE layout, same similarity edges, same two-line
labels (author+year, then the paper's name). `visualize` *serves* the interactive page
on a port; `graph --html` *writes* it to a file you can open or share with no server
running. `graph` alone writes the SVG (plus a PNG when `sharp` happens to be installed).

`search` / `index` need an embedding backend, auto-detected in this order:

| Backend | Condition | Notes |
|---|---|---|
| **ollama** | `bge-m3` pulled and ollama running | local, GPU-backed, no token, no egress — the default |
| Cloudflare worker | worker on `:18787` | reuses your `wrangler` login |
| Cloudflare REST | `CF_ACCOUNT_ID` + `CF_API_TOKEN` | a real token |

```bash
ollama pull bge-m3 && ollama serve                                  # local
cd ~/.maw/plugins/cf-embed/worker && wrangler dev --port 18787      # or cloud
```

Force one with `CITATION_EMBED=ollama|worker|cf-rest`. The model id is recorded in the
store's `manifest.json` — vectors from different models are not comparable, so switching
models means re-indexing.

## Two entry points, one implementation

| Entry | Needs | Repo root found via |
|---|---|---|
| `maw citation <verb>` | maw + bun | `MAW_HOME` (unchanged behaviour) |
| `./bin/citation <verb>` | bun only | walking up from the script for `CLAUDE.md` + `ψ/` |

Both call the same exported `handler`, so there is no second dispatch path to keep in sync.
Resolution order: `CITATION_ROOT` → `MAW_HOME` → walk up from the script → walk up from cwd →
`git rev-parse --show-toplevel` → cwd. `status` prints which one won, because a silently wrong
root reports "0 paper cards" and looks like data loss.

Store follows the root: `$MAW_HOME/citation-data/store` under maw, `<repo>/.citation/store`
standalone. Both gitignored and rebuildable.

## Data

- **Canonical store**: [`ψ/papers/`](../../papers/) — one markdown card per paper, with
  frontmatter (`citekey / authors / year / journal / quartile / topic / doi / status`) and a
  `## Notes` section that survives regeneration. See
  [`ψ/papers/README.md`](../../papers/README.md) for how to add a paper and index by hand.
  `index` reads cards first and only falls back to the JSONL when none exist.
- **Import source**: `artifacts/literature_corpus.jsonl` — 56 papers
  (`id / title / journal / topic / summary / thesis_relevance`), a working copy of
  `DustBoy-Phd-Oracle/artifacts/literature_corpus.jsonl`. `cards` also merges in the parent's
  `LITERATURE_REVIEW_PAPERS.md` for real author lists (56/56 matched; 9 read `[Authors]`
  upstream and are flagged `needs-authors` rather than guessed).
- **One index for both**: `--vault` embeds `ψ/memory/{learnings,retrospectives,resonance}` and
  `ψ/writing/research` alongside the papers, tagged `kind: note`. Search spans both; the
  constellation stays papers-only.
- **Batching**: embeds go out in groups of 16 (`CF_EMBED_BATCH`) — a single large request
  fails once vault notes are included.
- **Store**: three plain files — `vectors.f32` (N × dim Float32), `meta.jsonl`, `manifest.json`.
  No database, no native dependency. Search is brute-force cosine in pure TypeScript: 73 rows
  in ~0.2 s including the query embed. Delete the directory and re-index; it is derived data.
- **Embeddings**: `bge-m3`, 1024-dim, multilingual — genuinely neural, the upgrade from the
  June TF-IDF maps.

## After editing `src/index.ts`

The installed copy is a plain file copy, not a symlink — re-sync:

```bash
maw plugin install ψ/lab/citation --force
```

(`./bin/citation` reads the source directly — nothing to reinstall.)

## Roadmap

- `bib` — cards → BibTeX (unblocked for the 8 cards with Crossref-verified DOIs; 9 cards
  still need authors)

Not built yet — *cite what's real*.
