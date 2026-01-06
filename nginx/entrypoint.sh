#!/bin/sh
# Entrypoint script for nginx container in pasta network
# Resolves the pasta gateway IP and sets environment variables

set -e

echo "[Entrypoint] Starting nginx with pasta gateway resolution..."

# Get the pasta gateway IP (host IP)
GATEWAY_IP=$(ip route show default | awk '{print $3; exit}')

if [ -z "$GATEWAY_IP" ]; then
    echo "[ERROR] Failed to resolve gateway IP"
    exit 1
fi

echo "[Info] Detected pasta gateway IP: $GATEWAY_IP"

# Set environment variables for nginx template substitution
export PROXY_UPSTREAM_HOST="${PROXY_UPSTREAM_HOST:-$GATEWAY_IP}"
export PROXY_UPSTREAM_PORT="${PROXY_UPSTREAM_PORT:-8317}"

echo "[Info] Using upstream: $PROXY_UPSTREAM_HOST:$PROXY_UPSTREAM_PORT"

# Process nginx config template if it exists
if [ -f /etc/nginx/conf.d/default.conf.template ]; then
    echo "[Info] Processing nginx template..."
    envsubst '${PROXY_UPSTREAM_HOST} ${PROXY_UPSTREAM_PORT} ${PROXY_PASSWORD}' \
        < /etc/nginx/conf.d/default.conf.template \
        > /etc/nginx/conf.d/default.conf
    echo "[Info] Template processed successfully"
fi

# Test nginx configuration
nginx -t

# Start nginx
echo "[Info] Starting nginx..."
exec nginx -g 'daemon off;'
