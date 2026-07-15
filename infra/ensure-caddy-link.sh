#!/bin/sh
# Ensures the front-proxy Caddy container is attached to our docker network so
# it can route to nrw-web / nrw-api. Idempotent — safe to run on a timer, and a
# no-op if already connected. Run periodically so the link survives a restart of
# the Caddy/other-app stack.
#
#   ./ensure-caddy-link.sh
#
# Env overrides:
#   NRW_NETWORK       our compose network (default infra_default)
#   CADDY_CONTAINER   the Caddy container name (default neu-ai-web-1)
NETWORK="${NRW_NETWORK:-infra_default}"
CADDY="${CADDY_CONTAINER:-neu-ai-web-1}"

# Only attempt if both the network and the Caddy container exist.
if docker network inspect "$NETWORK" >/dev/null 2>&1 && docker inspect "$CADDY" >/dev/null 2>&1; then
  docker network connect "$NETWORK" "$CADDY" 2>/dev/null && echo "connected $CADDY -> $NETWORK" || true
fi
