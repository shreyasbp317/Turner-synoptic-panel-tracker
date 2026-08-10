# Temporary Vercel demo (for sharing with colleagues)

This is the fastest way to put a public URL in front of teammates.
For long-term / free-forever hosting, prefer **Oracle Always Free** (`DEPLOY-ORACLE.md`).

## Limits to know

- Vercel Functions reject request bodies over **4.5 MB**.
- Your Synoptic `.jsvg` files are often larger — this project uploads them via **Vercel Blob** (client → Blob → server), so large plans still work.
- Free Neon Postgres is fine for a demo.

## 1. Create a free Neon database

1. Go to [neon.tech](https://neon.tech) → create project  
2. Copy the connection string (`postgresql://...?...sslmode=require`)

## 2. Import the GitHub repo on Vercel

1. [vercel.com](https://vercel.com) → **Add New Project**  
2. Import `shreyasbp317/Turner-synoptic-panel-tracker`  
3. Framework: Next.js (auto)

## 3. Enable Vercel Blob

1. In the Vercel project → **Storage** → **Create** → **Blob**  
2. Connect it to the project (this sets `BLOB_READ_WRITE_TOKEN`)

## 4. Set environment variables

In Vercel → Project → **Settings** → **Environment Variables** (Production + Preview):

| Name | Value |
|---|---|
| `DATABASE_URL` | Neon connection string |
| `SESSION_SECRET` | long random string (≥32 chars) |
| `ADMIN_EMAIL` | `shreyasbp317@gmail.com` |
| `ADMIN_PASSWORD` | your password |
| `ADMIN_NAME` | `Shreyas BP` |
| `STORAGE_DRIVER` | `blob` |
| `NEXT_PUBLIC_USE_BLOB_UPLOAD` | `1` |
| `BLOB_READ_WRITE_TOKEN` | (usually auto-set by Blob store) |

## 5. Deploy

Click **Deploy**. After the first successful deploy:

### Run migrations + seed (one time)

From your laptop (in the project folder):

```powershell
$env:DATABASE_URL="postgresql://...neon.../neondb?sslmode=require"
npx prisma migrate deploy
$env:ADMIN_EMAIL="shreyasbp317@gmail.com"
$env:ADMIN_PASSWORD="shreyas@317"
$env:ADMIN_NAME="Shreyas BP"
npm run db:seed
```

Or use Neon’s SQL editor only for schema if needed — prefer `prisma migrate deploy`.

## 6. Share the URL

Vercel gives you something like:

`https://turner-synoptic-panel-tracker.vercel.app`

Log in with your admin email/password, upload a plan, share the link + create colleague accounts under **Users**.

## 7. After the demo

- You can delete the Vercel project anytime  
- Move to Oracle Always Free when you want $0 forever hosting  

## Troubleshooting

| Issue | Fix |
|---|---|
| Upload fails with Blob token error | Create/connect a Blob store; confirm `BLOB_READ_WRITE_TOKEN` |
| Login fails | Re-run `npm run db:seed` against the Neon `DATABASE_URL` |
| Empty buildings list | Seed did not run — run migrate + seed |
| Plan won’t open / blank canvas | Confirm Blob store is in same Vercel project; check browser console |
