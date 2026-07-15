# Operations — backups, uptime, and the Caddy link

Run these once on the VPS after `git pull`. Paths assume the repo at
`/opt/neuro-recode-whatsapp`.

## 1. Automated backups (Postgres + MinIO media)

`infra/backup.sh` dumps the database and archives the media volume to
`/opt/nrw-backups` (14-day retention). Test it once:

```bash
cd /opt/neuro-recode-whatsapp/infra
chmod +x backup.sh
./backup.sh          # creates db-*.sql.gz and minio-*.tgz
```

Schedule it daily with the systemd timer (fires 02:30 daily):

```bash
sudo cp infra/systemd/nrw-backup.service infra/systemd/nrw-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nrw-backup.timer
systemctl list-timers nrw-backup.timer      # confirm it's scheduled
```

*(Cron alternative:* `30 2 * * * /opt/neuro-recode-whatsapp/infra/backup.sh >> /var/log/nrw-backup.log 2>&1`*)*

**Off-site copy (recommended):** periodically copy `/opt/nrw-backups` to another
machine or object storage (e.g. `rsync`/`rclone`) — a backup on the same VPS
doesn't protect against losing the VPS.

### Restore
```bash
# Database:
gunzip -c /opt/nrw-backups/db-YYYYMMDD-HHMMSS.sql.gz \
  | docker exec -i infra-postgres-1 psql -U nrw -d nrw

# Media (stop the stack first to avoid writes):
docker run --rm -v infra_miniodata:/data -v /opt/nrw-backups:/backup \
  alpine sh -c "rm -rf /data/* && tar xzf /backup/minio-YYYYMMDD-HHMMSS.tgz -C /data"
```

## 2. Keep the Caddy link alive

Our containers publish no host ports; the front-proxy Caddy reaches them over a
shared docker network. That link is lost if the Caddy/other-app stack is
recreated. `infra/ensure-caddy-link.sh` re-attaches it (idempotent). Install the
timer so it self-heals within a minute:

```bash
cd /opt/neuro-recode-whatsapp/infra
chmod +x ensure-caddy-link.sh
sudo cp infra/systemd/nrw-caddy-link.service infra/systemd/nrw-caddy-link.timer /etc/systemd/system/ 2>/dev/null || \
  sudo cp systemd/nrw-caddy-link.service systemd/nrw-caddy-link.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now nrw-caddy-link.timer
```

If your Caddy container isn't `neu-ai-web-1`, edit the `CADDY_CONTAINER` value at
the top of `ensure-caddy-link.sh` (or set it in the service file).

## 3. Health monitoring

The `api` and `web` containers now have Docker healthchecks. Check status:

```bash
cd /opt/neuro-recode-whatsapp/infra
docker compose -f docker-compose.yml -f docker-compose.caddy.yml ps
# STATUS shows "healthy" / "unhealthy"
```

For an external heartbeat, point an uptime monitor (e.g. UptimeRobot) at
`https://whatsappchat.neurorecode.in/health` — it returns `{"status":"ok",...}`.

Tail logs when something looks off:
```bash
docker compose -f docker-compose.yml -f docker-compose.caddy.yml logs -f api
```
