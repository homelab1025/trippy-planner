#!/usr/bin/env bash
set -euo pipefail

# Postgres is started by entrypoint.sh at container boot; this script
# only owns the backend + frontend, run as the non-root "dev" user.

PIDFILE="/workspace/.dev-pids"
LOGDIR="/workspace/logs"

mkdir -p "$LOGDIR"
rm -f "$PIDFILE"

# ── Generate sources ────────────────────────────────────────────────
echo "🔧 Generating sources..."
cd /workspace/frontend && npm run generate:api -q 2>/dev/null
cd /workspace/backend && ./mvnw generate-sources -q 2>/dev/null
echo "✅ Sources generated"

# ── Start Backend ───────────────────────────────────────────────────
echo "🚀 Starting backend on :8080/api..."
cd /workspace/backend
./mvnw spring-boot:run -Dspring-boot.run.profiles=local > "$LOGDIR/backend.log" 2>&1 &
MAVEN_PID=$!

BACKEND_PID=""
for i in $(seq 1 20); do
  BACKEND_PID=$(pgrep -P "$MAVEN_PID" -n 2>/dev/null || true)
  [[ -n "$BACKEND_PID" ]] && break
  sleep 0.5
done
BACKEND_PID="${BACKEND_PID:-$MAVEN_PID}"
echo "$BACKEND_PID" > "$PIDFILE"
echo "   PID: $BACKEND_PID"

# Wait for backend to be ready
echo "⏳ Waiting for backend..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:8080/api/actuator/health > /dev/null 2>&1; then
    echo "✅ Backend is up"
    break
  fi
  sleep 1
done

# ── Start Frontend ──────────────────────────────────────────────────
echo "🌐 Starting frontend on :5173..."
cd /workspace/frontend
npm run dev -- --host 0.0.0.0 > "$LOGDIR/frontend.log" 2>&1 &
FRONTEND_PID=$!

NODE_PID=""
for i in $(seq 1 20); do
  NODE_PID=$(pgrep -P "$FRONTEND_PID" -n 2>/dev/null || true)
  [[ -n "$NODE_PID" ]] && break
  sleep 0.5
done
NODE_PID="${NODE_PID:-$FRONTEND_PID}"
echo "$NODE_PID" >> "$PIDFILE"
echo "   PID: $NODE_PID"

# ── Summary ─────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo "  🌍  Trippy Planner is running!"
echo "═══════════════════════════════════════════"
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:8080/api"
echo "  Database:  localhost:5432  (user: trippy, started at container boot)"
echo "═══════════════════════════════════════════"
echo ""
echo "  Stop:  ./stop.sh"
echo "  Force: ./stop.sh --force"
echo "  Logs:  tail -f $LOGDIR/backend.log"
echo "         tail -f $LOGDIR/frontend.log"
echo ""
