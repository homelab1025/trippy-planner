#!/usr/bin/env bash
set -euo pipefail

# ── Runs as root for exactly this one-shot bootstrap, then execs into
#    the "dev" user for the rest of the container's life (see the final
#    `exec gosu`). No root process lingers after this script returns. ──

PG_CONF="$(find /etc/postgresql -maxdepth 3 -name postgresql.conf | head -n1)"
if [[ -z "$PG_CONF" ]]; then
  echo "❌ Could not locate postgresql.conf" >&2
  exit 1
fi

# ── Alias "postgres" to localhost, matching the docker-compose service
#    name, so application-local.properties resolves the same hostname
#    under both claude-dev and `make dev` ───────────────────────────────
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

# ── Git identity for commits made inside the container ─────────────
# The SSH key itself needs no setup here - run.sh bind-mounts it
# directly at /home/dev/.ssh/id_ed25519 with the right perms already.
if [[ -n "${GIT_USER_NAME:-}" ]]; then
  gosu dev git config --global user.name "$GIT_USER_NAME"
fi
if [[ -n "${GIT_USER_EMAIL:-}" ]]; then
  gosu dev git config --global user.email "$GIT_USER_EMAIL"
fi

echo "🔐 Dropping to non-root user 'dev'..."
exec gosu dev "$@"
