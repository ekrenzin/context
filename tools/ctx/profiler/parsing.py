"""Transcript parsing -- dispatches to format-specific parsers."""

from collections import Counter
from pathlib import Path

from ctx.profiler.parse_jsonl import parse_jsonl
from ctx.profiler.parse_txt import parse_txt


def parse_transcript(filepath: Path) -> dict:
    """Dispatch to the correct parser based on file extension."""
    if filepath.suffix == ".jsonl":
        return parse_jsonl(filepath)
    return parse_txt(filepath)


def extract_ngrams(sequences: list[list[str]], n: int) -> Counter:
    ngrams: Counter = Counter()
    for seq in sequences:
        for i in range(len(seq) - n + 1):
            gram = " -> ".join(seq[i : i + n])
            ngrams[gram] += 1
    return ngrams
