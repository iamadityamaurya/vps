const fs = require('fs');

const data = JSON.parse(fs.readFileSync('/tmp/opencode/bench-results.json', 'utf8'));
const { model, maxTokens, levels } = data;

const fmt = ms => ms >= 1000 ? `${(ms / 1000).toFixed(2)}s` : `${Math.round(ms)}ms`;

const rows = levels.map(l => `
  <tr>
    <td class="mono">${l.level}x</td>
    <td>${l.ok}/${l.level + 0}</td>
    <td class="mono">${fmt(l.ttftMin)}</td>
    <td class="mono">${fmt(l.ttftAvg)}</td>
    <td class="mono">${fmt(l.ttftMax)}</td>
    <td class="mono">${fmt(l.totalMax)}</td>
    <td class="mono">${fmt(l.totalAvg)}</td>
    <td class="mono">${l.throughput.toFixed(1)}</td>
  </tr>`).join('');

const maxTotal = Math.max(...levels.map(l => l.totalMax));
const maxTtft = Math.max(...levels.map(l => l.ttftMax));

const bars = (key, max, unit) => levels.map(l => `
  <div class="brow">
    <div class="blabel mono">${l.level}x</div>
    <div class="btrack"><div class="bar" style="width:${Math.max(1.5, (l[key] / max) * 100)}%"></div></div>
    <div class="bvalue mono">${fmt(l[key])}</div>
  </div>`).join('');

const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>API Benchmark — ${model}</title>
<style>
  :root { --bg:#0d1117; --card:#161b22; --border:#30363d; --text:#e6edf3; --muted:#8b949e; --accent:#58a6ff; }
  * { box-sizing: border-box; }
  body { margin:0; background:var(--bg); color:var(--text); font-family:ui-sans-serif,system-ui,sans-serif; line-height:1.6; }
  .page { max-width:860px; margin:0 auto; padding:48px 20px 80px; }
  h1 { font-size:1.8rem; margin:0 0 6px; }
  .sub { color:var(--muted); margin-bottom:28px; }
  .card { background:var(--card); border:1px solid var(--border); border-radius:10px; padding:24px; margin-top:24px; }
  .card h2 { margin:0 0 16px; font-size:1.1rem; }
  table { width:100%; border-collapse:collapse; font-size:0.9rem; }
  th,td { padding:8px 10px; text-align:right; border-bottom:1px solid var(--border); }
  th:first-child, td:first-child { text-align:left; }
  th { color:var(--muted); font-weight:600; font-size:0.8rem; text-transform:uppercase; letter-spacing:0.5px; }
  tr:last-child td { border-bottom:none; }
  .mono { font-family:ui-monospace,Menlo,monospace; font-size:0.85em; }
  .brow { display:flex; align-items:center; gap:12px; margin:8px 0; }
  .blabel { width:48px; color:var(--muted); text-align:right; }
  .btrack { flex:1; background:#0d1117; border:1px solid var(--border); border-radius:4px; height:22px; overflow:hidden; }
  .bar { height:100%; background:var(--accent); border-radius:3px; }
  .bar.slow { background:#f85149; }
  .bvalue { width:80px; color:var(--muted); }
  footer { margin-top:32px; color:var(--muted); font-size:0.8rem; }
</style>
</head>
<body>
<div class="page">
  <h1>Benchmark Results</h1>
  <p class="sub">${model} · ${maxTokens} max tokens per request · streaming · ${new Date().toISOString()}</p>

  <div class="card">
    <h2>Summary</h2>
    <table>
      <thead><tr><th>concurrency</th><th>ok</th><th>TTFT min</th><th>TTFT avg</th><th>TTFT max</th><th>max total</th><th>avg total</th><th>req/s</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>

  <div class="card">
    <h2>Max total time — how long the slowest request took</h2>
    ${bars('totalMax', maxTotal)}
  </div>

  <div class="card">
    <h2>Worst time-to-first-token</h2>
    ${bars('ttftMax', maxTtft)}
  </div>

  <footer>Measured through the full chain: browser → proxy (${model === 'deepseek-v4.1-flash' ? 'DeepSeek' : 'Qwen'} backend) and back.</footer>
</div>
</body>
</html>`;

fs.writeFileSync(`${__dirname}/bench.html`, html);
console.log(`chart written: ${__dirname}/bench.html (${levels.length} levels, model ${model})`);
