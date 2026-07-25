// citation embed worker — the OPTIONAL cloud embedding backend.
//
// You do not need this. The default backend is ollama on your own machine, which
// needs no account and sends nothing over the network. This exists for the case
// where you would rather not run a local model: it puts Cloudflare Workers AI
// behind the same tiny HTTP contract, so `citation` cannot tell the difference.
//
//   POST /embed        { texts: ["a", "b"], model?: "@cf/baai/bge-m3" } -> { data: number[][] }
//   POST /query-embed  { text: "a query",   model?: "@cf/baai/bge-m3" } -> { data: number[][] }
//   GET  /health       -> { ok: true, model }
//
// Run it:  cd ψ/lab/citation/worker && wrangler dev --port 18787
// Then:    CITATION_EMBED=worker ./bin/citation index --vault
//
// There is no API token anywhere in here. The AI binding is granted by wrangler
// from your own `wrangler login`, and the account is chosen by wrangler (or by
// CLOUDFLARE_ACCOUNT_ID) — deliberately not committed, since this repo is public.

const DEFAULT_MODEL = "@cf/baai/bge-m3"; // 1024-dim, multilingual — same model ollama serves

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "content-type",
};

function cors(response) {
  for (const [k, v] of Object.entries(CORS)) response.headers.set(k, v);
  return response;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // The constellation page embeds search queries straight from the browser,
    // so it needs the preflight to succeed.
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: CORS });
    }

    if (url.pathname === "/health") {
      return cors(Response.json({ ok: true, model: DEFAULT_MODEL }));
    }

    if (request.method === "POST" && (url.pathname === "/embed" || url.pathname === "/query-embed")) {
      let body;
      try {
        body = await request.json();
      } catch {
        return cors(Response.json({ error: "expected a JSON body" }, { status: 400 }));
      }

      // /embed takes `texts`, /query-embed takes a single `text` — accept either
      // on both paths rather than failing on a detail the caller can't see.
      const raw = body.texts ?? body.text;
      const texts = (Array.isArray(raw) ? raw : [raw]).filter((t) => typeof t === "string" && t.length > 0);
      if (!texts.length) {
        return cors(Response.json({ error: "no non-empty text supplied" }, { status: 400 }));
      }

      try {
        const result = await env.AI.run(body.model || DEFAULT_MODEL, { text: texts });
        // Passed through as-is: the caller reads `.data`, and the rest of the
        // payload (shape, pooling, token cost) is genuinely useful when debugging.
        return cors(Response.json(result));
      } catch (error) {
        return cors(Response.json({ error: String(error?.message ?? error) }, { status: 502 }));
      }
    }

    return cors(
      new Response(
        "citation embed worker (optional).\n" +
          "  POST /embed        {texts:[...]}\n" +
          "  POST /query-embed  {text:'...'}\n" +
          "  GET  /health\n" +
          "The default backend is ollama, which needs none of this.\n",
        { status: 200, headers: { "content-type": "text/plain; charset=utf-8" } },
      ),
    );
  },
};
