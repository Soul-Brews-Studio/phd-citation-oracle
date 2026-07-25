# Prompt craft for agentic deep research

What each part of the brief is actually doing, and the specific failure it prevents. Read this
the first time you use the skill, and again whenever a brief feels vague or bloated.

## Contents

- [The mechanism you are steering](#the-mechanism-you-are-steering)
- [Section by section: what each one prevents](#section-by-section-what-each-one-prevents)
- [Tool limits to respect](#tool-limits-to-respect)
- [Calibrating breadth](#calibrating-breadth)
- [Anti-patterns in detail](#anti-patterns-in-detail)
- [Adapting to other tools](#adapting-to-other-tools)

## The mechanism you are steering

Agentic deep-research tools generally follow the same three beats: expand the prompt into a
plan, execute many searches and page reads against that plan, then synthesise a long cited
report. You get leverage at the first beat and almost none at the third — by the time the
report is being written, the sources it will use have already been chosen.

That is why a brief front-loads structure. You are not writing a question; you are writing the
outline the plan will inherit.

The corollary: **the plan review step is the cheapest place to catch a wrong turn.** A brief
with explicit exclusions and named verification targets lets a reader glance at the plan and
see immediately that step 4 has wandered off. A brief that says "research X thoroughly"
produces a plan that looks plausible no matter how wrong it is.

## Section by section: what each one prevents

**Objective (one sentence, names the decision).** Without the decision, the tool optimises for
coverage instead of usefulness. "Research vector databases" produces a survey; "Determine
whether we should move our 2M-vector index off Postgres+pgvector before the next release"
produces an answer. The decision also tells the tool when to stop.

**Audience.** Governs vocabulary and how much is assumed. A brief that does not say the reader
is a specialist gets an introduction it does not need.

**Already known.** The most under-used section. Deep research defaults to establishing
background first; if you do not fence off what you know, a substantial fraction of the report
restates your own premises back to you. Listing five things you already know can double the
useful density of the output.

**Working hypothesis.** Turns the exercise from collection into testing, and licenses the tool
to disconfirm you. Say explicitly that you want the hypothesis challenged, or you will get
confirmation-shaped results.

**In scope / out of scope.** The exclusions matter more than the inclusions. Adjacent
territory is where padding comes from — related-but-different populations, other geographies,
other product tiers. Naming three things you do not want removes more noise than naming ten
things you do.

**Time window.** Prevents two opposite failures: citing 2015 state-of-the-art as current, and
missing the foundational paper that everyone still cites. Hence the "plus foundational work
where it remains the standard reference" clause.

**Source quality — including what to avoid.** A preference list alone still admits content
farms, because they match keywords well and rank well. Naming what to reject is what keeps
them out. Requiring the *venue* alongside the title also makes quality auditable at a glance
when you read the reference list.

**Never invent a DOI.** Fabricated identifiers are the single most damaging failure mode,
because a plausible-looking DOI is expensive to catch and embarrassing to propagate. Pair the
prohibition with an explicit alternative — "say so" — so the model has somewhere to go when it
cannot find one.

**Specific things to verify (quoted verbatim, with units).** Paraphrasing a figure invites the
tool to match a different figure. Quoting "RMSE ≤ 7 µg/m³ on 24-hour averaged data" gives it
something to match exactly, and gives you something to compare against when it reports back.

**Named output sections.** The structural lever. Also the place to demand the two sections
people forget: *where sources disagree* and *what could not be verified*. Without them you get
false consensus and unmarked gaps — the two ways a confident report misleads.

**Rules about demonstrate-vs-assert.** Deep-research output tends to flatten a single
speculative blog claim and a replicated study into the same declarative sentence. Asking for
the distinction explicitly is the cheapest way to keep the epistemics visible.

## Tool limits to respect

Ask for what the tool can actually do:

- **No paywalled full text.** It can usually read abstracts, publisher landing pages, official
  standards pages, preprints and open-access versions. If a number lives only inside a
  paywalled PDF, expect "could not verify" — and say that is the desired answer.
- **No private files or internal systems** unless the tool explicitly supports attachments.
- **No code execution**, so no "run this benchmark". It can only report benchmarks others ran.
- **Recency is uneven.** Very recent material may be missing or thin; ask it to state the
  latest date it found evidence for, so you can tell fresh silence from old silence.
- **Long output ≠ thorough.** Length is the easiest thing for it to produce. "Do not add
  background sections I did not ask for" is a real constraint, not politeness.

## Calibrating breadth

One brief should have one centre of gravity. A useful test: can you state the objective in one
sentence without using "and"? If not, you likely have two briefs.

| Shape | When it fits | Typical cost |
|---|---|---|
| **Narrow verification** — one claim, primary sources, pass/fail | You have a specific number or threshold to confirm | Minutes; short report |
| **Bounded comparison** — 3–6 named options against stated criteria | A decision between known candidates | Moderate |
| **Landscape survey** — map a field, then find the gaps | You are new to an area, or hunting novelty | Long; longest report |

`--variants` exists because the right shape is often unclear until you see the options priced
side by side.

## Anti-patterns in detail

**The everything brief.** "Research X and tell me everything I need to know." Produces
encyclopedia structure — history, definitions, key players, future outlook — none of it aimed
at a decision. Fix: state the decision.

**Criteria-free superlatives.** "What is the best framework for this?" The tool must invent
criteria, and it will reach for popularity, GitHub stars, or recency. Fix: supply the criteria
and their relative weight.

**The topic-swappable brief.** If the brief would work unchanged for a different subject, it
contains no steering information. Every section should be one that only makes sense for *this*
question.

**Question stuffing.** Eight questions in one brief means each gets an eighth of the plan.
Fix: split, or rank them and say the first three are what matter.

**Accepting the plan unread.** The one review step you get, skipped. Fix: the delivery note
tells the user to read and edit the plan — keep it in the handover.

**Over-constraining format.** Demanding exact word counts per section wastes effort on padding
and truncation. Name sections and their order; leave length to the material, with a cap only
on the executive answer.

## Adapting to other tools

The same brief transfers to other agentic research tools with small adjustments:

- **Tools that do not show a plan**: front-load the exclusions even harder, since there is no
  review step to catch drift.
- **Tools with tight output limits**: cut the request to the top three sections and ask for the
  reference list as a compact table.
- **Tools that support file upload**: move "already known" into an attachment and reference it,
  keeping the brief itself short.
- **Chat models without a research mode**: expect one pass over a handful of sources. Reduce
  scope to a single verification question, or the output will be confident and thin.
