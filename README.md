# Neuro Recode WhatsApp

A **self-hosted, custom agent inbox** built on Meta's **WhatsApp Business Platform
(Cloud API)**. Customers message you from real WhatsApp; your agents work inside this
app. Not a third-party tool — we own the UI, the backend, and the data, running on our
own Hostinger VPS.

> **Status:** Phase 0 + Phase 1 (foundations, verified webhook, real-time agent inbox,
> inbound messages + agent replies within the 24h service window). Roadmap for media,
> templates/broadcasts, and voice calls is in `docs`/the plan.

## Architecture

| Layer | Tech |
|-------|------|
| Agent web app | Next.js + TypeScript + Tailwind + TanStack Query + Zustand |
| API / backend | NestJS + Socket.IO gateway |
| Real-time | Socket.IO + Redis adapter |
| Database | PostgreSQL + Prisma |
| Queue / cache | Redis + BullMQ |
| Media (later phases) | MinIO (S3-compatible) |
| Reverse proxy / TLS | Nginx + Let's Encrypt |

```
apps/web   → Next.js agent inbox
apps/api   → NestJS: WhatsApp webhooks, Graph API client, sockets, queues
packages/db     → Prisma schema + client (@nrw/db)
packages/shared → shared TS types & socket/WhatsApp contracts (@nrw/shared)
infra           → docker-compose + nginx
```

## How the WhatsApp integration works

1. A customer messages your WhatsApp Business number.
2. Meta sends a **webhook** POST to `/webhooks/whatsapp`. We verify the
   `X-Hub-Signature-256` against the App Secret, enqueue it (BullMQ), and ack `200`.
3. The worker upserts the contact + conversation, stores the message **idempotently**
   (dedup by `wamid`), and pushes it to agents over Socket.IO.
4. An agent replies in the UI → the API calls the Graph API
   `POST /{PHONE_NUMBER_ID}/messages` → status webhooks update the ticks.
5. Replies are only free-form inside the **24-hour service window**; outside it, an
   approved **template** is required (Templates phase).

## Prerequisites

- Node 20+ and pnpm 10+ (local dev) / Docker + Docker Compose (VPS).
- A fully set up Meta WhatsApp Business Account (WABA), a registered phone number, a
  permanent System-User access token, and your App ID/Secret.

## Configuration

```bash
cp .env.example .env
# Fill in the WHATSAPP_* values and change all the change-me secrets.
```

You choose `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; enter the same value in the Meta App
dashboard → WhatsApp → Configuration → Webhook.

## Run with Docker (recommended, mirrors the VPS)

```bash
cd infra
docker compose up -d --build
# API   → http://localhost:4000/health
# Web   → http://localhost:3000  (login with SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD)
```

The API container runs `prisma db push` on boot to create the schema, and the API seeds
the admin agent on first start.

## Run locally without Docker

```bash
pnpm install
pnpm db:generate
# point DATABASE_URL/REDIS_URL at local Postgres + Redis, then:
pnpm db:push
pnpm --filter @nrw/api dev      # http://localhost:4000
pnpm --filter @nrw/web dev      # http://localhost:3000
```

## Connect the Meta webhook

Meta must reach a **public HTTPS** URL. On the VPS, point your Hostinger domain
(e.g. `chat.neurorecode.com`) at the server, obtain TLS via certbot, then set the
callback URL to `https://<domain>/webhooks/whatsapp` and subscribe to the `messages`
field. For local development, expose port 4000 with a tunnel or use the WABA test number.

Verify the handshake succeeds (Meta shows **Verified**), send a message to your number,
and watch it appear live in the inbox.

## Tests

```bash
pnpm --filter @nrw/api test    # webhook signature scheme, etc.
```

## Roadmap (next phases)

2. Outbound + ticketing (assignment, tags, notes, canned responses) — partially in place.
3. Media & files (MinIO) — images, video, docs, voice notes.
4. Templates & broadcasts (BullMQ send engine, delivery reporting).
5. Voice calls (WhatsApp Business Calling API + coturn). *Video not yet offered by Meta.*
6. Hardening & ops (RBAC, backups, monitoring, CI, load testing).
