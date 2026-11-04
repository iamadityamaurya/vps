require('dotenv').config();

const BASE_URL = process.env.TEST_BASE_URL || 'https://api.adityamaurya.dev';
const API_KEY = process.env.PROXY_API_KEY;
const MODEL = process.argv[2] || 'deepseek-v4.1-flash';
const LEVELS = [1, 2, 4, 8, 16, 32, 64, 128];
const MAX_TOKENS = 64;

const headers = {
  'Content-Type': 'application/json',
  Authorization: `Bearer ${API_KEY}`
};

const oneRequest = async () => {
  const started = performance.now();
  let ttft = null;
  let tokens = 0;

  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: MODEL,
      messages: [{ role: 'user', content: 'Count from 1 to 20, one number per line.' }],
      max_tokens: MAX_TOKENS,
      stream: true
    })
  });

  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status} ${body.slice(0, 80)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop();
    for (const line of lines) {
      if (!line.startsWith('data: ') || line.includes('[DONE]')) continue;
      try {
        const chunk = JSON.parse(line.slice(6));
        const delta = chunk.choices?.[0]?.delta;
        if ((delta?.content || delta?.reasoning) && ttft === null) {
          ttft = performance.now() - started;
        }
        if (delta?.content || delta?.reasoning) tokens++;
      } catch {}
    }
  }

  return {
    ttft,
    total: performance.now() - started,
    tokens
  };
};

const percentile = (arr, p) => {
  const sorted = [...arr].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length))];
};

const fmt = ms => ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;
const bar = (value, max, width = 40) => {
  const filled = Math.max(1, Math.round((value / max) * width));
  return '█'.repeat(filled) + '░'.repeat(width - filled);
};

const runLevel = async n => {
  const results = await Promise.allSettled(Array.from({ length: n }, () => oneRequest()));
  const ok = results.filter(r => r.status === 'fulfilled').map(r => r.value);
  const failed = n - ok.length;
  const ttfts = ok.map(r => r.ttft).filter(Boolean);
  const totals = ok.map(r => r.total);

  return {
    level: n,
    ok: ok.length,
    failed,
    ttftMin: Math.min(...ttfts),
    ttftAvg: ttfts.reduce((a, b) => a + b, 0) / ttfts.length,
    ttftP95: percentile(ttfts, 95),
    ttftMax: Math.max(...ttfts),
    totalMax: Math.max(...totals),
    totalAvg: totals.reduce((a, b) => a + b, 0) / totals.length,
    tokens: ok.reduce((a, r) => a + r.tokens, 0),
    throughput: ok.length / (Math.max(...totals) / 1000)
  };
};

const run = async () => {
  console.log(`\nBenchmark: ${BASE_URL}/v1  model=${MODEL}  max_tokens=${MAX_TOKENS}\n`);
  const levels = [];

  for (const n of LEVELS) {
    process.stdout.write(`running ${n} parallel request${n > 1 ? 's' : ''}… `);
    const t0 = performance.now();
    const r = await runLevel(n);
    r.wall = (performance.now() - t0) / 1000;
    levels.push(r);
    console.log(`${r.ok}/${n} ok in ${r.wall.toFixed(1)}s`);
  }

  const maxTotal = Math.max(...levels.map(l => l.totalMax));
  const maxTtft = Math.max(...levels.map(l => l.ttftMax));

  console.log('\n┌───────┬─────┬────────┬────────┬────────┬────────┬─────────────┬─────────────┬────────┐');
  console.log('│ level │  ok  │ TTFT   │ TTFT   │ TTFT   │ max    │ max total   │ avg total   │ req/s  │');
  console.log('│       │      │ min    │ avg    │ max    │ fail   │ time        │ time        │        │');
  console.log('├───────┼─────┼────────┼────────┼────────┼────────┼─────────────┼─────────────┼────────┤');
  for (const l of levels) {
    console.log(
      `│ ${String(l.level).padStart(5)} │ ${String(l.ok).padStart(3) } │ ${fmt(l.ttftMin).padStart(6)} │ ${fmt(l.ttftAvg).padStart(6)} │ ${fmt(l.ttftMax).padStart(6)} │ ${String(l.failed).padStart(6)} │ ${fmt(l.totalMax).padStart(11)} │ ${fmt(l.totalAvg).padStart(11)} │ ${l.throughput.toFixed(1).padStart(6)} │`
    );
  }
  console.log('└───────┴─────┴────────┴────────┴────────┴────────┴─────────────┴─────────────┴────────┘');

  console.log('\nMax total time per level (all requests of the level must finish):');
  for (const l of levels) {
    console.log(`${String(l.level).padStart(3)}x │${bar(l.totalMax, maxTotal)}│ ${fmt(l.totalMax)}`);
  }

  console.log('\nWorst TTFT per level (time until first token, slowest request):');
  for (const l of levels) {
    console.log(`${String(l.level).padStart(3)}x │${bar(l.ttftMax, maxTtft, 40)}│ ${fmt(l.ttftMax)}`);
  }
  console.log('');

  require('fs').writeFileSync('/tmp/opencode/bench-results.json', JSON.stringify({ model: MODEL, maxTokens: MAX_TOKENS, levels }, null, 2));
  console.log('raw results: /tmp/opencode/bench-results.json');
};

run().catch(err => {
  console.error('benchmark crashed:', err.message);
  process.exit(1);
});
