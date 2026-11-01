# Deploy

```bash
rsync -av --exclude node_modules . user@VM_IP:/tmp/vps-llm-shield
ssh user@VM_IP

sudo mkdir -p /opt/vps-llm-shield
sudo cp -r /tmp/vps-llm-shield/* /opt/vps-llm-shield/
cd /opt/vps-llm-shield
sudo cp .env .env               # edit: PORT, TARGET_URL, PROXY_API_KEY, UPSTREAM_API_KEY
sudo npm ci --omit=dev

sudo cp deploy/vps-llm-shield.service /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now vps-llm-shield
sudo ufw allow 3000/tcp
```

## Client usage (OpenAI SDK)

```js
const client = new OpenAI({
  baseURL: "http://<VM_IP>:3000/v1",
  apiKey: "<PROXY_API_KEY>",
});
```

## Endpoints

- `POST /v1/chat/completions` — chat, supports `"stream": true`
- `POST /v1/completions`
- `POST /v1/embeddings`
- `GET /v1/models`
- `GET /health`

## Operations

```bash
sudo systemctl restart vps-llm-shield
journalctl -u vps-llm-shield -f
```
