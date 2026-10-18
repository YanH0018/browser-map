#!/usr/bin/env bash
#
# task-done.sh — exit 0 only if the ASSISTANT actually declared TASK DONE.
#
# Why not grep the log? In pi's JSON mode the log contains the full USER
# prompt too — and the ralph prompt itself mentions "TASK DONE", so a
# naive grep self-triggers. For text-mode logs (qwen engine) plain grep
# is still correct.
#
#   scripts/task-done.sh <logfile>

set -uo pipefail
log="$1"
[ -f "$log" ] || exit 1

if head -c 64 "$log" | grep -q '"type":"session"'; then
  python3 - "$log" << 'PYEOF'
import json, sys

hit = False
for line in open(sys.argv[1], errors="replace"):
    try:
        e = json.loads(line)
    except json.JSONDecodeError:
        continue
    if e.get("type") != "message_end":
        continue
    m = e.get("message", {})
    if m.get("role") != "assistant":
        continue
    for c in m.get("content", []):
        if c.get("type") == "text" and "TASK DONE" in c.get("text", ""):
            hit = True
sys.exit(0 if hit else 1)
PYEOF
else
  grep -q "TASK DONE" "$log"
fi
