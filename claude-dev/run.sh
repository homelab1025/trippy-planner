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

# Optional: mount a dedicated SSH deploy key from the host so the container
# can push to GitHub, without ever baking the key into the image. Bind
# mounts keep the host file's owner/perms as-is, and the image is built
# with matching UID/GID, so this only works cleanly if the key is chmod 600
# on the host already.
SSH_MOUNT_ARGS=()
if [[ -n "${CLAUDE_DEV_SSH_KEY:-}" ]]; then
  if [[ ! -f "$CLAUDE_DEV_SSH_KEY" ]]; then
    echo "❌ CLAUDE_DEV_SSH_KEY is set to '$CLAUDE_DEV_SSH_KEY' but that file doesn't exist" >&2
    exit 1
  fi
  KEY_PERMS=$(stat -c '%a' "$CLAUDE_DEV_SSH_KEY" 2>/dev/null || stat -f '%Lp' "$CLAUDE_DEV_SSH_KEY")
  if [[ "$KEY_PERMS" != "600" ]]; then
    echo "⚠️  $CLAUDE_DEV_SSH_KEY has permissions $KEY_PERMS, not 600 - ssh inside the container will reject it as-is." >&2
    echo "    Fix with: chmod 600 $CLAUDE_DEV_SSH_KEY" >&2
  fi
  SSH_MOUNT_ARGS=(-v "$CLAUDE_DEV_SSH_KEY":/home/dev/.ssh/id_ed25519:ro)
fi

docker run -it --rm \
  -v "$(pwd)":/workspace \
  -v "$VOLUME":/home/dev/.claude \
  "${SSH_MOUNT_ARGS[@]}" \
  -e GIT_USER_NAME="${GIT_USER_NAME:-claude}" \
  -e GIT_USER_EMAIL="${GIT_USER_EMAIL:-florin.diaconeasa@gmail.com}" \
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
