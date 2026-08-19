#!/usr/bin/env bash
set -euo pipefail

# Builds and runs the claude-dev container with only the workspace (this
# repo) and the network exposed to it: no other host mounts, no docker
# socket, capabilities dropped to the minimum Postgres' startup needs.

cd "$(dirname "$0")/.."

IMAGE=claude-dev
VOLUME=claude-dev-home

docker build \
  --build-arg UID="$(id -u)" \
  --build-arg GID="$(id -g)" \
  -t "$IMAGE" \
  claude-dev/

# Named volume (Docker-managed, not a host path) so the Claude Code OAuth
# login persists across container restarts.
docker volume create "$VOLUME" > /dev/null

docker run -it --rm \
  -v "$(pwd)":/workspace \
  -v "$VOLUME":/home/dev/.claude \
  -p 5173:5173 \
  -p 8080:8080 \
  -p 5432:5432 \
  --cap-drop=ALL \
  --cap-add=SETUID \
  --cap-add=SETGID \
  --cap-add=CHOWN \
  --cap-add=DAC_OVERRIDE \
  --cap-add=FOWNER \
  --security-opt=no-new-privileges=true \
  "$IMAGE" "$@"
