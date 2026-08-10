# RPL-10X Equipment Delivery & Installation Status Tracker

Interactive replacement for the read-only Power BI Synoptic floor-plan dashboard. Upload `.svg` / `.jsvg` plans, click equipment to change status, and export updated files + CSV history.

## Prerequisites

- Node.js 20+
- npm

## Quick start (local)

```bash
# 1) Install
npm install

# 2) Start embedded PostgreSQL (leave this terminal running)
npm run db:start

# 3) In another terminal: migrate + seed
npm run db:setup

# 4) Run the app
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Default admin (from `.env` — change in production):

- Email: `admin@turner.local`
- Password: `ChangeMeAdmin1!`

## Environment

Copy `.env.example` to `.env` and set:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | Postgres connection string |
| `SESSION_SECRET` | ≥32 char cookie secret |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` / `ADMIN_NAME` | Seeded admin |
| `UPLOAD_DIR` | Local file storage root (default `./uploads`) |

## Typical workflow

1. Sign in as ADMIN.
2. **Upload** a `.jsvg` or `.svg` for Building → System → (Data Hall if applicable).
3. On the **mapping** screen, assign equipment tags (individually or via CSV preview/commit). Tags already present in the file are kept.
4. Open the floor plan, right-click / press-and-hold equipment to change status (EDITOR/ADMIN).
5. **Export** updated `.jsvg`/`.svg` and CSV status history.

## Access

Invite-only login. Anyone with an account has **full access** (upload, status changes, mapping, export, user management). There are no Viewer/Editor restrictions — only invite people who should use the tool.

## Project layout

- `src/app` — pages + API routes
- `src/components` — floor plan canvas, charts, mapping UI
- `src/lib/parsers` — `.jsvg` / `.svg` parsers
- `src/lib/storage` — swappable file storage
- `src/lib/auth` — swappable auth provider
- `prisma` — schema, migrations, seed

See `DECISIONS.md` for design assumptions.

## Hosting

- **Temporary demo for colleagues:** Vercel + Neon + Blob — see **[DEPLOY-VERCEL.md](./DEPLOY-VERCEL.md)**
- **Free forever:** Oracle Cloud Always Free — see **[DEPLOY-ORACLE.md](./DEPLOY-ORACLE.md)**
- Railway (paid ~$5/mo): **[DEPLOY-RAILWAY.md](./DEPLOY-RAILWAY.md)**
