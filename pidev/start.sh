#!/usr/bin/env bash
set -euo pipefail

PIDFILE="/workspace/.dev-pids"
LOGDIR="/workspace/logs"
PG_CONF="/etc/postgresql/17/main/postgresql.conf"

mkdir -p "$LOGDIR"
rm -f "$PIDFILE"

# ── Ensure PostgreSQL listens on all interfaces ─────────────────────
if ! grep -q "^listen_addresses = '\*'" "$PG_CONF" 2>/dev/null; then
  sed -i "s/^#listen_addresses = .*/listen_addresses = '*'/" "$PG_CONF"
  sed -i "s/^listen_addresses = .*/listen_addresses = '*'/" "$PG_CONF"
  echo "✅ Updated PostgreSQL to listen on all interfaces"
fi

# ── Start PostgreSQL ────────────────────────────────────────────────
if pg_isready -q 2>/dev/null; then
  echo "⏭️  PostgreSQL is already running"
else
  echo "🐘 Starting PostgreSQL..."
  pg_ctlcluster 17 main start
  sleep 2
  echo "✅ PostgreSQL started on port 5432"
fi

# ── Ensure database & user exist ────────────────────────────────────
su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='trippy'\"" | grep -q 1 || \
  su - postgres -c "psql -c \"CREATE USER trippy WITH PASSWORD 'trippy';\""
su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='trippy'\"" | grep -q 1 || \
  su - postgres -c "psql -c \"CREATE DATABASE trippy OWNER trippy;\""

# ── Generate sources ────────────────────────────────────────────────
echo "🔧 Generating sources..."
cd /workspace/frontend && npm run generate:api -q 2>/dev/null
cd /workspace/backend && ./mvnw generate-sources -q 2>/dev/null
echo "✅ Sources generated"

# ── Start Backend ───────────────────────────────────────────────────
echo "🚀 Starting backend on :8080/api..."
cd /workspace/backend
SPRING_DATASOURCE_URL=jdbc:postgresql://localhost:5432/trippy \
SPRING_DATASOURCE_USERNAME=trippy \
SPRING_DATASOURCE_PASSWORD=trippy \
RESEND_API_KEY=test \
APP_BASE_URL=http://localhost:5173 \
./mvnw spring-boot:run > "$LOGDIR/backend.log" 2>&1 &
MAVEN_PID=$!
# Wait a moment for Java child to spawn, then grab it
sleep 2
BACKEND_PID=$(pgrep -P $MAVEN_PID -n 2>/dev/null || echo "$MAVEN_PID")
echo "$BACKEND_PID" > "$PIDFILE"
echo "   PID: $BACKEND_PID"

# Wait for backend to be ready
echo "⏳ Waiting for backend..."
for i in $(seq 1 30); do
  if curl -sf http://localhost:8080/api/actuator/health > /dev/null 2>&1 || curl -s http://localhost:8080/api/actuator/health > /dev/null 2>&1; then
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
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:8080/api"
echo "  Database:  localhost:5432  (user: trippy)"
echo "═══════════════════════════════════════════"
echo ""
echo "  Stop:  ./stop.sh"
echo "  Force: ./stop.sh --force"
echo "  Logs:  tail -f $LOGDIR/backend.log"
echo "         tail -f $LOGDIR/frontend.log"
echo ""
