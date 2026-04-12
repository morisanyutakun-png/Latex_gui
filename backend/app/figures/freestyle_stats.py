"""CLI to summarize the freestyle figure compile log.

Usage (from backend/):
    python -m app.figures.freestyle_stats
    python -m app.figures.freestyle_stats --top 20
    python -m app.figures.freestyle_stats --since 86400   # last 24h

Reads `backend/assets/figures/_freestyle_log.jsonl` and prints:
  - total / success / fail counts
  - top categories by attempt count
  - top repeated body hashes (candidates for catalog promotion)
  - top failure reasons
"""
from __future__ import annotations

import argparse
import json
import sys
import time
from collections import Counter
from pathlib import Path

from .snippet import freestyle_log_path


def _parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(description="Summarize the freestyle figure log")
    p.add_argument("--top", type=int, default=10, help="how many rows per table (default 10)")
    p.add_argument(
        "--since",
        type=int,
        default=0,
        help="only include entries from the last N seconds (0 = all)",
    )
    p.add_argument("--path", type=str, default=None, help="override log path")
    return p.parse_args()


def _read_log(path: Path, since: int) -> list[dict]:
    if not path.exists():
        return []
    cutoff = int(time.time()) - since if since > 0 else 0
    out: list[dict] = []
    for line in path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line:
            continue
        try:
            entry = json.loads(line)
        except json.JSONDecodeError:
            continue
        if since and int(entry.get("ts", 0)) < cutoff:
            continue
        out.append(entry)
    return out


def _print_table(title: str, rows: list[tuple[str, int]], limit: int) -> None:
    if not rows:
        print(f"\n## {title}: (none)")
        return
    print(f"\n## {title}")
    width = max(len(r[0]) for r in rows[:limit])
    for key, count in rows[:limit]:
        print(f"  {count:>5}  {key[:width]}")


def main() -> int:
    args = _parse_args()
    path = Path(args.path) if args.path else freestyle_log_path()

    entries = _read_log(path, args.since)
    if not entries:
        print(f"(no entries in {path})")
        return 0

    total = len(entries)
    ok = sum(1 for e in entries if e.get("success"))
    fail = total - ok

    print(f"# Freestyle figure log summary — {path}")
    print(f"entries: {total}  (success: {ok}, failure: {fail})")
    if args.since:
        print(f"window: last {args.since}s")

    categories = Counter(e.get("category", "unknown") for e in entries)
    _print_table("Top categories", categories.most_common(), args.top)

    # Hash-based repeat detection — same figure compiled many times is a
    # strong candidate for promotion to a curated asset.
    keys = Counter(e.get("key", "-") for e in entries if e.get("success"))
    _print_table("Top repeated successful figures (by key)", keys.most_common(), args.top)

    # Sample bodies of the hottest hashes so the reviewer can see what they are.
    top_keys = [k for k, _ in keys.most_common(args.top) if k and k != "-"]
    if top_keys:
        body_by_key: dict[str, str] = {}
        for e in entries:
            if e.get("success") and e.get("key") in top_keys:
                body_by_key.setdefault(e["key"], e.get("body_sample", ""))
        print("\n## Hot figure body samples (first 180 chars)")
        for k in top_keys:
            sample = body_by_key.get(k, "").replace("\n", " ")[:180]
            print(f"  [{k}]  {sample}")

    errors = Counter(e.get("error", "")[:60] for e in entries if not e.get("success") and e.get("error"))
    _print_table("Top failure reasons", errors.most_common(), args.top)

    reasons = Counter((e.get("reason") or "")[:60] for e in entries if e.get("reason"))
    _print_table("Top AI-supplied reasons", reasons.most_common(), args.top)

    return 0


if __name__ == "__main__":
    sys.exit(main())
