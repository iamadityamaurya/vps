require('dotenv').config();
const express = require('express');
const { createProxyMiddleware } = require('http-proxy-middleware');

const app = express();

const PORT = parseInt(process.env.PORT, 10) || 3000;
const TARGET_URL = (process.env.TARGET_URL || 'http://103.68.69.21:8000').replace(/\/+$/, '');
const PROXY_API_KEY = (process.env.PROXY_API_KEY || '').trim();
const UPSTREAM_API_KEY = (process.env.UPSTREAM_API_KEY || '').trim();
const HIDE_CLIENT_IP = process.env.HIDE_CLIENT_IP !== 'false';

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

const authenticate = (req, res, next) => {
  if (!PROXY_API_KEY) return next();

  const header = req.headers.authorization;
  const token =
    header?.startsWith('Bearer ') ? header.slice(7).trim() :
    req.headers['x-api-key'] ? String(req.headers['x-api-key']).trim() : '';

  if (token === PROXY_API_KEY) return next();

  res.status(401).json({
    error: {
      message: 'Invalid or missing API key.',
      type: 'invalid_request_error',
      param: null,
      code: 'invalid_api_key'
    }
  });
};

const proxy = createProxyMiddleware({
  target: TARGET_URL,
  changeOrigin: true,
  xfwd: !HIDE_CLIENT_IP,
  pathRewrite: (path, req) => {
    const [pathname, query] = (req.originalUrl || path).split('?');
    const target = pathname.startsWith('/v1') ? pathname : `/v1${pathname}`;
    return query ? `${target}?${query}` : target;
  },
  on: {
    proxyReq: proxyReq => {
      if (HIDE_CLIENT_IP) {
        for (const header of ['x-forwarded-for', 'x-forwarded-host', 'x-forwarded-proto', 'x-real-ip', 'via', 'forwarded']) {
          proxyReq.removeHeader(header);
        }
      }
      if (UPSTREAM_API_KEY) {
        proxyReq.setHeader('authorization', `Bearer ${UPSTREAM_API_KEY}`);
      }
    },
    proxyRes: (proxyRes, req, res) => {
      if (/\/(chat\/)?completions/.test(req.originalUrl)) {
        res.setHeader('X-Accel-Buffering', 'no');
        res.setHeader('Cache-Control', 'no-cache');
      }
      res.removeHeader('server');
      res.removeHeader('x-powered-by');
    },
    error: (err, req, res) => {
      if (res.headersSent) return;
      res.status(502).json({
        error: {
          message: 'Upstream unavailable.',
          type: 'server_error',
          code: 502
        }
      });
    }
  }
});

app.use(['/v1', '/models', '/chat', '/embeddings', '/completions'], authenticate, proxy);

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`vps-llm-shield listening on :${PORT} -> ${TARGET_URL}`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
