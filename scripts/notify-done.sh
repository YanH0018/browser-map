#!/usr/bin/env bash
#
# notify-done.sh — waits for the running ralph loop to reach a terminal
# state (TASK DONE / circuit breaker / iteration cap), runs the check
# loop as an independent verification, then emails Alex the outcome.
#
# Lives inside the cockpit tmux session (scripts/watch.sh window) so its
# lifecycle is tied to the session — no orphaned background processes.
#
#   scripts/notify-done.sh [email]

set -uo pipefail
cd "$(dirname "$0")/.."

TO="${1:-vvin732@icloud.com}"
export PATH="/opt/homebrew/bin:$PATH"

echo "watchdog armed — waiting for the agent loop to exit…"
while pgrep -f "ralph.sh" >/dev/null 2>&1 || pgrep -f "qwen --yolo" >/dev/null 2>&1; do
  sleep 60
done
echo "loop exited at $(date '+%H:%M:%S') — verifying and reporting"

# --- independent check loop -------------------------------------------------
COMPILE=$(npm run compile >/dev/null 2>&1 && echo PASS || echo FAIL)
TEST=$(npm test >/dev/null 2>&1 && echo PASS || echo FAIL)
BUILD=$(npm run build >/dev/null 2>&1 && echo PASS || echo FAIL)

BRANCH=$(git branch --show-current)
GITLOG=$(git log --oneline -8)
STATUS=$(git status --short | head -10)
METRICS=$(cat .agent/runs/loop-*.jsonl 2>/dev/null | tail -10)
DIFFSTAT=$(git diff main..."$BRANCH" --stat 2>/dev/null | tail -15)

BODY="M2 agent loop finished on branch $BRANCH.

Independent check loop:  compile=$COMPILE  test=$TEST  build=$BUILD

=== recent commits ===
$GITLOG

=== working tree ===
${STATUS:-clean}

=== iteration metrics ===
$METRICS

=== diff vs main ===
$DIFFSTAT

The branch is NOT merged yet — final review is yours (per .agent/POLICY.md).
Reply to Kimi when you are back and it will run acceptance + merge + push.

— ralph watchdog on your M5 Max"

# --- email via Mail.app (uses the Mac's configured account) -----------------
python3 - "$TO" "$BODY" << 'PYEOF'
import subprocess, sys
to, body = sys.argv[1], sys.argv[2]
applescript = '''
tell application "Mail"
  set m to make new outgoing message with properties {subject:"[browser-map] M2 loop finished — report attached", content:BODY, visible:false}
  tell m to make new to recipient at end of to recipients with properties {address:TO}
  send m
end tell
'''
# pass strings via environment to avoid AppleScript injection
import os
os.environ["BODY"] = body
os.environ["TO"] = to
# NB: "to" is an AppleScript keyword and names are case-insensitive,
# so the recipient variable must NOT be named TO/to.
script = '''
set BODY to system attribute "BODY"
set ADDR to system attribute "TO"
''' + applescript.replace("address:TO", "address:ADDR")
subprocess.run(["osascript", "-e", script], check=False)
PYEOF

echo "report emailed to $TO"
