#!/usr/bin/env bash
#
# ralph.sh — fresh-context agent loop ("Ralph Wiggum" pattern) for this repo.
#
# Each iteration starts the local agent with a CLEAN context; state survives
# in the repo: code, git history, and .agent/ files. The loop stops when the
# agent prints TASK DONE, or when a circuit breaker trips.
#
# Circuit breakers (env-tunable):
#   MAX_ITER=8        hard cap on iterations
#   ITER_TIMEOUT=15m  per-iteration wall clock (GNU timeout)
#   STALL_SECS=240    no model streaming AND no repo change for this long
#                     => iteration is stuck; kill and restart fresh
#   MAX_STALLS=3      consecutive stalls => give up and notify
#
# Transcripts: .agent/runs/<ts>-iter<N>.log   Metrics: .agent/runs/loop-<ts>.jsonl
# Override the agent command for testing: AGENT_CMD="echo" scripts/ralph.sh

set -uo pipefail
cd "$(dirname "$0")/.."

MAX_ITER="${MAX_ITER:-8}"
ITER_TIMEOUT="${ITER_TIMEOUT:-15m}"
STALL_SECS="${STALL_SECS:-420}"
MAX_STALLS="${MAX_STALLS:-3}"

# NOTE: do NOT add coreutils' gnubin to PATH — its unprefixed GNU date
# shadows BSD date and breaks the `-j -f` parsing in last_activity_epoch.
# ~/.bun/bin is where the pi coding agent lives.
export PATH="/opt/homebrew/bin:$HOME/.bun/bin:$HOME/Library/Application Support/kimi-desktop/daimon-share/daimon/npm-global/bin:$PATH"
export OPENAI_API_KEY="${OPENAI_API_KEY:-lm-studio}"
export OPENAI_BASE_URL="${OPENAI_BASE_URL:-http://localhost:1234/v1}"
export OPENAI_MODEL="${OPENAI_MODEL:-qwen3.8-27b-mlx}"
# Engine is swappable: qwen-code (default) or pi, e.g.
#   AGENT_CMD="pi --print --no-session --model lm_studio/qwen3.8-27b-mlx" scripts/ralph.sh
AGENT_CMD="${AGENT_CMD:-qwen --yolo -p}"

mkdir -p .agent/runs
RUN_TS=$(date +%Y%m%d-%H%M%S)
METRICS=".agent/runs/loop-$RUN_TS.jsonl"
MARKER=".agent/runs/.marker"

notify() { osascript -e "display notification \"$1\" with title \"ralph loop\" sound name \"Glass\"" 2>/dev/null || true; }
metric() { printf '{"iter":%s,"outcome":"%s","secs":%s,"ts":"%s"}\n' "$1" "$2" "$3" "$(date -u +%FT%TZ)" >> "$METRICS"; }

# seconds since the last real generation activity in LM Studio's log.
# Counts stream starts, prompt-processing progress, and stream finishes —
# NOT the periodic cache_store bookkeeping lines. A wedged stream produces
# none of these; a healthy iteration produces at least one every few minutes.
last_activity_epoch() {
  local log ts epoch=0
  log=$(ls -t "$HOME"/.lmstudio/server-logs/*/*.log 2>/dev/null | head -1)
  if [ -n "$log" ]; then
    ts=$(grep -E "Streaming response|Finished streaming|Prompt processing" "$log" 2>/dev/null | tail -1 | sed -E 's/^\[([^]]+)\].*/\1/')
    [ -n "$ts" ] && epoch=$(/bin/date -j -f "%Y-%m-%d %H:%M:%S" "$ts" +%s 2>/dev/null || echo 0)
  fi
  echo "$epoch"
}

if ! curl -sf -m 5 "$OPENAI_BASE_URL/models" | grep -q "$OPENAI_MODEL"; then
  echo "✗ inference plane not ready (want $OPENAI_MODEL at $OPENAI_BASE_URL)"
  echo "  fix: lms server start && lms load $OPENAI_MODEL -c 65536 --ttl 3600"
  exit 1
fi
if [ -n "$(git status --porcelain)" ]; then
  echo "✗ working tree is dirty — commit or stash first"; git status --short; exit 1
fi

stalls=0
for i in $(seq 1 "$MAX_ITER"); do
  LOG=".agent/runs/$RUN_TS-iter$i.log"
  echo; echo "━━━ iteration $i/$MAX_ITER — $(date +%H:%M:%S) — log: $LOG ━━━"

  PROMPT="You are the primary engineering agent for this repository (iteration $i of a fresh-context loop; earlier iterations' work persists in the repo and git history, NOT in your memory).

Session bootstrap: read AGENTS.md, .agent/POLICY.md, .agent/CURRENT_TASK.md. Skim docs/ only if needed.

Loop rules:
- ONE task slice per iteration: pick the most important unfinished piece, implement it, verify, commit;
- check loop before committing: npm run compile && npm test && npm run build must pass;
- commit on the current branch (conventional message); never push;
- update .agent/TASKS.md and .agent/CURRENT_TASK.md to reflect what remains;
- keep reasoning short; work autonomously, do not ask questions;
- if EVERYTHING in the current task is complete and verified, print exactly: TASK DONE
- otherwise finish the iteration by printing exactly: ITERATION DONE"

  start=$(date +%s)
  # Plain pipe (proven reliable in M1); output lands in the log per turn.
  # Live token-level view lives in the cockpit's LM Studio pane instead.
  $AGENT_CMD "$PROMPT" > "$LOG" 2>&1 &
  pid=$!
  touch "$MARKER"
  outcome="exit"

  while kill -0 "$pid" 2>/dev/null; do
    sleep 15
    now=$(date +%s); elapsed=$((now - start))
    # wall-clock breaker
    max_secs=$(( $(echo "$ITER_TIMEOUT" | sed 's/[^0-9]//g') * 60 ))
    if [ "$elapsed" -ge "$max_secs" ]; then
      echo "⏱ iteration timeout ($ITER_TIMEOUT) — killing"; kill "$pid" 2>/dev/null; outcome="timeout"; break
    fi
    # stall breaker: no LM Studio generation activity for STALL_SECS
    # AND no repo file newer than marker — both stale means wedged.
    if [ "$elapsed" -ge "$STALL_SECS" ]; then
      act_epoch=$(last_activity_epoch)
      act_age=$(( act_epoch > 0 ? now - act_epoch : 99999 ))
      if [ "$act_age" -gt "$STALL_SECS" ] && ! find . -type f -newer "$MARKER" \
          -not -path './.git/*' -not -path './node_modules/*' -not -path './.agent/runs/*' \
          -not -path './.wxt/*' -not -path './.output/*' -print -quit | grep -q .; then
        echo "⚠ stall detected (no generation activity for ${act_age}s, no repo change) — restarting fresh"
        kill "$pid" 2>/dev/null; outcome="stall"; break
      fi
      touch "$MARKER"
    fi
  done
  wait "$pid" 2>/dev/null
  secs=$(( $(date +%s) - start ))
  metric "$i" "$outcome" "$secs"

  if grep -q "TASK DONE" "$LOG" 2>/dev/null; then
    echo "✅ TASK DONE after $i iteration(s), ${secs}s on the last one"
    metric "$i" "done" "$secs"
    notify "task complete after $i iteration(s)"
    exit 0
  fi

  if [ "$outcome" = "stall" ]; then
    stalls=$((stalls + 1))
    if [ "$stalls" -ge "$MAX_STALLS" ]; then
      echo "🛑 circuit breaker: $MAX_STALLS consecutive stalls — stopping"
      notify "STUCK: $MAX_STALLS consecutive stalls, human needed"
      exit 2
    fi
  else
    stalls=0
  fi
done

echo "🛑 hit MAX_ITER=$MAX_ITER without TASK DONE"
notify "hit iteration cap ($MAX_ITER) — review needed"
exit 3
