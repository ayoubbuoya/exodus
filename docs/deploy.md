# Deploy Exodus on a public server

This puts the demo online at **https://exodus.markets** (no port in the URL) on a fresh Ubuntu server, using [`docker-compose.prod.yml`](../docker-compose.prod.yml).

What runs: the same containers as the local demo (PostgreSQL, the Canton sandbox, setup, oracle, API). In front of them, **nginx** (in Docker) takes ports **80 and 443**. It serves the web app over HTTPS, forwards `/api` and `/v2`, and sends `http://` and `www.` visitors to `https://exodus.markets`. Only nginx is reachable from outside.

The HTTPS certificate comes from Let's Encrypt with an **HTTP-01 check**: certbot puts a small file on the site, Let's Encrypt downloads it from `http://exodus.markets/.well-known/acme-challenge/...`, and that proves the server owns the name. The `certbot-renew` container repeats this before the certificate expires, so **you never renew it by hand**.

> "USYC" and "USDC" are **simulated** tokens issued by demo parties. They are not issued by, connected to, or endorsed by Circle or Hashnote.

## What you need

- An Ubuntu server (22.04 or 24.04) of its own, with **at least 4 GB of RAM** (8 GB is safer: the Canton sandbox is a Java process). Nothing else may use ports 80 and 443 on it.
- Ports **22, 80 and 443/TCP** open in the provider's firewall or security group (if it has one).
- Access to the DNS settings of `exodus.markets` at your registrar.

## 1. Point the name at the server

At your registrar's DNS page, add:

| Type | Host | Value |
|---|---|---|
| A | `@` (the bare `exodus.markets`) | the server's public IPv4 address |
| A | `www` | the same address |

**Delete any `AAAA` record** for `@` or `www` (and any parking or "URL redirect" record the registrar added), unless it points at this server's IPv6. Let's Encrypt prefers IPv6, so a stale `AAAA` record makes the certificate step fail.

Check both names (it can take a few minutes):

```bash
curl -s "https://dns.google/resolve?name=exodus.markets&type=A"
curl -s "https://dns.google/resolve?name=www.exodus.markets&type=A"
```

Each answer must contain the server's IP.

## 2. Prepare the server

Log in (`ssh root@<server IP>`, or a sudo user) and update it:

```bash
sudo apt update && sudo apt upgrade -y
```

Install Docker Engine and the Compose plugin from Docker's own repository (Ubuntu's `docker.io` package is older):

```bash
sudo apt install -y ca-certificates curl git
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "${UBUNTU_CODENAME:-$VERSION_CODENAME}") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
sudo apt update
sudo apt install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo usermod -aG docker $USER     # then log out and back in, to run docker without sudo
docker compose version            # checks it works
```

If an nginx or Apache **installed on Ubuntu** is running, stop it: it would hold port 80 or 443. `sudo systemctl disable --now nginx apache2` (an error for a service that does not exist is fine).

Firewall (optional, but a good habit). Allow SSH **before** enabling it, or you lock yourself out:

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

Note: ports that Docker publishes are opened by Docker itself, even without the `ufw` rules. That is why `docker-compose.prod.yml` publishes only nginx's 80 and 443, never the database, the ledger or the API.

On a 4 GB server, a swap file gives some room during the first build:

```bash
sudo fallocate -l 4G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## 3. Get the code and fill in the settings

```bash
git clone https://github.com/ayoubbuoya/exodus.git
cd exodus
cp .env.prod.example .env
nano .env
```

Set `LETSENCRYPT_EMAIL` and `ADMIN_PASSWORD` (at least 10 characters). `EXODUS_DOMAIN` already holds `exodus.markets`. On an 8 GB server, set `LEDGER_MEM_LIMIT=4g`. `.env` is git-ignored.

## 4. Build and start

```bash
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

The first build takes 10 to 20 minutes (it downloads the Daml SDK and builds the contracts).

nginx now runs with a temporary **self-signed** certificate (a browser would show a warning). That is expected: nginx must be running for the next step.

## 5. Get the real certificate (once)

```bash
docker compose -f docker-compose.prod.yml run --rm certbot
docker compose -f docker-compose.prod.yml restart nginx
```

The first command ends with "Successfully received certificate". It covers `exodus.markets` and `www.exodus.markets` and is kept in the `letsencrypt` Docker volume. The restart makes nginx use it.

If certbot fails, it is almost always DNS: check step 1 (both A records, no stale `AAAA`) and that port 80 is open in the provider's firewall. Then run the two commands again. Don't retry in a fast loop: Let's Encrypt allows 5 failures per hour.

## 6. Check

- Open **https://exodus.markets**: the padlock shows a Let's Encrypt certificate. The sandbox needs about a minute before the app answers.
- `http://exodus.markets` and `https://www.exodus.markets` both land on `https://exodus.markets`.
- Log in as the admin (`ADMIN_EMAIL` and the password from `.env`).

## Every day

All commands run from the repository root, after `alias dc='docker compose -f docker-compose.prod.yml'`.

| Task | Command |
|---|---|
| See what runs | `dc ps` |
| Follow the logs | `dc logs -f api` (or `nginx`, `oracle`, `ledger`, `certbot-renew`) |
| Reset the demo, or bring it back after a reboot | `dc down && dc up -d` |
| Deploy new code | `git pull && dc build && dc down && dc up -d` |

**The ledger is in memory.** After a reboot, a ledger crash or `down`, every account and trade is gone and the demo starts fresh. That is also how you reset it. Don't use `down -v`: it also deletes the certificate volume (you would then repeat step 5).

**The ledger has a RAM ceiling.** The sandbox container may use at most `LEDGER_MEM_LIMIT` (default `3g`, set in `.env`), and the Java heap gets half of that. To see how close it is to the ceiling, and why it stopped if it did:

```bash
docker stats --no-stream exodus-prod-ledger-1      # MEM USAGE / LIMIT
docker inspect exodus-prod-ledger-1 --format 'exit={{.State.ExitCode}} oomKilled={{.State.OOMKilled}}'
dc logs --tail=100 ledger | grep -i outofmemory
```

`OutOfMemoryError` in the logs means the heap filled up: raise `LEDGER_MEM_LIMIT`, then `dc down && dc up -d`.

## The certificate renews itself

A Let's Encrypt certificate lasts **90 days**. Every 12 hours, the `certbot-renew` container runs `certbot renew`, which does nothing until fewer than 30 days are left and then renews with the same HTTP-01 check. nginx reloads itself every 6 hours, so it picks up the new certificate without a restart. You only need ports 80 and 443 to stay open.

Check the expiry date, or test a renewal without changing anything:

```bash
echo | openssl s_client -connect exodus.markets:443 -servername exodus.markets 2>/dev/null | openssl x509 -noout -enddate
dc exec certbot-renew certbot renew --dry-run
```

## Worth knowing

- **Visitors share one demo.** `/lab` lets anyone act as any demo party through `/v2`, including moving the demo clock. What one person does there, everyone sees.
- **Rate limits count per visitor.** nginx passes the visitor's IP in `X-Forwarded-For`, and the API trusts it only from private addresses (Docker containers). Never publish the API's port 3000.
- **One public name.** `www.exodus.markets` and every `http://` address redirect to `https://exodus.markets`, so there is one session cookie.
