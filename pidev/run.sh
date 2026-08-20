#!/usr/bin/env bash
set -euo pipefail

# Builds and runs the pidev container. Unlike claude-dev, this runs as
# root with a relaxed seccomp profile and the host's Docker socket
# mounted in, because the "pi" agent itself drives podman/docker (e.g.
# for `make dev` / `make build`) from inside the container.

cd "$(dirname "$0")/.."

IMAGE=pi-sandbox

docker build -t "$IMAGE" pidev/

# Default host ports collide with claude-dev, which binds the same three
# (5173/8080/5432). Walk up to the next free port instead of failing.
port_in_use() {
  (exec 3<>"/dev/tcp/127.0.0.1/$1") 2>/dev/null && exec 3>&- || return 1
}

find_free_port() {
  local port="$1"
  while port_in_use "$port"; do
    port=$((port + 1))
  done
  echo "$port"
}

FRONTEND_PORT=$(find_free_port 5173)
BACKEND_PORT=$(find_free_port 8080)
DB_PORT=$(find_free_port 5432)

if [[ "$FRONTEND_PORT" != "5173" || "$BACKEND_PORT" != "8080" || "$DB_PORT" != "5432" ]]; then
  echo "⚠️  Default ports busy (another dev container running?) — using:"
  echo "   Frontend: $FRONTEND_PORT   Backend: $BACKEND_PORT   Postgres: $DB_PORT"
  echo ""
fi

docker run --rm -it \
  --security-opt seccomp=unconfined \
  -p "$FRONTEND_PORT":5173 \
  -p "$BACKEND_PORT":8080 \
  -p "$DB_PORT":5432 \
  -e HOST_FRONTEND_PORT="$FRONTEND_PORT" \
  -e HOST_BACKEND_PORT="$BACKEND_PORT" \
  -e HOST_DB_PORT="$DB_PORT" \
  -v "$(pwd)":/workspace \
  -v ~/.pi/agent:/root/.pi/agent \
  -v /var/run/docker.sock:/var/run/docker.sock \
  "$IMAGE" "$@"
