#!/usr/bin/env bash
#
# autochain.sh — overnight milestone chain (M6 -> M7 -> stop).
#
# For each milestone: wait for its ralph loop to exit, verify the loop
# truly finished (assistant TASK DONE sentinel) AND passes the full
# check loop, then merge to main + push + tick ROADMAP + report.
# Only then ignite the next milestone. Any gate failure stops the chain
# and notifies — nothing is merged on a red check loop.
#
# IMPORTANT: run a COPY of this script (bash byte-offset reads vs branch
# checkouts):  cp scripts/autochain.sh /tmp/ && bash /tmp/autochain.sh

set -uo pipefail
REPO="$(cd "$(dirname "$0")/.." && pwd)"
# when run from /tmp copy, anchor at the real repo:
[ -d "$REPO/.git" ] || REPO="/Users/alexh/Documents/kimi/tasks/2026-10-17/13-27-37-0628e32f/browser-workspace"
cd "$REPO"
export PATH="/opt/homebrew/bin:$HOME/.bun/bin:$PATH"
TO="vvin732@icloud.com"
AGENT_CMD='pi --mode json --print --no-session --model lm_studio/qwen3.8-27b-mlx'

say() { echo "[autochain $(date '+%H:%M:%S')] $*"; }

ping() { # iMessage doorbell
  PING="$1" osascript -e '
set PING to system attribute "PING"
tell application "Messages" to send PING to buddy "vvin732@icloud.com" of (1st service whose service type = iMessage)' \
    >/dev/null 2>&1 && say "iMessage sent" || say "iMessage FAILED"
}

mail() { # subject $1, body $2 — Mail.app with one retry
  python3 - "$TO" "$1" "$2" << 'PYEOF'
import subprocess, sys, os
to, subject, body = sys.argv[1], sys.argv[2], sys.argv[3]
os.environ["TO"], os.environ["SUBJ"], os.environ["BODY"] = to, subject, body
script = '''
set ADDR to system attribute "TO"
set SUBJ to system attribute "SUBJ"
set BODY to system attribute "BODY"
tell application "Mail"
  set m to make new outgoing message with properties {subject:SUBJ, content:BODY, visible:false}
  tell m to make new to recipient at end of to recipients with properties {address:ADDR}
  send m
end tell
'''
sys.exit(subprocess.run(["osascript", "-e", script], check=False).returncode)
PYEOF
  if [ $? -ne 0 ]; then
    open -g -a Mail 2>/dev/null; sleep 30
    python3 - "$TO" "$1" "$2" << 'PYEOF'
import subprocess, sys, os
to, subject, body = sys.argv[1], sys.argv[2], sys.argv[3]
os.environ["TO"], os.environ["SUBJ"], os.environ["BODY"] = to, subject, body
script = '''
set ADDR to system attribute "TO"
set SUBJ to system attribute "SUBJ"
set BODY to system attribute "BODY"
tell application "Mail"
  set m to make new outgoing message with properties {subject:SUBJ, content:BODY, visible:false}
  tell m to make new to recipient at end of to recipients with properties {address:ADDR}
  send m
end tell
'''
sys.exit(subprocess.run(["osascript", "-e", script], check=False).returncode)
PYEOF
  fi
}

wait_loop_exit() {
  say "waiting for ralph loop to exit…"
  while pgrep -f "^bash scripts/ralph.sh" >/dev/null 2>&1; do sleep 60; done
  sleep 5
  say "loop exited"
}

# verdict_for <run-ts> -> echoes TASK DONE / NOT DONE
verdict_for() {
  local f
  f=$(ls -t .agent/runs/"$1"-iter*.log 2>/dev/null | head -1)
  [ -n "$f" ] && scripts/task-done.sh "$f" && echo "TASK DONE" || echo "NOT DONE"
}

# accept <branch> <tag> <merge-subject> <roadmap-pattern> <roadmap-replacement>
# returns 0 on merged+pushed, 1 on any gate failure (chain must stop)
accept() {
  local branch="$1" tag="$2" subject="$3" roadpat="$4" roadrep="$5"
  local compile test build e2e
  git checkout "$branch" >/dev/null 2>&1 || { say "✗ cannot checkout $branch"; return 1; }
  if [ -n "$(git status --porcelain)" ]; then
    say "✗ dirty tree on $branch"; return 1
  fi
  say "running check loop on $branch…"
  compile=$(npm run compile >/dev/null 2>&1 && echo PASS || echo FAIL)
  test=$(npm test >/dev/null 2>&1 && echo PASS || echo FAIL)
  build=$(npm run build >/dev/null 2>&1 && echo PASS || echo FAIL)
  e2e=$(npm run test:e2e >/dev/null 2>&1 && echo PASS || echo FAIL)
  say "checks: compile=$compile test=$test build=$build e2e=$e2e"
  if [ "$compile$test$build$e2e" != "PASSPASSPASSPASS" ]; then
    return 1
  fi
  git checkout main >/dev/null 2>&1 && git pull --ff-only >/dev/null 2>&1
  git merge --no-ff "$branch" -m "$subject" >/dev/null 2>&1 || { say "✗ merge failed"; return 1; }
  sed -i '' "s|$roadpat|$roadrep|" docs/ROADMAP.md
  git add docs/ROADMAP.md && git commit -m "docs: tick ${tag} on roadmap (autochain)" >/dev/null 2>&1
  git push >/dev/null 2>&1 || { say "✗ push failed"; return 1; }
  say "✓ $tag merged to main and pushed"
  return 0
}

report() { # tag $1, verdict $2, extra $3
  local body="$2
branch: $(git branch --show-current)

=== recent commits ===
$(git log --oneline -8)

=== token ledger (this run) ===
$3

— autochain on your M5 Max"
  ping "[browser-map] $1 — $2"
  mail "[browser-map] $1 report" "$body"
}

# ---------------- phase A: M6 ----------------
wait_loop_exit
M6RUN=$(ls -t .agent/runs/loop-*.jsonl | head -1 | sed -E 's/.*loop-([0-9-]+)\.jsonl/\1/')
V6=$(verdict_for "$M6RUN")
LEDGER6=$(python3 scripts/token-report.py "${M6RUN}-*.log" 2>/dev/null | tail -12)
if [ "$V6" = "TASK DONE" ] && accept feature/m6 "M6" \
    "merge: M6 automatic layout — tidy grid, group-by-domain, safety snapshots (pi engine)" \
    '- \[ \] \*\*M6 — Automatic layout.*' \
    '- [x] **M6 — Automatic layout**: tidy grid; group-by-domain; safety snapshots (autochain)'; then
  report "M6 merged" "M6 done, checks green, merged+pushed" "$LEDGER6"
else
  report "M6 NEEDS HUMAN" "M6 verdict=$V6 — acceptance FAILED, chain stopped, nothing merged" "$LEDGER6"
  exit 1
fi

# ---------------- phase B: ignite + accept M7 ----------------
git checkout -b feature/m7 >/dev/null 2>&1
cp .agent/next-tasks/m7.md .agent/CURRENT_TASK.md
git add .agent/CURRENT_TASK.md && git commit -m "task: load M7 — semantic clustering via local embeddings (autochain)" >/dev/null 2>&1
git push -u origin feature/m7 >/dev/null 2>&1
tmux new-window -t agent -n m7run "cd '$REPO' && ITER_TIMEOUT=25m AGENT_CMD='$AGENT_CMD' scripts/ralph.sh; echo; echo '— loop exited; pane kept —'; exec bash"
say "M7 ignited"
ping "[browser-map] M6 merged ✅ — M7 (semantic clustering) ignited, back to sleep"
# let the new loop actually spawn before watching for its exit
sleep 15

wait_loop_exit
M7RUN=$(ls -t .agent/runs/loop-*.jsonl | head -1 | sed -E 's/.*loop-([0-9-]+)\.jsonl/\1/')
V7=$(verdict_for "$M7RUN")
LEDGER7=$(python3 scripts/token-report.py "${M7RUN}-*.log" 2>/dev/null | tail -12)
if [ "$V7" = "TASK DONE" ] && accept feature/m7 "M7" \
    "merge: M7 semantic clustering — local embeddings, greedy threshold clusters (pi engine)" \
    '- \[ \] \*\*M7 — Semantic clustering.*' \
    '- [x] **M7 — Semantic clustering**: local embeddings + greedy clustering (autochain)'; then
  report "M7 merged — chain complete" "M7 done, checks green, merged+pushed. M0–M7 all landed on main. Chain stops here; M8 needs your product call." "$LEDGER7"
else
  report "M7 NEEDS HUMAN" "M7 verdict=$V7 — acceptance FAILED, nothing merged; branch feature/m7 left as-is" "$LEDGER7"
  exit 1
fi
say "chain complete — good night"
