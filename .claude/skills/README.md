# Skills — Citation Oracle ✦

Claude Code skills that live with this oracle. Repo-local (`.claude/skills/`), so they load
automatically for any session working in this repository.

**Free to reuse** — take them, fork them, adapt them. They're plain Markdown with YAML
frontmatter; nothing here is specific to our infrastructure except where noted.

| Skill | What it does |
|-------|--------------|
| [`gemini-deep-research`](gemini-deep-research/SKILL.md) | Interactively builds a high-quality prompt for **Google Gemini Deep Research** (or any agentic deep-research tool) — scoping questions → a copy-paste research brief with objective, explicit out-of-scope list, source-quality bar, named output sections, citation rules and uncertainty flags. Domain-agnostic. |
| [`paper-card`](paper-card/SKILL.md) | **Import** papers into a markdown-card corpus (from a pasted citation, BibTeX, DOI, bare title, PDF, or a whole deep-research bibliography — deduping first via Crossref + semantic search) and **export** back out to BibTeX/CSV/comparison tables. Refuses to invent DOIs or author lists; flags gaps instead. Pairs with `gemini-deep-research`: that one gets you a bibliography, this one files it. |
| [`research-ingest`](research-ingest/SKILL.md) | **Absorb** a deep-research report produced elsewhere (Gemini/ChatGPT/Perplexity) into the vault and the local LanceDB: file it verbatim with provenance, extract the bibliography, **verify every supplied DOI against Crossref before it touches a card**, reconcile against the existing corpus (enrich / create / hold), re-index, then prove it searchable. Completes the loop with `gemini-deep-research` and `paper-card`. |

### `gemini-deep-research` layout

Built following the [skill-creator](https://docs.claude.com/en/docs/claude-code/skills) pattern
of progressive disclosure — a lean `SKILL.md` plus resources loaded only when needed:

```
gemini-deep-research/
├── SKILL.md                        # flow + self-check (always loaded when triggered)
├── assets/brief-template.md        # the thing you fill in, every run
├── references/
│   ├── prompt-craft.md             # what each brief section prevents; tool limits; anti-patterns
│   └── examples.md                 # 3 worked briefs: comparison · verification · survey
└── evals/evals.json                # test prompts + structural assertions
```

## Install one of these elsewhere

**Per-project** (loads only in that repo):
```bash
mkdir -p /path/to/your-repo/.claude/skills
cp -r gemini-deep-research /path/to/your-repo/.claude/skills/
```

**Fleet-wide / global** (loads in every session):
```bash
ln -s "$(pwd)/gemini-deep-research" ~/.claude/skills/gemini-deep-research
# or copy instead of symlink:
cp -r gemini-deep-research ~/.claude/skills/
```

Then invoke it as `/gemini-deep-research [topic]`. Run `/help` or check the skills list if it
doesn't appear — a new global skill needs the session to pick it up.

## Writing your own

The contract is small: a directory containing `SKILL.md`, whose frontmatter carries

```yaml
---
name: your-skill-name          # becomes /your-skill-name
argument-hint: "[<arg>] [--flag]"
description: >
  What it does, plus the trigger phrases that should invoke it — and, just as
  importantly, when NOT to trigger (point at the sibling skill instead).
type: local
---
```

Everything below the frontmatter is instructions to the model. Two things that make a skill
actually good, learned the hard way:

- **Say when *not* to use it.** Ambiguity between two similar skills is the main failure mode.
  `gemini-deep-research` writes a *prompt for another tool*; it explicitly points research
  that should happen in-session at the sibling `/oracle-deep-research`.
- **Give it a checklist.** A skill that ends with "verify these 9 things before you hand it
  over" produces far more consistent output than one that only describes the goal.

## Why they live here

The oracle's brain is the repo (see `CLAUDE.md`, principle 1 — *Nothing is Deleted*). A skill
committed here is versioned, reviewable in diffs, and travels with the oracle when it's cloned
or budded.
