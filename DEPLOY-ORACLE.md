# Deploy on Oracle Cloud Always Free (forever $0)

This runs the full stack (Next.js + Postgres + persistent uploads) on an
**Oracle Cloud Infrastructure (OCI) Always Free** VM so teammates can use it anytime.

## What you get

- Always-on public website (no sleep)
- Postgres + uploaded floor plans on the VM disk
- Cost: **$0** within Always Free limits

## 1. Create a free Oracle Cloud account

1. Go to [cloud.oracle.com](https://www.oracle.com/cloud/free/) and sign up  
2. Complete verification (needs a credit card for identity; Always Free should not charge if you stay in free shape limits)

## 2. Create an Always Free VM

1. OCI Console → **Compute** → **Instances** → **Create instance**
2. Recommended free shape:
   - **VM.Standard.A1.Flex** (Ampere ARM) — 2 OCPUs / 12 GB RAM is comfortable  
   - Or **VM.Standard.E2.1.Micro** (AMD) if A1 capacity is unavailable in your region
3. Networking:
   - Use the default VCN or create one
   - Assign a **public IP**
4. SSH keys: add your public key (you’ll need it to log in)
5. Create the instance and wait until it is **Running**

### Open the firewall for the website

1. Note the instance **public IP**
2. **Networking** → VCN → subnet → **Security List** (or NSG)
3. Add Ingress rules:
   - TCP **22** (SSH) from your IP (preferred) or `0.0.0.0/0`
   - TCP **3000** from `0.0.0.0/0` (app)  
     Later you can put Cloudflare Tunnel / HTTPS on 443 instead.

Also open the port inside the VM OS (Oracle Linux / Ubuntu often block by default):

```bash
# Ubuntu example
sudo ufw allow 22
sudo ufw allow 3000
sudo ufw enable
```

## 3. Install Docker on the VM

SSH in:

```bash
ssh ubuntu@YOUR_PUBLIC_IP
# or: ssh opc@YOUR_PUBLIC_IP   (Oracle Linux images use opc)
```

**Ubuntu:**

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
newgrp docker
docker --version
docker compose version
```

## 4. Clone and configure the app

```bash
git clone https://github.com/shreyasbp317/Turner-synoptic-panel-tracker.git
cd Turner-synoptic-panel-tracker
cp .env.oracle.example .env
nano .env   # set strong POSTGRES_PASSWORD, SESSION_SECRET, ADMIN_EMAIL, ADMIN_PASSWORD
```

Generate a session secret:

```bash
openssl rand -hex 32
```

## 5. Start the stack

```bash
docker compose up -d --build
docker compose ps
docker compose logs -f app
```

First boot runs database migrations automatically.

## 6. Seed the admin user (one time)

```bash
docker compose exec app npx prisma db seed
# or:
docker compose exec app npm run db:seed
```

## 7. Open the site

Visit:

`http://YOUR_PUBLIC_IP:3000`

Sign in with the `ADMIN_EMAIL` / `ADMIN_PASSWORD` from `.env`.

You should see an **Upload** button in the top-right header on every page (ADMIN only).

## 8. Create employee accounts

As ADMIN → **Users** → create EDITOR / VIEWER accounts for the team.  
Share the URL + their individual logins (not the admin password).

## Optional: free HTTPS URL (recommended)

Use **Cloudflare Tunnel** (free) so you get `https://rpl.yourdomain.com` without opening port 3000 publicly.

1. Create a free Cloudflare account + add a domain (or use a free subdomain worker setup)
2. On the VM:

```bash
curl -fsSL https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-linux-arm64 -o cloudflared
# use amd64 build if your VM is E2.1.Micro
chmod +x cloudflared
sudo mv cloudflared /usr/local/bin/
cloudflared tunnel login
cloudflared tunnel create rpl10x
cloudflared tunnel route dns rpl10x rpl.yourdomain.com
```

Config (`~/.cloudflared/config.yml`):

```yaml
tunnel: rpl10x
credentials-file: /home/ubuntu/.cloudflared/<TUNNEL_ID>.json
ingress:
  - hostname: rpl.yourdomain.com
    service: http://localhost:3000
  - service: http_status:404
```

Run:

```bash
cloudflared tunnel run rpl10x
```

(Install as a systemd service for always-on.)

## Updating later

```bash
cd ~/Turner-synoptic-panel-tracker
git pull
docker compose up -d --build
```

Uploads and database stay on Docker volumes.

## Accessing the database

```bash
# From the VM
docker compose exec db psql -U rpl10x -d rpl10x
```

Or open a temporary tunnel from your laptop:

```bash
ssh -L 5433:127.0.0.1:5432 ubuntu@YOUR_PUBLIC_IP
# then Prisma Studio / DBeaver → localhost:5433
```

## Troubleshooting

| Issue | Fix |
|---|---|
| Can’t reach site | Check Security List + `ufw` allow 3000; confirm `docker compose ps` |
| A1 shape “out of capacity” | Try another region, or use E2.1.Micro |
| Login fails after deploy | Re-run `docker compose exec app npm run db:seed` with correct ADMIN_* in `.env` |
| No Upload button | Confirm header shows role **ADMIN** (VIEWER/EDITOR cannot upload) |
| Disk filling up | Large `.jsvg` uploads — Always Free boot volume is limited; prune old plans if needed |

## Always Free tips

- Stay on Always Free shapes (A1 Flex within free OCPU/RAM quota, or E2.1.Micro)
- Don’t attach expensive paid block volumes unless you intend to pay
- Keep regular `git pull` + `docker compose up -d --build` for updates
