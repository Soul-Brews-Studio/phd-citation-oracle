#!/usr/bin/env python3
"""Insert zero-width spaces at Thai word boundaries so typst can break lines.

Thai does not separate words with spaces, so a typesetter with no Thai
dictionary breaks lines mid-word. ZWSP (U+200B) marks the legal break points
without adding visible space.

Two things must be left alone or the output breaks:
  - fenced code blocks (```): a ZWSP inside a shell command is invisible and
    makes the command fail if copy-pasted
  - inline code (`like this`): same hazard, smaller blast radius

Reads stdin, writes stdout, so it composes in a pipeline.
"""
import re
import sys

sys.stdout.reconfigure(encoding="utf-8")

from pythainlp.tokenize import word_tokenize

ZWSP = "​"
THAI = r"฀-๿"


def has_thai(text: str) -> bool:
    return bool(re.search(f"[{THAI}]", text))


def break_thai_runs(text: str) -> str:
    """ZWSP-join every Thai run, leaving non-Thai spans untouched."""
    out = []
    for seg in re.split(f"([{THAI}]+)", text):
        if has_thai(seg):
            try:
                out.append(ZWSP.join(word_tokenize(seg, engine="newmm")))
            except Exception:
                out.append(seg)  # never lose text to a tokenizer failure
        else:
            out.append(seg)
    return "".join(out)


def process_line(line: str) -> str:
    if not has_thai(line):
        return line
    # Split on inline code so backticked spans pass through verbatim.
    return "".join(
        part if part.startswith("`") else break_thai_runs(part)
        for part in re.split(r"(`[^`]*`)", line)
    )


def main() -> None:
    in_fence = False
    fence_re = re.compile(r"^\s*(```|~~~)")
    for line in sys.stdin:
        line = line.rstrip("\n")
        if fence_re.match(line):
            in_fence = not in_fence
            print(line)
            continue
        print(line if in_fence else process_line(line))


if __name__ == "__main__":
    main()
