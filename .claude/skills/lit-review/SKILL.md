---
name: lit-review
description: Run a literature-review working session end to end, starting from whatever you actually have — a single reference, a list, a full AI research report, or only a TOPIC with no papers yet. For a topic it triages you into getting sources from two independent retrievals and CROSS-CHECKING them against each other before anything becomes a card, because the papers only one source found are where fabrications live. Then verify metadata against Crossref, re-index, and read the corpus as a map to find gaps and neighbours. Use this whenever someone says "I want to do a literature review", "add these papers and show me the map", "ทำ literature review", "เพิ่ม paper แล้ว visualize", "what's missing from my corpus", "which papers are near this one", "show me the constellation", "I only have a topic, where do I start", "หาเปเปอร์เพิ่มให้หน่อย", "ได้ list มาจาก Gemini", "cross check papers", or hands over a batch of newly-found papers to file. Covers the whole loop — add → verify → index → visualise → gap-hunt — and names the traps that silently corrupt a corpus. For a single paste-in-one-reference job use `paper-card` instead; for absorbing an external AI research report use `research-ingest`.
argument-hint: "add <doi|title> | topic <subject> | crosscheck | visualize [--threshold N] | gaps | check"
---

# lit-review — the working loop

A literature review is not a one-shot import. It is a loop you run many times:

```
find a paper → add a card → VERIFY it → re-index → look at the map → find the next gap
```

The step people skip is **verify**, and it is the one that decides whether the
bibliography is trustworthy. On this corpus, verifying 62 inherited cards against
Crossref found **18 errors in 14 of them** — wrong first authors, an invented title
sitting on a correct DOI, page numbers read off the DOI's own digits. Every one looked
completely plausible. None would have been caught by reading the cards.

**Prerequisite:** `./bin/citation status` should show a card count and a reachable
embedder. If the embedder line is missing, `search`/`visualize` cannot run — start one
(`ollama serve`) or see §"When things go wrong".

---

## 0. What did you actually get? — triage first

What arrives is rarely a clean list. Route it before touching the corpus:

| You have | Do this | Then |
|---|---|---|
| **one** reference / DOI / title | §1 below, by hand | §2 verify |
| **a list** of references | `/paper-card import` — dedupes against the corpus first | §2 verify |
| **a full report** (prose + bibliography) from Gemini/ChatGPT/Perplexity | `/research-ingest <path>` — files it verbatim with provenance, then verifies every DOI *before* writing a card | §2, then `/research-harvest` |
| **only a topic**, no papers yet | §0.1 below — go get sources, from **more than one** | §0.2 cross-check |

### 0.1 You have a topic, not a list

Ask the corpus first — you may already own the answer:

```bash
./bin/citation search "the claim you intend to make, as a full sentence" -k 10
```

Short 2–3 word queries score badly against a 1024-dim embedding: tiny fragments win on
cosine for the wrong reasons. Write the actual sentence you want to support.

If the corpus is thin there, get outside sources — and get them from **at least two
independent retrievals**, because the whole point of the next step is comparing them:

```
/gemini-deep-research <topic>      # builds the brief; run it in Gemini, save the report
```

Independent means *different retrieval mechanism*, not just a different prompt. A good
second source is a real bibliographic index (Scopus, Web of Science, Semantic Scholar)
or a Crossref query you run yourself:

```bash
# a second, mechanical retrieval you control — no model in the loop
curl -s "https://api.crossref.org/works?query.bibliographic=YOUR+TOPIC\
&filter=from-pub-date:2022-01-01,type:journal-article&rows=20\
&select=DOI,title,container-title,issued,author&mailto=you@example.com" \
  | bun -e 'const items=(await Bun.stdin.json()).message.items??[];
      for(const i of items) console.log(i.DOI, "|", (i.title??[""])[0].slice(0,80));'
```

### 0.2 Cross-check the sources against each other

**This is the step that earns the second retrieval.** Put the two lists side by side
before anything becomes a card:

| Bucket | What it means | What to do |
|---|---|---|
| **in both** | two independent retrievals agree it exists and is relevant | strongest candidates — verify DOIs, then file |
| **only in the index** (Scopus/Crossref) | the model missed it | usually real and worth reading — models under-retrieve recent and non-English work |
| **only in the AI report** | either a genuine find the index query missed, **or invented** | ⚠️ **verify these first, every time** |
| **in neither** but you expected it | possible gap — or your query was wrong | re-query before concluding anything |

The "only in the AI report" bucket is where fabrications live. On this corpus a Gemini
report produced exactly that failure: it cited *"Chen, X. et al. — Validation of GeoNEX
Himawari-8 MAIAC Aerosol Optical Depth"*. **No such paper exists.** The real one is
She, L., Zhang, H., Wang, W. & Wang, Y. (2019), with a different title — wrong author
*and* wrong title, on a DOI that was correct all along. It looked completely ordinary.

Also cross-check **the metadata, not just the existence**. When two sources describe the
same DOI differently, one of them is wrong:

```bash
# does the corpus already hold it, under a different key?
./bin/citation search "<paper title>" -k 3

# what does the registration authority say?
curl -s "https://api.crossref.org/works/<DOI>?mailto=you@example.com" \
  | bun -e 'const m=(await Bun.stdin.json()).message;
      console.log((m.title??[""])[0]);
      console.log((m["container-title"]??[""])[0], m.issued?.["date-parts"]?.[0]?.[0]);
      console.log((m.author??[]).map(a=>a.family).join(", "));'
```

Three real traps this catches, all seen on this corpus:

- an **`[Already Catalogued]` marker pointing at the wrong card** — believing it would
  have written a wrong DOI onto a card that was already correct
- **a fabricated title bolted to a correct DOI** — nobody had compared the two, and it
  survived hours of work until a later verification scored the title at 0.33
- **page numbers read off the DOI's own digits** — `…-00363-w` became "p363" when the
  real article number is 41

> **A paper both sources miss is not proof it does not exist.** Two failed retrievals are
> still two retrievals. Before writing "no published work addresses X", run a deliberate
> negative search in a real index and check the product documentation — see §5.

Once cross-checked, the survivors go through §1 → §2 like anything else. Nothing skips
verification because it "came from two places".

---

## 1. Add a paper

The card is markdown in `ψ/papers/`, and **the filename is the `\cite{}` key**. Fill in
only what you cannot look up; Crossref supplies the rest.

```bash
cd ψ/papers
cp mahajan2025.md nan2026.md          # any existing card as a template
$EDITOR nan2026.md
```

Fill **four fields** and leave the rest empty on purpose:

```yaml
citekey: nan2026                       # must equal the filename
title: "An integrated low-cost air quality sensor and a multi-task calibration framework"
year: "2026"
journal: "Environment International"
topic: "low-cost-sensor-calibration"   # must be one of the existing topics
authors: []                            # ← leave empty, Crossref fills it
doi: ""                                # ← leave empty
volume: ""                             # ← leave empty
pages: ""                              # ← leave empty
status: needs-authors
```

Then write the two body lines that make the paper *findable*, because these are what
gets embedded — `title + Key findings + Thesis relevance`, nothing else:

```markdown
**Key findings** — what it actually reports, with the real numbers (R², RMSE, n)

**Thesis relevance** — why it matters to YOUR argument. This field is what makes
semantic search useful; a vague sentence here makes the paper hard to find later.

## Notes
Your own thinking. `citation cards` never overwrites anything under this heading.
```

**Getting the topic right matters** — it colours the node in the map and groups it in
`INDEX.md`. Use an existing one:

```bash
./bin/citation status >/dev/null && rg -o '^topic: "(.*)"' -r '$1' ψ/papers/*.md | sort | uniq -c | sort -rn
```

## 2. Verify — never skip this

```bash
./bin/citation doi nan2026            # dry run: shows what it WOULD change
./bin/citation doi nan2026 --write    # writes authors, doi, volume, pages, issue
```

It fills the frontmatter, rewrites the H1 to `Nan et al. (2026) — …`, replaces the
citation line, and stamps `verified: crossref YYYY-MM-DD`. That stamp is what stops
`citation cards` from ever reverting the card to the unverified import.

It **refuses** matches it cannot justify, which is the point. Three guards:

| Guard | The mistake it prevents |
|---|---|
| must be a `journal-article` | a title search once ranked an editorial *comment* above the paper it commented on; a preprint scores 1.00 on title |
| authors must agree in the 0.85–0.95 similarity band | a review and the study it reviews have near-identical titles |
| title ≥0.95 + same journal + same year = "strong" | lets Crossref's registered bylines overrule a corpus that was wrong 7 times |

If it says **no confident match**, read the reason it prints. Usually the stored title
is wrong or truncated, not the paper missing. Two escape hatches, in order of safety:

```bash
# you know the DOI; let it check that DOI against the card
./bin/citation doi nan2026 --doi 10.1016/j.envint.2025.109981 --write

# the DOI is right and the card's TITLE is the wrong thing — say so explicitly
./bin/citation doi she2019 --doi 10.3390/rs11232771 --trust-doi --write
```

`--trust-doi` prints both titles and a warning before writing, because if the DOI is
wrong this writes a wrong citation. That happened here: one card carried a title
invented by an AI report, bolted to a DOI that was correct the whole time.

**Batch mode** for many new cards at once:

```bash
./bin/citation doi                    # dry run over every card missing a doi or authors
./bin/citation doi --write            # write them
./bin/citation doi --all --write --rekey   # + rename placeholder citekeys to author-year
```

`--rekey` turns `npjclimate2024` into `ravindra2024`. Nothing is lost — the old key is
kept in `aka:`, and `cards` reads it back so regeneration cannot resurrect the
placeholder.

## 3. Re-index

```bash
./bin/citation index --vault
```

`--vault` embeds your retros, lessons and research notes alongside the papers, so one
search spans the literature *and* your own thinking (results are tagged `📄 paper` /
`📝 note`). Re-index when you change a title, **Key findings**, **Thesis relevance**,
`topic`, or add a card. You do **not** need to re-index after only adding a `doi:` —
that field is not embedded.

## 4. Look at the map

```bash
./bin/citation serve                          # interactive, :5556
./bin/citation graph --threshold 0.68 --html  # portable file, no server
```

In the page: **click a star** for the paper's full text, its distinctive terms, its
nearest neighbours *and the terms they share*, plus links out to Scholar/Crossref.
Click a legend row to isolate one topic. Drag to pan, scroll to zoom.

**Tuning the threshold is how you read the map**, not a cosmetic setting:

| You see | Meaning | Do |
|---|---|---|
| almost no edges | threshold too high for this corpus | lower it — the tool prints the max observed similarity, start 0.05 below |
| one dense hairball | threshold too low | raise by 0.1 until clusters separate |
| a paper with **no** edges at a sane threshold | it sits alone semantically | either a genuinely novel angle, or its **Thesis relevance** is too vague to embed well |

`serve` is verbose by default: it reports similarity max/mean, edge density, isolated
papers, per-topic counts, and the most-connected papers. Those numbers *are* the
review — an isolated paper and an over-connected paper are both findings.

## 5. Hunt gaps

The map answers "what do I have". These answer "what am I missing":

```bash
# does the corpus actually cover a claim I intend to make?
./bin/citation search "sensor drift over a full burning season" -k 8

# which topics are thin?
rg -o '^topic: "(.*)"' -r '$1' ψ/papers/*.md | sort | uniq -c | sort -n

# which cards are still unverified or unread?
rg -l 'status: needs-authors' ψ/papers/
rg -l '_to fill after reading_' ψ/papers/
```

A search that returns nothing above ~0.5 is a real signal: either the corpus has a gap,
or the papers covering it have weak **Thesis relevance** text. Check which before
concluding you found a gap in the *literature* — see the warning below.

> **A search that finds nothing is not proof that nothing exists.** One failed search is
> weak evidence of absence. Before writing "no published work addresses X", run a
> deliberate negative search in a real index (Scopus/WoS) and check the product
> documentation. An AI report on this corpus claimed three literature gaps; on
> inspection one was plausible, one was unsurprising, and one was explained by the
> instrument being physically unable to make the measurement.

## 6. Produce the bibliography

```bash
./bin/citation bib                 # → artifacts/citation.bib
./bin/citation bib --by-topic      # grouped, for drafting a chapter section by section
```

Cards missing authors are written as **commented-out stubs** rather than dropped, so the
file states its own gaps. Verify it compiles before trusting it:

```bash
python3 - <<'PY'
keys = [l.split('{')[1].split(',')[0] for l in open('artifacts/citation.bib') if l.startswith('@article')]
open('/tmp/t.aux','w').write('\\relax\n' + '\n'.join(f'\\citation{{{k}}}' for k in keys)
                             + '\n\\bibstyle{plain}\n\\bibdata{citation}\n')
print(len(keys), 'entries')
PY
cd /tmp && cp <repo>/artifacts/citation.bib . && bibtex t   # want: 0 warnings
```

## When things go wrong

| Symptom | Cause and fix |
|---|---|
| `no embedding backend reachable` | no ollama, no worker → `ollama serve`, or `cd ψ/lab/citation/worker && wrangler dev --port 18787` |
| `MODEL MISMATCH — the index was built with …` | the store and the live embedder are different models; vectors are not comparable → `./bin/citation index --vault` to rebuild, or force the original with `CITATION_EMBED=ollama\|worker` |
| new card missing from the map | forgot `kind: paper` in frontmatter, or forgot to re-index |
| node label shows a journal name instead of an author | `authors:` or `year:` is empty → run `doi --write` |
| embed error partway through a batch | batch too large → `CF_EMBED_BATCH=8 ./bin/citation index --vault` |
| `status` says `0 paper card(s)` | wrong repo root — `status` prints which rule it used; set `CITATION_ROOT` if it guessed wrong |
| a verified card reverted after `cards` | should be impossible; `verified:` protects it. If it happens, that is a bug worth reporting |

## The habits that matter

1. **Verify before it reaches the bibliography.** Plausible ≠ correct. 23% of the
   inherited cards here were wrong in a way no amount of reading would reveal.
2. **Write **Thesis relevance** for your future self searching.** It is embedded; a
   vague sentence makes the paper unfindable later.
3. **Never invent a DOI.** One card here still has none because its journal is not in
   Crossref. An empty field is honest; a guessed one is a citation error.
4. **Keep exclusions.** A paper that turned out irrelevant stays, with a note on *why* —
   that reasoning is part of the review.
5. **Re-index after editing embedded text**, or the map shows yesterday's corpus.
