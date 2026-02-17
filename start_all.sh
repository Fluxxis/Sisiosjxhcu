#!/usr/bin/env bash
set -euo pipefail

# Backward-compatible wrapper: start everything via start_app.sh
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
exec "$ROOT/start_app.sh"
