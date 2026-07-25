#!/usr/bin/env bash
# Build the commands edition. Same pipeline as the long book, one extra gate:
# this edition has a PAGE BUDGET, so the build reports whether it hit it.
set -uo pipefail
cd "$(dirname "$0")"

SLUG="citation-oracle-commands"
TARGET_MIN=54
TARGET_MAX=61
T="$(mktemp -d /tmp/cmdbook-XXXXXX)"
trap 'echo "temp: $T"' EXIT

: > "$T/all.md"
FILES=(00-start.md 01-*.md 02-*.md 03-*.md 04-*.md 05-*.md 06-*.md 07-*.md \
       08-*.md 09-*.md 10-*.md 11-*.md 12-*.md 13-*.md 14-*.md 15-*.md)
missing=0
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then cat "$f" >> "$T/all.md"; printf '\n\n' >> "$T/all.md"
  else echo "❌ missing: $f"; missing=1; fi
done
[ "$missing" -eq 0 ] || { echo "abort: incomplete"; exit 1; }

ch=$(grep -c '^# บทที่' "$T/all.md" || true)
echo "chapters: $ch"
[ "$ch" -eq 15 ] || { echo "❌ expected 15, got $ch"; exit 1; }
blocks=$(( $(grep -c '^```' "$T/all.md" || echo 0) / 2 ))
echo "code blocks: $blocks"

if uvx --from pythainlp python3 thai-wordbreak.py < "$T/all.md" > "$T/zwsp.md" 2>"$T/wb.err"; then
  echo "✓ wordbreak"
else
  echo "⚠ pythainlp failed — no word break"; cp "$T/all.md" "$T/zwsp.md"
fi

pandoc -f markdown-citations "$T/zwsp.md" -o "$T/body.typ" -t typst || exit 1
perl -i -pe 's/#horizontalrule/#line(length: 100%)/g' "$T/body.typ"

cat book.typ "$T/body.typ" > "$T/full.typ"
typst compile --font-path fonts --font-path /System/Library/Fonts \
  --font-path /System/Library/AssetsV2 --font-path ~/Library/Fonts \
  "$T/full.typ" "$SLUG.pdf" 2>"$T/typst.err" || { cat "$T/typst.err"; exit 1; }

# A font fallback silently mis-stacks Thai marks, so warn-and-continue is not enough.
if grep -qi 'unknown font' "$T/typst.err"; then
  echo "❌ FONT FALLBACK:"; grep -i 'unknown font' "$T/typst.err" | sort -u; exit 1
fi

pages=$(pdfinfo "$SLUG.pdf" | awk '/^Pages:/{print $2}')
echo "PAGES: $pages  (budget ${TARGET_MIN}-${TARGET_MAX})"
if [ "$pages" -lt "$TARGET_MIN" ]; then
  echo "  ⚠ under budget — chapters may be too thin"
elif [ "$pages" -gt "$TARGET_MAX" ]; then
  echo "  ⚠ over budget — trim prose (NOT commands) or tighten leading in book.typ"
else
  echo "  ✓ on budget"
fi
echo "✓ $PWD/$SLUG.pdf"
