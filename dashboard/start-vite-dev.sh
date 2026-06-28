#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")"
exec npm run dev -- --host 0.0.0.0
