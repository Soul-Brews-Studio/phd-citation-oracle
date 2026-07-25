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
HAVE_MAW=1
command -v maw >/dev/null || { HAVE_MAW=0; }
[ "$HAVE_MAW" = "1" ] && ok "maw present" || ok "maw absent — will use the standalone runner (./bin/citation)"

# ── install the plugin from source ───────────────────────────────────────────
if [ "$HAVE_MAW" = "1" ]; then
  say "installing the plugin (ψ/lab/citation → .maw/plugins/citation)"
  maw plugin install ψ/lab/citation --force >/dev/null
  ok "installed — no dependencies to resolve (the plugin has none)"
  RUN="maw citation"
else
  say "no maw — using the standalone runner"
  chmod +x bin/citation 2>/dev/null || true
  ok "./bin/citation ready (finds the repo by walking up for CLAUDE.md + ψ/)"
  RUN="./bin/citation"
  unset MAW_HOME     # so the store lands in <repo>/.citation/store
fi

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
       cd ψ/lab/citation/worker && wrangler dev --port 18787
EOF
  WORKER_UP=0
fi
fi

# ── build the corpus + index ─────────────────────────────────────────────────
if [ "${1:-}" != "--no-index" ] && [ "$WORKER_UP" = "1" ]; then
  say "building paper cards"
  $RUN cards 2>/dev/null | sed 's/^/  /' || bad "cards failed"
  say "indexing (papers + vault notes)"
  $RUN index --vault 2>/dev/null | sed 's/^/  /' || bad "index failed"
fi

say "status"
$RUN status 2>/dev/null | sed 's/^/  /' || true

cat <<'EOF'

Ready. Try (with maw):
  export MAW_HOME="$PWD/.maw"     # or: direnv allow
  maw citation search "biomass burning haze northern thailand"
  maw citation serve              # interactive 2D constellation
  maw citation graph --html       # SVG + a portable interactive page

Or with no maw at all:
  ./bin/citation search "biomass burning haze northern thailand"
  ./bin/citation serve

Manual: ψ/papers/README.md   (adding papers, indexing by hand, troubleshooting)
EOF
