---
name: research-harvest
description: Turn an already-filed deep-research report into actual work products — the decision it supports with evidence, a thesis-ready comparison table, a verification queue built from its own "could not verify" section, follow-up research briefs for the gaps it identified, and the conflicts it surfaced that a human must adjudicate. Use this after a report is in the vault and someone asks "what do we do with this", "ทำอะไรต่อกับ report นี้", "get more out of this", "what does this actually tell us", "turn this into a table/chapter section", "what should we research next", or hands you a research document and expects more than filing. Do NOT use it to file or index the report (that is research-ingest), to run new research (use /oracle-deep-research), or to write the prompt for another tool (use /gemini-deep-research).
argument-hint: "<path-to-filed-report> [--table] [--queue] [--briefs] [--all]"
---

# research-harvest — a report is raw material, not a deliverable

Filing a report and indexing its references captures the *citations*. The expensive part —
the synthesis, the numbers under their measurement conditions, the contradictions it noticed,
the gaps it proved — sits unread in prose unless someone converts it into work.

This skill does that conversion. It assumes the report is already filed and indexed
(`research-ingest`); if it isn't, do that first, because harvesting an unverified document
risks propagating DOIs and figures nobody checked.

## What a good report already contains

Reports written from a structured brief tend to carry five harvestable seams. Find them before
extracting anything, because the naming varies by tool:

| Seam | Typical heading | What it becomes |
|---|---|---|
| The answer | "Direct Answer", "Executive summary" | A decision with its conditions |
| The evidence | "Annotated bibliography", per-item tables | Card enrichment + the comparison table |
| The conflicts | "Disagreements", "Where sources differ" | An adjudication list for the human |
| The admissions | "Unverified claims", "Could not verify" | A verification queue |
| The absences | "Gaps", "What is missing" | Follow-up briefs, and sometimes a contribution |

The last two are the ones people skip, and they are the most valuable: a well-run report tells
you precisely where it stopped being reliable.

## 1. Extract the decision, with its conditions

A one-paragraph answer is not useful; an answer plus *when it flips* is. Write it as:

> **Decision** — <what to do>
> **Because** — <the two or three findings that drive it, each with a citation>
> **Flips if** — <the conditions under which the answer changes>
> **Confidence** — <what would have to be true, and how well established that is>

If the report hedges everywhere, say so plainly rather than manufacturing a decision it did not
support. "The evidence does not choose between these" is a finding.

## 2. Build the comparison table

Pull every quantitative claim into one table, and carry the **measurement conditions in the
same cell as the number**. A metric without its conditions invites false comparison — an R²
computed at one wavelength, matching window or averaging period is not comparable to another,
and this is the single most common way a synthesis table misleads.

Where a source omits the conditions, write the number and mark it *not comparable*, with why.
Save to the thesis-facing location (`ψ/writing/`), not into a card.

## 3. Enrich the cards

For each paper the report discusses, append its reported metrics to that card's `## Notes`,
attributed to the report and dated, with the caveat that they are as-reported and unchecked
against the paper itself. Never promote a report's numbers into frontmatter — frontmatter is
for bibliographic fact, notes are where provenance-carrying claims belong.

## 4. Turn the admissions into a verification queue

Every item in the report's "unverified" section becomes a queued task with a named source to
check and a named method (`ψ/writing/research/verification-queue.md` or the equivalent). Order
by consequence: a threshold that will be quoted in a thesis outranks a background detail.

This queue is the handoff to `/oracle-deep-research` — hand it the queue, not the whole report.

## 5. Turn the gaps into briefs

For each gap the report identified, decide which of three things it is, because they lead to
very different work:

- **A search failure** — the literature exists, the report missed it → a narrow follow-up brief
  via `/gemini-deep-research`.
- **A real absence** — nobody has published this → potentially a contribution. Say so
  explicitly; a proven absence in your own research area is an asset, not a loose end.
- **An access failure** — it exists but was paywalled → a retrieval task, not a research task.

Distinguishing these is judgement, so show your reasoning rather than asserting the label.

## 6. Surface the conflicts for a human

Where sources disagree, do not average them. Present each position, who holds it, what evidence
backs it, and what would settle it. Then stop — adjudicating a live disagreement in the
literature is the researcher's call, not the tool's (External Brain, Not Command).

## Output

Write to `ψ/writing/research/<report-slug>-harvest.md`, linking back to the source report, and
report inline: the decision, how many cards were enriched, how many verification items queued,
how many gaps and of which kind, and the conflicts awaiting a human. Append a `## Review`
section to the source report noting that it has been harvested and where the output lives, so
nobody harvests it twice.

## Honesty rules

- **Attribute every number to the report**, and mark it as-reported-not-verified.
- **Never resolve a conflict by picking the more confident source.** Confidence is not evidence.
- **A gap you cannot classify is still worth reporting** — say you could not tell whether it is
  absence or search failure, and what would distinguish them.
- **Do not inflate the decision.** If the honest output is "this narrows it to two options",
  that is the output.
