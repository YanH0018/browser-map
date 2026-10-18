#!/usr/bin/env bash
#
# notify-done.sh — waits for the running ralph loop to reach a terminal
# state (TASK DONE / circuit breaker / iteration cap), runs the check
# loop as an independent verification, then emails Alex the outcome.
#
# Lives inside the cockpit tmux session so its lifecycle is tied to the
# session — no orphaned background processes.
#
#   scripts/notify-done.sh [email]

set -uo pipefail
cd "$(dirname "$0")/.."

TO="${1:-vvin732@icloud.com}"
export PATH="/opt/homebrew/bin:$PATH"

# The real loop runs as "bash scripts/ralph.sh"; tmux launcher wrappers
# mention ralph.sh in their argv too, so match the full bash invocation.
echo "watchdog armed — waiting for the agent loop to exit…"
while pgrep -f "bash scripts/ralph.sh" >/dev/null 2>&1; do
  sleep 60
done
sleep 5  # let the last agent process flush its log
echo "loop exited at $(date '+%H:%M:%S') — verifying and reporting"

# --- independent check loop -------------------------------------------------
COMPILE=$(npm run compile >/dev/null 2>&1 && echo PASS || echo FAIL)
TEST=$(npm test >/dev/null 2>&1 && echo PASS || echo FAIL)
BUILD=$(npm run build >/dev/null 2>&1 && echo PASS || echo FAIL)

BRANCH=$(git branch --show-current)
GITLOG=$(git log --oneline -8)
STATUS=$(git status --short | head -10)
METRICS=$(cat .agent/runs/loop-*.jsonl 2>/dev/null | tail -10)
LASTLOG=$(ls -t .agent/runs/2*-iter*.log 2>/dev/null | head -1)
DONE=""
for f in .agent/runs/2*-iter*.log; do
  [ -f "$f" ] && scripts/task-done.sh "$f" && DONE="$f"
done
VERDICT=$([ -n "$DONE" ] && echo "TASK DONE (in $DONE)" || echo "NO TASK DONE — check metrics")

BODY="M6 agent loop finished on branch $BRANCH (engine: pi).

Verdict: $VERDICT
Independent check loop:  compile=$COMPILE  test=$TEST  build=$BUILD

=== recent commits ===
$GITLOG

=== working tree ===
${STATUS:-clean}

=== iteration metrics ===
$METRICS

The branch is NOT merged yet — final review is yours (per .agent/POLICY.md).
Reply to Kimi when you are back and it will run acceptance + merge + push.

— ralph watchdog on your M5 Max"

# --- iMessage doorbell (instant, junk-proof) ---------------------------------
# Short ping first so the phone buzzes even if the email lands in junk.
PING="[browser-map] M6 loop ended — $VERDICT | compile=$COMPILE test=$TEST build=$BUILD — full report in mail"
PING="$PING" osascript -e '
set PING to system attribute "PING"
tell application "Messages" to send PING to buddy "vvin732@icloud.com" of (1st service whose service type = iMessage)' \
  && echo "iMessage doorbell sent" || echo "iMessage doorbell FAILED (email still goes out)"

# --- email via Mail.app (uses the Mac's configured account) -----------------
send_mail() {
python3 - "$TO" "$BODY" << 'PYEOF'
import subprocess, sys, os
to, body = sys.argv[1], sys.argv[2]
os.environ["BODY"] = body
os.environ["TO"] = to
# NB: "to" is an AppleScript keyword and names are case-insensitive,
# so the recipient variable must NOT be named TO/to.
script = '''
set BODY to system attribute "BODY"
set ADDR to system attribute "TO"
tell application "Mail"
  set m to make new outgoing message with properties {subject:"[browser-map] M6 loop finished — report attached", content:BODY, visible:false}
  tell m to make new to recipient at end of to recipients with properties {address:ADDR}
  send m
end tell
'''
r = subprocess.run(["osascript", "-e", script], check=False)
sys.exit(r.returncode)
PYEOF
}

# Mail.app can drop AppleEvents when the Mac has been idle — wake it and
# retry once before giving up.
if ! send_mail; then
  echo "first send failed — waking Mail and retrying in 30s"
  open -g -a Mail 2>/dev/null || true
  sleep 30
  send_mail && echo "retry succeeded" || echo "retry FAILED — report left in .agent/runs/"
fi

echo "report emailed to $TO"
