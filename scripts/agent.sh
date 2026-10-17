#!/usr/bin/env bash
#
# agent.sh — launch the local engineering agent on the current task.
#
#   scripts/agent.sh              # run the task from .agent/CURRENT_TASK.md
#   scripts/agent.sh "fix the …"  # run an ad-hoc task
#
# The agent is qwen-code (Qwen3.8-27B via LM Studio's OpenAI-compatible
# API) in auto-approve mode, sandboxed by policy to this repository —
# see .agent/POLICY.md for what it may and may not do.
#
# Runs are tee'd to .agent/runs/<timestamp>.log so telemetry survives
# the terminal scrollback. Stop anytime with Ctrl+C; Git is the safety
# net (every task starts from a clean tree, work lands on a branch).

set -euo pipefail
cd "$(dirname "$0")/.."

export PATH="/opt/homebrew/bin:$HOME/Library/Application Support/kimi-desktop/daimon-share/daimon/npm-global/bin:$PATH"
export OPENAI_API_KEY="${OPENAI_API_KEY:-lm-studio}"
export OPENAI_BASE_URL="${OPENAI_BASE_URL:-http://localhost:1234/v1}"
export OPENAI_MODEL="${OPENAI_MODEL:-qwen3.8-27b-mlx}"

# --- preflight: inference plane reachable, model available ----------------
if ! curl -sf -m 5 "$OPENAI_BASE_URL/models" | grep -q "$OPENAI_MODEL"; then
  echo "✗ inference plane not ready (want $OPENAI_MODEL at $OPENAI_BASE_URL)"
  echo "  fix: lms server start && lms load $OPENAI_MODEL -c 65536 --ttl 3600"
  exit 1
fi

# --- preflight: tree must be clean (Git is the recovery mechanism) ---------
if [ -n "$(git status --porcelain)" ]; then
  echo "✗ working tree is dirty — commit or stash before starting a task"
  git status --short
  exit 1
fi

# --- assemble the prompt ----------------------------------------------------
if [ $# -gt 0 ]; then
  TASK="$*"
else
  TASK="$(cat .agent/CURRENT_TASK.md)"
fi

PROMPT="You are the primary engineering agent for this repository.

Session bootstrap: read AGENTS.md and .agent/POLICY.md, then the docs they
point to. The repository is your persistent memory — update .agent/ files
before you finish.

Your task:

$TASK

Working rules:
- work autonomously to completion; do not ask questions (approval
  boundaries are in .agent/POLICY.md — stop and report if you hit one);
- keep reasoning short; read only files you need;
- before committing: npm run compile && npm test && npm run build must
  all pass (run npm run test:e2e as well if the task touches UI wiring);
- commit on the current branch with a conventional message; never push;
- finish by printing exactly: TASK DONE"

# --- run, with the transcript kept for .agent/RUN_LOG.md --------------------
mkdir -p .agent/runs
LOG=".agent/runs/$(date +%Y%m%d-%H%M%S).log"
echo "▶ agent starting — model: $OPENAI_MODEL @ $OPENAI_BASE_URL"
echo "  transcript: $LOG   (watch live: tail -f $LOG)"
exec qwen --yolo -p "$PROMPT" 2>&1 | tee "$LOG"
