# Helio on a VPS

💡 This guide puts Helio on the same server as your **9Router**. Helio talks to 9Router on `127.0.0.1`, so 9Router never has to be open to the internet.

## 🧰 1. What you need

1. A Linux server with **Docker** and the **Docker Compose plugin** (`docker compose version` must work)
2. At least **2 GB of RAM**. If the build gets killed, add swap first: `sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile`
3. Your **9Router** running on the same server (port 20128)
4. For real users: a **domain name** that points to the server, and a real **SMTP** service for email

## 🔐 2. Secure 9Router first

❓ `ss -ltnp | grep 20128` showing `0.0.0.0:20128` means 9Router listens on every network card. It is only safe if nobody on the internet can reach that port.

1. From **your own computer** (not the server) run: `curl -m 5 -s -o /dev/null -w "%{http_code}\n" http://YOUR_SERVER_IP:20128/v1/models`
2. If it prints `000` or times out, the port is closed from outside. Good
3. If it prints `200` or `401`, the port is **open to the internet**. Close it: remove the port 20128 rule in your cloud firewall (security group), and also run `sudo ufw deny 20128/tcp`
4. A key that was pasted in a chat or a document is no longer secret. After the first successful test, **create a new key in the 9Router dashboard and delete the old one**

## 📦 3. Copy Helio to the server

1. On your computer: `scp helio-phase2-v2.zip ubuntu@YOUR_SERVER_IP:~/`
2. On the server: `sudo apt-get install -y unzip && unzip helio-phase2-v2.zip && cd helio`

## ⚙️ 4. Set up the settings

1. `cp .env.vps.example .env`
2. Make two secrets and paste them into `.env`: run `openssl rand -hex 32` for **MASTER_KEY**, and `openssl rand -hex 16` for **POSTGRES_PASSWORD**
3. Paste your 9Router key into **PLATFORM_LLM_API_KEY**
4. Find the model ids. Run this on the server (replace `YOUR_KEY`):
   `curl -s http://127.0.0.1:20128/v1/models -H "Authorization: Bearer YOUR_KEY" | grep -o '"id": *"[^"]*"'`
5. Put one id in each of **PLATFORM_MODEL_LIGHT** (Lyra), **PLATFORM_MODEL_MEDIUM** (Carina) and **PLATFORM_MODEL_HEAVY** (Hydra). Use quotes if the id has a space
6. Test one model before you start Helio:
   `curl -sN http://127.0.0.1:20128/v1/chat/completions -H "Authorization: Bearer YOUR_KEY" -H "Content-Type: application/json" -d '{"model":"YOUR_MODEL_ID","stream":true,"messages":[{"role":"user","content":"Say hi"}]}' | head -n 8`
   You should see lines that start with `data:`

## 🚀 5. Start it

1. With an SSH tunnel (testing): `docker compose -f docker-compose.vps.yml up -d --build`
2. With a domain and HTTPS: set `APP_URL=https://your.domain` and `HELIO_DOMAIN=your.domain` in `.env`, open ports 80 and 443 (`sudo ufw allow 80,443/tcp`), then run `docker compose -f docker-compose.vps.yml --profile https up -d --build`
3. Watch it start: `docker compose -f docker-compose.vps.yml logs -f web`

## 🌐 6. Open Helio

1. **Tunnel mode.** On your computer run `ssh -L 3000:127.0.0.1:3000 -L 8025:127.0.0.1:8025 ubuntu@YOUR_SERVER_IP`, then open **http://localhost:3000**. Confirmation emails are at **http://localhost:8025**. Use Chrome or Firefox: Safari does not keep `Secure` cookies on `localhost`
2. **Domain mode.** Open **https://your.domain**. Caddy gets the HTTPS certificate by itself

## ✅ 7. Check that it works

1. Create an account, confirm the email, and finish onboarding
2. Open the Team room and write `@Lyra hello`. Lyra should answer in a few seconds
3. Try `@Carina` and `@Hydra`. Each one uses a different tier of 9Router
4. If an agent says it could not answer, the message tells you why. Common reasons are a wrong model id (step 4) or a wrong key

## 🔄 8. Update later

1. Copy the new zip and unzip it over the old folder (keep your `.env`)
2. `docker compose -f docker-compose.vps.yml up -d --build`

## 💾 9. Backups

1. Back up the database: `docker compose -f docker-compose.vps.yml exec -T postgres pg_dump -U helio helio > helio-$(date +%F).sql`
2. Keep **MASTER_KEY** somewhere safe. Without it, saved API keys cannot be read

## ⚠️ 10. Before real users arrive

1. **Create database migrations.** Right now the database is built with `db push`, which is fine for a first test but can stop on future changes. See README section 4
2. **Use a real SMTP service.** Mailpit only catches emails, it does not send them
3. **Check the daily limits.** The default is 1,000,000 tokens per workspace per day, and 300,000 per person. Change them in `.env`
4. **Keep 9Router closed** to the internet (step 2) and rotate its key

## ❓ 11. If something fails

1. **`migrate` exits with an error.** Run `docker compose -f docker-compose.vps.yml logs migrate`. If it says a port is busy, another Postgres is already using 5432
2. **Login works but you are signed out at once.** The page must be opened over HTTPS, or as `http://localhost:3000` through the tunnel. A plain `http://SERVER_IP:3000` address will not keep the session
3. **"Could not reach the provider".** From the server run the test in step 4. If it fails there, the problem is 9Router, not Helio
4. **"Service is busy. Try again in a moment."** Redis is not running: `docker compose -f docker-compose.vps.yml ps`
