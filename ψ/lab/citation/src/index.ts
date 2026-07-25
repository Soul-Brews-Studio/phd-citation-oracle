import { readFile, stat, mkdir, readdir, unlink } from "node:fs/promises";
import { statSync } from "node:fs";
import { join, dirname } from "node:path";

type InvokeContext = { source: "cli"; args: string[] };
type PluginResult = { ok: boolean; output?: string; error?: string };

// citation — Citation Oracle's own maw plugin: index/search/visualize the PhD
// literature corpus. Same shape as muninn (laris-co/muninn-oracle ψ/lab/muninn),
// tuned for papers: the unit is a paper, the color is its topic — The Constellation.

const ARRA_URL = process.env.ARRA_URL || "http://localhost:47778";
// Data lives outside the plugin's own installed dir — `maw plugin install`
// copies the whole source tree, so a `--force` reinstall would wipe an in-tree
// data/ dir. Prefer $MAW_HOME (stable across reinstalls).
const LOCAL_WORKER_URL = process.env.CF_EMBED_WORKER_URL || "http://localhost:18787";
const EMBED_MODEL = process.env.CF_EMBED_MODEL || "@cf/baai/bge-m3";
const DEFAULT_CORPUS = "artifacts/literature_corpus.jsonl";

// Professional type pairing (matches the oracle book skills' book-feel): a
// journal serif for titles, a clean humanist sans for labels/UI. Both ship with
// macOS so sharp/librsvg and the browser resolve them without downloads.
const FONT_SERIF = "Charter, 'Iowan Old Style', Georgia, 'Times New Roman', serif";
const FONT_SANS = "'Helvetica Neue', Helvetica, 'Segoe UI', Arial, sans-serif";

// ── embedding backends ──
// Three, tried in this order unless CITATION_EMBED is set:
//   ollama    — fully local, uses the GPU (Metal on Apple silicon). No account,
//               no token, no network. Default when it is running.
//   worker    — the shared wrangler-dev Cloudflare worker on :18787.
//   cf-rest   — Cloudflare REST with CF_ACCOUNT_ID + CF_API_TOKEN.
// The point is that indexing must work on a laptop with nothing configured,
// while still allowing a cloud embedder when you want one.

const OLLAMA_URL = process.env.OLLAMA_URL || "http://localhost:11434";
const OLLAMA_MODEL = process.env.CITATION_OLLAMA_MODEL || "bge-m3";
type Backend = "ollama" | "worker" | "cf-rest";

let backendCache: Backend | null = null;

async function detectBackend(): Promise<Backend> {
  if (backendCache) return backendCache;
  const forced = process.env.CITATION_EMBED as Backend | undefined;
  if (forced) return (backendCache = forced);
  // Prefer local: no token, no egress, and on Apple silicon it is GPU-backed.
  try {
    const res = await fetch(`${OLLAMA_URL}/api/tags`, { signal: AbortSignal.timeout(1500) });
    if (res.ok) {
      const json = (await res.json()) as { models?: Array<{ name?: string }> };
      const has = (json.models ?? []).some((m) => (m.name ?? "").startsWith(OLLAMA_MODEL));
      if (has) return (backendCache = "ollama");
    }
  } catch {
    /* not running — fall through */
  }
  if (process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN) return (backendCache = "cf-rest");
  return (backendCache = "worker");
}

/** Model identity is stored with the index — mixing models silently is a correctness bug. */
async function embedModelId(): Promise<string> {
  const b = await detectBackend();
  return b === "ollama" ? `ollama:${OLLAMA_MODEL}` : `cloudflare:${EMBED_MODEL}`;
}

async function embedViaOllama(texts: string[]): Promise<number[][]> {
  const res = await fetch(`${OLLAMA_URL}/api/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ model: OLLAMA_MODEL, input: texts }),
  });
  if (!res.ok) throw new Error(`ollama embed failed: ${res.status} ${await res.text().catch(() => "")}`);
  const json = (await res.json()) as { embeddings?: number[][] };
  if (!json.embeddings?.length) throw new Error("ollama returned no embeddings");
  return json.embeddings;
}

async function embedTexts(texts: string[]): Promise<number[][]> {
  const backend = await detectBackend();
  if (backend === "ollama") return embedViaOllama(texts);
  if (process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN) {
    const url = `https://api.cloudflare.com/client/v4/accounts/${process.env.CF_ACCOUNT_ID}/ai/run/${EMBED_MODEL}`;
    const res = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${process.env.CF_API_TOKEN}`, "content-type": "application/json" },
      body: JSON.stringify({ text: texts }),
    });
    if (!res.ok) throw new Error(`Cloudflare REST embed failed: ${res.status}`);
    const json = (await res.json()) as { result?: { data?: number[][] } };
    if (!json.result?.data) throw new Error("Cloudflare REST embed returned no data");
    return json.result.data;
  }
  const res = await fetch(`${LOCAL_WORKER_URL}/embed`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ texts, model: EMBED_MODEL }),
  }).catch((error) => {
    throw new Error(
      `Local embed worker unreachable at ${LOCAL_WORKER_URL} — reuse the shared one: ` +
        `cd ~/.maw/plugins/cf-embed/worker && wrangler dev --port 18787 (${error instanceof Error ? error.message : String(error)})`,
    );
  });
  if (!res.ok) throw new Error(`Local embed worker failed: ${res.status}`);
  const json = (await res.json()) as { data?: number[][] };
  if (!json.data) throw new Error("Local embed worker returned no data");
  return json.data;
}

// The embed worker 500s on a large batch (56 papers alone were fine; papers +
// vault notes were not). Chunk the requests so corpus size never breaks indexing.
const EMBED_BATCH = Number(process.env.CF_EMBED_BATCH) || 16;

async function embedBatched(texts: string[], onProgress?: (done: number, total: number) => void): Promise<number[][]> {
  const out: number[][] = [];
  for (let i = 0; i < texts.length; i += EMBED_BATCH) {
    const chunk = texts.slice(i, i + EMBED_BATCH);
    try {
      out.push(...(await embedTexts(chunk)));
    } catch (error) {
      throw new Error(
        `embed failed on batch ${Math.floor(i / EMBED_BATCH) + 1} (items ${i}–${i + chunk.length - 1}, ` +
          `longest ${Math.max(...chunk.map((t) => t.length))} chars): ${error instanceof Error ? error.message : String(error)}`,
      );
    }
    onProgress?.(Math.min(i + EMBED_BATCH, texts.length), texts.length);
  }
  return out;
}

async function embedOne(text: string): Promise<number[]> {
  const vectors = await embedTexts([text]);
  const vector = vectors[0];
  if (!vector) throw new Error("no vector returned for input text");
  return vector;
}

// ── the vector store — plain files, no native dependencies ──
// Two files plus a manifest:
//   vectors.f32  N × dim little-endian Float32, row-major
//   meta.jsonl   one JSON object per row, same order
//   manifest.json  { model, dim, count, updated }
// Brute-force cosine over a Float32Array is O(N·dim): ~62 papers is microseconds
// and even 100k rows stays well under a second, which is far below the point
// where an ANN index would earn a 487 MB native dependency.

// Resolved lazily: the repo root isn't known at import time, and without maw the
// store must follow the corpus rather than whatever directory you happened to be in.
function storeDir(): string {
  if (process.env.CITATION_STORE_DIR) return process.env.CITATION_STORE_DIR;
  if (process.env.MAW_HOME) return `${process.env.MAW_HOME}/citation-data/store`;
  return `${repoRoot()}/.citation/store`;
}

type StoreMeta = {
  id: string;
  kind: string;
  citekey: string;
  title: string;
  journal: string;
  topic: string;
  path: string;
  text: string;
  indexed_at: string;
};
type Manifest = { model: string; dim: number; count: number; updated: string };

async function storeWrite(rows: Array<StoreMeta & { vector: number[] }>, model: string): Promise<Manifest> {
  const dir = storeDir();
  await mkdir(dir, { recursive: true });
  const dim = rows[0]?.vector.length ?? 0;
  const flat = new Float32Array(rows.length * dim);
  rows.forEach((r, i) => {
    if (r.vector.length !== dim) throw new Error(`row ${r.id} has dim ${r.vector.length}, expected ${dim}`);
    flat.set(r.vector, i * dim);
  });
  await Bun.write(`${dir}/vectors.f32`, flat.buffer as ArrayBuffer);
  await Bun.write(
    `${dir}/meta.jsonl`,
    rows.map(({ vector: _v, ...m }) => JSON.stringify(m)).join("\n") + "\n",
  );
  const manifest: Manifest = { model, dim, count: rows.length, updated: new Date().toISOString() };
  await Bun.write(`${dir}/manifest.json`, JSON.stringify(manifest, null, 2));
  return manifest;
}

async function storeRead(): Promise<{ meta: StoreMeta[]; vectors: Float32Array; manifest: Manifest } | null> {
  const dir = storeDir();
  const mf = Bun.file(`${dir}/manifest.json`);
  if (!(await mf.exists())) return null;
  const manifest = (await mf.json()) as Manifest;
  const metaText = await Bun.file(`${dir}/meta.jsonl`).text();
  const meta = metaText.split("\n").filter(Boolean).map((l) => JSON.parse(l) as StoreMeta);
  const buf = await Bun.file(`${dir}/vectors.f32`).arrayBuffer();
  return { meta, vectors: new Float32Array(buf), manifest };
}

/** Cosine against every row. Vectors are pre-normalised by neither backend, so normalise here. */
function storeSearch(
  query: number[],
  vectors: Float32Array,
  dim: number,
  count: number,
  filter?: (i: number) => boolean,
): Array<{ index: number; score: number }> {
  let qn = 0;
  for (const v of query) qn += v * v;
  qn = Math.sqrt(qn) || 1;
  const out: Array<{ index: number; score: number }> = [];
  for (let i = 0; i < count; i++) {
    if (filter && !filter(i)) continue;
    let dot = 0, rn = 0;
    const off = i * dim;
    for (let d = 0; d < dim; d++) {
      const x = vectors[off + d];
      dot += x * query[d];
      rn += x * x;
    }
    out.push({ index: i, score: dot / ((Math.sqrt(rn) || 1) * qn) });
  }
  out.sort((a, b) => b.score - a.score);
  return out;
}

// ── finding the repo, with or without maw ──
// `maw` cds into the plugin's own install dir before invoking it, so cwd is
// useless there; MAW_HOME's parent IS the repo root by construction. But the
// standalone runner (bin/citation) has no MAW_HOME at all and may be invoked
// from anywhere, so fall back to walking up for the repo's own markers.
// A silently wrong root is this command's worst failure mode — it reports
// "0 paper cards" and looks like data loss — so the resolution is recorded and
// surfaced by `status`.

let rootCache: { path: string; how: string } | null = null;

function looksLikeRepo(dir: string): boolean {
  try {
    return statSync(join(dir, "CLAUDE.md")).isFile() && statSync(join(dir, "ψ")).isDirectory();
  } catch {
    return false;
  }
}

/** Walk up from `start` until a directory holds both CLAUDE.md and ψ/. */
function walkUpForRepo(start: string): string | null {
  let dir = start;
  for (let i = 0; i < 12; i++) {
    if (looksLikeRepo(dir)) return dir;
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  return null;
}

function resolveRoot(): { path: string; how: string } {
  if (rootCache) return rootCache;

  if (process.env.CITATION_ROOT) return (rootCache = { path: process.env.CITATION_ROOT, how: "CITATION_ROOT" });
  // Keep maw behaviour byte-identical.
  if (process.env.MAW_HOME) return (rootCache = { path: dirname(process.env.MAW_HOME), how: "MAW_HOME" });

  // The shim lives inside the repo, so walking up from the SCRIPT works no
  // matter where the caller happened to cd to.
  const fromScript = walkUpForRepo(import.meta.dir);
  if (fromScript) return (rootCache = { path: fromScript, how: "walk up from the script" });

  const fromCwd = walkUpForRepo(process.cwd());
  if (fromCwd) return (rootCache = { path: fromCwd, how: "walk up from cwd" });

  try {
    const git = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"], { stdout: "pipe", stderr: "ignore" });
    const out = new TextDecoder().decode(git.stdout).trim();
    if (out && looksLikeRepo(out)) return (rootCache = { path: out, how: "git rev-parse" });
  } catch {
    /* git may not be installed */
  }

  return (rootCache = { path: process.cwd(), how: "cwd (fallback — no repo markers found)" });
}

function repoRoot(): string {
  return resolveRoot().path;
}

// ── the corpus: one JSONL row per paper ──
// { id, title, journal, topic, summary, thesis_relevance }

type Paper = {
  id: string;
  title: string;
  journal?: string;
  topic?: string;
  summary?: string;
  thesis_relevance?: string;
};

async function loadCorpus(path: string): Promise<Paper[]> {
  const raw = await readFile(path, "utf-8");
  const papers: Paper[] = [];
  for (const line of raw.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    try {
      const p = JSON.parse(trimmed) as Paper;
      if (p && p.title) papers.push(p);
    } catch {
      /* skip malformed line */
    }
  }
  return papers;
}

// The text we embed per paper: title carries the topic, summary + relevance
// carry the semantic meat that makes similarity meaningful.
function paperText(p: Paper): string {
  return [p.title, p.summary, p.thesis_relevance].filter(Boolean).join("\n\n");
}

// ── status — arra liveness + LanceDB + CF embed, one check ──

// Optional liveness check only — arra is NOT on the data path (the store is local
// files). It must never be able to hang `status`: an unbounded fetch here froze the
// command for minutes when the backend stopped responding mid-session.
async function checkArraBackend(): Promise<string> {
  try {
    const res = await fetch(`${ARRA_URL}/api/health`, { signal: AbortSignal.timeout(2000) });
    const json = (await res.json()) as { data?: { status?: string; version?: string } };
    return `  ✓ arra-oracle-v3 reachable (${ARRA_URL}) — ${json.data?.status ?? "unknown"} (v${json.data?.version ?? "?"}) [optional]`;
  } catch {
    return `  ⚠ arra-oracle-v3 not responding at ${ARRA_URL} [optional — not used for storage or search]`;
  }
}

async function checkStore(): Promise<string> {
  try {
    const s = await storeRead();
    if (!s) return `  ⚠ store empty (${storeDir()}) — run "citation index"`;
    const papers = s.meta.filter((m) => (m.kind || "paper") === "paper").length;
    const notes = s.meta.filter((m) => m.kind === "note").length;
    const bytes = (s.vectors.byteLength / 1024).toFixed(0);
    return (
      `  ✓ store ready (${storeDir()}) — ${papers} paper(s)` +
      (notes ? ` + ${notes} vault note(s)` : "") +
      ` · ${s.manifest.dim}-dim · ${bytes} KB · model ${s.manifest.model}`
    );
  } catch (error) {
    return `  ✗ store unreadable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

// ── hardware — what is actually doing the arithmetic ──
// "GPU-backed" was an assertion in the docs and nowhere in the output, which is
// the kind of claim that quietly stops being true. On Apple silicon the GPU is
// reached through Metal with unified memory, so a model is either fully resident
// or partly spilled to CPU — and ollama tells us which, exactly.

function hardwareLine(): string {
  const bytes = (n: number) => `${(n / 1024 ** 3).toFixed(0)} GB`;
  try {
    if (process.platform === "darwin") {
      const sysctl = (key: string) => {
        const r = Bun.spawnSync(["sysctl", "-n", key], { stdout: "pipe", stderr: "ignore" });
        return new TextDecoder().decode(r.stdout).trim();
      };
      const chip = sysctl("machdep.cpu.brand_string");
      const mem = Number(sysctl("hw.memsize"));
      const cores = sysctl("hw.logicalcpu");
      const silicon = process.arch === "arm64";
      return (
        `  ✓ hardware: ${chip || "Mac"} · ${process.arch} · ${cores} cores` +
        (mem ? ` · ${bytes(mem)} ${silicon ? "unified memory" : "RAM"}` : "") +
        (silicon ? " — Metal GPU available to ollama" : "")
      );
    }
    return `  ✓ hardware: ${process.platform} · ${process.arch}`;
  } catch {
    return `  ✓ hardware: ${process.platform} · ${process.arch}`;
  }
}

/** Is the embedding model actually on the GPU, or has it spilled to CPU? */
async function ollamaResidency(): Promise<string> {
  try {
    const res = await fetch(`${OLLAMA_URL}/api/ps`, { signal: AbortSignal.timeout(1500) });
    if (!res.ok) return "";
    const json = (await res.json()) as { models?: Array<{ name?: string; size?: number; size_vram?: number; context_length?: number }> };
    const m = (json.models ?? []).find((x) => (x.name ?? "").startsWith(OLLAMA_MODEL));
    if (!m?.size) return "";
    const pct = Math.round(((m.size_vram ?? 0) / m.size) * 100);
    const mb = (m.size / 1024 ** 2).toFixed(0);
    return (
      `\n      └ ${m.name} · ${mb} MB · ${pct}% GPU` +
      (pct === 100 ? " (fully resident — no CPU fallback)" : " ⚠ partly on CPU") +
      (m.context_length ? ` · ${m.context_length} ctx` : "")
    );
  } catch {
    return "";   // model simply not loaded yet; not worth a warning
  }
}

async function checkEmbedBackend(): Promise<string> {
  try {
    const backend = await detectBackend();
    const vec = await embedOne("healthcheck");
    const where =
      backend === "ollama"
        ? `ollama ${OLLAMA_MODEL} @ ${OLLAMA_URL} — local, no token, no egress`
        : backend === "cf-rest"
          ? `Cloudflare REST ${EMBED_MODEL} (token)`
          : `local worker ${LOCAL_WORKER_URL} (${EMBED_MODEL}, no token)`;
    // Ask after embedding, not before: the healthcheck is what loads the model.
    const residency = backend === "ollama" ? await ollamaResidency() : "";
    return `  ✓ embeddings: ${where} — ${vec.length}-dim${residency}`;
  } catch (error) {
    return (
      `  ✗ no embedding backend reachable: ${error instanceof Error ? error.message : String(error)}\n` +
      `      local option:  ollama pull ${OLLAMA_MODEL} && ollama serve\n` +
      `      cloud option:  cd ~/.maw/plugins/cf-embed/worker && wrangler dev --port 18787`
    );
  }
}


async function cmdStatus(): Promise<PluginResult> {
  const corpusPath = join(repoRoot(), DEFAULT_CORPUS);
  const corpusLine = await stat(corpusPath)
    .then((s) => `  ✓ corpus present (${DEFAULT_CORPUS}) — ${s.size} bytes`)
    .catch(() => `  ⚠ corpus missing at ${DEFAULT_CORPUS}`);
  const raw = await readRawCards();
  const cardCount = raw.length;
  const withDoi = raw.filter((c) => typeof c.fm.doi === "string" && c.fm.doi).length;
  const needAuthors = raw.filter((c) => !(c.fm.authors as string[] | undefined)?.length).length;
  const root = resolveRoot();
  const lines = [
    "── citation status ──",
    `  ✓ repo root: ${root.path} (${root.how})`,
    `  ${needAuthors ? "⚠" : "✓"} ${cardCount} paper card(s) in ${PAPERS_DIR}` +
      ` — ${withDoi} with a DOI` +
      (needAuthors ? `, ${needAuthors} still missing authors (citation doi --write)` : ", all citable"),
    corpusLine,
    await checkStore(),
    hardwareLine(),
    await checkEmbedBackend(),
    await checkArraBackend(),
  ];
  const hardFail = lines.some((l) => l.includes("✗"));
  return { ok: !hardFail, output: lines.join("\n") };
}

// ── paper cards — one markdown file per paper, oracle-style ──
// The vault is the canonical store: cards are readable, greppable, hand-editable,
// and indexed alongside the oracle's own notes. JSONL is treated as an import
// format, not the source of truth.

const PAPERS_DIR = "ψ/papers";
// The parent oracle's reference list carries full author strings the JSONL lacks.
const UPSTREAM_CITATIONS = [
  "/opt/Code/github.com/laris-co/DustBoy-Phd-Oracle/ψ/writing/LITERATURE_REVIEW_PAPERS.md",
  "artifacts/LITERATURE_REVIEW_PAPERS.md",
];

type Card = {
  citekey: string;
  id: string;
  title: string;        // the real paper title where known
  shortTitle: string;   // the corpus's descriptive tail
  authors: string[];
  year: string;
  journal: string;
  quartile: string;
  impactFactor: string;
  volume: string;
  issue: string;        // BibTeX's `number` — some styles require it
  pages: string;
  topic: string;
  status: string;       // ok | needs-authors
  doi: string;
  verified?: string;    // e.g. "crossref 2026-07-25" — provenance for the metadata
  aka?: string;         // a previous citekey, kept so no key is ever lost
  authorsUpstream?: string[];  // what the upstream list claimed, when it was wrong
  summary: string;
  relevance: string;
  citationRaw: string;
  notes: string;        // human-written, preserved across regeneration
};

/** APA-ish reference line, built from resolved metadata rather than parroted. */
function fullCitation(c: Pick<Card, "authors" | "year" | "title" | "journal" | "volume" | "pages" | "doi">): string {
  const list =
    c.authors.length <= 1 ? (c.authors[0] ?? "")
    : `${c.authors.slice(0, -1).join(", ")}, & ${c.authors[c.authors.length - 1]}`;
  const vp = [c.volume, c.pages].filter(Boolean).join(", ");
  return `${list} (${c.year}). ${c.title}. *${c.journal}*${vp ? `, ${vp}` : ""}.` + (c.doi ? ` https://doi.org/${c.doi}` : "");
}

/** "Atmospheric Measurement Techniques (Q1, IF ~4.0)" → parts. */
function splitJournal(j: string): { journal: string; quartile: string; impactFactor: string } {
  const m = j.match(/^(.*?)\s*\((.*)\)\s*$/);
  if (!m) return { journal: j.trim(), quartile: "", impactFactor: "" };
  const inner = m[2];
  const q = inner.match(/Q([1-4])/);
  const impact = inner.match(/IF\s*~?\s*([\d.]+)/i);
  return { journal: m[1].trim(), quartile: q ? `Q${q[1]}` : "", impactFactor: impact ? impact[1] : "" };
}

/**
 * Parse one "**Citation:**" line from the upstream reference list:
 *   Mahajan, S., & Helbing, D. (2025). Dynamic calibration of ... *npj Climate ...*, 8, 257.
 * Some entries genuinely read "[Authors]" upstream — surfaced as needs-authors
 * rather than guessed, because those are exactly the ones that block BibTeX.
 */
function parseCitation(raw: string): { authors: string[]; year: string; title: string; journal: string; volume: string; pages: string } {
  const out = { authors: [] as string[], year: "", title: "", journal: "", volume: "", pages: "" };
  if (!raw) return out;
  const yearMatch = raw.match(/\((\d{4})[a-z]?\)\.\s*/);
  if (!yearMatch) return out;
  out.year = yearMatch[1];
  const authorPart = raw.slice(0, yearMatch.index).trim().replace(/[,\s]+$/, "");
  const rest = raw.slice((yearMatch.index ?? 0) + yearMatch[0].length);

  if (!/^\[Authors?\]/i.test(authorPart)) {
    // "Surname, A. B., Surname2, C., & Surname3, D." → keep "Surname, A. B." units
    out.authors = authorPart
      .replace(/\s*&\s*/g, ", ")
      .split(/,\s*(?=[A-Z][A-Za-z'\-]+,)/)
      .map((s) => s.replace(/[,\s]+$/, "").trim())
      .filter((s) => s && !/^et al\.?$/i.test(s));
  }

  const journalMatch = rest.match(/\*([^*]+)\*/);
  out.title = (journalMatch ? rest.slice(0, journalMatch.index) : rest).replace(/\.\s*$/, "").trim();
  if (journalMatch) {
    out.journal = journalMatch[1].trim();
    const tail = rest.slice((journalMatch.index ?? 0) + journalMatch[0].length);
    const vp = tail.match(/,\s*([0-9]+)(?:\s*\(([^)]*)\))?,?\s*([0-9]+(?:-{1,2}[0-9]+)?)?/);
    if (vp) {
      out.volume = vp[1] ?? "";
      out.pages = vp[3] ?? "";
    }
  }
  return out;
}

/** Read the upstream reference list into id → raw citation. */
async function loadUpstreamCitations(): Promise<Map<string, string>> {
  const map = new Map<string, string>();
  for (const candidate of UPSTREAM_CITATIONS) {
    const path = candidate.startsWith("/") ? candidate : join(repoRoot(), candidate);
    const text = await readFile(path, "utf-8").catch(() => "");
    if (!text) continue;
    // ### 2.1.4 Title …    then the following **Citation:** line
    const re = /^###\s+(\d+(?:\.\d+)*)\s+.*$/gm;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const after = text.slice(m.index, m.index + 1400);
      const cite = after.match(/\*\*Citation:\*\*\s*(.+)/);
      if (cite) map.set(m[1], cite[1].trim());
    }
    if (map.size) break;
  }
  return map;
}

function citekeyFor(authors: string[], year: string, journal: string, fallback: string): string {
  const surname = authors[0]?.split(",")[0]?.trim() ?? "";
  const base = surname
    ? surname.toLowerCase().replace(/[^a-z]/g, "")
    : (journal.match(/\b[A-Za-z]+/g) ?? [fallback])
        .slice(0, 2).join("").toLowerCase().replace(/[^a-z]/g, "") || "unknown";
  return `${base}${year || ""}`;
}

function yamlEscape(s: string): string {
  return `"${String(s).replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
}

/**
 * "Mahajan, S." + "Helbing, D." + 2025 → "Mahajan & Helbing (2025)".
 * Also the bridge that keeps card titles in the corpus's "Author (year) -- Short"
 * shape, which shortLabel()/paperName() rely on for the graph's two-line labels.
 */
function citeLabel(authors: string[], year: string, journal: string): string {
  const surnames = authors.map((a) => a.split(",")[0].trim()).filter(Boolean);
  const who =
    surnames.length === 0 ? journal || "Unknown"
    : surnames.length === 1 ? surnames[0]
    : surnames.length === 2 ? `${surnames[0]} & ${surnames[1]}`
    : `${surnames[0]} et al.`;
  return `${who} (${year || "n.d."})`;
}

function renderCard(c: Card): string {
  const authorBlock = c.authors.length
    ? `authors:\n${c.authors.map((a) => `  - ${yamlEscape(a)}`).join("\n")}`
    : "authors: []";
  const heading = `${citeLabel(c.authors, c.year, c.journal)} — ${c.shortTitle || c.title}`;
  return `---
citekey: ${c.citekey}
id: ${yamlEscape(c.id)}
title: ${yamlEscape(c.title || c.shortTitle)}
short_title: ${yamlEscape(c.shortTitle)}
${authorBlock}
year: ${yamlEscape(c.year)}
journal: ${yamlEscape(c.journal)}
quartile: ${yamlEscape(c.quartile)}
impact_factor: ${yamlEscape(c.impactFactor)}
volume: ${yamlEscape(c.volume)}
issue: ${yamlEscape(c.issue)}
pages: ${yamlEscape(c.pages)}
doi: ${yamlEscape(c.doi)}
topic: ${yamlEscape(c.topic)}
status: ${c.status}${c.verified ? `\nverified: ${yamlEscape(c.verified)}` : ""}${c.aka ? `\naka: ${c.aka}` : ""}${
    c.authorsUpstream?.length
      ? `\nauthors_upstream:\n${c.authorsUpstream.map((a) => `  - ${yamlEscape(a)}`).join("\n")}`
      : ""
  }
tags: [paper, ${c.topic}]
kind: paper
---

# ${heading}

**Key findings** — ${c.summary || "_not recorded_"}

**Thesis relevance** — ${c.relevance || "_not recorded_"}

**Full citation** — ${
    // Upstream's line is authoritative when it has real authors; when it reads
    // "[Authors]" it must not be echoed back over metadata we since verified.
    c.authors.length && (!c.citationRaw || /^\[Authors?\]/i.test(c.citationRaw))
      ? fullCitation(c)
      : c.citationRaw || "_not recorded upstream_"
  }
${c.status === "needs-authors" ? "\n> ⚠️ Authors are unrecorded upstream (the reference list reads `[Authors]`). Resolve before this paper can go into a `.bib`.\n" : ""}
## Notes

${c.notes.trim() || "<!-- Your notes go here. `maw citation cards` preserves everything under this heading. -->"}
`;
}

/** Everything under "## Notes" — preserved so regeneration never eats human work. */
function extractNotes(existing: string): string {
  const m = existing.match(/^##\s+Notes\s*$([\s\S]*)/m);
  if (!m) return "";
  const body = m[1].trim();
  return body.startsWith("<!--") && body.endsWith("-->") ? "" : body;
}

/** Minimal frontmatter reader — machine-written, but tolerant of hand edits. */
function parseFrontmatter(text: string): Record<string, string | string[]> {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  const out: Record<string, string | string[]> = {};
  if (!m) return out;
  let listKey = "";
  for (const line of m[1].split("\n")) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && listKey) {
      const v = item[1].trim().replace(/^"(.*)"$/, "$1");
      (out[listKey] as string[]).push(v);
      continue;
    }
    const kv = line.match(/^([A-Za-z_][A-Za-z0-9_]*):\s*(.*)$/);
    if (!kv) continue;
    const [, key, rawVal] = kv;
    const val = rawVal.trim();
    if (val === "" ) { listKey = key; out[key] = []; continue; }
    listKey = "";
    if (val === "[]") { out[key] = []; continue; }
    const inline = val.match(/^\[(.*)\]$/);
    if (inline) {
      out[key] = inline[1].split(",").map((s) => s.trim().replace(/^"(.*)"$/, "$1")).filter(Boolean);
      continue;
    }
    out[key] = val.replace(/^"(.*)"$/, "$1");
  }
  return out;
}

async function cmdCards(rest: string[]): Promise<PluginResult> {
  const corpusArg = rest.find((a) => a.endsWith(".jsonl"));
  const corpusPath = corpusArg ? join(repoRoot(), corpusArg) : join(repoRoot(), DEFAULT_CORPUS);
  const papers = await loadCorpus(corpusPath).catch(() => [] as Paper[]);
  if (!papers.length) return { ok: false, error: `no papers parsed from ${corpusPath}` };

  const citations = await loadUpstreamCitations();
  const dir = join(repoRoot(), PAPERS_DIR);
  await mkdir(dir, { recursive: true });

  // A citekey is an identifier, not a derived value. Once a card exists for an
  // id, that key is its name for good — otherwise `doi --rekey` would be quietly
  // undone by the next `cards` run, which would recreate the placeholder card
  // and orphan the resolved one. (Principle 1: keys are never silently reused.)
  const existing = await readRawCards();
  const keyForId = new Map<string, string>();
  for (const c of existing) {
    const id = typeof c.fm.id === "string" ? c.fm.id : "";
    if (id) keyForId.set(id, typeof c.fm.citekey === "string" ? c.fm.citekey : c.name.replace(/\.md$/, ""));
  }

  // Build cards first so citekey collisions can be disambiguated deterministically.
  const cards: Card[] = [];
  const used = new Map<string, number>();
  for (const p of papers.sort((a, b) => String(a.id).localeCompare(String(b.id), undefined, { numeric: true }))) {
    const raw = citations.get(String(p.id)) ?? "";
    const parsed = parseCitation(raw);
    const j = splitJournal(p.journal ?? "");
    const shortTitle = paperName(p.title) || p.title;
    const yearFromTitle = p.title.match(/\((\d{4})[a-z]?\)/)?.[1] ?? "";
    const year = parsed.year || yearFromTitle;
    const inherited = keyForId.get(String(p.id));
    let key = inherited ?? citekeyFor(parsed.authors, year, parsed.journal || j.journal, String(p.id));
    const seen = used.get(key) ?? 0;
    used.set(key, seen + 1);
    if (seen && !inherited) key = `${key}${String.fromCharCode(97 + seen)}`; // b, c, …
    cards.push({
      citekey: key,
      id: String(p.id),
      title: parsed.title || shortTitle,
      shortTitle,
      authors: parsed.authors,
      year,
      journal: parsed.journal || j.journal,
      quartile: j.quartile,
      impactFactor: j.impactFactor,
      volume: parsed.volume,
      issue: "",
      pages: parsed.pages,
      topic: p.topic ?? "uncategorized",
      status: parsed.authors.length ? "ok" : "needs-authors",
      doi: "",
      summary: p.summary ?? "",
      relevance: p.thesis_relevance ?? "",
      citationRaw: raw,
      notes: "",
    });
  }

  let created = 0, updated = 0, keptNotes = 0;
  for (const c of cards) {
    const path = join(dir, `${c.citekey}.md`);
    const existing = await readFile(path, "utf-8").catch(() => "");
    if (existing) {
      c.notes = extractNotes(existing);
      if (c.notes) keptNotes++;
      // Anything resolved against Crossref outranks the upstream JSONL, which is
      // exactly where the wrong journals and phantom page numbers came from. A
      // regeneration that silently reverted verified metadata would be the same
      // bug as losing a hand-added DOI, one level deeper.
      const fm = parseFrontmatter(existing);
      const keep = (k: string) => (typeof fm[k] === "string" ? (fm[k] as string) : "");
      if (keep("doi")) c.doi = keep("doi");
      if (keep("verified")) {
        c.verified = keep("verified");
        const fmAuthors = Array.isArray(fm.authors) ? (fm.authors as string[]) : [];
        if (fmAuthors.length) { c.authors = fmAuthors; c.status = "ok"; }
        for (const k of ["title", "journal", "volume", "issue", "pages"] as const) if (keep(k)) c[k] = keep(k);
      }
      if (keep("aka")) c.aka = keep("aka");
      const upstream = Array.isArray(fm.authors_upstream) ? (fm.authors_upstream as string[]) : [];
      if (upstream.length) c.authorsUpstream = upstream;
      updated++;
    } else created++;
    await Bun.write(path, renderCard(c));
  }

  // The index describes the DIRECTORY, not this import. Cards ingested from
  // outside research (there are six) have no row in the JSONL, and building the
  // contents page from `cards` alone quietly dropped them from it.
  const onDisk = await readRawCards();
  const fmStr = (c: RawCard, k: string) => (typeof c.fm[k] === "string" ? (c.fm[k] as string) : "");
  const byTopic = new Map<string, RawCard[]>();
  for (const c of onDisk) {
    const topic = fmStr(c, "topic") || "uncategorized";
    if (!byTopic.has(topic)) byTopic.set(topic, []);
    byTopic.get(topic)!.push(c);
  }
  for (const list of byTopic.values()) {
    list.sort((a, b) => fmStr(a, "id").localeCompare(fmStr(b, "id"), undefined, { numeric: true }));
  }
  const needAuthors = onDisk.filter((c) => !(c.fm.authors as string[] | undefined)?.length);
  const withDoi = onDisk.filter((c) => fmStr(c, "doi")).length;
  const corrected = onDisk.filter((c) => (c.fm.authors_upstream as string[] | undefined)?.length);
  const indexMd = [
    "# Paper cards",
    "",
    `${onDisk.length} papers, one markdown card each — the canonical store. Regenerate with`,
    "`citation cards` (your `## Notes` and any `doi:` you add are preserved).",
    "",
    `${withDoi}/${onDisk.length} carry a Crossref-verified DOI. Resolve the rest with \`citation doi --write\`,`,
    "then build the bibliography with `citation bib`.",
    "",
    `Imported from \`${corpusArg ?? DEFAULT_CORPUS}\`${citations.size ? ` + ${citations.size} upstream citations` : ""};`,
    "cards added by research ingest are listed here too.",
    "",
    ...[...byTopic.keys()].sort().flatMap((topic) => [
      `## ${topic} (${byTopic.get(topic)!.length})`,
      "",
      "| id | citekey | paper | journal | doi |",
      "|---|---|---|---|---|",
      ...byTopic.get(topic)!.map((c) => {
        const key = fmStr(c, "citekey") || c.name.replace(/\.md$/, "");
        const short = (fmStr(c, "short_title") || fmStr(c, "title")).replace(/\|/g, "\\|");
        const journal = fmStr(c, "journal").replace(/\|/g, "\\|");
        const q = fmStr(c, "quartile");
        const doi = fmStr(c, "doi");
        return `| ${fmStr(c, "id")} | [\`${key}\`](${c.name}) | ${short} | ${journal}${q ? ` (${q})` : ""} | ${doi ? `[✓](https://doi.org/${doi})` : "—"} |`;
      }),
      "",
    ]),
    ...(needAuthors.length
      ? ["## ⚠️ Needs authors before `.bib`", "",
         `${needAuthors.length} card(s) whose authors are unrecorded upstream (the reference list reads \`[Authors]\`):`, "",
         ...needAuthors.map((c) => `- \`${fmStr(c, "citekey")}\` (${fmStr(c, "id")}) — ${fmStr(c, "short_title")}`), ""]
      : []),
    ...(corrected.length
      ? ["## Bylines corrected against Crossref", "",
         `${corrected.length} card(s) were credited to the wrong first author upstream. The claim we`,
         "inherited is kept in each card's `authors_upstream:` — the correction is part of the record,",
         "not a silent overwrite.", "",
         "| citekey | upstream claimed | actually (Crossref) |",
         "|---|---|---|",
         ...corrected.map((c) => {
           const was = (c.fm.authors_upstream as string[])[0] ?? "?";
           const now = ((c.fm.authors as string[]) ?? [])[0] ?? "?";
           return `| \`${fmStr(c, "citekey")}\` | ${was} | ${now} |`;
         }), ""]
      : []),
  ].join("\n");
  await Bun.write(join(dir, "INDEX.md"), indexMd);

  const out = [
    `✦ ${cards.length} paper card(s) → ${dir}`,
    `  created ${created} · updated ${updated} · notes preserved on ${keptNotes}`,
    `  upstream citations matched: ${citations.size}/${cards.length}`,
    `  index: ${join(dir, "INDEX.md")}`,
  ];
  if (needAuthors.length) {
    out.push(`  ⚠ ${needAuthors.length} card(s) need authors before BibTeX: ${needAuthors.map((c) => fmStr(c, "citekey")).join(", ")}`);
    out.push(`     resolve them against Crossref: citation doi --write`);
  }
  out.push(`\nNext: maw citation index   (cards are picked up automatically)`);
  return { ok: true, output: out.join("\n") };
}

/** Read the markdown cards back — this is what `index` prefers over the JSONL. */
async function readPaperCards(): Promise<Array<Paper & { citekey: string; notes: string }>> {
  const dir = join(repoRoot(), PAPERS_DIR);
  let names: string[] = [];
  try {
    // Skip the generated contents page and the hand-written manual — they live
    // in the same directory but are not papers (README.md was silently indexing
    // as one "uncategorized" paper).
    const NOT_CARDS = new Set(["INDEX.md", "README.md"]);
    names = (await readdir(dir)).filter((n) => n.endsWith(".md") && !NOT_CARDS.has(n));
  } catch {
    return [];
  }
  const out: Array<Paper & { citekey: string; notes: string }> = [];
  for (const name of names.sort()) {
    const text = await readFile(join(dir, name), "utf-8").catch(() => "");
    if (!text) continue;
    const fm = parseFrontmatter(text);
    const body = text.replace(/^---\n[\s\S]*?\n---\n/, "");
    const grab = (label: string) =>
      body.match(new RegExp(`\\*\\*${label}\\*\\*\\s*—\\s*([\\s\\S]*?)(?=\\n\\n|\\n##|$)`))?.[1]?.trim() ?? "";
    const str = (k: string) => (typeof fm[k] === "string" ? (fm[k] as string) : "");
    const authors = Array.isArray(fm.authors) ? (fm.authors as string[]) : [];
    // Rebuild the corpus's "Author (year) -- Short title" shape: the graph's
    // two-line labels are produced by shortLabel()/paperName() splitting on " -- ".
    const label = citeLabel(authors, str("year"), str("journal"));
    const short = str("short_title") || str("title");
    out.push({
      id: str("id") || name.replace(/\.md$/, ""),
      citekey: str("citekey") || name.replace(/\.md$/, ""),
      title: short ? `${label} -- ${short}` : label,
      journal: [str("journal"), str("quartile") ? `(${str("quartile")})` : ""].filter(Boolean).join(" "),
      topic: str("topic") || "uncategorized",
      summary: grab("Key findings"),
      thesis_relevance: grab("Thesis relevance"),
      notes: extractNotes(text),
    });
  }
  return out;
}

// ── index — embed the corpus (cards first, JSONL as fallback) into LanceDB ──

type Row = {
  id: string;
  kind: string;        // paper | note — lets one index serve both without confusing them
  citekey: string;
  title: string;
  journal: string;
  topic: string;
  path: string;        // where it came from, for notes
  text: string;
  vector: number[];
  indexed_at: string;
};

/** Vault notes (retros, lessons, research) so search spans papers AND our own thinking. */
const VAULT_DIRS = ["ψ/memory/learnings", "ψ/memory/retrospectives", "ψ/memory/resonance", "ψ/writing/research"];

async function walkMarkdown(dir: string): Promise<string[]> {
  const out: string[] = [];
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const e of entries) {
    const full = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walkMarkdown(full)));
    else if (e.isFile() && e.name.endsWith(".md")) out.push(full);
  }
  return out;
}

async function cmdIndex(rest: string[]): Promise<PluginResult> {
  const pathArg = rest.find((a) => a.endsWith(".jsonl"));
  const withVault = rest.includes("--vault");
  const lines: string[] = [];

  // Cards are canonical. Fall back to the JSONL only when no cards exist yet.
  let papers: Array<Paper & { citekey?: string; notes?: string }> = await readPaperCards();
  if (papers.length) {
    lines.push(`Loaded ${papers.length} paper card(s) from ${join(repoRoot(), PAPERS_DIR)}`);
  } else {
    const corpusPath = pathArg ? join(repoRoot(), pathArg) : join(repoRoot(), DEFAULT_CORPUS);
    const st = await stat(corpusPath).catch(() => null);
    if (!st?.isFile()) return { ok: false, error: `no cards in ${PAPERS_DIR} and no corpus at ${corpusPath} — run "maw citation cards" first` };
    papers = await loadCorpus(corpusPath);
    if (!papers.length) return { ok: false, error: `no papers parsed from ${corpusPath}` };
    lines.push(`Loaded ${papers.length} paper(s) from ${corpusPath} (no cards yet — run "maw citation cards")`);
  }

  // A card's own notes are signal too, so they join the embedded text.
  const paperTexts = papers.map((p) => [paperText(p), p.notes].filter(Boolean).join("\n\n"));

  const noteFiles: string[] = [];
  if (withVault) {
    for (const d of VAULT_DIRS) noteFiles.push(...(await walkMarkdown(join(repoRoot(), d))));
    lines.push(`Loaded ${noteFiles.length} vault note(s) from ${VAULT_DIRS.join(", ")}`);
  }
  const noteTexts = await Promise.all(
    noteFiles.map(async (f) => (await readFile(f, "utf-8").catch(() => "")).slice(0, 3000)),
  );

  const allTexts = [...paperTexts, ...noteTexts];
  const vectors = await embedBatched(allTexts);
  lines.push(`Embedded ${vectors.length} item(s) in batches of ${EMBED_BATCH}`);
  const now = new Date().toISOString();

  const rows: Row[] = [];
  papers.forEach((p, i) => {
    const vector = vectors[i];
    if (!vector) return;
    rows.push({
      id: `paper:${p.citekey ?? p.id ?? p.title}`,
      kind: "paper",
      citekey: p.citekey ?? "",
      title: p.title,
      journal: p.journal ?? "",
      topic: p.topic ?? "uncategorized",
      path: p.citekey ? `${PAPERS_DIR}/${p.citekey}.md` : "",
      text: paperTexts[i],
      vector,
      indexed_at: now,
    });
  });
  noteFiles.forEach((f, i) => {
    const vector = vectors[papers.length + i];
    if (!vector) return;
    const rel = f.replace(`${repoRoot()}/`, "");
    rows.push({
      id: `note:${rel}`,
      kind: "note",
      citekey: "",
      title: noteTexts[i].match(/^#\s+(.+)$/m)?.[1]?.trim() ?? rel.split("/").pop() ?? rel,
      journal: "",
      topic: rel.split("/").slice(0, 3).join("/"),
      path: rel,
      text: noteTexts[i],
      vector,
      indexed_at: now,
    });
  });
  if (!rows.length) return { ok: false, error: "embedding produced no rows" };

  const manifest = await storeWrite(rows, await embedModelId());
  lines.push(
    `Wrote ${storeDir()} — ${manifest.count} × ${manifest.dim}-dim ` +
      `(${(manifest.count * manifest.dim * 4 / 1024).toFixed(0)} KB), model ${manifest.model}`,
  );

  const paperRows = rows.filter((r) => r.kind === "paper");
  const topics = [...new Set(paperRows.map((r) => r.topic))].sort();
  lines.push(`\n✓ indexed ${paperRows.length} paper(s) across ${topics.length} topic(s):`);
  for (const t of topics) lines.push(`    ${paperRows.filter((r) => r.topic === t).length.toString().padStart(3)}  ${t}`);
  const noteRows = rows.filter((r) => r.kind === "note");
  if (noteRows.length) lines.push(`✓ indexed ${noteRows.length} vault note(s) alongside them (searchable together)`);
  else lines.push(`  (add --vault to index retros/lessons/research alongside the papers)`);
  return { ok: true, output: lines.join("\n") };
}

// ── search — semantic search over the indexed papers ──

async function cmdSearch(rest: string[]): Promise<PluginResult> {
  const kFlagIndex = rest.indexOf("-k");
  const k = kFlagIndex >= 0 ? Number(rest[kFlagIndex + 1]) : 5;
  const jsonFlagIndex = rest.indexOf("--json");
  const json = jsonFlagIndex >= 0;

  const strip = new Set<number>();
  if (kFlagIndex >= 0) {
    strip.add(kFlagIndex);
    strip.add(kFlagIndex + 1);
  }
  if (jsonFlagIndex >= 0) strip.add(jsonFlagIndex);
  const query = rest.filter((_, i) => !strip.has(i)).join(" ");
  if (!query) return { ok: false, error: "usage: search <query> [-k N] [--json]" };

  const store = await storeRead();
  if (!store) return { ok: false, error: `nothing indexed yet — run "maw citation index" first` };
  const vector = await embedOne(query);
  const hits = storeSearch(vector, store.vectors, store.manifest.dim, store.meta.length).slice(0, k);
  const results = hits.map((h) => ({ ...store.meta[h.index], score: h.score }));

  if (json) {
    const payload = results.map((r) => ({
      similarity: Number(r.score.toFixed(4)),
      kind: r.kind || "paper",
      citekey: r.citekey || "",
      id: r.id,
      title: r.title,
      journal: r.journal,
      topic: r.topic,
      path: r.path || "",
    }));
    return { ok: true, output: JSON.stringify(payload, null, 2) };
  }

  const lines = [`Top ${results.length} result(s) for "${query}":\n`];
  for (const r of results) {
    const tag = (r.kind || "paper") === "note" ? "📝 note" : "📄 paper";
    lines.push(`  [${r.score.toFixed(4)}] ${tag}${r.citekey ? ` \\cite{${r.citekey}}` : ""} (${r.topic}) ${r.title}`);
    if (r.journal) lines.push(`    ${r.journal}`);
    if (r.path) lines.push(`    ${r.path}`);
    lines.push("");
  }
  return { ok: true, output: lines.join("\n") };
}

// ── visualize — 3D PCA of the paper embeddings, colored by topic ──
// (The Constellation: each paper a star, each topic a color.)

/** Gram-matrix PCA via power iteration + deflation (N papers ≪ 1024 dims). */
function pcaND(vectors: number[][], k: number): number[][] {
  const n = vectors.length;
  const d = vectors[0]?.length ?? 0;
  if (n === 0 || d === 0) return [];

  const mean = new Array(d).fill(0);
  for (const v of vectors) for (let j = 0; j < d; j++) mean[j] += v[j] / n;
  const centered = vectors.map((v) => v.map((x, j) => x - mean[j]));

  const gram: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i; j < n; j++) {
      let dot = 0;
      for (let c = 0; c < d; c++) dot += centered[i][c] * centered[j][c];
      gram[i][j] = dot;
      gram[j][i] = dot;
    }
  }

  function powerIteration(matrix: number[][], iterations = 100): { vec: number[]; val: number } {
    // Deterministic seed (no Math.random) so the layout is reproducible.
    let vec = Array.from({ length: n }, (_, i) => Math.sin(i + 1));
    const norm0 = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
    vec = vec.map((v) => v / norm0);
    for (let iter = 0; iter < iterations; iter++) {
      const next = matrix.map((row) => row.reduce((sum, v, j) => sum + v * vec[j], 0));
      const norm = Math.sqrt(next.reduce((sum, v) => sum + v * v, 0)) || 1;
      vec = next.map((v) => v / norm);
    }
    const mv = matrix.map((row) => row.reduce((sum, v, j) => sum + v * vec[j], 0));
    const val = vec.reduce((sum, v, i) => sum + v * mv[i], 0);
    return { vec, val };
  }

  const components: Array<{ vec: number[]; val: number }> = [];
  let deflated = gram;
  for (let c = 0; c < k; c++) {
    const { vec, val } = powerIteration(deflated);
    components.push({ vec, val });
    deflated = deflated.map((row, i) => row.map((v, j) => v - val * vec[i] * vec[j]));
  }

  return Array.from({ length: n }, (_, i) => components.map(({ vec, val }) => vec[i] * Math.sqrt(Math.max(val, 0))));
}

// ── t-SNE — spread layout so clusters separate and labels stop colliding ──
// Classic van der Maaten t-SNE, PCA-initialised so it's deterministic (no RNG).
// n≈56 papers → the O(n²) form is instant; no Barnes-Hut needed.
function tsne(X: number[][], opts: { perplexity?: number; iters?: number } = {}): number[][] {
  const n = X.length;
  if (n === 0) return [];
  if (n <= 2) return X.map((_, i) => [i, 0]);
  const perp = opts.perplexity ?? Math.max(5, Math.min(20, Math.floor(n / 3)));
  const iters = opts.iters ?? 700;

  const D: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      let s = 0;
      for (let d = 0; d < X[i].length; d++) {
        const diff = X[i][d] - X[j][d];
        s += diff * diff;
      }
      D[i][j] = s;
      D[j][i] = s;
    }
  }

  // P_{j|i}: per-point binary search on beta (=1/2σ²) to hit target perplexity.
  const P: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  const logU = Math.log(perp);
  for (let i = 0; i < n; i++) {
    let betaMin = -Infinity, betaMax = Infinity, beta = 1;
    const prow = new Array(n).fill(0);
    for (let iter = 0; iter < 50; iter++) {
      let sum = 0;
      for (let j = 0; j < n; j++) {
        prow[j] = i === j ? 0 : Math.exp(-D[i][j] * beta);
        sum += prow[j];
      }
      sum = sum || 1e-12;
      let H = 0;
      for (let j = 0; j < n; j++) {
        const p = prow[j] / sum;
        if (p > 1e-12) H -= p * Math.log(p);
      }
      const diff = H - logU;
      if (Math.abs(diff) < 1e-5) break;
      if (diff > 0) {
        betaMin = beta;
        beta = betaMax === Infinity ? beta * 2 : (beta + betaMax) / 2;
      } else {
        betaMax = beta;
        beta = betaMin === -Infinity ? beta / 2 : (beta + betaMin) / 2;
      }
    }
    let sum = 0;
    for (let j = 0; j < n; j++) sum += prow[j];
    sum = sum || 1e-12;
    for (let j = 0; j < n; j++) P[i][j] = prow[j] / sum;
  }

  // symmetrize + normalize into P2
  const P2: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
  let psum = 0;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { P2[i][j] = P[i][j] + P[j][i]; psum += P2[i][j]; }
  psum = psum || 1e-12;
  for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) P2[i][j] = Math.max(P2[i][j] / psum, 1e-12);

  // init from PCA (deterministic), scaled small so early exaggeration dominates
  const pca = pcaND(X, 2);
  let Y = pca.map((c) => [c[0] ?? 0, c[1] ?? 0]);
  let mxInit = 0;
  for (const y of Y) mxInit = Math.max(mxInit, Math.abs(y[0]), Math.abs(y[1]));
  const f = mxInit > 0 ? 1e-4 / mxInit : 1;
  Y = Y.map((y) => [y[0] * f, y[1] * f]);

  const gains = Array.from({ length: n }, () => [1, 1]);
  const inc = Array.from({ length: n }, () => [0, 0]);
  // Small learning rate — for n≈56 the classic lr=200 diverges (a few points
  // shoot out, the rest collapse). ~15 (karpathy tsnejs range) stays stable.
  const lr = 15, exagg = 4, exaggEnd = 100;

  for (let iter = 0; iter < iters; iter++) {
    const num: number[][] = Array.from({ length: n }, () => new Array(n).fill(0));
    let qsum = 0;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = Y[i][0] - Y[j][0], dy = Y[i][1] - Y[j][1];
      const q = 1 / (1 + dx * dx + dy * dy);
      num[i][j] = q; num[j][i] = q; qsum += 2 * q;
    }
    qsum = qsum || 1e-12;
    const momentum = iter < 250 ? 0.5 : 0.8;
    for (let i = 0; i < n; i++) {
      let gx = 0, gy = 0;
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        const pij = (iter < exaggEnd ? exagg : 1) * P2[i][j];
        const qij = num[i][j] / qsum;
        const mult = (pij - qij) * num[i][j];
        gx += mult * (Y[i][0] - Y[j][0]);
        gy += mult * (Y[i][1] - Y[j][1]);
      }
      gx *= 4; gy *= 4;
      gains[i][0] = Math.max(0.01, Math.sign(gx) === Math.sign(inc[i][0]) ? gains[i][0] * 0.8 : gains[i][0] + 0.2);
      gains[i][1] = Math.max(0.01, Math.sign(gy) === Math.sign(inc[i][1]) ? gains[i][1] * 0.8 : gains[i][1] + 0.2);
      inc[i][0] = momentum * inc[i][0] - lr * gains[i][0] * gx;
      inc[i][1] = momentum * inc[i][1] - lr * gains[i][1] * gy;
      Y[i][0] += inc[i][0];
      Y[i][1] += inc[i][1];
    }
    let mx = 0, my = 0;
    for (const y of Y) { mx += y[0] / n; my += y[1] / n; }
    for (const y of Y) { y[0] -= mx; y[1] -= my; }
  }
  return Y;
}

// maw buffers a plugin's stdout and prints it only once the plugin process
// exits — which never happens for `serve`, so a plain console.log stays
// invisible for the whole life of the server (you just get a blank prompt).
// Writing to the controlling terminal bypasses that pipe entirely; fall back to
// stdout when there is no tty (piped runs, CI, `bun run src/index.ts`).
async function announce(text: string): Promise<void> {
  try {
    await Bun.write("/dev/tty", `${text}\n`);
  } catch {
    console.log(text);
  }
}

// The interactive page lives in a REAL html file next to this source
// (src/page.html) — edit it directly, no escaping games. `maw plugin install`
// copies the whole source tree, so it ships with the plugin; import.meta.dir
// points at the installed copy (process.cwd() would not — see repoRoot()).
async function loadPageTemplate(): Promise<{ text: string } | { error: string }> {
  const path = join(import.meta.dir, "page.html");
  const file = Bun.file(path);
  if (!(await file.exists())) {
    return { error: `page template missing: ${path} — re-run: maw plugin install ψ/lab/citation --force` };
  }
  return { text: await file.text() };
}

// Shared page builder: the interactive 2D constellation. `visualize` serves it;
// `graph --html` writes it to a file so it opens/shares without a server running.
type PageStats = {
  maxSim: number;
  meanSim: number;
  tsneMs: number;
  embedDim: number;
  topics: Array<{ topic: string; count: number }>;
  topDegree: Array<{ label: string; degree: number }>;
  isolated: number;
};
type BuiltPage = { html: string; nodeCount: number; topicCount: number; edgeCount: number; stats: PageStats };

async function buildConstellationHtml(threshold: number): Promise<BuiltPage | { error: string }> {
  const store = await storeRead();
  if (!store) return { error: `nothing indexed yet — run "maw citation index" first` };
  // The constellation maps PAPERS. Vault notes may share the index (--vault) but
  // would distort a literature layout, so they are excluded here.
  const keep = store.meta.map((m, i) => ({ m, i })).filter(({ m }) => (m.kind || "paper") === "paper");
  if (keep.length === 0) return { error: 'no papers in the index — run "maw citation index" first' };
  const rows = keep.map(({ m }) => m as unknown as Record<string, unknown>);
  const dim = store.manifest.dim;
  const vectors = keep.map(({ i }) => Array.from(store.vectors.subarray(i * dim, (i + 1) * dim)));
  const tsneStart = Date.now();
  const coords = tsne(vectors);
  const tsneMs = Date.now() - tsneStart;

  // Same t-SNE + robust percentile scaling as `graph`, into a virtual canvas.
  const VW = 2000, VH = 1300, M = 90;
  const pct = (arr: number[], p: number) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.max(0, Math.min(s.length - 1, Math.floor((p / 100) * (s.length - 1))))];
  };
  const xs = coords.map((c) => c[0] ?? 0), ys = coords.map((c) => c[1] ?? 0);
  const minX = pct(xs, 2), maxX = pct(xs, 98), minY = pct(ys, 2), maxY = pct(ys, 98);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const px = coords.map((c) => M + ((clamp(c[0] ?? 0, minX, maxX) - minX) / (maxX - minX || 1)) * (VW - 2 * M));
  const py = coords.map((c) => VH - M - ((clamp(c[1] ?? 0, minY, maxY) - minY) / (maxY - minY || 1)) * (VH - 2 * M));

  const nodes = rows.map((r: Record<string, unknown>, i: number) => ({
    x: px[i], y: py[i],
    title: String(r.title), journal: String(r.journal), topic: String(r.topic),
    label: shortLabel(String(r.title)),   // author + year
    name: paperName(String(r.title)),     // the paper's descriptive name
    detail: String(r.text ?? ""),         // full indexed text, for the click popup
    // Not in the corpus today — the page links out by title until DOIs are
    // resolved in. Passed through so a real link works the moment they exist.
    doi: r.doi ? String(r.doi) : "",
    url: r.url ? String(r.url) : "",
  }));
  const topics = [...new Set(nodes.map((n) => n.topic))].sort();
  const palette = ["#2ca88f", "#e8724c", "#5b74c9", "#d94f9a", "#7bc043", "#f2c53d", "#c9a66b", "#9aa0a6"];
  const colorFor = (t: string) => palette[topics.indexOf(t) % palette.length];
  const colorMap = Object.fromEntries(topics.map((t) => [t, colorFor(t)]));

  const edges: Array<{ i: number; j: number; s: number }> = [];
  let maxSim = 0, simSum = 0, simCount = 0;
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const s = cosine(vectors[i], vectors[j]);
      if (s > maxSim) maxSim = s;
      simSum += s;
      simCount++;
      if (s > threshold) edges.push({ i, j, s });
    }
  }
  const degree = new Array(nodes.length).fill(0);
  for (const e of edges) { degree[e.i]++; degree[e.j]++; }
  const stats: PageStats = {
    maxSim,
    meanSim: simCount ? simSum / simCount : 0,
    tsneMs,
    embedDim: vectors[0]?.length ?? 0,
    topics: topics.map((t) => ({ topic: t, count: nodes.filter((n) => n.topic === t).length })),
    topDegree: degree
      .map((d, i) => ({ label: nodes[i].label, degree: d }))
      .sort((a, b) => b.degree - a.degree)
      .slice(0, 5),
    isolated: degree.filter((d) => d === 0).length,
  };

  // The page itself is a REAL html file (src/page.html) — loaded, not inlined.
  const template = await loadPageTemplate();
  if ("error" in template) return { error: template.error };

  const data = {
    nodes, edges, vectors,
    colors: colorMap,
    worker: LOCAL_WORKER_URL,
    model: EMBED_MODEL,
    vw: VW, vh: VH,
    threshold,
  };
  // `<` → \u003c so no "</script>" can ever terminate the data block early.
  const dataJson = JSON.stringify(data).replace(/</g, "\\u003c");
  // All substitutions are global: a stray mention of a placeholder anywhere in
  // the template must not swallow the real one (a non-global data replace once
  // injected into page.html's header comment and left the page blank).
  const html = template.text
    .replace(/\{\{FONT_SANS\}\}/g, FONT_SANS)
    .replace(/\{\{FONT_SERIF\}\}/g, FONT_SERIF)
    .replace(/\{\{DATA_JSON\}\}/g, () => dataJson);
  if (html.includes("{{")) {
    return { error: `page.html has unsubstituted placeholders — check src/page.html tokens` };
  }

  return { html, nodeCount: nodes.length, topicCount: topics.length, edgeCount: edges.length, stats };
}

// Verbose report shared by `visualize` and `graph` (--verbose / -v).
function verboseLines(s: PageStats, edgeCount: number, nodeCount: number, threshold: number): string[] {
  const pairs = (nodeCount * (nodeCount - 1)) / 2;
  return [
    "",
    "── verbose ──",
    `  embeddings   ${EMBED_MODEL} · ${s.embedDim}-dim · ${nodeCount} papers`,
    `  layout       t-SNE (PCA-init, deterministic) in ${s.tsneMs} ms`,
    `  similarity   max ${s.maxSim.toFixed(3)} · mean ${s.meanSim.toFixed(3)} over ${pairs} pairs`,
    `  edges        ${edgeCount} of ${pairs} pairs above ${threshold} (${((edgeCount / (pairs || 1)) * 100).toFixed(1)}%)`,
    `  isolated     ${s.isolated} paper(s) with no edge at this threshold`,
    "  topics",
    ...s.topics.map((t) => `      ${String(t.count).padStart(3)}  ${t.topic}`),
    "  most-connected",
    ...s.topDegree.map((d) => `      ${String(d.degree).padStart(3)}  ${d.label}`),
  ];
}

async function cmdVisualize(rest: string[]): Promise<PluginResult> {
  const portFlagIndex = rest.indexOf("--port");
  const port = portFlagIndex >= 0 ? Number(rest[portFlagIndex + 1]) : Number(process.env.CITATION_VISUALIZE_PORT) || 5556;
  const tIdx = rest.indexOf("--threshold");
  const threshold = tIdx >= 0 ? Number(rest[tIdx + 1]) : 0.68;

  const built = await buildConstellationHtml(threshold);
  if ("error" in built) return { ok: false, error: built.error };

  // A previous `visualize` often still holds the port; step to the next free one
  // instead of dying with EADDRINUSE.
  let served = port;
  for (let attempt = 0; ; attempt++) {
    try {
      Bun.serve({ port: served, fetch: () => new Response(built.html, { headers: { "content-type": "text/html" } }) });
      break;
    } catch (error) {
      const busy = String(error).includes("EADDRINUSE") || String(error).includes("in use");
      if (!busy || attempt >= 9) return { ok: false, error: `could not bind a port near ${port}: ${String(error)}` };
      served++;
    }
  }
  const portNote = served !== port ? `⚠ port ${port} busy (an earlier serve is still running) — using ${served}\n` : "";

  // Verbose is the DEFAULT here: serving is interactive, so the stats are what
  // you want to see. `--quiet`/`-q` trims it back to the banner.
  const verbose = !(rest.includes("--quiet") || rest.includes("-q"));
  const lines = [
    `✦ citation constellation (2D) — http://localhost:${served}`,
    `${built.nodeCount} papers · ${built.topicCount} topics · ${built.edgeCount} edges (sim > ${threshold})`,
    `drag to pan · scroll to zoom · hover a star · click a star for full detail · search to highlight`,
  ];
  if (verbose) lines.push(...verboseLines(built.stats, built.edgeCount, built.nodeCount, threshold));
  lines.push("Ctrl+C to stop");

  // Announce NOW, straight to the terminal — this command never finishes, and
  // maw only flushes returned output (or piped stdout) once the process exits.
  await announce(portNote + lines.join("\n"));
  return { ok: true };
}

// ── graph — 2D labeled similarity network, rendered to PNG (the readable one) ──
// papers as labeled nodes, colored by topic, edges where cosine similarity >
// threshold. This IS the citation graph. Matches the June "Research Concept
// Network" style Nat found readable — flat, labeled, edged.

function cosine(a: number[], b: number[]): number {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

// "Barkjohn et al. (2021) -- US-wide PurpleAir Correction" → "Barkjohn et al. (2021)"
function shortLabel(title: string): string {
  const head = title.split(/\s+(?:--|—|-)\s+/)[0].trim();
  const label = head || title;
  return label.length > 40 ? `${label.slice(0, 38)}…` : label;
}

// The other half: "Barkjohn et al. (2021) -- US-wide PurpleAir Correction"
// → "US-wide PurpleAir Correction". Empty when the title has no descriptive part.
function paperName(title: string): string {
  const parts = title.split(/\s+(?:--|—)\s+/);
  const tail = parts.slice(1).join(" — ").trim();
  if (!tail) return "";
  return tail.length > 44 ? `${tail.slice(0, 42)}…` : tail;
}

function svgEscape(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function cmdGraph(rest: string[]): Promise<PluginResult> {
  const tIdx = rest.indexOf("--threshold");
  const threshold = tIdx >= 0 ? Number(rest[tIdx + 1]) : 0.5;
  const oIdx = rest.indexOf("--out");
  const outArg = oIdx >= 0 ? rest[oIdx + 1] : "artifacts/citation-network.png";
  const outPath = join(repoRoot(), outArg);

  const store = await storeRead();
  if (!store) return { ok: false, error: `nothing indexed yet — run "maw citation index" first` };
  const keep = store.meta.map((m, i) => ({ m, i })).filter(({ m }) => (m.kind || "paper") === "paper");
  if (keep.length === 0) return { ok: false, error: 'no papers in the index — run "maw citation index" first' };
  const rows = keep.map(({ m }) => m as unknown as Record<string, unknown>);
  const gdim = store.manifest.dim;
  const vectors = keep.map(({ i }) => Array.from(store.vectors.subarray(i * gdim, (i + 1) * gdim)));
  const nodes = rows.map((r: Record<string, unknown>) => ({
    title: String(r.title),
    topic: String(r.topic),
    label: shortLabel(String(r.title)),  // author + year
    name: paperName(String(r.title)),    // the paper's descriptive name
  }));
  const coords = tsne(vectors);

  // canvas — scale on the 2nd–98th percentile so a stray outlier can't
  // squash the whole cloud into a corner.
  const W = 2000, H = 1300, M = 90;
  const pct = (arr: number[], p: number) => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.max(0, Math.min(s.length - 1, Math.floor((p / 100) * (s.length - 1))))];
  };
  const xs = coords.map((c) => c[0] ?? 0), ys = coords.map((c) => c[1] ?? 0);
  const minX = pct(xs, 2), maxX = pct(xs, 98);
  const minY = pct(ys, 2), maxY = pct(ys, 98);
  const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v));
  const sx = (x: number) => M + ((clamp(x, minX, maxX) - minX) / (maxX - minX || 1)) * (W - 2 * M);
  const sy = (y: number) => H - M - ((clamp(y, minY, maxY) - minY) / (maxY - minY || 1)) * (H - 2 * M); // flip
  const px = coords.map((c) => sx(c[0] ?? 0));
  const py = coords.map((c) => sy(c[1] ?? 0));

  // topics + palette
  const topics = [...new Set(nodes.map((n) => n.topic))].sort();
  const palette = ["#2ca88f", "#e8724c", "#5b74c9", "#d94f9a", "#7bc043", "#f2c53d", "#c9a66b", "#9aa0a6"];
  const colorFor = (topic: string) => palette[topics.indexOf(topic) % palette.length];

  // edges above threshold
  const edges: Array<{ i: number; j: number; s: number }> = [];
  let maxSim = 0;
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const s = cosine(vectors[i], vectors[j]);
      if (s > maxSim) maxSim = s;
      if (s > threshold) edges.push({ i, j, s });
    }
  }

  const edgeSvg = edges
    .map((e) => {
      const op = Math.min(0.5, (e.s - threshold) / (1 - threshold) + 0.12).toFixed(3);
      const w = (0.6 + (e.s - threshold) * 6).toFixed(2);
      return `<line x1="${px[e.i].toFixed(1)}" y1="${py[e.i].toFixed(1)}" x2="${px[e.j].toFixed(1)}" y2="${py[e.j].toFixed(1)}" stroke="#9aa3ad" stroke-width="${w}" stroke-opacity="${op}"/>`;
    })
    .join("");

  const nodeSvg = nodes
    .map((n, i) => {
      const above = i % 2 === 0; // alternate label above/below to reduce collisions
      // two lines: author+year, then the paper's name underneath
      const ly = above ? py[i] - (n.name ? 32 : 14) : py[i] + 22;
      const x = px[i].toFixed(1);
      const line2 = n.name
        ? `<tspan x="${x}" dy="15" font-size="12.5" font-weight="400" fill="#5b6270">${svgEscape(n.name)}</tspan>`
        : "";
      return (
        `<circle cx="${x}" cy="${py[i].toFixed(1)}" r="9" fill="${colorFor(n.topic)}" stroke="#ffffff" stroke-width="1.5"/>` +
        `<text y="${ly.toFixed(1)}" font-family="${FONT_SANS}" text-anchor="middle" paint-order="stroke" stroke="#ffffff" stroke-width="3.5" stroke-linejoin="round">` +
        `<tspan x="${x}" font-size="15" font-weight="600" fill="#1a1a2e">${svgEscape(n.label)}</tspan>${line2}</text>`
      );
    })
    .join("");

  const legendSvg =
    `<rect x="34" y="34" width="360" height="${44 + topics.length * 30}" rx="10" fill="#ffffff" stroke="#d7dbe0" stroke-width="1.5"/>` +
    `<text x="54" y="66" font-family="${FONT_SERIF}" font-size="22" font-weight="700" fill="#1a1a2e">Research Clusters</text>` +
    topics
      .map((t, i) => {
        const cy = 92 + i * 30;
        const count = nodes.filter((n) => n.topic === t).length;
        return `<circle cx="64" cy="${cy - 5}" r="8" fill="${colorFor(t)}"/><text x="82" y="${cy}" font-family="${FONT_SANS}" font-size="17" fill="#33373d">${svgEscape(t)} (${count})</text>`;
      })
      .join("");

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">` +
    `<rect width="${W}" height="${H}" fill="#ffffff"/>` +
    `<text x="${W / 2}" y="50" font-family="${FONT_SERIF}" font-size="34" font-weight="700" text-anchor="middle" fill="#141428">Citation Constellation</text>` +
    `<text x="${W / 2}" y="76" font-family="${FONT_SANS}" font-size="16" text-anchor="middle" fill="#6b7280">bge-m3 · t-SNE · ${nodes.length} papers · ${edges.length} edges (cosine &gt; ${threshold})</text>` +
    edgeSvg + legendSvg + nodeSvg +
    `</svg>`;

  await mkdir(dirname(outPath), { recursive: true });
  // SVG always — it is dependency-free and scales. PNG only if `sharp` happens to
  // be installed, so a zero-dependency install still produces a usable figure.
  const svgPath = outPath.replace(/\.png$/, ".svg");
  await Bun.write(svgPath, svg);
  let pngNote = "";
  try {
    const { default: sharp } = (await import("sharp")) as { default: (b: Buffer) => { png: () => { toFile: (p: string) => Promise<unknown> } } };
    await sharp(Buffer.from(svg)).png().toFile(outPath);
    pngNote = `\n✦ png            → ${outPath}`;
  } catch {
    pngNote = `\n  (png skipped — 'sharp' not installed; the SVG above is the figure)`;
  }

  // --html: also write the interactive page (same t-SNE + edges) as a portable
  // file — openable/shareable without keeping `visualize`'s server running.
  let htmlNote = "";
  let verboseTail: string[] = [];
  if (rest.includes("--verbose") || rest.includes("-v")) {
    const built = await buildConstellationHtml(threshold);
    if (!("error" in built)) {
      verboseTail = verboseLines(built.stats, built.edgeCount, built.nodeCount, threshold);
    }
  }
  if (rest.includes("--html")) {
    const hIdx = rest.indexOf("--html");
    const nextArg = rest[hIdx + 1];
    const htmlArg = nextArg && !nextArg.startsWith("--") ? nextArg : outArg.replace(/\.png$/, ".html");
    const htmlPath = join(repoRoot(), htmlArg);
    const built = await buildConstellationHtml(threshold);
    if ("error" in built) return { ok: false, error: built.error };
    await mkdir(dirname(htmlPath), { recursive: true });
    await Bun.write(htmlPath, built.html);
    htmlNote = `\n✦ interactive page → ${htmlPath} (open in a browser: pan/zoom/hover/search)`;
  }

  return {
    ok: true,
    output:
      `✦ citation graph → ${svgPath}${pngNote}${htmlNote}\n` +
      `${nodes.length} papers · ${topics.length} topics · ${edges.length} edges (cosine > ${threshold}, max observed ${maxSim.toFixed(3)})\n` +
      (edges.length === 0
        ? `no edges at this threshold — lower it: maw citation graph --threshold ${(maxSim - 0.05).toFixed(2)}`
        : edges.length > 400
          ? `dense — raise threshold for a cleaner graph: maw citation graph --threshold ${(threshold + 0.1).toFixed(2)}`
          : `tune with --threshold N`) +
      (verboseTail.length ? `\n${verboseTail.join("\n")}` : ""),
  };
}

// ── doi — resolve and verify against Crossref ──
// The corpus arrived as JSONL with no DOIs and, for nine papers, no authors at
// all (the upstream reference list literally reads "[Authors]"). Both are hard
// blockers for a `.bib`, and both are exactly the kind of gap that tempts an LLM
// to fill it in from memory. So this resolves them against Crossref — the
// registration authority — and refuses anything it cannot match confidently.
//
// Two failure modes already cost us real time and are guarded here explicitly:
//   1. A title search once ranked an *editorial comment* above the paper it
//      commented on. Hence `type` must be "journal-article".
//   2. An outside tool invented "Chen et al." for a paper actually by She et al.
//      Hence authors are only ever taken FROM Crossref, never carried over.

const CROSSREF_API = "https://api.crossref.org/works";
// Crossref asks for a contact address in exchange for the faster "polite" pool.
const CROSSREF_MAILTO = process.env.CROSSREF_MAILTO || "citation-oracle@soul-brews.studio";

type CrossrefWork = {
  DOI: string;
  type: string;
  title?: string[];
  "container-title"?: string[];
  issued?: { "date-parts"?: number[][] };
  volume?: string;
  issue?: string;
  page?: string;
  "article-number"?: string;
  author?: Array<{ family?: string; given?: string; name?: string }>;
};

/**
 * Crossref serves XML-escaped text, so journal names arrive as
 * "Environmental Science &amp; Technology". Writing that into a card would put a
 * literal "&amp;" in the thesis bibliography.
 */
function decodeEntities(s: string): string {
  return s
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;|&#39;/g, "'")
    .replace(/&nbsp;/g, " ");
}

/** Strip markup and punctuation so two spellings of one title compare equal. */
function normalizeTitle(s: string): string {
  return s
    .replace(/<[^>]+>/g, " ")      // Crossref embeds <sub>/<sup> in titles
    .replace(/[‐-―]/g, "-") // en/em dashes vs hyphen
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

/**
 * Token overlap over words longer than three characters. Crude, but it separates
 * "the same paper" from "an adjacent paper by the same group", which is the
 * distinction that actually matters here.
 *
 * Precision and recall are kept apart on purpose. Hand-kept reference lists
 * routinely drop a subtitle — the corpus stored "LGHAP: the Long-term Gap-free
 * High-resolution Air Pollutant concentration dataset" for a paper that really
 * ends "…, derived via tensor-flow-based multimodal data fusion". Every word of
 * the stored title is in the real one (precision 1.0) while F1 falls to 0.72.
 * Containment is the signal there; symmetry would throw it away.
 */
function titleScores(stored: string, candidate: string): { f1: number; precision: number; recall: number } {
  const A = new Set(normalizeTitle(stored).split(" ").filter((w) => w.length > 3));
  const B = new Set(normalizeTitle(candidate).split(" ").filter((w) => w.length > 3));
  if (!A.size || !B.size) return { f1: 0, precision: 0, recall: 0 };
  let hit = 0;
  for (const w of A) if (B.has(w)) hit++;
  const precision = hit / A.size;   // how much of what we stored is in the candidate
  const recall = hit / B.size;      // how much of the candidate we stored
  const f1 = precision + recall === 0 ? 0 : (2 * precision * recall) / (precision + recall);
  return { f1, precision, recall };
}


function crossrefAuthors(w: CrossrefWork): string[] {
  return (w.author ?? [])
    .map((a) => {
      if (!a.family) return decodeEntities(a.name?.trim() ?? "");
      // "Sachit" → "S."; "Van der Berg" stays intact as the family name.
      // Guard the first character: a given name recorded as "Ernest Kojo -"
      // otherwise yields the nonsense initial "-.".
      const initials = (a.given ?? "")
        .split(/[\s.]+/)
        .filter((g) => /^\p{L}/u.test(g))
        .map((g) => `${g[0]!.toUpperCase()}.`)
        .join(" ");
      const family = decodeEntities(a.family);
      return initials ? `${family}, ${initials}` : family;
    })
    .filter(Boolean);
}

function crossrefYear(w: CrossrefWork): string {
  return String(w.issued?.["date-parts"]?.[0]?.[0] ?? "");
}

/** Nature-family journals number articles rather than paginating them. */
function crossrefPages(w: CrossrefWork): string {
  return w.page ?? w["article-number"] ?? "";
}

function surnameSet(authors: string[]): Set<string> {
  return new Set(authors.map((a) => a.split(",")[0]!.trim().toLowerCase()).filter(Boolean));
}

/**
 * How much of what we already believed about authorship survives contact with
 * Crossref. Titles can match 1.00 and still be the wrong paper — a review and
 * the study it reviews often share a title almost word for word — so when a card
 * already names authors, they are the sharpest disambiguator available. A score
 * of 0 with authors on both sides means the two records are about different
 * papers, whatever the titles say.
 */
function authorAgreement(known: string[], found: string[]): number {
  const a = surnameSet(known), b = surnameSet(found);
  if (!a.size || !b.size) return 1;   // nothing to disagree about
  let hit = 0;
  for (const s of a) if (b.has(s)) hit++;
  return hit / a.size;
}

type Match = {
  work: CrossrefWork;
  similarity: number;
  yearMatch: boolean;
  authorScore: number;
  /** Title + journal + year all agree: this is the same paper, whoever wrote it. */
  strong: boolean;
  /** The stored title is a truncation of the candidate's — a subtitle was dropped. */
  contained: boolean;
  confident: boolean;
};

/**
 * One place decides what counts as a match, so the search path and the
 * known-DOI path cannot drift apart in how strict they are.
 */
function scoreMatch(work: CrossrefWork, storedTitle: string, journal: string, year: string, knownAuthors: string[]): Match {
  const { f1, precision } = titleScores(storedTitle, decodeEntities((work.title ?? [""])[0] ?? ""));
  const found = crossrefYear(work);
  // Online-first publication routinely shifts the year by one.
  const yearMatch = !year || !found || Math.abs(Number(found) - Number(year)) <= 1;
  const journalMatch =
    !journal || !(work["container-title"] ?? [])[0] ||
    normalizeTitle(decodeEntities((work["container-title"] ?? [""])[0] ?? "")) === normalizeTitle(journal);
  const authorScore = authorAgreement(knownAuthors, crossrefAuthors(work));
  const isArticle = work.type === "journal-article";
  // A near-exact match on a long, distinctive title in the same journal and year
  // identifies the paper on its own. Two different papers do not share a title
  // like "Spatiotemporally continuous PM2.5 dataset in the Mekong River Basin".
  const strong = isArticle && f1 >= 0.95 && journalMatch && yearMatch;
  // Every stored word present, same journal, same year: a dropped subtitle, not
  // a different paper. Journal and year carry the weight the missing tail can't.
  const contained = isArticle && precision >= 0.95 && f1 >= 0.6 && journalMatch && yearMatch;
  return {
    work,
    similarity: f1,
    yearMatch,
    authorScore,
    strong,
    contained,
    // A preprint (`posted-content`) of the same paper scores 1.0 on title, so
    // the type check is doing real work, not ceremony. Author agreement guards
    // the weaker band, where a review and its subject can look alike.
    confident: strong || contained || (isArticle && f1 >= 0.85 && yearMatch && authorScore >= 0.5),
  };
}

/**
 * Fetch one known DOI and score it like any search hit. Sometimes you already
 * know the DOI and Crossref's bibliographic search simply cannot find the paper
 * from its title — but "I know it" is still not evidence, so the record is
 * fetched and checked against the card rather than taken on trust.
 */
async function crossrefByDoi(doi: string, title: string, journal: string, year: string, knownAuthors: string[]): Promise<Match | null> {
  const res = await fetch(`${CROSSREF_API}/${encodeURIComponent(doi)}?mailto=${encodeURIComponent(CROSSREF_MAILTO)}`, {
    signal: AbortSignal.timeout(20000),
  });
  if (!res.ok) return null;
  const json = (await res.json()) as { status?: string; message?: CrossrefWork };
  const work = json.status === "ok" ? json.message : undefined;
  if (!work) return null;
  return scoreMatch(work, title, journal, year, knownAuthors);
}

async function crossrefSearch(title: string, journal: string, year: string, knownAuthors: string[] = []): Promise<Match[]> {
  const url = new URL(CROSSREF_API);
  url.searchParams.set("query.bibliographic", [title, journal, year].filter(Boolean).join(" "));
  url.searchParams.set("rows", "5");
  url.searchParams.set("select", "DOI,title,container-title,type,issued,volume,issue,page,article-number,author");
  url.searchParams.set("mailto", CROSSREF_MAILTO);

  const res = await fetch(url, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`Crossref ${res.status}`);
  const json = (await res.json()) as { message?: { items?: CrossrefWork[] } };

  return (json.message?.items ?? [])
    .map((work) => scoreMatch(work, title, journal, year, knownAuthors))
    .sort((a, b) => b.similarity - a.similarity);
}

type RawCard = { path: string; name: string; text: string; fm: Record<string, string | string[]> };

/** Cards as they are on disk — `readPaperCards` reshapes for search and drops fields. */
async function readRawCards(): Promise<RawCard[]> {
  const dir = join(repoRoot(), PAPERS_DIR);
  const NOT_CARDS = new Set(["INDEX.md", "README.md"]);
  let names: string[] = [];
  try {
    names = (await readdir(dir)).filter((n) => n.endsWith(".md") && !NOT_CARDS.has(n));
  } catch {
    return [];
  }
  const out: RawCard[] = [];
  for (const name of names.sort()) {
    const path = join(dir, name);
    const text = await readFile(path, "utf-8").catch(() => "");
    if (text) out.push({ path, name, text, fm: parseFrontmatter(text) });
  }
  return out;
}

/**
 * Rewrite frontmatter fields in place, leaving every other byte untouched.
 * Deliberately surgical rather than re-rendering the card: a card carries hand
 * written notes and an edited body, and a round-trip through renderCard() would
 * quietly normalise things nobody asked it to touch.
 */
function patchFrontmatter(text: string, updates: Record<string, string | string[]>): string {
  const m = text.match(/^---\n([\s\S]*?)\n---/);
  if (!m) return text;
  const lines = m[1].split("\n");
  const out: string[] = [];
  const applied = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    const key = lines[i].match(/^([A-Za-z_][A-Za-z0-9_]*):/)?.[1];
    if (!key || !(key in updates)) {
      out.push(lines[i]);
      continue;
    }
    // Swallow the old value, including any indented list items beneath it.
    while (i + 1 < lines.length && /^\s+-\s+/.test(lines[i + 1])) i++;
    const value = updates[key];
    if (Array.isArray(value)) {
      out.push(value.length ? `${key}:\n${value.map((v) => `  - ${yamlEscape(v)}`).join("\n")}` : `${key}: []`);
    } else {
      out.push(`${key}: ${key === "status" || key === "citekey" ? value : yamlEscape(value)}`);
    }
    applied.add(key);
  }

  for (const [key, value] of Object.entries(updates)) {
    if (applied.has(key)) continue;
    out.push(Array.isArray(value)
      ? (value.length ? `${key}:\n${value.map((v) => `  - ${yamlEscape(v)}`).join("\n")}` : `${key}: []`)
      : `${key}: ${key === "status" || key === "citekey" ? value : yamlEscape(value)}`);
  }

  return text.replace(m[0], `---\n${out.join("\n")}\n---`);
}

/**
 * Once authors are known, three places in the body still say otherwise: the H1,
 * the "[Authors]." citation line, and the needs-authors warning. Leaving them is
 * worse than never having resolved the paper — the card would contradict itself.
 */
function refreshCardBody(text: string, authors: string[], year: string, journal: string, shortTitle: string, fullTitle: string, volume: string, pages: string, doi: string, forceCitation = false): string {
  let out = text;
  const label = citeLabel(authors, year, journal);
  out = out.replace(/^#\s+.*$/m, `# ${label} — ${shortTitle || fullTitle}`);
  out = out.replace(/\n>\s*⚠️ Authors are unrecorded upstream[^\n]*\n/, "\n");

  const authorList =
    authors.length <= 1 ? (authors[0] ?? "")
    : `${authors.slice(0, -1).join(", ")}, & ${authors[authors.length - 1]}`;
  const vp = [volume, pages].filter(Boolean).join(", ");
  const citation =
    `${authorList} (${year}). ${fullTitle}. *${journal}*${vp ? `, ${vp}` : ""}.` +
    (doi ? ` https://doi.org/${doi}` : "");
  out = out.replace(/(\*\*Full citation\*\*\s*—\s*)(.*)/, (_full, prefix: string, existing: string) =>
    // Only overwrite the placeholder — a hand-written citation is human work.
    // The exception is a corrected byline: leaving the old reference line would
    // make the card contradict its own frontmatter, which is worse than either.
    forceCitation || /^\[Authors?\]/i.test(existing.trim()) || !existing.trim()
      ? `${prefix}${citation}`
      : `${prefix}${existing}`);
  return out;
}

async function cmdDoi(rest: string[]): Promise<PluginResult> {
  const write = rest.includes("--write");
  const all = rest.includes("--all");
  const rekey = rest.includes("--rekey");
  const keepAuthors = rest.includes("--keep-authors");
  const doiFlag = rest.indexOf("--doi");
  const givenDoi = doiFlag >= 0 ? rest[doiFlag + 1] : undefined;
  // Escape hatch for the case where the DOI is known-good and the *stored title*
  // is what's wrong — a fabricated title reached one card, and no similarity
  // threshold can tell "our title is wrong" from "wrong paper". Deliberately
  // narrow: one named card, an explicit DOI, and an explicit assertion of trust.
  const trustDoi = rest.includes("--trust-doi");
  const only = new Set(rest.filter((a, i) => !a.startsWith("--") && i !== doiFlag + 1));
  if (givenDoi && only.size !== 1) {
    return { ok: false, error: "--doi applies to exactly one card: citation doi <citekey> --doi 10.xxxx/yyy --write" };
  }
  if (trustDoi && !givenDoi) {
    return { ok: false, error: "--trust-doi only means anything with an explicit --doi to trust" };
  }

  const cards = await readRawCards();
  if (!cards.length) return { ok: false, error: `no cards in ${PAPERS_DIR} — run "citation cards" first` };

  const str = (fm: RawCard["fm"], k: string) => (typeof fm[k] === "string" ? (fm[k] as string) : "");
  const targets = cards.filter((c) => {
    if (only.size) return only.has(str(c.fm, "citekey")) || only.has(c.name.replace(/\.md$/, ""));
    if (all) return true;
    const authors = Array.isArray(c.fm.authors) ? (c.fm.authors as string[]) : [];
    return !str(c.fm, "doi") || !authors.length;   // the two things that block a .bib
  });

  if (!targets.length) {
    return { ok: true, output: `✦ nothing to resolve — every card already has a DOI and authors (${cards.length} cards).` };
  }

  const lines: string[] = [`✦ resolving ${targets.length} of ${cards.length} card(s) against Crossref${write ? "" : "  [dry run — pass --write to save]"}`, ""];
  let resolved = 0, ambiguous = 0, failed = 0, renamed = 0;
  const disputedAuthors: string[] = [];
  // Grows as we rename, so two cards in one run cannot claim the same new key.
  const takenKeys = new Set(cards.map((c) => c.name.replace(/\.md$/, "")));

  for (const card of targets) {
    const citekey = str(card.fm, "citekey") || card.name.replace(/\.md$/, "");
    const title = str(card.fm, "title");
    const journal = str(card.fm, "journal");
    const year = str(card.fm, "year");

    const knownAuthors = Array.isArray(card.fm.authors) ? (card.fm.authors as string[]) : [];
    // Some cards store the issue inside the volume, APA-style: "11(23)". BibTeX
    // wants them apart (volume/number), so split before Crossref's values land.
    const storedVolume = (() => {
      const raw = str(card.fm, "volume");
      const m = raw.match(/^\s*([^\s(]+)\s*\(\s*([^)]+)\s*\)\s*$/);
      return m ? { volume: m[1], issue: m[2] } : { volume: raw, issue: str(card.fm, "issue") };
    })();
    let matches: Match[];
    try {
      matches = givenDoi
        ? [await crossrefByDoi(givenDoi, title, journal, year, knownAuthors)].filter((m): m is Match => m !== null)
        : await crossrefSearch(title, journal, year, knownAuthors);
    } catch (error) {
      lines.push(`  ✗ ${citekey} — Crossref unreachable: ${error instanceof Error ? error.message : String(error)}`);
      failed++;
      continue;
    }

    const best = matches.find((m) => m.confident) ?? (trustDoi ? matches[0] : undefined);
    if (best && trustDoi && !best.confident) {
      lines.push(
        `  ! ${citekey} — accepting ${best.work.DOI} on trust despite title similarity ${best.similarity.toFixed(2)}`,
        `      stored title  : ${title}`,
        `      Crossref title: ${decodeEntities(((best.work.title ?? [""])[0] ?? "").replace(/<[^>]+>/g, ""))}`,
        `      → the stored title is being REPLACED. If the DOI is wrong, this writes a wrong citation.`,
      );
    }
    if (!best) {
      const top = matches[0];
      const why = !top
        ? "no results"
        : top.work.type !== "journal-article" ? `top hit is a ${top.work.type}, not a journal article`
        : top.similarity < 0.85 ? `best title similarity only ${top.similarity.toFixed(2)}`
        : top.authorScore < 0.5 ? `authors disagree — card says ${surnameSet(knownAuthors).values().next().value ?? "?"}, Crossref says ${surnameSet(crossrefAuthors(top.work)).values().next().value ?? "?"}`
        : "year mismatch";
      lines.push(
        `  ? ${citekey} — no confident match (${why})` +
        (top ? `\n      best: [${top.similarity.toFixed(2)}] ${top.work.type} ${top.work.DOI}\n      ${((top.work.title ?? [""])[0] ?? "").slice(0, 90)}` : ""),
      );
      ambiguous++;
      continue;
    }

    const w = best.work;
    const authors = crossrefAuthors(w);
    const crJournal = decodeEntities((w["container-title"] ?? [""])[0] ?? "");
    const crTitle = decodeEntities(((w.title ?? [""])[0] ?? title).replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim());
    const notes: string[] = [];
    // The corpus's journal is sometimes simply wrong — worth saying out loud,
    // because a wrong journal in a thesis bibliography is a citation error.
    if (crJournal && normalizeTitle(crJournal) !== normalizeTitle(journal)) notes.push(`journal: "${journal}" → "${crJournal}"`);
    const crPages = crossrefPages(w);
    if (crPages && crPages !== str(card.fm, "pages")) notes.push(`pages: "${str(card.fm, "pages")}" → "${crPages}"`);

    // The upstream reference list has been caught crediting the wrong first
    // author (once, the paper's LAST author, misspelled). Crossref is the
    // publisher's own registered metadata, so on a strong match it wins — but the
    // old list is preserved, never erased, and the swap is always announced.
    const disputed = knownAuthors.length > 0 && best.authorScore < 0.5 && best.strong;
    // "Bainomugisha, E., et al." is not an author list, it is a list with a hole
    // in it — and BibTeX has no idea what "et al." means, so it would render as a
    // person's name. Crossref carries the complete list; prefer it.
    const truncated = knownAuthors.some((a) => /\bet\s+al\.?\s*$/i.test(a));
    // Silent omission: every stored author appears in Crossref's list, but the
    // list is shorter. Nothing disagrees — a co-author was simply dropped when
    // the reference was typed, with no "et al." to admit it. she2019 lost its
    // fifth author that way, which is a small citation error that still misstates
    // who did the work.
    const incomplete = knownAuthors.length > 0 && best.authorScore === 1 && authors.length > knownAuthors.length;
    const sameWork = best.strong || best.contained || trustDoi;
    const takeAuthors =
      !knownAuthors.length || (!keepAuthors && (disputed || ((truncated || incomplete) && sameWork)));

    if (best.contained && !best.strong) notes.push(`title was truncated upstream → "${crTitle.slice(0, 78)}${crTitle.length > 78 ? "…" : ""}"`);
    lines.push(`  ✓ ${citekey} [${best.similarity.toFixed(2)}]${best.strong && best.authorScore < 1 ? " strong" : best.contained && !best.strong ? " contained" : ""} ${w.DOI}`);
    lines.push(`      ${authors.slice(0, 3).join("; ")}${authors.length > 3 ? ` … +${authors.length - 3}` : ""} (${crossrefYear(w)})`);
    if (disputed) {
      lines.push(`      ⚠ AUTHORS CORRECTED — upstream said "${knownAuthors[0]}", Crossref says "${authors[0]}"`);
      lines.push(`        upstream list kept in authors_upstream:${keepAuthors ? " (not replaced: --keep-authors)" : ""}`);
      disputedAuthors.push(citekey);
    } else if (takeAuthors && knownAuthors.length) {
      lines.push(
        `      ↳ author list completed: ${knownAuthors.length}${truncated ? ` ("et al.")` : " (silently short)"} → ${authors.length} named`,
      );
    }
    for (const n of notes) lines.push(`      ↳ ${n}`);
    resolved++;

    if (!write) continue;

    const updates: Record<string, string | string[]> = {
      doi: w.DOI,
      status: "ok",
      title: crTitle,
      journal: crJournal || journal,
      volume: w.volume ?? storedVolume.volume,
      issue: w.issue ?? storedVolume.issue,
      pages: crPages || str(card.fm, "pages"),
      verified: `crossref ${new Date().toISOString().slice(0, 10)}`,
    };
    if (takeAuthors) updates.authors = authors;
    if (disputed) updates.authors_upstream = knownAuthors;

    let next = patchFrontmatter(card.text, updates);
    next = refreshCardBody(
      next,
      (updates.authors as string[]) ?? (card.fm.authors as string[]) ?? [],
      String(updates.title ? crossrefYear(w) || year : year),
      String(updates.journal),
      str(card.fm, "short_title"),
      crTitle,
      String(updates.volume),
      String(updates.pages),
      w.DOI,
      takeAuthors && knownAuthors.length > 0,
    );

    // A citekey like `npjclimate2023` was only ever a placeholder for "we don't
    // know who wrote this". Now that we do, `yu2023` is what a human will type.
    // The old key is kept in `aka:` — nothing is deleted, and `cards` reads it
    // back so regeneration never resurrects the placeholder.
    let path = card.path;
    // Key off the authors that actually end up in the card. Keying off Crossref's
    // list while keeping the card's produced `adong2025.md` whose first author
    // reads "Bainomugisha" — a filename contradicting its own contents.
    const finalAuthors = takeAuthors ? authors : knownAuthors;
    if (rekey && finalAuthors.length) {
      const proposed = citekeyFor(finalAuthors, crossrefYear(w) || year, crJournal, citekey);
      if (proposed !== citekey && !takenKeys.has(proposed)) {
        takenKeys.add(proposed);
        next = patchFrontmatter(next, { citekey: proposed, aka: citekey });
        path = join(dirname(card.path), `${proposed}.md`);
        lines.push(`      ↳ rekeyed: ${citekey} → ${proposed} (old key kept as aka:)`);
        renamed++;
      }
    }

    await Bun.write(path, next);
    // Write the new name first, then drop the old one — if anything fails in
    // between, the card survives under one name or the other, never neither.
    if (path !== card.path) await unlink(card.path);
  }

  lines.push("");
  lines.push(`  resolved ${resolved} · ambiguous ${ambiguous} · failed ${failed}${renamed ? ` · rekeyed ${renamed}` : ""}`);
  if (disputedAuthors.length) {
    lines.push(
      `\n  ⚠ ${disputedAuthors.length} card(s) had the wrong authors upstream: ${disputedAuthors.join(", ")}`,
      `    These would have become citation errors in the thesis. Worth telling the parent oracle,`,
      `    whose LITERATURE_REVIEW_PAPERS.md is where the wrong bylines came from.`,
    );
  }
  if (!write && resolved) lines.push(`\nNothing was written. Re-run with --write to save${rekey ? "" : " (add --rekey to also rename placeholder citekeys)"}.`);
  if (write && renamed) lines.push(`\nRe-index so the store matches the new keys: citation index --vault`);
  return { ok: failed === 0, output: lines.join("\n") };
}

// ── bib — the cards as BibTeX ──
// The whole point of this oracle: 62 markdown cards become \cite{} keys a thesis
// can actually use. Entries missing authors or a DOI are NOT silently dropped —
// they are written as commented-out stubs, so the bibliography stays honest
// about what it does not yet have, and nothing disappears from the corpus.

/**
 * BibTeX has no concept of "et al." — it would typeset it as somebody's name.
 * `others` is the convention it does understand, and styles render it as "et al."
 * themselves. Truncation that could not be resolved stays visible as truncation.
 */
function bibAuthors(authors: string[]): string {
  const named: string[] = [];
  let truncated = false;
  for (const a of authors) {
    const cleaned = a.replace(/,?\s*\bet\s+al\.?\s*$/i, "").trim();
    if (cleaned !== a.trim()) truncated = true;
    if (cleaned) named.push(bibEscape(cleaned));
  }
  return [...named, ...(truncated ? ["others"] : [])].join(" and ");
}

/** BibTeX's escapes. Titles keep their braces so styles cannot lowercase them. */
function bibEscape(s: string): string {
  return s
    .replace(/[\\]/g, "\\textbackslash{}")
    .replace(/([&%$#_])/g, "\\$1")
    .replace(/~/g, "\\textasciitilde{}")
    .replace(/\^/g, "\\textasciicircum{}")
    .replace(/[{}]/g, "");
}

function bibEntry(fields: Array<[string, string]>, key: string, type = "article"): string {
  const width = Math.max(...fields.map(([k]) => k.length));
  const body = fields
    .filter(([, v]) => v)
    .map(([k, v]) => `  ${k.padEnd(width)} = {${v}}`)
    .join(",\n");
  return `@${type}{${key},\n${body}\n}`;
}

async function cmdBib(rest: string[]): Promise<PluginResult> {
  const outArg = rest.find((a) => a.endsWith(".bib"));
  const byTopic = rest.includes("--by-topic");
  const cards = await readRawCards();
  if (!cards.length) return { ok: false, error: `no cards in ${PAPERS_DIR} — run "citation cards" first` };

  const str = (fm: RawCard["fm"], k: string) => (typeof fm[k] === "string" ? (fm[k] as string) : "");

  type Entry = { key: string; topic: string; year: string; bib: string; complete: boolean; missing: string[] };
  const entries: Entry[] = [];

  for (const card of cards) {
    const fm = card.fm;
    const key = str(fm, "citekey") || card.name.replace(/\.md$/, "");
    const authors = Array.isArray(fm.authors) ? (fm.authors as string[]) : [];
    const title = str(fm, "title");
    const journal = str(fm, "journal");
    const year = str(fm, "year");
    const doi = str(fm, "doi");

    const missing: string[] = [];
    if (!authors.length) missing.push("authors");
    if (!title) missing.push("title");
    if (!journal) missing.push("journal");
    if (!year) missing.push("year");
    if (!doi) missing.push("doi");

    const fields: Array<[string, string]> = [
      ["author", bibAuthors(authors)],
      ["title", `{${bibEscape(title)}}`],   // inner braces protect capitalisation
      ["journal", bibEscape(journal)],
      ["year", year],
      ["volume", str(fm, "volume")],
      ["number", str(fm, "issue")],
      ["pages", str(fm, "pages")],
      ["doi", doi],
      ["note", str(fm, "verified") ? `verified via ${str(fm, "verified")}` : ""],
    ];

    entries.push({
      key,
      topic: str(fm, "topic") || "uncategorized",
      year,
      // A DOI is desirable, not mandatory — a paper with real authors, title,
      // journal and year is perfectly citable. Only missing authors makes an
      // entry unusable, because BibTeX would render it as an anonymous work.
      complete: authors.length > 0 && !!title && !!journal && !!year,
      missing,
      bib: bibEntry(fields, key),
    });
  }

  const complete = entries.filter((e) => e.complete);
  const withheld = entries.filter((e) => !e.complete);
  const noDoi = complete.filter((e) => e.missing.includes("doi"));

  const sortKey = (e: Entry) => (byTopic ? `${e.topic} ${e.key}` : e.key);
  complete.sort((a, b) => sortKey(a).localeCompare(sortKey(b)));

  const header = [
    `% Citation Oracle ✦ — generated by "citation bib" from ${PAPERS_DIR}/`,
    `% ${complete.length} citable entries of ${entries.length} cards · ${complete.length - noDoi.length} with a DOI`,
    `% The cards are the source of truth: edit those, not this file.`,
    `% Regenerate: citation bib`,
    "",
  ];

  const body: string[] = [];
  let lastTopic = "";
  for (const e of complete) {
    if (byTopic && e.topic !== lastTopic) {
      body.push(`% ── ${e.topic} ──`, "");
      lastTopic = e.topic;
    }
    body.push(e.bib, "");
  }

  if (withheld.length) {
    body.push(
      `% ── withheld: ${withheld.length} card(s) not citable yet ──`,
      `% Kept here rather than dropped — the gap is part of the record. Fill them`,
      `% with: citation doi --write   (resolves authors + DOI against Crossref)`,
      "",
      ...withheld.flatMap((e) => [
        `% ${e.key} — missing: ${e.missing.join(", ")}`,
        ...e.bib.split("\n").map((l) => `% ${l}`),
        "",
      ]),
    );
  }

  const outPath = join(repoRoot(), outArg ?? "artifacts/citation.bib");
  await mkdir(dirname(outPath), { recursive: true });
  await Bun.write(outPath, [...header, ...body].join("\n"));

  const out = [
    `✦ ${complete.length} citable entr${complete.length === 1 ? "y" : "ies"} → ${outPath}`,
    `  ${complete.length - noDoi.length}/${complete.length} carry a DOI${noDoi.length ? ` · ${noDoi.length} without` : ""}`,
  ];
  if (withheld.length) {
    out.push(`  ⚠ ${withheld.length} withheld (commented in the file, nothing lost): ${withheld.map((e) => e.key).join(", ")}`);
    out.push(`     resolve with: citation doi --write`);
  }
  out.push(`\nUse in LaTeX:  \\bibliography{${(outArg ?? "artifacts/citation.bib").replace(/\.bib$/, "")}}   then \\cite{${complete[0]?.key ?? "citekey"}}`);
  return { ok: true, output: out.join("\n") };
}

// ── dispatch ──

function helpText(): string {
  return `citation — Citation Oracle's own maw plugin (the PhD literature corpus: cards → .bib → constellation)

Usage:
  maw citation status                        Root + cards + store + embedder + hardware, one check
  maw citation cards [corpus.jsonl]          Build/refresh one markdown card per paper in ${PAPERS_DIR}/ (+ INDEX.md). Your \`## Notes\` and any \`doi:\` you add are preserved
  maw citation doi [--write] [--rekey] [--all] [citekey…]  Resolve authors + DOI against Crossref. Dry run unless --write; --rekey renames placeholder citekeys (old key kept as \`aka:\`)
  maw citation bib [out.bib] [--by-topic]    Cards → BibTeX (default artifacts/citation.bib). Entries missing authors are commented, never dropped
  maw citation index [--vault] [corpus.jsonl]  Embed the cards into the local store (falls back to the JSONL if no cards exist). --vault also indexes retros/lessons/research so search spans both
  maw citation search <query> [-k N] [--json]  Semantic search over indexed papers (default k=5)
  maw citation serve [--port N] [--threshold N] [--quiet]  Serve the interactive 2D constellation (default port 5556, verbose by default; alias: visualize)
  maw citation graph [--threshold N] [--out PATH] [--html [PATH]]  Render the 2D labeled similarity network → PNG (default artifacts/citation-network.png, threshold 0.5); --html also writes the interactive page

Run from inside Soul-Brews-Studio/phd-citation-oracle.
(maw x citation <verb> also works — same plugin, explicit invocation.)

Env:
  ARRA_URL              arra-oracle-v3 backend URL (default http://localhost:47778)
  CITATION_ROOT         repo root override (default: MAW_HOME, else walk up for CLAUDE.md + ψ/)
  CITATION_STORE_DIR    vector store dir (default $MAW_HOME/citation-data/store, else <repo>/.citation/store)
  CITATION_EMBED        force a backend: ollama | worker | cf-rest (default: auto-detect, ollama first)
  OLLAMA_URL            ollama endpoint (default http://localhost:11434)
  CITATION_OLLAMA_MODEL local embedding model (default bge-m3)
  CF_EMBED_WORKER_URL   shared local embed worker (default http://localhost:18787, no token)
  CF_EMBED_MODEL        embed model (default @cf/baai/bge-m3, 1024-dim, multilingual)
  CITATION_VISUALIZE_PORT  default port for visualize (default 5556)
  CROSSREF_MAILTO       contact address for Crossref's polite pool (faster, kinder)

Roadmap: citation edges (which paper cites which) — the graph currently draws semantic
similarity, not citation. Not built yet — cite what's real.`;
}

const KNOWN_COMMANDS = ["status", "cards", "doi", "bib", "index", "search", "serve", "visualize", "graph"] as const;

function levenshtein(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)]);
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      dp[i][j] = a[i - 1] === b[j - 1] ? dp[i - 1][j - 1] : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[a.length][b.length];
}

function closestCommand(cmd: string): string | null {
  let best: { name: string; dist: number } | null = null;
  for (const known of KNOWN_COMMANDS) {
    const dist = levenshtein(cmd, known);
    if (!best || dist < best.dist) best = { name: known, dist };
  }
  return best && best.dist <= 2 ? best.name : null;
}

export async function handler(ctx: InvokeContext): Promise<PluginResult> {
  const [cmd, ...rest] = ctx.args;
  switch (cmd) {
    case "status":
      return cmdStatus();
    case "cards":
      return cmdCards(rest);
    case "index":
      return cmdIndex(rest);
    case "search":
      return cmdSearch(rest);
    case "serve":       // `serve` and `visualize` are the same command
    case "visualize":
      return cmdVisualize(rest);
    case "graph":
      return cmdGraph(rest);
    case "doi":
      return cmdDoi(rest);
    case "bib":
      return cmdBib(rest);
    case undefined:
      return { ok: true, output: helpText() };
    default: {
      const suggestion = closestCommand(cmd);
      const hint = suggestion ? ` — did you mean "${suggestion}"?` : "";
      return { ok: false, error: `unknown command: "${cmd}"${hint}\n\n${helpText()}` };
    }
  }
}

// Commands that start a server must NOT be exited — their Bun.serve() has to
// keep the event loop alive. (Missing "serve" here made it print its banner and
// die instantly, so nothing was ever listening.) Exported so bin/citation shares
// the exact same list rather than keeping its own copy in sync.
export const LONG_RUNNING = new Set<string>(["serve", "visualize"]);

export default handler;

if (import.meta.main) {
  const args = process.argv.slice(2);
  const result = await handler({ source: "cli", args });
  if (result.output) console.log(result.output);
  if (result.error) console.error(result.error);
  if (!LONG_RUNNING.has(args[0] ?? "") || !result.ok) {
    process.exit(result.ok ? 0 : 1);
  }
}
