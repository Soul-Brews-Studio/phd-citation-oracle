---
name: gemini-deep-research
description: Turn a vague research wish into a rigorous, copy-paste research brief for Google Gemini Deep Research (or any agentic deep-research tool) via a short interactive scoping round — objective, explicit out-of-scope list, source-quality bar, named output sections, citation rules, and instructions to flag what it could not verify. Use this whenever someone wants to hand research off to Gemini or a similar tool, or says "gemini deep research", "prompt for gemini", "deep research prompt", "write me a prompt so Gemini can research X", "ทำ prompt ให้ gemini", "ask Gemini/Perplexity/ChatGPT to research this" — and also when they just describe a big research question they clearly intend to run elsewhere, even if they never say the word "prompt". Do NOT use it to perform the research in this session (use a research/web-search skill for that), and not for ordinary one-line prompt polishing.
argument-hint: "[<topic>] [--quick] [--from-session] [--variants] [--lang <language>]"
---

# Gemini Deep Research — write the brief, not the report

An agentic deep-research tool will happily spend twenty minutes browsing hundreds of pages
in the wrong direction. The brief is the only steering wheel you get, so it deserves more
care than a chat message.

This skill produces **a prompt to paste elsewhere**. It does not do the research. If the
user wants findings in this session, use a web-search/research skill instead.

## Why briefs beat questions

Deep-research tools typically expand your prompt into a **multi-step plan**, then execute it
across many sources and return a long cited report. Two consequences drive everything below:

- **The plan inherits your structure.** Name the sections you want and the plan comes back
  with those sections. A vague prompt yields a vague plan yields a Wikipedia-shaped report.
- **Most tools let you review the plan before it runs.** So write the brief to make a wrong
  turn *visible* — explicit exclusions and named verification targets are what make a plan
  checkable in ten seconds.

These tools also cannot read paywalled full text, private files, or run code. Ask for what
is verifiable from public sources, and require unverifiable claims to be flagged rather than
smoothed over.

## Flow

**1. Get the topic.** Take it from the argument. If missing, ask in one line. With
`--from-session`, draft it from the conversation so far, state what you inferred, and invite
correction — people rarely restate context they've already given you.

**2. Scope it — one batched round.** Ask 3–4 questions in a single **AskUserQuestion** call.
Put the recommended option first. A good default set, adapted to the topic:

| Question | Header | Options (first = recommended) |
|---|---|---|
| What decision does this research serve? | Purpose | Survey a field · Verify specific claims · Compare options · Find gaps/novelty |
| How wide should it cast? | Sources | Peer-reviewed only · Peer-reviewed + official/standards · Add industry & preprints · Anything incl. news |
| What should come back? | Deliverable | Report + comparison table · Annotated bibliography · One-page brief · Table only |
| How far back? | Recency | Last 3 years · Last 5 years · Last 10 years · No limit (include foundational) |

Skip this round with `--quick`, use the recommended defaults, and print the assumptions you
made so they are visible and correctable.

**3. Collect what you cannot guess.** In one short message, ask only for what materially
changes the brief: what the user already knows (so the report doesn't restate their own
premises), any must-include or must-exclude sources, geography/language constraints, and any
specific numbers or claims to check. If the session already answers these, use it and say so.

**4. Assemble.** Fill `assets/brief-template.md`. Read `references/prompt-craft.md` for what
each section is doing and the failure it prevents — worth reading the first time, and whenever
a brief feels flabby.

**5. Self-check.** Run the checklist below before handing anything over.

**6. Deliver.**
- Print the brief in **one fenced code block** with nothing else inside it, so it can be
  copied in a single gesture.
- Save it. Prefer the repo's own convention if one exists (`ψ/writing/prompts/`,
  `docs/research/`, …); otherwise `research-briefs/<YYYY-MM-DD>_<slug>.md`. Include
  frontmatter recording the topic, date, and the scoping answers — briefs are highly reusable
  with the topic swapped.
- Add three lines on running it: open the tool → choose its deep-research mode → paste →
  **read and edit the generated plan before approving it**.
- With `--variants`, also emit a narrow variant (one verifiable question, minutes) and a wide
  variant (landscape survey, much longer) so the user can choose by cost.

With `--lang <language>`, write the brief in that language. Consider keeping the source-quality
bar in English when the sources are English — it maps more directly onto what the tool will
search.

## Self-check before handing it over

- [ ] The objective is one sentence and names the **decision** it serves.
- [ ] There is an explicit **out-of-scope** list. This is the single biggest quality lever —
      without it the tool pads the report with adjacent territory.
- [ ] "What I already know" is filled in, so the report doesn't spend a third of its length
      re-establishing the user's premises.
- [ ] Output sections are **named and ordered** — this is what makes the returned plan
      checkable at a glance.
- [ ] The source bar names both preferred *and* disallowed source types.
- [ ] Citations are required with DOI/URL, and inventing them is forbidden.
- [ ] Unverifiable claims must be flagged, and contradictions between sources surfaced rather
      than averaged into false consensus.
- [ ] Any figure to be checked appears verbatim in the brief, with units.
- [ ] Nothing asks for what the tool cannot do — paywalled full text, private files, code
      execution.

## Bundled resources

| File | Read it when |
|---|---|
| `assets/brief-template.md` | Every run — this is the thing you fill in |
| `references/prompt-craft.md` | First run, and when a brief feels vague or bloated: what each section prevents, anti-patterns, tool-specific limits |
| `references/examples.md` | You want a worked brief to pattern-match against (three domains: engineering decision, academic verification, market/regulatory landscape) |

## Anti-patterns worth naming up front

| Don't | Why it hurts |
|---|---|
| "Research X and tell me everything" | Produces an encyclopedia entry, not an answer |
| Cramming 8 unrelated questions into one brief | The plan spreads thin; run separate briefs |
| Skipping what the user already knows | Half the report restates their premises |
| Asking for "the best" without criteria | The tool invents criteria, usually popularity |
| Handing over a brief that fits any topic | If it would work for a different subject unchanged, it is too generic to steer anything |
