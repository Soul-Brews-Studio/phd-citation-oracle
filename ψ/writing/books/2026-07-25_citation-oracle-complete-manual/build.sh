#!/usr/bin/env bash
# Build the book: markdown chapters → ZWSP → pandoc → typst → PDF.
# Run from this directory. Every step gates loudly rather than producing a
# quietly-wrong PDF, because the failures here are all silent ones.
set -uo pipefail
cd "$(dirname "$0")"

SLUG="citation-oracle-complete-manual"
T="$(mktemp -d /tmp/book-XXXXXX)"
trap 'echo "temp: $T"' EXIT

# ── 1. assemble in chapter order, blank-line separated ──
# The blank line matters: pandoc's blank_before_header means a heading with no
# preceding blank line renders as literal "# text" in the PDF.
: > "$T/all.md"
FILES=(00-frontmatter.md 01-*.md 02-*.md 03-*.md 04-*.md 05-*.md 06-*.md \
       07-*.md 08-*.md 09-*.md 10-*.md 11-*.md 12-*.md 13-*.md 14-*.md 15-*.md)
missing=0
for f in "${FILES[@]}"; do
  if [ -f "$f" ]; then
    cat "$f" >> "$T/all.md"; printf '\n\n' >> "$T/all.md"
  else
    echo "❌ missing: $f"; missing=1
  fi
done
[ "$missing" -eq 0 ] || { echo "abort: draft incomplete"; exit 1; }

chapters=$(grep -c '^# บทที่' "$T/all.md" || true)
echo "chapters found: $chapters"
[ "$chapters" -eq 15 ] || { echo "❌ expected 15 chapters, got $chapters"; exit 1; }
echo "words: $(wc -w < "$T/all.md")"

# ── 2. Thai word break (skips code) ──
if uvx --from pythainlp python3 thai-wordbreak.py < "$T/all.md" > "$T/zwsp.md" 2>"$T/wb.err"; then
  echo "✓ wordbreak ok ($(wc -c < "$T/zwsp.md") bytes from $(wc -c < "$T/all.md"))"
else
  echo "⚠ pythainlp failed — building WITHOUT word break (lines may break mid-word)"
  cat "$T/wb.err" | tail -3
  cp "$T/all.md" "$T/zwsp.md"
fi

# ── 3. pandoc → typst ──
# -citations: an @token like @org/pkg otherwise becomes a citation and typst
# then dies with "the document does not contain a bibliography".
pandoc -f markdown-citations "$T/zwsp.md" -o "$T/body.typ" -t typst || exit 1
perl -i -pe 's/#horizontalrule/#line(length: 100%)/g' "$T/body.typ"
echo "✓ pandoc → typst"

# ── 4. compile ──
cat book.typ "$T/body.typ" > "$T/full.typ"
typst compile --font-path fonts --font-path /System/Library/Fonts \
  --font-path /System/Library/AssetsV2 --font-path ~/Library/Fonts \
  "$T/full.typ" "$SLUG.pdf" 2>"$T/typst.err" || { cat "$T/typst.err"; exit 1; }

# typst exits 0 and merely warns when it falls back on a missing font — and a
# fallback face is exactly what mis-stacks Thai tone marks. So gate on it.
if grep -qi 'unknown font' "$T/typst.err"; then
  echo "❌ FONT FALLBACK — Thai marks will be wrong:"; grep -i 'unknown font' "$T/typst.err" | sort -u
  exit 1
fi
echo "✓ compiled, no font fallback"

pages=$(pdfinfo "$SLUG.pdf" | awk '/^Pages:/{print $2}')
echo "PAGES: $pages"
echo "✓ $PWD/$SLUG.pdf"
