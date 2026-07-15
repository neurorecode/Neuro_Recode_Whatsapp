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

## Troubleshooting

- **Webhook won't verify (Meta shows an error):**
  - `curl "https://chat.neurorecode.com/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=YOUR_TOKEN&hub.challenge=123"` should return `123`.
  - Token mismatch is the usual cause — the `.env` value and the Meta field must match exactly. After editing `.env`, `docker compose up -d` to reload the API.
- **TLS/cert errors:** confirm `dig +short DOMAIN` shows the VPS IP, ports 80/443 are open, then re-run `./init-letsencrypt.sh`.
- **Messages arrive but nothing shows live:** check `docker compose logs api` for signature failures (`Invalid webhook signature`) — means `WHATSAPP_APP_SECRET` is wrong.
- **Reply fails with "24-hour service window closed":** expected — you can only free-text a customer within 24h of their last message. Templates come in a later phase.
- **Restart everything:** `docker compose down && docker compose up -d --build`.
- **Certs auto-renew** via the `certbot` container; nginx reloads every 6h to pick them up. No action needed.
