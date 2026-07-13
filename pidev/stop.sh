#!/usr/bin/env bash
set -uo pipefail

PIDFILE="/workspace/.dev-pids"
FORCE=0

if [[ "${1:-}" == "--force" ]]; then
  FORCE=1
fi

echo "🛑 Shutting down Trippy Planner..."
echo ""

# ── Helper: stop a PID tree gracefully or forcefully ────────────────
stop_tree() {
  local name="$1"
  local pid="$2"

  if ! kill -0 "$pid" 2>/dev/null; then
    echo "⏭️  $name (PID $pid) not running"
    return
  fi

  # Gather the entire process tree
  local tree
  tree=$(pgrep -P "$pid" -r 2>/dev/null || true)
  if [[ -n "$tree" ]]; then
    tree="$pid $tree"
  fi

  if [[ "$FORCE" -eq 1 ]]; then
    echo "💀 Killing $name (PID $pid)..."
    kill -9 $tree 2>/dev/null || true
    echo "✅ $name killed"
  else
    echo "🛑 Stopping $name (PID $pid)..."
    kill $tree 2>/dev/null || true
    # Wait up to 10 seconds
    for i in $(seq 1 10); do
      local alive=0
      for p in $tree; do
        if kill -0 "$p" 2>/dev/null; then
          alive=1
          break
        fi
      done
      [[ "$alive" -eq 0 ]] && break
      sleep 1
    done
    # Check if still alive
    local still_alive=0
    for p in $tree; do
      if kill -0 "$p" 2>/dev/null; then
        still_alive=1
        break
      fi
    done
    if [[ "$still_alive" -eq 1 ]]; then
      echo "⚠️  $name didn't stop gracefully, forcing..."
      kill -9 $tree 2>/dev/null || true
      echo "✅ $name killed"
    else
      echo "✅ $name stopped gracefully"
    fi
  fi
}

# ── Read PIDs ──────────────────────────────────────────────────────
if [[ -f "$PIDFILE" ]]; then
  BACKEND_PID=$(sed -n '1p' "$PIDFILE")
  FRONTEND_PID=$(sed -n '2p' "$PIDFILE")
else
  echo "⚠️  No PID file found at $PIDFILE"
  BACKEND_PID=""
  FRONTEND_PID=""
fi

# ── Stop Frontend ──────────────────────────────────────────────────
if [[ -n "$FRONTEND_PID" ]]; then
  stop_tree "Frontend" "$FRONTEND_PID"
fi

# ── Stop Backend ───────────────────────────────────────────────────
if [[ -n "$BACKEND_PID" ]]; then
  stop_tree "Backend" "$BACKEND_PID"
fi

# ── Stop PostgreSQL ────────────────────────────────────────────────
if service postgresql status > /dev/null 2>&1; then
  if [[ "$FORCE" -eq 1 ]]; then
    echo "💀 Stopping PostgreSQL (force)..."
    service postgresql stop || true
    if service postgresql status > /dev/null 2>&1; then
      pkill -9 -x postgres 2>/dev/null || true
    fi
  else
    echo "🛑 Stopping PostgreSQL..."
    service postgresql stop
  fi
  echo "✅ PostgreSQL stopped"
else
  echo "⏭️  PostgreSQL not running"
fi

# ── Cleanup ─────────────────────────────────────────────────────────
rm -f "$PIDFILE"
echo ""
echo "🧹 PID file cleaned up"
echo ""
echo "Done."
