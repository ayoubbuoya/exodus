# Deploy Exodus on a public server

This puts the demo online at `https://exodus.buoya.space:8443` using [`docker-compose.prod.yml`](../docker-compose.prod.yml). It is built for a server whose ports 80 and 443 already belong to another project. Exodus only uses **one port (8443)**, and it gets its HTTPS certificate with a DNS check, so it never needs port 80.

What runs: the same containers as the local demo (PostgreSQL, the Canton sandbox, setup, oracle, API). In front of them, **nginx** serves the web app over HTTPS and forwards `/api` and `/v2`. Only nginx is reachable from outside.

> "USYC" and "USDC" are **simulated** tokens issued by demo parties. They are not issued by, connected to, or endorsed by Circle or Hashnote.

## What you need

- A Linux server with Docker and Docker Compose, and **at least 4 GB of RAM** (8 GB is safer: the Canton sandbox is a Java process).
- Port **8443/TCP** open in the provider's firewall or security group. Docker opens it on the server itself.
- Access to the DNS settings of `buoya.space` (Namecheap: *Domain List → Manage → Advanced DNS*).

## 1. Point the name at the server

In Namecheap's *Advanced DNS*, add:

| Type | Host | Value |
|---|---|---|
| A Record | `exodus` | the server's public IPv4 address |

Check it (it can take a few minutes):

```bash
curl -s "https://dns.google/resolve?name=exodus.buoya.space&type=A"
```

## 2. Fill in the settings

On the server, from the repository root:

```bash
cp .env.prod.example .env
nano .env
```

Set `LETSENCRYPT_EMAIL` and `ADMIN_PASSWORD` (at least 10 characters). `EXODUS_DOMAIN` and `EXODUS_HTTPS_PORT` already hold `exodus.buoya.space` and `8443`. `.env` is git-ignored.

## 3. Build

```bash
docker compose -f docker-compose.prod.yml build
```

The first build takes 10 to 20 minutes (it downloads the Daml SDK and builds the contracts).

## 4. Get the certificate (once)

```bash
docker compose -f docker-compose.prod.yml run --rm certbot
```

Certbot prints a **TXT record** and waits. **Don't press Enter yet.**

1. In Namecheap's *Advanced DNS*, add a **TXT Record** with Host `_acme-challenge.exodus` (Namecheap adds `.buoya.space` itself) and the value certbot printed.
2. Wait until the record is visible (usually 1 to 5 minutes):
   ```bash
   curl -s "https://dns.google/resolve?name=_acme-challenge.exodus.buoya.space&type=TXT"
   ```
3. Press Enter. Certbot saves the certificate in the `letsencrypt` Docker volume.

You can delete the TXT record afterwards.

## 5. Start

```bash
docker compose -f docker-compose.prod.yml up -d
```

Open **https://exodus.buoya.space:8443**. The sandbox needs about a minute before the app answers. Log in as the admin with the password from `.env`.

If you start before step 4, nginx serves a self-signed certificate (browsers show a warning). After getting the real one, run `docker compose -f docker-compose.prod.yml restart nginx`.

## Every day

All commands run from the repository root, after `alias dc='docker compose -f docker-compose.prod.yml'`.

| Task | Command |
|---|---|
| See what runs | `dc ps` |
| Follow the logs | `dc logs -f api` (or `nginx`, `oracle`, `ledger`) |
| Reset the demo, or bring it back after a reboot | `dc down && dc up -d` |
| Deploy new code | `git pull && dc build && dc down && dc up -d` |

**The ledger is in memory.** After a reboot, a ledger crash or `down`, every account and trade is gone and the demo starts fresh. That is also how you reset it. Don't use `down -v`: it also deletes the certificate volume.

**The ledger has a RAM ceiling.** The sandbox container may use at most `LEDGER_MEM_LIMIT` (default `3g`, set in `.env`), and the Java heap gets half of that. This keeps it from eating the RAM of the other project on this server. To see how close it is to the ceiling, and why it stopped if it did:

```bash
docker stats --no-stream exodus-prod-ledger-1      # MEM USAGE / LIMIT
docker inspect exodus-prod-ledger-1 --format 'exit={{.State.ExitCode}} oomKilled={{.State.OOMKilled}}'
dc logs --tail=100 ledger | grep -i outofmemory
```

`OutOfMemoryError` in the logs means the heap filled up: raise `LEDGER_MEM_LIMIT`, then `dc down && dc up -d`.

## Renew the certificate

A Let's Encrypt certificate lasts **90 days**. Certbot can't renew this one on its own, because each renewal needs a new TXT record. Before it expires, run step 4 again (answer *Renew* if certbot asks), then `dc restart nginx`.

Check the expiry date:

```bash
echo | openssl s_client -connect exodus.buoya.space:8443 -servername exodus.buoya.space 2>/dev/null | openssl x509 -noout -enddate
```

## Worth knowing

- **Judges share one demo.** `/lab` lets anyone act as any demo party through `/v2`, including moving the demo clock. What one person does there, everyone sees.
- **Rate limits count per visitor.** nginx passes the visitor's IP in `X-Forwarded-For`, and the API trusts it only from private addresses (Docker containers). Never publish the API's port 3000.
- **`http://` on port 8443** is redirected to `https://`.
