# Deploying GRN Desk to a Hostinger VPS

This app is a single Node service: Express serves both the REST API **and** the
built React client, with live sync over Socket.IO. On a Hostinger **VPS (KVM)** it
runs as one PM2-managed process behind Nginx, talking to **MongoDB Atlas**.

```
Browser ──HTTPS──▶ Nginx (:443/:80) ──proxy──▶ Node/Express (127.0.0.1:5000) ──▶ MongoDB Atlas
                                                └ serves client/dist (React) + /api + /socket.io
```

Files that make this work (already in the repo):

| File | Purpose |
|------|---------|
| `ecosystem.config.cjs` | PM2 process definition (single fork instance) |
| `deploy/nginx.conf.example` | Nginx reverse-proxy vhost (with WebSocket upgrade) |
| `deploy/deploy.sh` | Pull → install → build → reload, for future updates |
| `.env.example` | Template for the server `.env` |

---

## 0. Before you start

- A Hostinger **VPS** with Ubuntu 22.04/24.04 and SSH access (root or a sudo user).
- A **domain** (or subdomain) whose DNS **A record** points at the VPS IP. Set this
  in Hostinger's **hPanel → Domains → DNS**. `A  @  <VPS_IP>` and `A  www  <VPS_IP>`.
- Your **MongoDB Atlas** connection string.
- **Atlas Network Access:** add the VPS's public IP (Atlas → Network Access → Add IP).
  Without this, the VPS cannot reach the cluster and the server will fail to connect.

---

## 1. Install the runtime (once)

SSH in, then install Node 20 LTS, Git, Nginx, and PM2:

```bash
sudo apt update && sudo apt -y upgrade
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt -y install nodejs git nginx
sudo npm install -g pm2
node -v && npm -v            # sanity check (Node >= 18)
```

## 2. Get the code

```bash
cd /var/www          # or any directory you like
sudo mkdir -p grn && sudo chown "$USER" grn
git clone <YOUR_REPO_URL> grn
cd grn
```

> No Git remote? Instead `scp -r` your local project folder to `/var/www/grn`
> (exclude `node_modules`, `client/node_modules`, `client/dist`, `.env`).

## 3. Configure environment

```bash
cp .env.example .env
nano .env
```

Set at least:

- `MONGODB_URI` — your Atlas string, password **URL-encoded** (`@`→`%40`, `#`→`%23`, …).
- `JWT_SECRET` — a long random string: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `HOST=127.0.0.1` — so Node only listens for Nginx, not the public internet.
- `PORT=5000`
- `CLIENT_ORIGIN` — your `https://your-domain.com` (or leave `*`).

> The admin username/password are **not** put in `.env` — you pass them to the seed
> in the next step, and they're stored hashed in MongoDB.

## 4. Install, build, seed

```bash
npm install --omit=dev                 # server production deps
npm run build                          # installs client devDeps + builds client/dist
npm run seed -- <admin-user> <admin-pass>   # creates the first admin in MongoDB (run ONCE)
```

Pass a real username/password to `seed` (password min 8 chars); it's hashed and
stored in MongoDB — nothing is written to `.env`. If it says *"Users already
exist"*, an admin is already in the database — skip it. Change the password after
first login via the **Password** button.

## 5. Start under PM2

```bash
pm2 start ecosystem.config.cjs
pm2 save                     # remember this process list across reboots
pm2 startup                  # prints a command — run it to enable boot-start
pm2 logs grn-desk            # confirm: "GRN Desk (MERN) listening on 127.0.0.1:5000"
```

Quick local check on the box:

```bash
curl -s http://127.0.0.1:5000/api/health      # -> {"ok":true}
```

## 6. Put Nginx in front

```bash
sudo cp deploy/nginx.conf.example /etc/nginx/sites-available/grn-desk
sudo nano /etc/nginx/sites-available/grn-desk        # set server_name to your domain
sudo ln -s /etc/nginx/sites-available/grn-desk /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default          # optional: drop the welcome page
sudo nginx -t && sudo systemctl reload nginx
```

Visit `http://your-domain.com` — the login screen should load.

## 7. Enable HTTPS (Let's Encrypt)

Once DNS resolves to the VPS:

```bash
sudo apt -y install certbot python3-certbot-nginx
sudo certbot --nginx -d your-domain.com -d www.your-domain.com
```

Certbot adds the `:443` block and an HTTP→HTTPS redirect, and auto-renews. After
this, set `CLIENT_ORIGIN=https://your-domain.com` in `.env` and `pm2 reload grn-desk`.

## 8. Firewall (recommended)

```bash
sudo ufw allow OpenSSH
sudo ufw allow 'Nginx Full'      # 80 + 443
sudo ufw enable
```

Port 5000 stays closed to the world — only Nginx (localhost) reaches Node.

---

## Updating later

Push changes to your repo, then on the VPS:

```bash
cd /var/www/grn
bash deploy/deploy.sh
```

That pulls, reinstalls, rebuilds the client, and reloads PM2 with zero downtime.

---

## Troubleshooting

| Symptom | Cause / fix |
|---------|-------------|
| `EADDRINUSE :::5000` | Another process holds 5000. `pm2 delete grn-desk` then start again, or `sudo lsof -i :5000` to find it. |
| Server logs `querySrv ECONNREFUSED` | DNS can't resolve Atlas SRV. The app already retries via public DNS; also check the VPS IP is whitelisted in Atlas Network Access. |
| Login says "Wrong username or password" on a fresh DB | Admin not created yet — run `npm run seed -- <user> <pass>`. |
| `MongooseError` / URI won't parse | Password not URL-encoded in `MONGODB_URI` (`@`→`%40`). |
| Login returns **405 Not Allowed** (nginx), or `/api/...` returns the HTML page instead of JSON | Nginx isn't proxying `/api` to Node — it's serving the SPA fallback. Add the proxy blocks from `deploy/nginx.api-proxy.snippet.conf` (and make sure Node is running on 5000). |
| Live updates (Socket.IO) not working | Nginx must forward the `Upgrade`/`Connection` headers — use the provided `nginx.conf.example`. |
| 502 Bad Gateway | Node isn't running or crashed. `pm2 logs grn-desk`. |
| Blank page / "Client not built yet" | Run `npm run build` (creates `client/dist`). |

Useful PM2 commands: `pm2 status`, `pm2 restart grn-desk`, `pm2 logs grn-desk --lines 100`, `pm2 monit`.
