# Deploy to Railway

This app is set up for **Railway**: Next.js web service + managed Postgres + a volume for uploaded floor plans.

## 1. Put the code on GitHub

If you haven’t already:

1. Create a new empty GitHub repo (e.g. `rpl-10x-tracker`)
2. From this project folder:

```bash
git add .
git commit -m "Initial RPL-10X tracker with Railway deploy config"
git branch -M main
git remote add origin https://github.com/YOUR_USER/rpl-10x-tracker.git
git push -u origin main
```

## 2. Create the Railway project

1. Go to [railway.app](https://railway.app) and sign in (GitHub login is easiest)
2. **New Project** → **Deploy from GitHub repo** → select `rpl-10x-tracker`
3. Railway will detect the `Dockerfile` and start a first build (it may fail until env vars / DB exist — that’s OK)

## 3. Add PostgreSQL

1. In the project canvas: **+ New** → **Database** → **PostgreSQL**
2. Open your **web service** → **Variables**
3. Add a **Variable Reference**:
   - Name: `DATABASE_URL`
   - Value: `${{Postgres.DATABASE_URL}}`  
     (pick the Postgres service’s `DATABASE_URL` from the UI)

## 4. Add a volume for uploads (required)

Floor plan files must survive redeploys.

1. Open the **web service** → **Settings** → **Volumes** → **Add Volume**
2. Mount path: `/app/uploads`
3. Also set variable: `UPLOAD_DIR=/app/uploads`

## 5. Set the remaining environment variables

On the **web service** → **Variables**:

| Variable | Example / notes |
|---|---|
| `DATABASE_URL` | Reference from Postgres (step 3) |
| `UPLOAD_DIR` | `/app/uploads` |
| `SESSION_SECRET` | Long random string, ≥32 characters |
| `ADMIN_EMAIL` | Your real email (first admin login) |
| `ADMIN_PASSWORD` | Strong password — change after first login |
| `ADMIN_NAME` | Your name |
| `NODE_ENV` | `production` |

Generate a session secret (PowerShell):

```powershell
-join ((48..57 + 65..90 + 97..122) | Get-Random -Count 48 | ForEach-Object { [char]$_ })
```

## 6. Public URL

1. Web service → **Settings** → **Networking** → **Generate Domain**
2. You’ll get something like `https://rpl-10x-tracker-production.up.railway.app`
3. Share that URL with the team (they still need login accounts you create)

## 7. Seed the admin user (one time)

After the first successful deploy (migrations run automatically on boot):

**Option A — Railway CLI**

```bash
npm i -g @railway/cli
railway login
railway link
railway run npm run db:seed
```

**Option B — one-off from your PC**

Copy the **public** Postgres URL from Railway Postgres → Variables, then:

```powershell
$env:DATABASE_URL="postgresql://...@....railway.app:5432/railway"
npm run db:seed
```

Then open the site and sign in with `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

## 8. Create teammate accounts

Signed in as ADMIN → **Users** → add EDITOR / VIEWER accounts.  
Do **not** share the admin password.

## Accessing the database

| Method | How |
|---|---|
| Railway dashboard | Postgres service → **Data** / **Query** |
| Prisma Studio (local) | Set `DATABASE_URL` to Railway’s URL, run `npx prisma studio` |
| DBeaver / TablePlus | Host/user/password from Postgres service variables |

Use the **public** URL when connecting from your laptop; the app itself should keep using the private `${{Postgres.DATABASE_URL}}` reference.

## Updating the site

Push to `main` on GitHub → Railway redeploys automatically.  
Migrations apply on container start. Uploaded files stay on the volume.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build OK, crash on start | Check `DATABASE_URL` is set / referenced |
| Login works, uploads vanish | Volume not mounted at `/app/uploads` |
| 502 / healthcheck fail | Open deploy logs; confirm `/login` returns 200 |
| Can’t seed | `ADMIN_EMAIL` + `ADMIN_PASSWORD` must be set in the env you seed against |

## Cost note

Railway’s Hobby plan is enough to try with a small team. For always-on / more usage, upgrade when needed.
