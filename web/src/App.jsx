import React, { useEffect, useState } from 'react';

const API_BASE = 'https://api.adityamaurya.dev';

const MODEL = {
  id: 'deepseek-v4.1-flash',
  name: 'DeepSeek v4.1 Flash',
  contextWindow: 1048576,
  reasoning: true
};

const ENDPOINTS = [
  { method: 'POST', path: '/v1/chat/completions', desc: 'Create a chat completion. Supports streaming with "stream": true.' },
  { method: 'POST', path: '/v1/completions', desc: 'Legacy text completions.' },
  { method: 'POST', path: '/v1/embeddings', desc: 'Generate embeddings.' },
  { method: 'GET', path: '/v1/models', desc: 'List available models.' },
  { method: 'GET', path: '/health', desc: 'Service health check.' }
];

const CODE_SAMPLES = {
  curl: `curl ${API_BASE}/v1/chat/completions \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer YOUR_API_KEY" \\
  -d '{
    "model": "deepseek-v4.1-flash",
    "messages": [{ "role": "user", "content": "Hello!" }],
    "max_tokens": 500
  }'`,
  javascript: `import OpenAI from "openai";

const client = new OpenAI({
  baseURL: "${API_BASE}/v1",
  apiKey: "YOUR_API_KEY"
});

const res = await client.chat.completions.create({
  model: "deepseek-v4.1-flash",
  messages: [{ role: "user", content: "Hello!" }],
  max_tokens: 500
});

console.log(res.choices[0].message.content);`,
  python: `from openai import OpenAI

client = OpenAI(
    base_url="${API_BASE}/v1",
    api_key="YOUR_API_KEY"
)

res = client.chat.completions.create(
    model="deepseek-v4.1-flash",
    messages=[{"role": "user", "content": "Hello!"}],
    max_tokens=500
)

print(res.choices[0].message.content)`
};

const BENCH = [
  { level: 1, ok: 1, ttftMin: 1.27, ttftAvg: 1.27, ttftMax: 1.27, totalMax: 1.75, totalAvg: 1.75, rps: 0.6 },
  { level: 2, ok: 2, ttftMin: 0.95, ttftAvg: 1.08, ttftMax: 1.21, totalMax: 1.65, totalAvg: 1.51, rps: 1.2 },
  { level: 4, ok: 4, ttftMin: 0.61, ttftAvg: 0.9, ttftMax: 1.19, totalMax: 1.61, totalAvg: 1.33, rps: 2.5 },
  { level: 8, ok: 8, ttftMin: 0.63, ttftAvg: 0.99, ttftMax: 1.34, totalMax: 1.74, totalAvg: 1.4, rps: 4.6 },
  { level: 16, ok: 16, ttftMin: 0.65, ttftAvg: 0.96, ttftMax: 1.27, totalMax: 1.87, totalAvg: 1.39, rps: 8.5 },
  { level: 32, ok: 32, ttftMin: 0.73, ttftAvg: 1.09, ttftMax: 1.51, totalMax: 2.07, totalAvg: 1.73, rps: 15.5 },
  { level: 64, ok: 64, ttftMin: 0.77, ttftAvg: 1.25, ttftMax: 1.82, totalMax: 2.69, totalAvg: 2.23, rps: 23.8 },
  { level: 128, ok: 128, ttftMin: 0.79, ttftAvg: 1.29, ttftMax: 1.99, totalMax: 3.57, totalAvg: 3.14, rps: 35.9 }
];

const fmt = s => s >= 1 ? `${s.toFixed(2)}s` : `${Math.round(s * 1000)}ms`;

const CopyButton = ({ text }) => {
  const [copied, setCopied] = useState(false);
  return (
    <button
      className="copy"
      onClick={() => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      }}
    >
      {copied ? 'Copied!' : 'Copy'}
    </button>
  );
};

const CodeTabs = () => {
  const [tab, setTab] = useState('curl');
  return (
    <div className="code-block">
      <div className="tabs">
        {Object.keys(CODE_SAMPLES).map(k => (
          <button key={k} className={tab === k ? 'active' : ''} onClick={() => setTab(k)}>{k}</button>
        ))}
        <span style={{ flex: 1 }} />
        <CopyButton text={CODE_SAMPLES[tab]} />
      </div>
      <pre><code>{CODE_SAMPLES[tab]}</code></pre>
    </div>
  );
};

const BenchBars = ({ keyName, title, max }) => (
  <div className="bench-bars">
    <h3>{title}</h3>
    {BENCH.map(b => (
      <div key={b.level} className="brow">
        <div className="blabel mono">{b.level}x</div>
        <div className="btrack"><div className="bar" style={{ width: `${Math.max(2, (b[keyName] / max) * 100)}%` }} /></div>
        <div className="bvalue mono">{fmt(b[keyName])}</div>
      </div>
    ))}
  </div>
);

const Benchmarks = () => {
  const maxTotal = Math.max(...BENCH.map(b => b.totalMax));
  const maxTtft = Math.max(...BENCH.map(b => b.ttftMax));
  return (
    <section className="card">
      <h2>Performance</h2>
      <p>Load test through the live endpoint: streaming requests, 64 max tokens each, concurrency scaled from 1 to 128 parallel requests. Zero failures at every level.</p>
      <table className="bench">
        <thead>
          <tr>
            <th>parallel</th><th>ok</th><th>TTFT min</th><th>TTFT avg</th><th>TTFT max</th><th>max total</th><th>avg total</th><th>req/s</th>
          </tr>
        </thead>
        <tbody>
          {BENCH.map(b => (
            <tr key={b.level}>
              <td className="mono">{b.level}x</td>
              <td>{b.ok}/{b.level}</td>
              <td className="mono">{fmt(b.ttftMin)}</td>
              <td className="mono">{fmt(b.ttftAvg)}</td>
              <td className="mono">{fmt(b.ttftMax)}</td>
              <td className="mono">{fmt(b.totalMax)}</td>
              <td className="mono">{fmt(b.totalAvg)}</td>
              <td className="mono">{b.rps.toFixed(1)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="bench-grid">
        <BenchBars keyName="ttftMax" title="Time to first token (worst)" max={maxTtft} />
        <BenchBars keyName="totalMax" title="Total time (slowest request)" max={maxTotal} />
      </div>
      <p className="hint">At 128 parallel requests, first tokens still arrive in under 2 seconds and all requests complete within 3.6s — throughput ~36 req/s with no dropped requests.</p>
    </section>
  );
};

const App = () => {
  return (
    <div className="page">
      <header>
        <h1>LLM API <span className="badge">OpenAI-compatible</span></h1>
        <p className="sub">
          {API_BASE}/v1
        </p>
      </header>

      <section className="card">
        <h2>Quick start</h2>
        <p>Point any OpenAI SDK or HTTP client at <code>{API_BASE}/v1</code> with your API key in the <code>Authorization</code> header.</p>
        <CodeTabs />
      </section>

      <section className="card">
        <h2>Model</h2>
        <div className="model">
          <div className="model-head">
            <strong>{MODEL.name}</strong>
            {MODEL.reasoning && <span className="tag">reasoning</span>}
          </div>
          <div className="model-id">
            <code>{MODEL.id}</code>
            <CopyButton text={MODEL.id} />
          </div>
          <div className="model-meta">context: {(MODEL.contextWindow / 1024 / 1024).toFixed(0)}M tokens · streaming supported</div>
        </div>
        <p className="hint">Tip: this is a reasoning model — keep max_tokens ≥ 500 so answers don't get cut off mid-thought.</p>
      </section>

      <section className="card">
        <h2>Endpoints</h2>
        <table className="endpoints">
          <tbody>
            {ENDPOINTS.map(e => (
              <tr key={e.method + e.path}>
                <td><span className={`method ${e.method}`}>{e.method}</span></td>
                <td><code>{e.path}</code></td>
                <td>{e.desc}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <Benchmarks />

      <footer>
        <p>Authentication required on all <code>/v1/*</code> endpoints — <code>Authorization: Bearer YOUR_API_KEY</code> or <code>x-api-key</code> header.</p>
      </footer>
    </div>
  );
};

export default App;
