# citation embed worker — optional

**You probably don't need this.** The default embedding backend is `ollama` on your own machine:
no account, no token, and nothing leaves the computer. That is the right choice for an unpublished
literature corpus.

This worker exists for one case: you'd rather not run a local model, and you already have a
Cloudflare account. It puts Workers AI behind the same three-line HTTP contract, so `citation`
cannot tell which backend answered.

## Run it

```bash
cd ψ/lab/citation/worker
wrangler login                    # once — this is what grants the AI binding
wrangler dev --port 18787
```

**If you belong to more than one Cloudflare account**, that fails with:

```
More than one account available but unable to select one in non-interactive mode.
```

This is expected — `wrangler.toml` deliberately has no `account_id` (see the last section).
Pick one explicitly:

```bash
CLOUDFLARE_ACCOUNT_ID=<your-account-id> wrangler dev --port 18787
```

`wrangler whoami` lists your accounts and their ids. Verified working this way — `/health` returns
`{"ok":true,...}` and `/embed` with two texts returns two 1024-dim vectors.

Then, in another shell:

```bash
CITATION_EMBED=worker ./bin/citation index --vault
./bin/citation status             # should report: local worker http://localhost:18787
```

`citation` auto-detects backends in this order, so if ollama is running it wins and this worker is
ignored:

| Order | Backend | Condition |
|---|---|---|
| 1 | **ollama** | `bge-m3` pulled and ollama running — local, GPU, no token |
| 2 | **this worker** | reachable on `:18787` |
| 3 | Cloudflare REST | `CF_ACCOUNT_ID` + `CF_API_TOKEN` set |

Force one with `CITATION_EMBED=ollama|worker|cf-rest`.

## The contract

```
POST /embed        { texts: ["a", "b"], model?: "@cf/baai/bge-m3" }  ->  { data: number[][] }
POST /query-embed  { text: "a query",   model?: "@cf/baai/bge-m3" }  ->  { data: number[][] }
GET  /health                                                         ->  { ok: true, model }
```

CORS is open, because the constellation page (`citation serve`) embeds search queries directly from
the browser rather than proxying them.

## Two things worth knowing

**The model must match your index.** This worker serves `@cf/baai/bge-m3`; ollama serves `bge-m3`.
Same underlying model, but `manifest.json` records the id it was indexed with, and vectors from
different models are not comparable. Switching backend means re-indexing — `citation status` shows
which model the store was built with.

**Your corpus leaves the machine.** Every text you index goes to Cloudflare. For published papers
that is unremarkable; for unpublished thesis notes indexed with `--vault`, decide deliberately.
Once sent, it cannot be unsent. The local path exists precisely so this is a choice.

## No secrets here

There is no API token in this directory and none is required. `wrangler.toml` deliberately omits
`account_id` — this repo is public, and while an account ID is not a credential, it does not need
publishing either. If you belong to multiple accounts, set `CLOUDFLARE_ACCOUNT_ID` in your
environment.
