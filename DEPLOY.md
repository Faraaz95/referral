# Deploying CraftFlow Referrals

Production: **https://referral.flexiflow.tech**, on the shared VPS next to CraftFlow / FindFlow / Timellio, fully separate.

```
Internet → Nginx Proxy Manager (TLS, shared edge) → referral-web (Next.js :3000)
                                                      │  /api
                                                      ▼
                                            referral-backend (gunicorn :8000) → referral-db (Postgres 16)
```

- Own compose project `referral`, own network `referral`, own volume `referral_pgdata`, container names `referral-*`.
  Nothing is published on host ports; CPU/memory limits on every container.
- NPM is attached to the `referral` network so it can forward to `referral-web` by name.
- On start the backend runs migrations and `ensure_admin` (creates the first admin from `ADMIN_EMAIL` /
  `ADMIN_PASSWORD` in `.env`, only if no admin exists yet).

## CI/CD

`.github/workflows/deploy.yml` — on every push to `main`:
1. **check** – Django check, missing-migration check, migrate + tests on a test DB, frontend typecheck.
2. **build** – builds both images and pushes them to GHCR (`ghcr.io/faraaz95/referral-backend|frontend:<sha>`).
3. **deploy** – copies `deploy/` to `/home/deploy/referral` on the VPS and runs `deploy/deploy.sh`.

Repo secrets: `SSH_HOST`, `SSH_USER` (`deploy`), `SSH_KEY` (private key; public half in `deploy`'s
`~/.ssh/authorized_keys`), optional `GHCR_USER` / `GHCR_TOKEN`. Key on this Mac: `~/.ssh/id_referral_vps`.

## Server setup

```bash
mkdir -p ~/referral/deploy
cp ~/referral/deploy/.env.example ~/referral/deploy/.env && chmod 600 ~/referral/deploy/.env   # fill in secrets
```

NPM → Proxy Hosts → `referral.flexiflow.tech` → `referral-web` port `3000`, Block Common Exploits, Websockets;
SSL: Let's Encrypt, Force SSL, HTTP/2. DNS (Hostinger): `A referral → <server-ip>`.

## Ops

```bash
cd ~/referral/deploy
docker compose ps
docker compose logs -f backend
docker exec -it referral-backend python manage.py createsuperuser
docker exec referral-db pg_dump -U referral -Fc referral > ~/referral-$(date +%F).dump   # backup
```

Rollback: `BACKEND_IMAGE=ghcr.io/faraaz95/referral-backend:<sha> FRONTEND_IMAGE=ghcr.io/faraaz95/referral-frontend:<sha> ./deploy.sh`
