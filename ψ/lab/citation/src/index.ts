import * as lancedb from "@lancedb/lancedb";
import { readFile, stat, mkdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import sharp from "sharp";

type InvokeContext = { source: "cli"; args: string[] };
type PluginResult = { ok: boolean; output?: string; error?: string };

// citation — Citation Oracle's own maw plugin: index/search/visualize the PhD
// literature corpus. Same shape as muninn (laris-co/muninn-oracle ψ/lab/muninn),
// tuned for papers: the unit is a paper, the color is its topic — The Constellation.

const ARRA_URL = process.env.ARRA_URL || "http://localhost:47778";
// Data lives outside the plugin's own installed dir — `maw plugin install`
// copies the whole source tree, so a `--force` reinstall would wipe an in-tree
// data/ dir. Prefer $MAW_HOME (stable across reinstalls).
const LANCEDB_DIR =
  process.env.CITATION_LANCEDB_DIR ||
  (process.env.MAW_HOME ? `${process.env.MAW_HOME}/citation-data/lancedb` : `${process.cwd()}/citation-data/lancedb`);
const TABLE_NAME = "papers";
const LOCAL_WORKER_URL = process.env.CF_EMBED_WORKER_URL || "http://localhost:18787";
const EMBED_MODEL = process.env.CF_EMBED_MODEL || "@cf/baai/bge-m3";
const EMBED_DIM = 1024;
const DEFAULT_CORPUS = "artifacts/literature_corpus.jsonl";

// Professional type pairing (matches the oracle book skills' book-feel): a
// journal serif for titles, a clean humanist sans for labels/UI. Both ship with
// macOS so sharp/librsvg and the browser resolve them without downloads.
const FONT_SERIF = "Charter, 'Iowan Old Style', Georgia, 'Times New Roman', serif";
const FONT_SANS = "'Helvetica Neue', Helvetica, 'Segoe UI', Arial, sans-serif";

// ── embedding (shared local wrangler-dev worker, no API token) ──

async function embedTexts(texts: string[]): Promise<number[][]> {
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

async function embedOne(text: string): Promise<number[]> {
  const vectors = await embedTexts([text]);
  const vector = vectors[0];
  if (!vector) throw new Error("no vector returned for input text");
  return vector;
}

// `maw` cds into the plugin's own install dir before invoking it, so
// process.cwd() is useless. MAW_HOME is set (via .envrc) to `<repo>/.maw`, so
// its parent IS the repo root by construction — no guessing (muninn's lesson).
function repoRoot(): string {
  if (process.env.MAW_HOME) return dirname(process.env.MAW_HOME);
  return process.cwd();
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

async function checkArraBackend(): Promise<string> {
  try {
    const res = await fetch(`${ARRA_URL}/api/health`);
    const json = (await res.json()) as { data?: { status?: string; version?: string } };
    return `  ✓ arra-oracle-v3 reachable (${ARRA_URL}) — ${json.data?.status ?? "unknown"} (v${json.data?.version ?? "?"})`;
  } catch (error) {
    return `  ✗ arra-oracle-v3 unreachable at ${ARRA_URL}: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function checkLanceDB(): Promise<string> {
  try {
    const db = await lancedb.connect(LANCEDB_DIR);
    const tables = await db.tableNames();
    const rows = tables.includes(TABLE_NAME) ? await (await db.openTable(TABLE_NAME)).countRows() : 0;
    return `  ✓ LanceDB connected (${LANCEDB_DIR}) — ${tables.length} table(s), ${rows} paper(s) indexed`;
  } catch (error) {
    return `  ✗ LanceDB connect failed: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function checkCloudEmbed(): Promise<string> {
  try {
    const vec = await embedOne("healthcheck");
    const mode = process.env.CF_ACCOUNT_ID && process.env.CF_API_TOKEN ? "REST API (token)" : "local worker (no token)";
    const dimNote = vec.length === EMBED_DIM ? "" : ` (expected ${EMBED_DIM})`;
    return `  ✓ Cloudflare embed reachable [${mode}] — ${vec.length}-dim vector${dimNote}`;
  } catch (error) {
    return `  ⚠ Cloudflare embed unavailable: ${error instanceof Error ? error.message : String(error)}`;
  }
}

async function cmdStatus(): Promise<PluginResult> {
  const corpusPath = join(repoRoot(), DEFAULT_CORPUS);
  const corpusLine = await stat(corpusPath)
    .then((s) => `  ✓ corpus present (${DEFAULT_CORPUS}) — ${s.size} bytes`)
    .catch(() => `  ⚠ corpus missing at ${DEFAULT_CORPUS}`);
  const lines = [
    "── citation status ──",
    corpusLine,
    await checkArraBackend(),
    await checkLanceDB(),
    await checkCloudEmbed(),
  ];
  const hardFail = lines.some((l) => l.includes("✗"));
  return { ok: !hardFail, output: lines.join("\n") };
}

// ── index — embed the paper corpus into the local LanceDB table ──

async function cmdIndex(pathArg?: string): Promise<PluginResult> {
  const corpusPath = pathArg ? join(repoRoot(), pathArg) : join(repoRoot(), DEFAULT_CORPUS);
  const st = await stat(corpusPath).catch(() => null);
  if (!st?.isFile()) return { ok: false, error: `corpus not found: ${corpusPath}` };

  const papers = await loadCorpus(corpusPath);
  if (!papers.length) return { ok: false, error: `no papers parsed from ${corpusPath}` };

  const lines = [`Loaded ${papers.length} paper(s) from ${corpusPath}`];
  const texts = papers.map(paperText);
  const vectors = await embedTexts(texts);

  type Row = {
    id: string;
    title: string;
    journal: string;
    topic: string;
    text: string;
    vector: number[];
    indexed_at: string;
  };
  const rows: Row[] = [];
  papers.forEach((p, i) => {
    const vector = vectors[i];
    if (!vector) return;
    rows.push({
      id: String(p.id ?? p.title),
      title: p.title,
      journal: p.journal ?? "",
      topic: p.topic ?? "uncategorized",
      text: texts[i],
      vector,
      indexed_at: new Date().toISOString(),
    });
  });
  if (!rows.length) return { ok: false, error: "embedding produced no rows" };

  const db = await lancedb.connect(LANCEDB_DIR);
  const tableNames = await db.tableNames();
  if (tableNames.includes(TABLE_NAME)) {
    const table = await db.openTable(TABLE_NAME);
    await table.mergeInsert("id").whenMatchedUpdateAll().whenNotMatchedInsertAll().execute(rows);
  } else {
    await db.createTable(TABLE_NAME, rows);
  }

  const topics = [...new Set(rows.map((r) => r.topic))].sort();
  lines.push(`\n✓ indexed ${rows.length} paper(s) across ${topics.length} topic(s):`);
  for (const t of topics) lines.push(`    ${rows.filter((r) => r.topic === t).length.toString().padStart(3)}  ${t}`);
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

  const db = await lancedb.connect(LANCEDB_DIR);
  const tableNames = await db.tableNames();
  if (!tableNames.includes(TABLE_NAME)) {
    return { ok: false, error: `table "${TABLE_NAME}" doesn't exist yet — run "maw citation index" first` };
  }
  const table = await db.openTable(TABLE_NAME);
  const vector = await embedOne(query);
  const results = await table.vectorSearch(vector).limit(k).toArray();

  if (json) {
    const payload = results.map((r: Record<string, unknown>) => ({
      distance: r._distance ?? null,
      id: String(r.id),
      title: String(r.title),
      journal: String(r.journal),
      topic: String(r.topic),
    }));
    return { ok: true, output: JSON.stringify(payload, null, 2) };
  }

  const lines = [`Top ${results.length} paper(s) for "${query}":\n`];
  for (const r of results) {
    lines.push(`  [${r._distance?.toFixed(4)}] (${r.topic}) ${r.title}`);
    if (String(r.journal)) lines.push(`    ${r.journal}`);
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

// Shared page builder: the interactive 2D constellation. `visualize` serves it;
// `graph --html` writes it to a file so it opens/shares without a server running.
type BuiltPage = { html: string; nodeCount: number; topicCount: number; edgeCount: number };

async function buildConstellationHtml(threshold: number): Promise<BuiltPage | { error: string }> {
  const db = await lancedb.connect(LANCEDB_DIR);
  const tableNames = await db.tableNames();
  if (!tableNames.includes(TABLE_NAME)) {
    return { error: `table "${TABLE_NAME}" doesn't exist yet — run "maw citation index" first` };
  }
  const table = await db.openTable(TABLE_NAME);
  const rows = await table.query().toArray();
  if (rows.length === 0) return { error: 'index is empty — run "maw citation index" first' };

  const vectors = rows.map((r: Record<string, unknown>) => Array.from(r.vector as ArrayLike<number>));
  const coords = tsne(vectors);

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
  }));
  const topics = [...new Set(nodes.map((n) => n.topic))].sort();
  const palette = ["#2ca88f", "#e8724c", "#5b74c9", "#d94f9a", "#7bc043", "#f2c53d", "#c9a66b", "#9aa0a6"];
  const colorFor = (t: string) => palette[topics.indexOf(t) % palette.length];
  const colorMap = Object.fromEntries(topics.map((t) => [t, colorFor(t)]));

  const edges: Array<{ i: number; j: number; s: number }> = [];
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      const s = cosine(vectors[i], vectors[j]);
      if (s > threshold) edges.push({ i, j, s });
    }
  }

  const legendRows = topics
    .map((t) => {
      const n = nodes.filter((x) => x.topic === t).length;
      return `<div class="item"><span class="sw" style="background:${colorFor(t)}"></span>${escapeHtml(t)} (${n})</div>`;
    })
    .join("");

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>citation constellation — ${nodes.length} papers</title>
<style>
  html,body{margin:0;height:100%;overflow:hidden;font-family:${FONT_SANS};background:#ffffff;color:#1a1a2e;}
  #svg{display:block;width:100vw;height:100vh;cursor:grab;background:#ffffff;}
  #svg.drag{cursor:grabbing;}
  text{user-select:none;pointer-events:none;font-family:${FONT_SANS};}
  #legend{position:fixed;top:16px;left:16px;background:rgba(255,255,255,.95);border:1px solid #d7dbe0;border-radius:10px;padding:12px 14px;font-size:13px;box-shadow:0 4px 20px rgba(0,0,0,.08);}
  #legend h3{margin:0 0 8px;font-size:16px;font-family:${FONT_SERIF};}
  #legend .item{display:flex;align-items:center;gap:7px;margin:4px 0;white-space:nowrap;}
  #legend .sw{width:11px;height:11px;border-radius:50%;flex-shrink:0;}
  #title{position:fixed;top:16px;left:50%;transform:translateX(-50%);font-size:22px;font-weight:700;color:#141428;text-align:center;font-family:${FONT_SERIF};}
  #title small{display:block;font-size:12px;font-weight:400;color:#6b7280;margin-top:2px;}
  #searchbar{position:fixed;top:64px;right:16px;display:flex;gap:6px;}
  #searchbar input{width:280px;border:1px solid #cfd4da;border-radius:8px;padding:8px 12px;font-size:13px;outline:none;}
  #searchbar input:focus{border-color:#5b74c9;}
  #searchbar button{border:1px solid #cfd4da;border-radius:8px;background:#fff;cursor:pointer;padding:0 12px;color:#6b7280;}
  #results{position:fixed;top:104px;right:16px;width:320px;max-height:60vh;overflow-y:auto;background:rgba(255,255,255,.97);border:1px solid #d7dbe0;border-radius:10px;padding:6px;font-size:12px;display:none;box-shadow:0 4px 20px rgba(0,0,0,.1);}
  #results.show{display:block;}
  #results .rt{color:#6b7280;padding:4px 8px;}
  #results .ri{display:flex;gap:8px;padding:5px 8px;border-radius:6px;cursor:pointer;}
  #results .ri:hover{background:#eef1f8;}
  #results .rs{color:#0f9d58;font-weight:700;font-variant-numeric:tabular-nums;}
  #tip{position:fixed;max-width:420px;background:rgba(20,20,35,.96);color:#f1f3f8;border-radius:9px;padding:10px 13px;font-size:13px;line-height:1.5;pointer-events:none;display:none;z-index:20;box-shadow:0 8px 30px rgba(0,0,0,.35);}
  #tip .tp{color:#93c5fd;font-size:11px;text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;}
  #tip .tj{color:#9aa3b2;font-size:12px;margin-top:5px;}
  #hint{position:fixed;bottom:14px;left:16px;font-size:12px;color:#9aa0a6;}
</style></head>
<body>
<div id="title">✦ Citation Constellation<small>bge-m3 · t-SNE · ${nodes.length} papers · ${edges.length} edges (sim &gt; ${threshold})</small></div>
<div id="legend"><h3>Research Clusters</h3>${legendRows}</div>
<div id="searchbar"><input id="q" placeholder="Search the literature… (Enter)"/><button id="clr">✕</button></div>
<div id="results"></div>
<div id="tip"></div>
<div id="hint">drag to pan · scroll to zoom · hover a star for the paper · search to highlight</div>
<svg id="svg" viewBox="0 0 ${VW} ${VH}" preserveAspectRatio="xMidYMid meet"></svg>
<script>
const NODES=${JSON.stringify(nodes)};
const EDGES=${JSON.stringify(edges)};
const VECTORS=${JSON.stringify(vectors)};
const COLORS=${JSON.stringify(colorMap)};
const WORKER=${JSON.stringify(LOCAL_WORKER_URL)};
const MODEL=${JSON.stringify(EMBED_MODEL)};
const VW=${VW}, VH=${VH};
const SVGNS="http://www.w3.org/2000/svg";
const svg=document.getElementById('svg');
const tip=document.getElementById('tip');
const resultsEl=document.getElementById('results');

// edges
const gEdges=document.createElementNS(SVGNS,'g');
svg.appendChild(gEdges);
for(const e of EDGES){
  const a=NODES[e.i],b=NODES[e.j];
  const ln=document.createElementNS(SVGNS,'line');
  ln.setAttribute('x1',a.x);ln.setAttribute('y1',a.y);ln.setAttribute('x2',b.x);ln.setAttribute('y2',b.y);
  ln.setAttribute('stroke','#9aa3ad');
  ln.setAttribute('stroke-width',(0.6+(e.s-0.5)*5).toFixed(2));
  ln.setAttribute('stroke-opacity',Math.min(0.5,(e.s-0.5)+0.12).toFixed(3));
  gEdges.appendChild(ln);
}
// nodes + labels
const gNodes=document.createElementNS(SVGNS,'g');
svg.appendChild(gNodes);
const circles=[];
NODES.forEach((n,i)=>{
  // two lines: author+year (bold), then the paper's name (lighter)
  const above=(i%2===0);
  const t=document.createElementNS(SVGNS,'text');
  t.setAttribute('x',n.x);t.setAttribute('y',(above? (n.name? n.y-32 : n.y-14) : n.y+22));
  t.setAttribute('text-anchor','middle');
  t.setAttribute('paint-order','stroke');t.setAttribute('stroke','#ffffff');t.setAttribute('stroke-width','3.5');t.setAttribute('stroke-linejoin','round');
  const l1=document.createElementNS(SVGNS,'tspan');
  l1.setAttribute('x',n.x);l1.setAttribute('font-size','15');l1.setAttribute('font-weight','600');l1.setAttribute('fill','#1a1a2e');
  l1.textContent=n.label;
  t.appendChild(l1);
  if(n.name){
    const l2=document.createElementNS(SVGNS,'tspan');
    l2.setAttribute('x',n.x);l2.setAttribute('dy','15');l2.setAttribute('font-size','12.5');l2.setAttribute('fill','#5b6270');
    l2.textContent=n.name;
    t.appendChild(l2);
  }
  gNodes.appendChild(t);
  const c=document.createElementNS(SVGNS,'circle');
  c.setAttribute('cx',n.x);c.setAttribute('cy',n.y);c.setAttribute('r','9');
  c.setAttribute('fill',COLORS[n.topic]||'#94a3b8');c.setAttribute('stroke','#fff');c.setAttribute('stroke-width','1.5');
  c.style.cursor='pointer';
  c.addEventListener('mousemove',(ev)=>{
    tip.style.display='block';tip.style.left=(ev.clientX+16)+'px';tip.style.top=(ev.clientY+16)+'px';
    const sc=(activeScores&&activeScores.has(i))?('<div style="color:#34d399;font-size:11px;margin-bottom:3px;">similarity '+activeScores.get(i).toFixed(3)+'</div>'):'';
    tip.innerHTML='<div class="tp">'+n.topic+'</div>'+sc+n.title.replace(/</g,'&lt;')+(n.journal?'<div class="tj">'+n.journal.replace(/</g,'&lt;')+'</div>':'');
  });
  c.addEventListener('mouseleave',()=>{tip.style.display='none';});
  gNodes.appendChild(c);
  circles.push(c);
});

// pan/zoom via viewBox
let vb={x:0,y:0,w:VW,h:VH};
function applyVB(){svg.setAttribute('viewBox',vb.x+' '+vb.y+' '+vb.w+' '+vb.h);}
svg.addEventListener('wheel',(e)=>{
  e.preventDefault();
  const r=svg.getBoundingClientRect();
  const mx=vb.x+((e.clientX-r.left)/r.width)*vb.w;
  const my=vb.y+((e.clientY-r.top)/r.height)*vb.h;
  const f=e.deltaY<0?0.87:1.15;
  const nw=Math.max(120,Math.min(VW*3,vb.w*f)), nh=nw*(VH/VW);
  vb.x=mx-((e.clientX-r.left)/r.width)*nw; vb.y=my-((e.clientY-r.top)/r.height)*nh; vb.w=nw; vb.h=nh;
  applyVB();
},{passive:false});
let drag=null;
svg.addEventListener('mousedown',(e)=>{drag={sx:e.clientX,sy:e.clientY,ox:vb.x,oy:vb.y};svg.classList.add('drag');});
window.addEventListener('mousemove',(e)=>{
  if(!drag)return;const r=svg.getBoundingClientRect();
  vb.x=drag.ox-((e.clientX-drag.sx)/r.width)*vb.w; vb.y=drag.oy-((e.clientY-drag.sy)/r.height)*vb.h; applyVB();
});
window.addEventListener('mouseup',()=>{drag=null;svg.classList.remove('drag');});

// search — embed query via shared worker, cosine vs stored vectors, highlight
let activeScores=null;
function cos(a,b){let d=0,na=0,nb=0;for(let i=0;i<a.length;i++){d+=a[i]*b[i];na+=a[i]*a[i];nb+=b[i]*b[i];}return d/(Math.sqrt(na)*Math.sqrt(nb)||1);}
const dim='#dfe3e8';
function reset(){activeScores=null;NODES.forEach((n,i)=>{circles[i].setAttribute('fill',COLORS[n.topic]||'#94a3b8');circles[i].setAttribute('r','9');});resultsEl.className='';resultsEl.innerHTML='';}
async function runSearch(q){
  resultsEl.className='show';resultsEl.innerHTML='<div class="rt">searching…</div>';
  try{
    const res=await fetch(WORKER+'/query-embed',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({text:q,model:MODEL})});
    if(!res.ok)throw new Error('embed worker HTTP '+res.status);
    const j=await res.json();const qv=j.data&&j.data[0];if(!qv)throw new Error('no vector');
    const scored=VECTORS.map((v,i)=>({i,s:cos(qv,v)})).sort((a,b)=>b.s-a.s);
    activeScores=new Map(scored.map(o=>[o.i,o.s]));
    const top=scored.slice(0,10);const topSet=new Set(top.map(o=>o.i));
    NODES.forEach((n,i)=>{
      if(topSet.has(i)){circles[i].setAttribute('fill',COLORS[n.topic]||'#94a3b8');circles[i].setAttribute('r','13');}
      else{circles[i].setAttribute('fill',dim);circles[i].setAttribute('r','7');}
    });
    resultsEl.innerHTML='<div class="rt">top '+top.length+' for "'+q+'"</div>'+top.map(o=>'<div class="ri" data-i="'+o.i+'"><span class="rs">'+o.s.toFixed(3)+'</span><span>'+NODES[o.i].label+'</span></div>').join('');
  }catch(err){resultsEl.innerHTML='<div class="rt" style="color:#d33">'+(err&&err.message?err.message:err)+'</div>';}
}
document.getElementById('q').addEventListener('keydown',(e)=>{if(e.key==='Enter'&&e.target.value.trim())runSearch(e.target.value.trim());});
document.getElementById('clr').addEventListener('click',()=>{document.getElementById('q').value='';reset();});
resultsEl.addEventListener('click',(e)=>{const it=e.target.closest('.ri');if(!it)return;const i=+it.dataset.i;const n=NODES[i];vb.w=520;vb.h=vb.w*(VH/VW);vb.x=n.x-vb.w/2;vb.y=n.y-vb.h/2;applyVB();});
</script>
</body></html>`;

  return { html, nodeCount: nodes.length, topicCount: topics.length, edgeCount: edges.length };
}

async function cmdVisualize(rest: string[]): Promise<PluginResult> {
  const portFlagIndex = rest.indexOf("--port");
  const port = portFlagIndex >= 0 ? Number(rest[portFlagIndex + 1]) : Number(process.env.CITATION_VISUALIZE_PORT) || 5556;
  const tIdx = rest.indexOf("--threshold");
  const threshold = tIdx >= 0 ? Number(rest[tIdx + 1]) : 0.68;

  const built = await buildConstellationHtml(threshold);
  if ("error" in built) return { ok: false, error: built.error };

  Bun.serve({ port, fetch: () => new Response(built.html, { headers: { "content-type": "text/html" } }) });

  return {
    ok: true,
    output:
      `✦ citation constellation (2D) — http://localhost:${port}\n` +
      `${built.nodeCount} papers · ${built.topicCount} topics · ${built.edgeCount} edges (sim > ${threshold})\n` +
      `drag to pan · scroll to zoom · hover a star · search to highlight\nCtrl+C to stop`,
  };
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

  const db = await lancedb.connect(LANCEDB_DIR);
  const tableNames = await db.tableNames();
  if (!tableNames.includes(TABLE_NAME)) {
    return { ok: false, error: `table "${TABLE_NAME}" doesn't exist yet — run "maw citation index" first` };
  }
  const table = await db.openTable(TABLE_NAME);
  const rows = await table.query().toArray();
  if (rows.length === 0) return { ok: false, error: 'index is empty — run "maw citation index" first' };

  const vectors = rows.map((r: Record<string, unknown>) => Array.from(r.vector as ArrayLike<number>));
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
  await sharp(Buffer.from(svg)).png().toFile(outPath);

  // --html: also write the interactive page (same t-SNE + edges) as a portable
  // file — openable/shareable without keeping `visualize`'s server running.
  let htmlNote = "";
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
      `✦ citation graph → ${outPath}${htmlNote}\n` +
      `${nodes.length} papers · ${topics.length} topics · ${edges.length} edges (cosine > ${threshold}, max observed ${maxSim.toFixed(3)})\n` +
      (edges.length === 0
        ? `no edges at this threshold — lower it: maw citation graph --threshold ${(maxSim - 0.05).toFixed(2)}`
        : edges.length > 400
          ? `dense — raise threshold for a cleaner graph: maw citation graph --threshold ${(threshold + 0.1).toFixed(2)}`
          : `tune with --threshold N`),
  };
}

// ── dispatch ──

function helpText(): string {
  return `citation — Citation Oracle's own maw plugin (index/search/visualize the PhD literature corpus)

Usage:
  maw citation status                        Corpus + arra backend + LanceDB + Cloudflare embed, one check
  maw citation index [corpus.jsonl]          Embed the paper corpus (default: ${DEFAULT_CORPUS}) into LanceDB
  maw citation search <query> [-k N] [--json]  Semantic search over indexed papers (default k=5)
  maw citation visualize [--port N]          Serve the 3D constellation — papers as stars, topics as colors (default port 5556)
  maw citation graph [--threshold N] [--out PATH] [--html [PATH]]  Render the 2D labeled similarity network → PNG (default artifacts/citation-network.png, threshold 0.5); --html also writes the interactive page

Run from inside Soul-Brews-Studio/phd-citation-oracle.
(maw x citation <verb> also works — same plugin, explicit invocation.)

Env:
  ARRA_URL              arra-oracle-v3 backend URL (default http://localhost:47778)
  CITATION_LANCEDB_DIR  local LanceDB dir (default $MAW_HOME/citation-data/lancedb)
  CF_EMBED_WORKER_URL   shared local embed worker (default http://localhost:18787, no token)
  CF_EMBED_MODEL        embed model (default @cf/baai/bge-m3, 1024-dim, multilingual)
  CITATION_VISUALIZE_PORT  default port for visualize (default 5556)

Roadmap: bib (JSONL → .bib keys), graph (citation edges). Not built yet — cite what's real.`;
}

const KNOWN_COMMANDS = ["status", "index", "search", "visualize", "graph"] as const;

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
    case "index":
      return cmdIndex(rest[0]);
    case "search":
      return cmdSearch(rest);
    case "visualize":
      return cmdVisualize(rest);
    case "graph":
      return cmdGraph(rest);
    case undefined:
      return { ok: true, output: helpText() };
    default: {
      const suggestion = closestCommand(cmd);
      const hint = suggestion ? ` — did you mean "${suggestion}"?` : "";
      return { ok: false, error: `unknown command: "${cmd}"${hint}\n\n${helpText()}` };
    }
  }
}

export default handler;

if (import.meta.main) {
  const args = process.argv.slice(2);
  const result = await handler({ source: "cli", args });
  if (result.output) console.log(result.output);
  if (result.error) console.error(result.error);
  if (args[0] !== "visualize" || !result.ok) {
    process.exit(result.ok ? 0 : 1);
  }
}
