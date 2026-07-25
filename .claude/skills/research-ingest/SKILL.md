---
name: research-ingest
description: Ingest a deep-research report produced elsewhere (Gemini Deep Research, ChatGPT, Perplexity, a colleague's review) into the local vault and the local LanceDB index — file the document with provenance, extract its bibliography, VERIFY every supplied DOI against Crossref before it touches any card, reconcile against the existing corpus (enrich vs create vs hold), then re-index and prove the result is searchable. Use this whenever someone hands over research output and wants it absorbed: "I got the data from Gemini", "index this into our database", "ingest this report", "เอาข้อมูลเข้า LanceDB", "index ข้อมูลเข้า database เรา", a path to a research .md/.pdf, or a pasted report with references. Do NOT use it to run the research (use /oracle-deep-research or /deep-research-sonnet), to write the prompt for another tool (use /gemini-deep-research), or for single-paper adds (use /paper-card).
argument-hint: "<path-to-report> [--dry-run] [--no-cards] [--workflow]"
---

# research-ingest — absorb outside research without absorbing its errors

A deep-research report from another tool is *evidence*, not truth. It arrives with real
findings, plausible-looking DOIs, and confident numbers — and the DOIs are the dangerous part,
because a fabricated identifier that reaches a bibliography is very expensive to catch later.

So this skill's shape is: **file everything, verify before writing, index, then prove.**

## The pipeline this sits in

`/gemini-deep-research` writes the brief → you run it in the other tool → **this skill files the
result** → `/paper-card` handles bibliography mechanics → `/oracle-deep-research` chases whatever
came back unverified.

## Step 1 — file the document verbatim, with provenance

Copy it into `ψ/writing/research/<YYYY-MM-DD>_<slug>.md` **unedited**, prepending frontmatter:

```yaml
---
title: <report title>
date: <YYYY-MM-DD>
source: Google Gemini Deep Research      # which tool actually produced it
prompt: ψ/writing/prompts/<the brief that produced it>.md   # if there is one
status: unverified — external output, claims not yet checked
kind: note
---
```

Verbatim matters: once you start editing, you lose the ability to tell what the tool said from
what you concluded. Corrections belong in a `## Review` section appended at the bottom.

## Step 2 — extract the bibliography

Read `references/report-formats.md` for what each tool's output looks like and the parsing traps
(Gemini escapes markdown and appends footnote superscripts that look like digits in your data).

Extract per paper: full citation, authors, year, title, journal, volume, pages, **DOI**, and any
reported metrics — copying metrics **verbatim, with units, wavelength and matching windows**.
Those qualifiers are what make numbers comparable; a metric without them is not reusable.

Note any `[Already Catalogued]`-style markers the report carries — if the brief asked it to skip
your known papers, it may have flagged them for you.

## Step 3 — verify every DOI before it goes anywhere

This is the step that justifies the skill. For each extracted DOI:

```bash
curl -s "https://api.crossref.org/works/10.xxxx/yyyy" \
  | python3 -c "import json,sys; d=json.load(sys.stdin)['message']; \
print(d.get('title',[''])[0]); print(d.get('container-title',[''])[0]); \
print(d.get('issued',{}).get('date-parts'))"
```

Classify each as **confirmed** (Crossref returns the same paper), **mismatch** (resolves to a
different paper — record what it actually is), or **not_found** (404/empty). Only a *confirmed*
DOI may be written into a card's frontmatter. A mismatch is a finding worth reporting loudly:
it means the report's citations cannot be trusted wholesale.

## Step 4 — reconcile against the corpus

For each verified entry, choose one action and say why:

| Action | When |
|---|---|
| **enrich-existing** | Already a card. Add the confirmed DOI and any new metrics to `## Notes`. Usually the highest-value outcome — an existing corpus typically has poor DOI coverage. |
| **create-new** | Genuinely absent. Propose `<surname><year>` and a topic from the existing set. |
| **skip-duplicate** | The report lists it twice; keep the richer entry. |
| **hold-unverified** | DOI failed, or authors unknown. Record it in the document's `## Review` section, not in frontmatter. |

Check both ways before deciding — semantic and lexical, because either alone misses:

```bash
maw citation search "<paper title>" -k 5 --json
rg -l -i "<distinctive words>" ψ/papers/
```

## Step 5 — write, index, prove

Apply the decisions (see `ψ/papers/README.md` for the card format), then:

```bash
maw citation index --vault     # cards + the filed report, one index
maw citation search "<something only the new material would match>" -k 5
```

The search is not optional. An ingest that hasn't been demonstrated searchable isn't finished —
and it's the only way to catch a card that silently dropped out of the index because a
frontmatter key was malformed.

## Step 6 — report honestly

State, in this order: DOIs confirmed / mismatched / not found; cards enriched; cards created;
entries held and why; and what the report itself flagged as unverified or as a gap. That last
part is the handoff to `/oracle-deep-research` — an external report's own "could not verify"
section is a ready-made work list, and passing it along is more useful than quietly dropping it.

## Scale

`--workflow` for a large report: fan out extraction by section, verify each section's DOIs as
soon as that section lands (pipeline, not barrier), then reconcile once at the end with the full
picture. Roughly one agent per section plus one verifier per section plus a single reconciler.
For a handful of references, do it inline — orchestration overhead isn't worth it.

`--dry-run` prints the decisions without writing cards. Worth it the first time you ingest from
a new tool, since that's when the parsing traps show up.

## Non-negotiables

- **Never write an unverified DOI into frontmatter.** Empty is a task; wrong is a defect.
- **Never edit the filed report to fix it.** Append `## Review` instead.
- **Preserve `## Notes` and existing `doi:`** on any card you touch.
- **Copy metrics with their conditions** — wavelength, averaging window, matching window,
  reference instrument. Numbers without them invite false comparisons.
- **Attribute the source on every enriched card**, so a future reader knows a value came from an
  external report rather than from the paper itself.
