#!/usr/bin/env bash
set -euo pipefail

PIDFILE="/workspace/.dev-pids"
LOGDIR="/workspace/logs"

mkdir -p "$LOGDIR"
rm -f "$PIDFILE"

# PostgreSQL is started by entrypoint.sh at container boot; this script
# only owns the backend + frontend.

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
# Wait a moment for Java child to spawn, then grab it
sleep 2
BACKEND_PID=$(pgrep -P $MAVEN_PID -n 2>/dev/null || echo "$MAVEN_PID")
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
# Grab the actual node process
sleep 2
NODE_PID=$(pgrep -P $FRONTEND_PID -n 2>/dev/null || echo "$FRONTEND_PID")
echo "$NODE_PID" >> "$PIDFILE"
echo "   PID: $NODE_PID"

# ── Summary ─────────────────────────────────────────────────────────
echo ""
echo "═══════════════════════════════════════════"
echo "  🌍  Trippy Planner is running!"
echo "═══════════════════════════════════════════"
echo "  Frontend:  http://localhost:${HOST_FRONTEND_PORT:-5173}"
echo "  Backend:   http://localhost:${HOST_BACKEND_PORT:-8080}/api"
echo "  Database:  localhost:${HOST_DB_PORT:-5432}  (user: trippy, started at container boot)"
echo "═══════════════════════════════════════════"
echo ""
echo "  Stop:  ./stop.sh"
echo "  Force: ./stop.sh --force"
echo "  Logs:  tail -f $LOGDIR/backend.log"
echo "         tail -f $LOGDIR/frontend.log"
echo ""
