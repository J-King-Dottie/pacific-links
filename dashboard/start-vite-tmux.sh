#!/usr/bin/env bash
set -euo pipefail

SESSION="pacific-links-dev"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

tmux kill-session -t "$SESSION" 2>/dev/null || true
tmux new-session -d -s "$SESSION" "$SCRIPT_DIR/start-vite-dev.sh"
