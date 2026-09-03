#!/bin/sh
set -eu

# Ensure persistent directories exist on the mounted volume (API creates files on demand,
# but empty volume mounts should still have a predictable layout).
mkdir -p \
  "${ARRIVAL_ATLAS_STATE_DIR:-/data/state}" \
  "${ARRIVAL_ATLAS_ACCOUNTS_DIR:-/data/accounts}" \
  "${ARRIVAL_ATLAS_SESSIONS_DIR:-/data/sessions}" \
  "${ARRIVAL_ATLAS_ENTITLEMENTS_DIR:-/data/entitlements}"

cd /app/apps/api
exec "$@"
