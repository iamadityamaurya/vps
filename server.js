require('dotenv').config();
const express = require('express');
const path = require('path');

const app = express();

const PORT = parseInt(process.env.PORT, 10) || 3000;
const PROXY_API_KEY = (process.env.PROXY_API_KEY || '').trim();
const HIDE_CLIENT_IP = process.env.HIDE_CLIENT_IP !== 'false';

if (!process.env.TARGET_URL) {
  console.error('Missing required env var: TARGET_URL');
  process.exit(1);
}

if (!PROXY_API_KEY || PROXY_API_KEY.length < 16) {
  console.error('Missing or weak PROXY_API_KEY (min 16 chars) - refusing to start without authentication');
  process.exit(1);
}

const providers = [
  {
    name: 'default',
    url: process.env.TARGET_URL.replace(/\/+$/, ''),
    apiKey: (process.env.UPSTREAM_API_KEY || '').trim()
  },
  ...(process.env.DEEPSEEK_TARGET_URL ? [{
    name: 'deepseek',
    url: process.env.DEEPSEEK_TARGET_URL.replace(/\/+$/, ''),
    apiKey: (process.env.DEEPSEEK_API_KEY || process.env.UPSTREAM_API_KEY || '').trim(),
    match: model => /deepseek/i.test(model)
  }] : [])
];

const route = model => providers.find(p => p.match?.(model)) || providers[0];

const readBody = req => new Promise((resolve, reject) => {
  const chunks = [];
  req.on('data', c => chunks.push(c));
  req.on('end', () => resolve(Buffer.concat(chunks)));
  req.on('error', reject);
});

const upstreamPath = url => url.startsWith('/v1') ? url : `/v1${url}`;

const forwardHeaders = provider => ({
  ...(provider.apiKey ? { authorization: `Bearer ${provider.apiKey}` } : {})
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use(express.static(path.join(__dirname, 'web-dist')));

const authenticate = (req, res, next) => {
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

app.use(authenticate);

app.get('/v1/models', async (req, res) => {
  const results = await Promise.allSettled(
    providers.map(p =>
      fetch(`${p.url}/v1/models`, { headers: forwardHeaders(p), signal: AbortSignal.timeout(15000) })
        .then(r => r.json())
    )
  );

  const models = results.flatMap(r =>
    r.status === 'fulfilled' && Array.isArray(r.value?.data) ? r.value.data : []
  );

  if (!models.length) {
    return res.status(502).json({ error: { message: 'No upstream available.', type: 'server_error', code: 502 } });
  }
  res.json({ object: 'list', data: models });
});

app.all(/^\/(v1|models|chat|embeddings|completions)/, async (req, res) => {
  try {
    const body = ['POST', 'PUT', 'PATCH'].includes(req.method) ? await readBody(req) : undefined;

    let model = '';
    if (body) {
      try { model = JSON.parse(body).model || ''; } catch { }
    }

    const provider = route(model);
    const target = `${provider.url}${upstreamPath(req.originalUrl.split('?')[0])}${req.originalUrl.includes('?') ? '?' + req.originalUrl.split('?')[1] : ''}`;

    const upstream = await fetch(target, {
      method: req.method,
      headers: {
        ...forwardHeaders(provider),
        accept: req.headers.accept || 'application/json',
        ...(body ? {
          'content-type': req.headers['content-type'] || 'application/json',
          'content-length': body.length
        } : {})
      },
      body,
      signal: AbortSignal.timeout(3600000)
    });

    res.status(upstream.status);
    for (const header of ['content-type', 'cache-control']) {
      const value = upstream.headers.get(header);
      if (value) res.setHeader(header, value);
    }

    if (upstream.headers.get('content-type')?.includes('text/event-stream')) {
      res.setHeader('X-Accel-Buffering', 'no');
      res.flushHeaders();
      for await (const chunk of upstream.body) {
        res.write(chunk);
      }
      res.end();
    } else {
      res.end(Buffer.from(await upstream.arrayBuffer()));
    }
  } catch (err) {
    if (res.headersSent) return res.end();
    res.status(502).json({
      error: {
        message: 'Upstream unavailable.',
        type: 'server_error',
        code: 502
      }
    });
  }
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`vps-llm-shield listening on :${PORT} (${providers.map(p => p.name).join(', ')})`);
});

for (const signal of ['SIGTERM', 'SIGINT']) {
  process.on(signal, () => {
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(0), 5000).unref();
  });
}
