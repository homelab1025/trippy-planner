#!/usr/bin/env bash
# Wrapper around `make` that logs output to logs/ so the container can read it.
#
# Usage:
#   ./run-make.sh dev          # -> logs/logs-dev.log
#   ./run-make.sh build        # -> logs/logs-build.log
#   ./run-make.sh test 2>&1    # -> logs/logs-test.log
#
# Run in background:
#   ./run-make.sh dev > logs/logs-dev.log 2>&1 &
#
# Or for live tailing:
#   ./run-make.sh dev 2>&1 | tee logs/logs-$(date +%F-%H%M%S).log

set -euo pipefail

LOG_DIR="$(cd "$(dirname "$0")" && pwd)/logs"
mkdir -p "$LOG_DIR"

LOG_FILE="${LOG_DIR}/logs-${1:-run}-$(date +%F-%H%M%S).log"

echo "[$(date)] Starting: make $*"
echo "[$(date)] Log: $LOG_FILE"

# Re-exec make, tee-ing output to the log file
make "$@" 2>&1 | tee "$LOG_FILE"
