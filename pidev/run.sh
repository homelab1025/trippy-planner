#!/usr/bin/env bash
set -euo pipefail

# Builds and runs the pidev container. Unlike claude-dev, this runs as
# root with a relaxed seccomp profile and the host's Docker socket
# mounted in, because the "pi" agent itself drives podman/docker (e.g.
# for `make dev` / `make build`) from inside the container.

cd "$(dirname "$0")/.."

IMAGE=pi-sandbox

docker build -t "$IMAGE" pidev/

docker run --rm -it \
  --security-opt seccomp=unconfined \
  -p 5173:5173 \
  -p 8080:8080 \
  -p 5432:5432 \
  -v "$(pwd)":/workspace \
  -v ~/.pi/agent:/root/.pi/agent \
  -v /var/run/docker.sock:/var/run/docker.sock \
  "$IMAGE" "$@"
