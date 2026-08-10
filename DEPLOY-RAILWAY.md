# Deploy to Railway (demo URL that stays online)

Use this when you need a **public link** that works with your laptop off.  
Floor plans are **bundled SVGs** in `/plans` and seeded into the DB (no upload UI).

## 1. Code on GitHub

Repo: `https://github.com/shreyasbp317/Turner-synoptic-panel-tracker`  
Push `main` after local changes.

## 2. Create the Railway project

1. Open [railway.app](https://railway.app) → sign in with GitHub  
2. **New Project** → **Deploy from GitHub repo** → `Turner-synoptic-panel-tracker`  
3. First build may fail until Postgres + env vars exist — OK  

## 3. Add PostgreSQL

1. **+ New** → **Database** → **PostgreSQL**  
2. Web service → **Variables** → add:  
   - `DATABASE_URL` = `${{Postgres.DATABASE_URL}}`

## 4. Environment variables

Web service → **Variables**:

| Variable | Value |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` |
| `STORAGE_DRIVER` | `postgres` |
| `SESSION_SECRET` | Random ≥32 chars |
| `ADMIN_EMAIL` | Your login email |
| `ADMIN_PASSWORD` | Strong password |
| `ADMIN_NAME` | Your name |
| `NODE_ENV` | `production` |

`STORAGE_DRIVER=postgres` stores SVG bytes in the DB — no volume needed for the demo.

PowerShell secret:

```powershell
-join ((48..57 + 65..90 + 97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
```

Redeploy after saving variables.

## 5. Public URL

Web service → **Settings** → **Networking** → **Generate Domain**  
Share `https://….up.railway.app` (login required).

## 6. Seed admin + RPL 3 plans (one time, from your PC)

Copy the **public** Postgres URL from Railway Postgres → Variables:

```powershell
cd "C:\Users\shreyas bp\Projects\rpl-10x-tracker"
$env:DATABASE_URL="postgresql://...public-host.../railway"
$env:STORAGE_DRIVER="postgres"
npm run db:seed
npm run db:seed-plans
```

Then open the site → log in → **RPL 3** → Floor plan dropdown.

## 7. Teammate accounts

**Users** → add accounts. Do not share the admin password.

## Updating

Push to `main` → Railway redeploys. Migrations run on boot.

Add more buildings later: drop SVGs in `plans/…`, extend `scripts/seed-plans.ts`, push, re-run `npm run db:seed-plans` with Railway’s public `DATABASE_URL` + `STORAGE_DRIVER=postgres`.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Crash on start | `DATABASE_URL` not set / not referenced |
| Login fails | Re-run `db:seed` with correct `ADMIN_*` on Railway DB |
| Empty dropdown | Run `db:seed-plans` against Railway DB |
| Blank plan | Confirm `STORAGE_DRIVER=postgres` on the web service **and** when seeding |
| 502 | Check deploy logs |

## Cost

Trial credits for a short demo; Hobby (~$5/mo) to keep always-on.
