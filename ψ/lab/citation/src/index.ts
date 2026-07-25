import * as lancedb from "@lancedb/lancedb";
import { readFile, stat } from "node:fs/promises";
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
const LANCEDB_DIR =
  process.env.CITATION_LANCEDB_DIR ||
  (process.env.MAW_HOME ? `${process.env.MAW_HOME}/citation-data/lancedb` : `${import.meta.dir}/../data/lancedb`);
const TABLE_NAME = "papers";
const LOCAL_WORKER_URL = process.env.CF_EMBED_WORKER_URL || "http://localhost:18787";
const EMBED_MODEL = process.env.CF_EMBED_MODEL || "@cf/baai/bge-m3";
const EMBED_DIM = 1024;
const DEFAULT_CORPUS = "artifacts/literature_corpus.jsonl";

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
    const payload = results.map((r) => ({
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

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

async function cmdVisualize(rest: string[]): Promise<PluginResult> {
  const portFlagIndex = rest.indexOf("--port");
  const port = portFlagIndex >= 0 ? Number(rest[portFlagIndex + 1]) : Number(process.env.CITATION_VISUALIZE_PORT) || 5556;

  const db = await lancedb.connect(LANCEDB_DIR);
  const tableNames = await db.tableNames();
  if (!tableNames.includes(TABLE_NAME)) {
    return { ok: false, error: `table "${TABLE_NAME}" doesn't exist yet — run "maw citation index" first` };
  }
  const table = await db.openTable(TABLE_NAME);
  const rows = await table.query().toArray();
  if (rows.length === 0) return { ok: false, error: 'index is empty — run "maw citation index" first' };

  const vectors = rows.map((r) => Array.from(r.vector as ArrayLike<number>));
  const coords = pcaND(vectors, 3);

  const points = rows.map((r, i) => ({
    x: coords[i]?.[0] ?? 0,
    y: coords[i]?.[1] ?? 0,
    z: coords[i]?.[2] ?? 0,
    title: String(r.title),
    journal: String(r.journal),
    topic: String(r.topic),
  }));

  const topics = [...new Set(points.map((p) => p.topic))].sort();
  const palette = ["#7c3aed", "#0ea5e9", "#10b981", "#f59e0b", "#ef4444", "#ec4899", "#14b8a6", "#a3e635"];
  const colorFor = (topic: string) => palette[topics.indexOf(topic) % palette.length];

  const html = `<!doctype html>
<html><head><meta charset="utf-8"><title>citation constellation — ${points.length} papers (3D)</title>
<style>
  html, body { margin:0; height:100%; overflow:hidden; font-family: ui-sans-serif, system-ui, sans-serif; background:#05060d; color:#e5e7eb; }
  canvas { display:block; cursor: grab; }
  canvas:active { cursor: grabbing; }
  #tooltip {
    position: fixed; max-width: 440px; background: rgba(12,14,30,0.97); border: 1px solid rgba(125,155,255,0.45);
    border-radius: 10px; padding: 12px 14px; font-size: 13px; line-height: 1.5; pointer-events: none;
    display: none; box-shadow: 0 8px 32px rgba(0,0,0,0.6); z-index: 10;
  }
  #tooltip .topic { color: #93c5fd; font-weight: 600; font-size: 11px; text-transform: uppercase; letter-spacing: .04em; margin-bottom: 6px; }
  #tooltip .journal { color: #94a3b8; font-size: 12px; margin-top: 6px; }
  #legend { position: fixed; top: 16px; left: 16px; background: rgba(12,14,30,0.9); border: 1px solid rgba(125,155,255,0.3);
    border-radius: 10px; padding: 12px 14px; font-size: 12px; max-height: 80vh; overflow-y: auto; }
  #legend .item { display: flex; align-items: center; gap: 6px; margin: 4px 0; white-space: nowrap; }
  #legend .swatch { width: 10px; height: 10px; border-radius: 50%; flex-shrink: 0; }
  h1 { position: fixed; top: 16px; right: 16px; font-size: 14px; font-weight: 500; color: #9ca3af; margin: 0; text-align: right; }
  h1 small { display: block; font-size: 11px; color: #6b7280; margin-top: 4px; font-weight: 400; }
  #search-box { position: fixed; top: 16px; left: 50%; transform: translateX(-50%); display: flex; gap: 6px; z-index: 5; }
  #search-box input { width: 340px; background: rgba(12,14,30,0.9); border: 1px solid rgba(125,155,255,0.3);
    border-radius: 8px; padding: 8px 12px; color: #e5e7eb; font-size: 13px; outline: none; }
  #search-box input:focus { border-color: #7d9bff; }
  #search-box button { background: rgba(12,14,30,0.9); border: 1px solid rgba(125,155,255,0.3); border-radius: 8px;
    color: #9ca3af; cursor: pointer; padding: 0 12px; font-size: 13px; }
  #results { position: fixed; top: 64px; left: 50%; transform: translateX(-50%); width: 400px; max-height: 60vh;
    overflow-y: auto; background: rgba(12,14,30,0.95); border: 1px solid rgba(125,155,255,0.3); border-radius: 10px;
    padding: 8px; font-size: 12px; display: none; }
  #results.show { display: block; }
  #results .r-title { color: #9ca3af; padding: 4px 8px 8px; font-size: 11px; }
  #results .r-item { display: flex; gap: 8px; align-items: baseline; padding: 6px 8px; border-radius: 6px; cursor: pointer; }
  #results .r-item:hover { background: rgba(125,155,255,0.15); }
  #results .r-score { color: #34d399; font-variant-numeric: tabular-nums; font-weight: 600; flex-shrink: 0; }
  #results .r-path { color: #d1d5db; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
  #results .r-err { color: #f87171; padding: 8px; }
</style></head>
<body>
<h1>citation constellation — ${points.length} papers · ${topics.length} topics<small>PCA 3D · drag to orbit · scroll to zoom</small></h1>
<div id="legend">${topics.map((t) => `<div class="item"><span class="swatch" style="background:${colorFor(t)}"></span>${escapeHtml(t)}</div>`).join("")}</div>
<div id="search-box">
  <input id="search-input" type="text" placeholder="Search the literature… (Enter)" />
  <button id="search-clear" title="Clear">✕</button>
</div>
<div id="results"></div>
<div id="tooltip"></div>
<script type="importmap">
{ "imports": {
  "three": "https://unpkg.com/three@0.160.0/build/three.module.js",
  "three/addons/": "https://unpkg.com/three@0.160.0/examples/jsm/"
} }
</script>
<script type="module">
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const points = ${JSON.stringify(points)};
const vectors = ${JSON.stringify(vectors)};
const colors = ${JSON.stringify(Object.fromEntries(topics.map((t) => [t, colorFor(t)])))};
const LOCAL_WORKER_URL = ${JSON.stringify(LOCAL_WORKER_URL)};
const EMBED_MODEL = ${JSON.stringify(EMBED_MODEL)};
const tooltip = document.getElementById('tooltip');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const resultsEl = document.getElementById('results');

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x05060d);

const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.1, 5000);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(devicePixelRatio);
document.body.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const xs = points.map(p => p.x), ys = points.map(p => p.y), zs = points.map(p => p.z);
const span = Math.max(...xs) - Math.min(...xs), spanY = Math.max(...ys) - Math.min(...ys), spanZ = Math.max(...zs) - Math.min(...zs);
const scale = 40 / (Math.max(span, spanY, spanZ) || 1);

const geometry = new THREE.BufferGeometry();
const positions = new Float32Array(points.length * 3);
const colorArr = new Float32Array(points.length * 3);
const tmpColor = new THREE.Color();
points.forEach((p, i) => {
  positions[i * 3] = p.x * scale;
  positions[i * 3 + 1] = p.y * scale;
  positions[i * 3 + 2] = p.z * scale;
  tmpColor.set(colors[p.topic] || '#94a3b8');
  colorArr[i * 3] = tmpColor.r; colorArr[i * 3 + 1] = tmpColor.g; colorArr[i * 3 + 2] = tmpColor.b;
});
geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
geometry.setAttribute('color', new THREE.BufferAttribute(colorArr, 3));
const colorAttr = geometry.getAttribute('color');

const material = new THREE.PointsMaterial({ size: 2.0, vertexColors: true, sizeAttenuation: true });
const cloud = new THREE.Points(geometry, material);
scene.add(cloud);

camera.position.set(30, 25, 45);
controls.target.set(0, 0, 0);
controls.update();

const raycaster = new THREE.Raycaster();
raycaster.params.Points.threshold = 1.4;
const mouse = new THREE.Vector2();

const baseColors = points.map((p) => new THREE.Color(colors[p.topic] || '#94a3b8'));
const dimColor = new THREE.Color(0x23252f);
let activeScores = null;

function cosineSim(a, b) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}

function resetSearch() {
  activeScores = null;
  for (let i = 0; i < points.length; i++) colorAttr.setXYZ(i, baseColors[i].r, baseColors[i].g, baseColors[i].b);
  colorAttr.needsUpdate = true;
  resultsEl.className = '';
  resultsEl.innerHTML = '';
}

async function runSearch(q) {
  resultsEl.className = 'show';
  resultsEl.innerHTML = '<div class="r-title">searching…</div>';
  try {
    const res = await fetch(LOCAL_WORKER_URL + '/query-embed', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text: q, model: EMBED_MODEL }),
    });
    if (!res.ok) throw new Error('embed worker HTTP ' + res.status);
    const json = await res.json();
    const qVec = json.data && json.data[0];
    if (!qVec) throw new Error('embed worker returned no vector');

    const scored = vectors.map((v, i) => ({ index: i, score: cosineSim(qVec, v) }));
    scored.sort((a, b) => b.score - a.score);
    activeScores = new Map(scored.map((s) => [s.index, s.score]));

    const top = scored.slice(0, 10);
    const topSet = new Set(top.map((t) => t.index));
    for (let i = 0; i < points.length; i++) {
      if (topSet.has(i)) {
        const c = baseColors[i].clone().lerp(new THREE.Color(0xffffff), Math.min(activeScores.get(i), 1) * 0.55);
        colorAttr.setXYZ(i, c.r, c.g, c.b);
      } else {
        colorAttr.setXYZ(i, dimColor.r, dimColor.g, dimColor.b);
      }
    }
    colorAttr.needsUpdate = true;

    resultsEl.innerHTML = '<div class="r-title">top ' + top.length + ' papers for "' + q + '"</div>' +
      top.map((t) => {
        const p = points[t.index];
        return '<div class="r-item" data-idx="' + t.index + '"><span class="r-score">' + t.score.toFixed(3) +
          '</span><span class="r-path">' + p.title + '</span></div>';
      }).join('');
  } catch (err) {
    resultsEl.className = 'show';
    resultsEl.innerHTML = '<div class="r-err">' + (err && err.message ? err.message : String(err)) + '</div>';
  }
}

searchInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && searchInput.value.trim()) runSearch(searchInput.value.trim());
});
searchClear.addEventListener('click', () => { searchInput.value = ''; resetSearch(); });
resultsEl.addEventListener('click', (e) => {
  const item = e.target.closest('.r-item');
  if (!item) return;
  const i = Number(item.dataset.idx);
  const target = new THREE.Vector3(positions[i * 3], positions[i * 3 + 1], positions[i * 3 + 2]);
  controls.target.copy(target);
  camera.position.copy(target).add(new THREE.Vector3(8, 6, 10));
  controls.update();
});

renderer.domElement.addEventListener('mousemove', (e) => {
  mouse.x = (e.clientX / innerWidth) * 2 - 1;
  mouse.y = -(e.clientY / innerHeight) * 2 + 1;
  raycaster.setFromCamera(mouse, camera);
  const hits = raycaster.intersectObject(cloud);
  if (hits.length) {
    const i = hits[0].index;
    const p = points[i];
    tooltip.style.display = 'block';
    tooltip.style.left = (e.clientX + 16) + 'px';
    tooltip.style.top = (e.clientY + 16) + 'px';
    const scoreLine = activeScores && activeScores.has(i)
      ? '<div style="color:#34d399;font-size:11px;margin-bottom:4px;">similarity ' + activeScores.get(i).toFixed(3) + '</div>'
      : '';
    tooltip.innerHTML = '<div class="topic">' + p.topic + '</div>' + scoreLine +
      p.title.replace(/</g,'&lt;') + (p.journal ? '<div class="journal">' + p.journal.replace(/</g,'&lt;') + '</div>' : '');
  } else {
    tooltip.style.display = 'none';
  }
});

window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
});

function animate() {
  requestAnimationFrame(animate);
  controls.update();
  renderer.render(scene, camera);
}
animate();
</script>
</body></html>`;

  Bun.serve({ port, fetch: () => new Response(html, { headers: { "content-type": "text/html" } }) });

  return {
    ok: true,
    output: `✦ citation constellation — http://localhost:${port}\n${points.length} papers across ${topics.length} topics, interactive 3D PCA + semantic search\nCtrl+C to stop`,
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

const KNOWN_COMMANDS = ["status", "index", "search", "visualize"] as const;

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
