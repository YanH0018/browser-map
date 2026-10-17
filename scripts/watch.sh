#!/usr/bin/env bash
#
# watch.sh — the agent cockpit. One tmux session, three panes:
#
#   ┌─────────────────────────┬──────────────────────────┐
#   │  ralph.sh agent loop    │  repo monitor            │
#   │  (live streaming via    │  git log/status + latest │
#   │   pty, auto-restart,    │  run log, refreshed 5s   │
#   │   circuit breakers)     │                          │
#   ├─────────────────────────┴──────────────────────────┤
#   │  shell in the repo (your manual intervention zone) │
#   └────────────────────────────────────────────────────┘
#
#   scripts/watch.sh        start the cockpit (or re-attach if running)
#   Ctrl+B then D           detach — the loop keeps running
#   tmux attach -t agent    come back later
#   tmux kill-session -t agent   stop everything

set -euo pipefail
cd "$(dirname "$0")/.."
export PATH="/opt/homebrew/bin:$PATH"

if tmux has-session -t agent 2>/dev/null; then
  echo "session 'agent' already running — attaching"
  exec tmux attach -t agent
fi

tmux new-session -d -s agent -x 220 -y 50 \
  "scripts/ralph.sh; echo; echo '— loop exited; pane kept for inspection —'; exec bash"

tmux split-window -h -t agent "
  while true; do clear;
    echo '=== git (this branch) ===';
    git log --oneline -6; echo;
    git status --short | head -15; echo;
    echo '=== latest iteration log (tail) ===';
    tail -c 2000 \"\$(ls -t .agent/runs/*-iter*.log 2>/dev/null | head -1)\" 2>/dev/null || echo '(no iterations yet)';
    sleep 5;
  done"

tmux split-window -v -t agent -p 30

# live inference activity from the LM Studio server log (token streams,
# prompt processing) — the per-token "is it thinking right now" view
tmux split-window -v -t agent.1 \
  "tail -n 30 -F \"\$(ls -t ~/.lmstudio/server-logs/*/*.log | head -1)\" | grep --line-buffered -E 'Streaming|Finished|Estimated Token|Prompt processing'"

tmux select-pane -t agent.0

echo "cockpit ready — attach with: tmux attach -t agent   (detach: Ctrl+B, D)"
if [ -t 0 ]; then exec tmux attach -t agent; fi
