# Deploying to the Hostinger VPS + getting the webhook Verified

This walks you from a fresh VPS to a live HTTPS inbox with Meta's webhook showing
**Verified**. Estimated time: ~30–45 min (mostly waiting on DNS + image builds).

You will need:
- SSH access to the Hostinger VPS and its **public IP**.
- A domain or subdomain you control (e.g. `chat.neurorecode.com`).
- Your Meta values: access token, phone number ID, WABA ID, App ID, App Secret.

---

## Step 1 — Point your domain at the VPS (do this first; DNS needs time)

In your DNS provider (Hostinger hPanel → Domains → DNS, or wherever the domain
lives), add an **A record**:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | `chat` (for `chat.neurorecode.com`) | your VPS public IP | default |

Verify from your laptop (may take a few minutes to propagate):
```bash
dig +short chat.neurorecode.com    # should print your VPS IP
```
Don't run the TLS step until this returns the right IP.

## Step 2 — SSH in and install Docker

```bash
ssh root@YOUR_VPS_IP

# Install Docker Engine + Compose plugin (Ubuntu/Debian; Hostinger default)
curl -fsSL https://get.docker.com | sh
docker --version && docker compose version   # confirm both work
```

## Step 3 — Open the firewall

The stack needs ports 80 and 443. If `ufw` is active:
```bash
ufw allow 80/tcp
ufw allow 443/tcp
ufw reload   # (only if ufw is enabled; otherwise skip)
```
Also confirm Hostinger's panel firewall (if you enabled one) allows 80/443.

## Step 4 — Get the code

```bash
cd /opt
git clone <YOUR_REPO_URL> neuro-recode-whatsapp
cd neuro-recode-whatsapp
git checkout claude/neuro-recode-whatsapp-clone-nuzkex
```

## Step 5 — Configure environment

```bash
cp .env.example .env
nano .env
```
Fill in / change **all** of these:
- `DOMAIN=chat.neurorecode.com` and `CERTBOT_EMAIL=you@neurorecode.com`
- Set the three public URLs to HTTPS:
  - `API_PUBLIC_URL=https://chat.neurorecode.com`
  - `WEB_PUBLIC_URL=https://chat.neurorecode.com`
  - `CORS_ORIGINS=https://chat.neurorecode.com`
- Replace every `change-me…` secret (`POSTGRES_PASSWORD`, `JWT_SECRET`,
  `MINIO_ROOT_PASSWORD`, `SEED_ADMIN_PASSWORD`).
- Set `SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD` — this is your inbox login.
- Choose a `WHATSAPP_WEBHOOK_VERIFY_TOKEN` (any random string — you'll paste the
  same value into Meta in Step 8).
- Paste the Meta credentials: `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`,
  `WHATSAPP_BUSINESS_ACCOUNT_ID`, `WHATSAPP_APP_ID`, `WHATSAPP_APP_SECRET`.

Generate strong secrets quickly:
```bash
openssl rand -hex 32   # run once per secret
```

## Step 6 — Issue the TLS certificate (one command)

```bash
cd infra
./init-letsencrypt.sh
```
This starts nginx and obtains a real Let's Encrypt cert for your domain.
If you want to rehearse without hitting rate limits first:
```bash
STAGING=1 ./init-letsencrypt.sh   # then re-run without STAGING for the real cert
```
Success ends with: `Done. TLS is live: https://chat.neurorecode.com`.

## Step 7 — Build and start the whole stack

The project `.env` lives at the repo root, but `docker compose` reads `.env` from
the folder you run it in (`infra/`). `init-letsencrypt.sh` creates a symlink
(`infra/.env → ../.env`) so interpolation works. If you skipped the TLS step, make
the link yourself first:
```bash
cd /opt/neuro-recode-whatsapp/infra
[ -e .env ] || ln -s ../.env .env
```

```bash
# still in infra/
docker compose up -d --build
docker compose ps           # all services should be "running"/"healthy"
```
Smoke-check from your laptop:
```bash
curl https://chat.neurorecode.com/health
# {"status":"ok","service":"nrw-api",...}
```
Open `https://chat.neurorecode.com` and log in with your
`SEED_ADMIN_EMAIL` / `SEED_ADMIN_PASSWORD`.

## Step 8 — Configure the webhook in Meta (get Verified)

1. Go to **developers.facebook.com** → your App → **WhatsApp → Configuration**.
2. Under **Webhook**, click **Edit**:
   - **Callback URL:** `https://chat.neurorecode.com/webhooks/whatsapp`
   - **Verify token:** the exact `WHATSAPP_WEBHOOK_VERIFY_TOKEN` from your `.env`.
3. Click **Verify and save**. Meta sends a GET to your server; it should flip to
   **✅ Verified** immediately.
4. Under **Webhook fields**, click **Manage** and **Subscribe** to `messages`.

Watch the server confirm it:
```bash
docker compose logs -f api | grep -i webhook
# "Webhook verified by Meta"
```

## Step 9 — End-to-end test

From a personal phone, send a WhatsApp message to your business number. Within a
second it should appear in the inbox at `https://chat.neurorecode.com`. Reply from
the inbox — it lands back on the phone, and the ticks update (✓ → ✓✓).

```bash
docker compose logs -f api    # watch inbound events + sends in real time
```

---

## Alternative: deploy behind an existing Traefik (e.g. alongside Frappe)

If the VPS already runs Traefik on 80/443 (Frappe's `frappe_docker-proxy`), do **not**
run our nginx/certbot — Traefik owns the ports and issues TLS. Skip Step 6 entirely.

1. In `.env`, set the three URLs to `https://<your-domain>` (as in Step 5).
2. Make sure `infra/.env` exists: `cd infra && [ -e .env ] || ln -s ../.env .env`
3. Bring the stack up with the Traefik overlay (nginx/certbot stay off by default):
   ```bash
   docker compose -f docker-compose.yml -f docker-compose.traefik.yml up -d --build
   ```
   This joins our `web`/`api` to Traefik's network (`frappe_docker_default`) and adds
   routing labels for your domain, with TLS via Traefik's `main-resolver`.
4. Give Traefik ~30–60s to obtain the cert, then: `curl https://<your-domain>/health`.

The overlay assumes Traefik entrypoint `websecure`, certresolver `main-resolver`, and
network `frappe_docker_default`. If yours differ, edit `docker-compose.traefik.yml`
(the `traefik.*` labels and the `edge` network name). Continue at **Step 8** to wire the
Meta webhook.

## Alternative: deploy behind an existing Caddy (static Caddyfile)

If the VPS already runs Caddy on 80/443 (front proxy for another app), ride it —
our stack publishes no host ports. Skip Step 6.

1. Point DNS: `whatsappchat.neurorecode.in` A record → **this** VPS's public IP
   (`curl -4 ifconfig.me`). Confirm with `dig +short whatsappchat.neurorecode.in`.
2. In `.env`, set the three URLs to `https://<domain>`; ensure `infra/.env` symlink exists.
3. Start our stack (no proxy, no host ports; containers named `nrw-web` / `nrw-api`):
   ```bash
   cd infra
   docker compose -f docker-compose.yml -f docker-compose.caddy.yml up -d --build
   ```
4. Connect the Caddy container to our network so it can resolve our containers
   (replace `neu-ai-web-1` with your Caddy container name):
   ```bash
   docker network connect infra_default neu-ai-web-1
   ```
5. Append `infra/caddy/whatsappchat.Caddyfile` to the host Caddyfile
   (find it via `docker inspect <caddy> --format '{{json .Mounts}}'`), then reload:
   ```bash
   docker exec neu-ai-web-1 caddy reload --config /etc/caddy/Caddyfile --adapter caddyfile
   ```
   Caddy obtains the TLS cert automatically. Then `curl https://<domain>/health`.

Note: the `docker network connect` is lost if the Caddy stack is recreated. To make
it permanent, add our network to that stack's compose (or a shared external network).
Continue at **Step 8** for the Meta webhook.

## Troubleshooting

- **Webhook won't verify (Meta shows an error):**
  - `curl "https://chat.neurorecode.com/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=123"` should return `123`.
  - Token mismatch is the usual cause — the `.env` value and the Meta field must match exactly. After editing `.env`, `docker compose up -d` to reload the API.
- **TLS/cert errors:** confirm `dig +short DOMAIN` shows the VPS IP, ports 80/443 are open, then re-run `./init-letsencrypt.sh`.
- **Messages arrive but nothing shows live:** check `docker compose logs api` for signature failures (`Invalid webhook signature`) — means `WHATSAPP_APP_SECRET` is wrong.
- **Reply fails with "24-hour service window closed":** expected — you can only free-text a customer within 24h of their last message. Templates come in a later phase.
- **`variable is not set` warnings / blank config:** `docker compose` isn't seeing the root `.env`. Ensure `infra/.env` exists (symlink to `../.env`) and run compose from `infra/`.
- **`Bind for 0.0.0.0:80 failed: port is already allocated`:** something else holds port 80/443. Find it with `ss -tlnp | grep -E ':80|:443'`. If it's a host web server: `systemctl stop apache2 nginx 2>/dev/null; systemctl disable apache2 nginx 2>/dev/null`. If it's a leftover container: `docker compose down` (from `infra/`), then retry.
- **Restart everything:** `docker compose down && docker compose up -d --build`.
- **Certs auto-renew** via the `certbot` container; nginx reloads every 6h to pick them up. No action needed.
