# Deploy

Domain: **https://api.adityamaurya.dev** (Cloudflare + Tunnel)
Fallback: `http://147.135.16.160:6686` (direct, via sslh)
SSH: `ssh -p 6686 root@147.135.16.160`

## Architecture

```
client → https://api.adityamaurya.dev (Cloudflare edge, TLS)
       → cloudflared tunnel (systemd: cloudflared)
       → Node proxy :3000 (systemd: vps-llm-shield) at /opt/vps-llm-shield
       → backends: TARGET_URL + DEEPSEEK_TARGET_URL (routed by model name)
SSH:    147.135.16.160:6686 → NAT → sslh :22 → sshd :2222
```

## First-time setup

```bash
rsync -av --exclude node_modules --exclude web/node_modules . user@VM_IP:/tmp/vps-llm-shield
ssh -p 6686 root@147.135.16.160
sudo mkdir -p /opt/vps-llm-shield && sudo cp -r /tmp/vps-llm-shield/* /opt/vps-llm-shield/
cd /opt/vps-llm-shield && npm ci --omit=dev
cp deploy/vps-llm-shield.service /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now vps-llm-shield
```

## Deploying updates

```bash
# server code
rsync -a --exclude node_modules server.js package.json root@147.135.16.160:/opt/vps-llm-shield/
ssh -p 6686 root@147.135.16.160 "systemctl restart vps-llm-shield"

# docs page (React)
cd web && npm run build && cd ..
rsync -a --delete --exclude 'bench-*.html' web/dist/ root@147.135.16.160:/opt/vps-llm-shield/web-dist/
```

## Endpoints

- `POST /v1/chat/completions` — chat, streaming (`"stream": true`)
- `POST /v1/completions`, `POST /v1/embeddings`
- `GET /v1/models` — merged from both backends
- `GET /health`

Auth: `Authorization: Bearer <PROXY_API_KEY>` on all `/v1/*` routes.

## Model routing

Model name contains `deepseek` → `DEEPSEEK_TARGET_URL`, otherwise → `TARGET_URL`.

## Env vars (.env, gitignored)

```
PORT, TARGET_URL, PROXY_API_KEY, UPSTREAM_API_KEY,
DEEPSEEK_TARGET_URL, DEEPSEEK_API_KEY, HIDE_CLIENT_IP
```

## Tests & benchmarks

```bash
node test.js                       # API test suite
node bench.js deepseek-v4.1-flash  # load benchmark → /tmp/opencode/bench-results.json
node make-chart.js                 # → bench.html
```

## Operations

```bash
systemctl status vps-llm-shield cloudflared sslh ssh
journalctl -u vps-llm-shield -f
systemctl restart vps-llm-shield   # after .env or code changes
```
