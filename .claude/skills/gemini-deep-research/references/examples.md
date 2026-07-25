# Worked examples

Three briefs across different domains. Read whichever is closest in *shape* to the request in
front of you — the shape (verification / comparison / survey) matters more than the subject.

- [Example 1 — Bounded comparison (engineering decision)](#example-1--bounded-comparison-engineering-decision)
- [Example 2 — Narrow verification (checking claimed figures)](#example-2--narrow-verification-checking-claimed-figures)
- [Example 3 — Landscape survey (regulatory / market)](#example-3--landscape-survey-regulatory--market)

---

## Example 1 — Bounded comparison (engineering decision)

**User said:** "we're at about 2 million vectors in pgvector and search is getting slow, should
we move to a dedicated vector db? need to decide before the Q1 release"

The scoping round established: purpose = compare options; sources = vendor docs + peer-reviewed
+ named practitioners; deliverable = report + comparison table; recency = last 3 years.

```
# Research objective
Determine whether a team running a ~2M-vector similarity index on PostgreSQL + pgvector should
migrate to a dedicated vector database before a Q1 release, or tune what they have.

# Context to assume
- Audience: senior backend engineers; assume familiarity with ANN indexes, HNSW/IVF, and
  Postgres operations. No introduction to embeddings.
- Already known — do not spend time re-establishing: what pgvector is; that HNSW and IVFFlat
  are the two pgvector index types; that recall/latency trade off against index build time;
  that dedicated engines exist (Qdrant, Weaviate, Milvus, Pinecone).
- Working hypothesis to test, and to disconfirm if the evidence points that way: at ~2M vectors
  the bottleneck is index configuration and memory sizing rather than the engine itself, so
  migration is premature.

# Scope
- In scope: pgvector 0.7+ on Postgres 15/16/17; Qdrant, Weaviate, Milvus, Pinecone; index types
  HNSW and IVF; filtered search performance; operational cost of running each; migration effort.
- Out of scope: full-text/hybrid search quality, embedding model choice, GPU-accelerated
  serving, deployments above 100M vectors, LLM/RAG framework comparisons.
- Time window: 2023–2026, since pgvector performance changed substantially across versions.
- Languages: English.

# Source quality
- Prefer: vendor benchmark methodology documents where the methodology is disclosed, published
  benchmark suites (e.g. ANN-Benchmarks), peer-reviewed evaluations, engineering write-ups from
  named teams reporting their own production numbers with hardware specified.
- Acceptable if labelled: vendor marketing benchmarks (flag them as vendor-run), preprints.
- Avoid: SEO listicles ("top 10 vector databases"), undated posts, any benchmark that does not
  state hardware, dataset, dimensionality and recall target.
- Cite every non-obvious claim with title, organisation/authors, year, and a direct URL.
  Never invent a citation; if you cannot find one, say so.

# Specific things to verify
- The claim that pgvector HNSW requires the index to fit in memory for acceptable latency —
  confirm or refute against primary documentation, and state the actual memory formula.
- Any specific "pgvector falls over above N vectors" threshold you encounter: report N, who
  claimed it, and under exactly what hardware, dimensionality and recall target.

# What to produce
1. Direct answer to the objective (max 200 words), including the conditions under which the
   answer flips.
2. Findings grouped by (a) tuning pgvector, (b) dedicated engines, (c) operational cost, each
   with citation and a one-line "why it matters".
3. Comparison table — columns: engine · p95 latency at ~2M vectors (state dimensionality and
   recall) · memory footprint · filtered-search support · operational burden · migration effort.
4. Where sources disagree — especially vendor-run vs independent benchmarks.
5. What you could not verify, and what would be needed to verify it.
6. Gaps and open questions.
7. Full reference list.

# Rules
- Distinguish what a benchmark demonstrates from what a vendor asserts.
- Never compare latency numbers measured at different recall targets as if they were equivalent;
  if a source omits recall, say so and treat the number as unusable.
- Quote figures with hardware, dataset, dimensionality and recall.
- Flag every claim not confirmed by a primary or independent source.
- If the evidence does not support a clean recommendation, say so.
- Do not add background sections I did not ask for.
```

**Why this one works:** the hypothesis is stated *and* the tool is licensed to disconfirm it;
the exclusions cut the entire adjacent RAG-framework swamp; and the "never compare latency at
different recall targets" rule blocks the specific way vector-database comparisons go wrong.

---

## Example 2 — Narrow verification (checking claimed figures)

**User said:** "I've got these regulator thresholds in my draft but I only have them
second-hand, I need the real numbers before I cite them"

Shape: one verifiable question, primary sources, minutes rather than an hour.

```
# Research objective
Confirm or correct four numeric thresholds attributed below to primary regulatory documents, so
they can be cited directly in a technical report rather than via secondary sources.

# Context to assume
- Audience: the report's author; assume domain fluency. No background needed.
- Already known: which documents the thresholds are believed to come from (named below); that
  secondary sources agree on them, which is exactly why independent confirmation is needed.

# Scope
- In scope: the primary published documents named below, and any superseding revision of them.
- Out of scope: comparisons to other jurisdictions, commentary on whether the thresholds are
  well chosen, historical versions before the current edition.
- Time window: the current edition of each document, plus any revision published since.
- Languages: English; note the original language if the authoritative text is not English.

# Source quality
- Prefer: the issuing body's own published document or its official web page. A number quoted
  by a third party does not count as confirmation, however reputable.
- Avoid: secondary summaries, review articles restating the thresholds, AI-generated overviews.
- For each threshold, give the document title, issuing body, edition/year, and the section,
  table or page where the number appears, plus a direct URL.

# Specific things to verify
<Quote each claim verbatim, with units and conditions, and the document you believe it is from.
For instance: "Threshold A: value X, measured under condition Y — believed to be in
<Document>, <Table N>. Confirm the value, the units, and the measurement condition.">

# What to produce
1. A table: claimed value · confirmed value · units · measurement condition · document,
   section/page · direct URL · status (confirmed / corrected / not found).
2. For anything corrected, quote the authoritative wording verbatim.
3. For anything not found: where you looked, and whether the barrier was a paywall, a
   restructured document, or the number appearing to be secondary-source-only.
4. Note any threshold that has been superseded, with the new value and effective date.

# Rules
- Do not report a value as confirmed unless you reached the issuing body's own document.
- If the primary document is paywalled or otherwise unreachable, say so and mark the item
  not found — an unverified number reported as verified is worse than a gap.
- Quote exact wording for anything corrected, including units and conditions.
- Do not add background about the regulations.
```

**Why this one works:** it defines what counts as confirmation ("a number quoted by a third
party does not count"), and it makes "not found" an acceptable, well-specified outcome — which
is what stops the tool from quietly substituting a secondary source.

---

## Example 3 — Landscape survey (regulatory / market)

**User said:** "we might expand into the EU next year, I need to understand what the AI Act
actually requires of us before we commit"

Shape: survey then narrow to obligations. Longest of the three.

```
# Research objective
Map the concrete obligations the EU AI Act places on a non-EU SaaS company that would deploy a
customer-facing AI assistant to EU users, to decide whether to enter the market next year.

# Context to assume
- Audience: a founder and a general counsel; comfortable with regulation but not with this Act.
- Already known: that the Act uses a risk-tier structure; that obligations phase in over time;
  that GDPR applies separately. No need to re-explain any of these.
- Working hypothesis to test: a general-purpose customer-support assistant falls outside the
  high-risk tier and therefore faces mainly transparency obligations.

# Scope
- In scope: the Act's obligations as they apply to providers and deployers of general-purpose
  and limited-risk AI systems; transparency duties; timelines and phase-in dates; penalties;
  the extraterritorial reach test for a non-EU provider.
- Out of scope: high-risk Annex III use cases we do not operate in (biometrics, employment
  screening, credit scoring, education), prohibited practices, member-state implementations
  beyond noting where they diverge, GDPR analysis.
- Time window: the Act as adopted and in force, plus guidance and delegated acts published
  since; note anything still pending.
- Languages: English; note where the authoritative text is another language.

# Source quality
- Prefer: the Official Journal text, European Commission guidance, AI Office publications,
  and national regulator statements.
- Acceptable if labelled: law-firm client briefings (name the firm and date), academic analysis.
- Avoid: vendor "AI Act compliance" marketing, undated summaries, AI-generated overviews.
- Cite article and paragraph numbers, not just document titles, plus a direct URL.

# Specific things to verify
- The exact test that makes a non-EU provider in scope, quoted from the Act with the article
  number.
- The current phase-in dates for each obligation category, and which are already in force
  versus pending.

# What to produce
1. Direct answer (max 200 words): are we in scope, and what tier are we likely in.
2. Obligations table — obligation · which article · who it binds (provider/deployer) · in force
   from · what compliance concretely requires.
3. The in-scope test for a non-EU provider, with the article quoted verbatim.
4. Where legal commentary disagrees about classification, and who takes which position.
5. What is still undecided — pending guidance, delegated acts, unresolved definitions.
6. What you could not verify.
7. Full reference list with article-level citations.

# Rules
- Distinguish the Act's text from commentators' interpretation of it, always.
- Where classification is genuinely contested, present the range rather than picking one.
- Quote article and paragraph numbers for every obligation.
- Flag anything that depends on guidance not yet published.
- Do not provide legal advice or a compliance verdict; provide the obligations and their sources.
- Do not add background about AI regulation generally.
```

**Why this one works:** a broad topic is bounded by naming the specific tiers and use cases that
are *out*; it demands article-level citations so claims stay auditable; and it separates the
statute from commentary, which is where survey briefs on regulation usually blur.
