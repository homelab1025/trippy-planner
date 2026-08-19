#!/usr/bin/env bash
set -euo pipefail

# Thin wrapper kept for backwards compatibility — the pidev container's
# build+run logic now lives alongside its Dockerfile, mirroring
# claude-dev/run.sh.
exec "$(dirname "$0")/pidev/run.sh" "$@"
