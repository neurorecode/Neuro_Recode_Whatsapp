#!/bin/sh
# One-time Let's Encrypt bootstrap for Neuro Recode WhatsApp.
# Run this ONCE on the VPS after DNS points at the server and .env is filled in.
# It issues the TLS cert so Meta can reach the webhook over HTTPS.
#
#   cd infra && ./init-letsencrypt.sh
#
# Set STAGING=1 to test against Let's Encrypt's staging CA first (avoids rate
# limits while you shake out DNS): STAGING=1 ./init-letsencrypt.sh
set -e
cd "$(dirname "$0")"

# Read a single var from ../.env WITHOUT executing the file (values may contain
# spaces, e.g. SEED_ADMIN_NAME="Neuro Recode Admin", which `.`-sourcing breaks on).
read_env() {
  grep -E "^$1=" ../.env 2>/dev/null | tail -1 | cut -d= -f2- \
    | sed -e 's/\r$//' -e 's/^["'\'']//' -e 's/["'\'']$//'
}

DOMAIN="${DOMAIN:-$(read_env DOMAIN)}"
CERTBOT_EMAIL="${CERTBOT_EMAIL:-$(read_env CERTBOT_EMAIL)}"

: "${DOMAIN:?Set DOMAIN in .env (e.g. whatsappchat.neurorecode.in)}"
: "${CERTBOT_EMAIL:?Set CERTBOT_EMAIL in .env}"

# docker compose auto-loads .env from the current directory (infra/), but the
# project .env lives at the repo root. Link it here so ${VAR} interpolation in
# docker-compose.yml resolves for every compose command (script + manual).
if [ ! -e .env ] && [ -f ../.env ]; then
  ln -s ../.env .env
  echo "### Linked ../.env -> infra/.env for docker compose"
fi

data_path="./data/certbot"
staging="${STAGING:-0}"

echo "### Domain: $DOMAIN   Email: $CERTBOT_EMAIL   Staging: $staging"
mkdir -p "$data_path/conf/live/$DOMAIN" "$data_path/www"

echo "### 1/5 Creating a temporary self-signed certificate so nginx can start ..."
docker compose run --rm --entrypoint "\
  openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
    -keyout /etc/letsencrypt/live/$DOMAIN/privkey.pem \
    -out /etc/letsencrypt/live/$DOMAIN/fullchain.pem \
    -subj /CN=localhost" certbot

echo "### 2/5 Starting nginx ..."
docker compose up -d --no-deps nginx

echo "### 3/5 Removing the temporary certificate ..."
docker compose run --rm --entrypoint "\
  sh -c 'rm -rf /etc/letsencrypt/live/$DOMAIN /etc/letsencrypt/archive/$DOMAIN /etc/letsencrypt/renewal/$DOMAIN.conf'" certbot

staging_arg=""
if [ "$staging" != "0" ]; then staging_arg="--staging"; fi

echo "### 4/5 Requesting the real Let's Encrypt certificate ..."
docker compose run --rm --entrypoint "\
  certbot certonly --webroot -w /var/www/certbot $staging_arg \
    --email $CERTBOT_EMAIL -d $DOMAIN \
    --rsa-key-size 4096 --agree-tos --no-eff-email --force-renewal" certbot

echo "### 5/5 Reloading nginx with the new certificate ..."
docker compose exec nginx nginx -s reload

echo ""
echo "### Done. TLS is live: https://$DOMAIN"
echo "### Next: docker compose up -d --build   (brings up api + web + db + redis + minio)"
