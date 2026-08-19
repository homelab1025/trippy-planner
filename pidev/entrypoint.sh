#!/usr/bin/env bash
set -euo pipefail

# ── Bootstraps PostgreSQL before handing off to the container's main
#    process (the "pi" agent). Runs as root throughout — unlike
#    claude-dev's entrypoint, there's no privilege drop here, since pidev
#    needs root for the mounted docker socket / podman toolchain. ───────

PG_CONF="$(find /etc/postgresql -maxdepth 3 -name postgresql.conf | head -n1)"
if [[ -z "$PG_CONF" ]]; then
  echo "❌ Could not locate postgresql.conf" >&2
  exit 1
fi

# ── Alias "postgres" to localhost, matching the docker-compose service
#    name, so application-local.properties resolves the same hostname
#    under both pidev and `make dev` ───────────────────────────────────
if ! grep -q "[[:space:]]postgres$" /etc/hosts 2>/dev/null; then
  echo "127.0.0.1 postgres" >> /etc/hosts
  echo "✅ Aliased 'postgres' to 127.0.0.1 in /etc/hosts"
fi

# ── Ensure PostgreSQL listens on all interfaces ─────────────────────
if ! grep -q "^listen_addresses = '\*'" "$PG_CONF" 2>/dev/null; then
  sed -i "s/^#\?listen_addresses = .*/listen_addresses = '*'/" "$PG_CONF"
  echo "✅ Updated PostgreSQL to listen on all interfaces"
fi

# ── Start PostgreSQL ────────────────────────────────────────────────
echo "🐘 Starting PostgreSQL..."
service postgresql start
for i in $(seq 1 30); do
  pg_isready -q && break
  sleep 1
done
echo "✅ PostgreSQL started on port 5432"

# ── Ensure database & user exist ────────────────────────────────────
su - postgres -c "psql -tc \"SELECT 1 FROM pg_roles WHERE rolname='trippy'\"" | grep -q 1 || \
  su - postgres -c "psql -c \"CREATE USER trippy WITH PASSWORD 'trippy';\""
su - postgres -c "psql -tc \"SELECT 1 FROM pg_database WHERE datname='trippy'\"" | grep -q 1 || \
  su - postgres -c "psql -c \"CREATE DATABASE trippy OWNER trippy;\""

exec "$@"
