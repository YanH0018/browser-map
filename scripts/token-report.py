#!/usr/bin/env python3
"""
token-report.py — token ledger for JSON-mode ralph iteration logs.

Parses .agent/runs/*-iter*.log (pi --mode json NDJSON), sums the usage
of every assistant `message_end` event per iteration, and prints:

  1. per-iteration token table (input / output / of-which-reasoning)
  2. grand totals
  3. what the same tokens would cost on cloud APIs (prices as of
     2026-10-17 — edit TIERS to re-price)

Notes:
- Only JSON-mode runs carry usage. M2–M4 logs are text mode and are
  skipped (listed at the end).
- `reasoning` tokens are part of `output` (they are billed as output
  on every cloud API too).
- LM Studio does not report cache hits via the API; the cached scenario
  uses the hit rate measured from LM Studio's server log (~92%).
"""

import glob
import json
import os
import sys

# --- cloud reference prices, USD per 1M tokens (2026-10-17) -----------------
# (input, output, cache_read)
TIERS = {
    "Haiku 5.5 / GPT-6 Luna (budget)": (0.10, 0.50, 0.01),
    "Sonnet 5 / GPT-6.1 Sol (mid)   ": (2.00, 10.00, 0.20),
    "Opus 5.5 (frontier)            ": (4.00, 20.00, 0.40),
}

# Measured from LM Studio server logs on this machine (M4 loop: 91.85%).
CACHE_HIT_RATE = 0.92

RUNS_DIR = os.path.join(os.path.dirname(__file__), "..", ".agent", "runs")


def parse_log(path):
    """Sum assistant usage across all turns in one iteration log."""
    inp = out = reasoning = 0
    turns = 0
    with open(path, errors="replace") as f:
        for line in f:
            if '"type":"message_end"' not in line and '"type": "message_end"' not in line:
                continue
            try:
                e = json.loads(line)
            except json.JSONDecodeError:
                continue
            if e.get("type") != "message_end":
                continue
            msg = e.get("message", {})
            if msg.get("role") != "assistant":
                continue
            u = msg.get("usage") or {}
            inp += u.get("input", 0)
            out += u.get("output", 0)
            reasoning += u.get("reasoning", 0)
            turns += 1
    return inp, out, reasoning, turns


def fmt(n):
    return f"{n:,}"


def main():
    pattern = sys.argv[1] if len(sys.argv) > 1 else "*-iter*.log"
    logs = sorted(glob.glob(os.path.join(RUNS_DIR, pattern)))
    if not logs:
        print(f"no logs matching {pattern} in {RUNS_DIR}")
        sys.exit(1)

    rows = []
    skipped = []
    for path in logs:
        inp, out, reasoning, turns = parse_log(path)
        if turns == 0:
            skipped.append(os.path.basename(path))
            continue
        rows.append((os.path.basename(path), inp, out, reasoning, turns))

    if not rows:
        print("no JSON-mode usage found (all logs are text mode?)")
        sys.exit(0)

    print(f"{'iteration log':<38}{'input':>12}{'output':>10}{'reasoning':>12}{'turns':>7}")
    print("-" * 79)
    ti = to = tr = 0
    for name, inp, out, reasoning, turns in rows:
        print(f"{name:<38}{fmt(inp):>12}{fmt(out):>10}{fmt(reasoning):>12}{turns:>7}")
        ti += inp
        to += out
        tr += reasoning
    print("-" * 79)
    print(f"{'TOTAL':<38}{fmt(ti):>12}{fmt(to):>10}{fmt(tr):>12}")
    print(f"\ntotal tokens processed: {fmt(ti + to)}  "
          f"(reasoning = {tr * 100 // max(to, 1)}% of output)")

    # --- cloud cost equivalence --------------------------------------------
    print(f"\ncloud-cost equivalence for this workload "
          f"(prices 2026-10-17, cache hit rate {CACHE_HIT_RATE:.0%}):")
    print(f"{'tier':<38}{'no cache ($)':>14}{'with cache ($)':>16}")
    print("-" * 68)
    for tier, (pin, pout, pcache) in TIERS.items():
        plain = ti * pin / 1e6 + to * pout / 1e6
        cached = (ti * (1 - CACHE_HIT_RATE) * pin / 1e6
                  + ti * CACHE_HIT_RATE * pcache / 1e6
                  + to * pout / 1e6)
        print(f"{tier:<38}{plain:>14.2f}{cached:>16.2f}")
    print("\nlocal cost: $0.00 (electricity not itemized)")

    if skipped:
        print(f"\nskipped {len(skipped)} text-mode log(s) without usage: "
              + ", ".join(skipped[:5]) + (" …" if len(skipped) > 5 else ""))


if __name__ == "__main__":
    main()
