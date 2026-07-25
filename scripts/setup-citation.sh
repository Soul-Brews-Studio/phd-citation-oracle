#!/usr/bin/env bash
# Bootstrap `maw citation` from a fresh clone.
#
# Why this script instead of committing .maw/ — the installed plugin at
# .maw/plugins/citation is a COPY of ψ/lab/citation (byte-identical), and its
# node_modules is ~487 MB. Committing it would duplicate the source in git,
# invite drift between two index.ts files, and bloat the repo. .maw/ also holds
# machine-specific maw state (audit log, fleet config, other plugins), which
# belongs to the machine and not the repository.
#
# So: the source of truth is ψ/lab/citation, and this script installs it.
#
#   ./scripts/setup-citation.sh          install + build the index
#   ./scripts/setup-citation.sh --no-index   install only
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
export MAW_HOME="$ROOT/.maw"

say() { printf '\n\033[1m%s\033[0m\n' "$*"; }
ok()  { printf '  \033[32m✓\033[0m %s\n' "$*"; }
bad() { printf '  \033[31m✗\033[0m %s\n' "$*"; }

say "citation — setup"
printf '  repo:     %s\n  MAW_HOME: %s\n' "$ROOT" "$MAW_HOME"

# ── prerequisites ────────────────────────────────────────────────────────────
command -v bun >/dev/null || { bad "bun not found — https://bun.sh"; exit 1; }
ok "bun $(bun --version)"
command -v maw >/dev/null || { bad "maw not found (maw-rs)"; exit 1; }
ok "maw present"

# ── install the plugin from source ───────────────────────────────────────────
say "installing the plugin (ψ/lab/citation → .maw/plugins/citation)"
maw plugin install ψ/lab/citation --force >/dev/null
ok "installed — no dependencies to resolve (the plugin has none)"

# ── the embed worker is the one external prerequisite ────────────────────────
say "checking an embedding backend"
WORKER="${CF_EMBED_WORKER_URL:-http://localhost:18787}"
if curl -s -m 3 http://localhost:11434/api/tags 2>/dev/null | grep -q bge-m3; then
  ok "ollama + bge-m3 (local, GPU-backed, no token)"
  WORKER_UP=1
else
if curl -s -m 5 -X POST "$WORKER/embed" \
     -H 'content-type: application/json' \
     -d '{"texts":["healthcheck"],"model":"@cf/baai/bge-m3"}' >/dev/null 2>&1; then
  ok "reachable at $WORKER"
  WORKER_UP=1
else
  bad "no embedding backend reachable"
  cat <<'EOF'
     Local (recommended — no token, uses your GPU):
       ollama pull bge-m3 && ollama serve
     Or the shared Cloudflare worker (do not spin up your own):
       cd ~/.maw/plugins/cf-embed/worker && wrangler dev --port 18787
EOF
  WORKER_UP=0
fi
fi

# ── build the corpus + index ─────────────────────────────────────────────────
if [ "${1:-}" != "--no-index" ] && [ "$WORKER_UP" = "1" ]; then
  say "building paper cards"
  maw citation cards 2>/dev/null | sed 's/^/  /' || bad "cards failed"
  say "indexing (papers + vault notes)"
  maw citation index --vault 2>/dev/null | sed 's/^/  /' || bad "index failed"
fi

say "status"
maw citation status 2>/dev/null | sed 's/^/  /' || true

cat <<'EOF'

Ready. Try:
  export MAW_HOME="$PWD/.maw"     # or: direnv allow
  maw citation search "biomass burning haze northern thailand"
  maw citation serve              # interactive 2D constellation
  maw citation graph --html       # PNG + a portable interactive page

Manual: ψ/papers/README.md   (adding papers, indexing by hand, troubleshooting)
EOF
