require('dotenv').config();

const BASE_URL = process.env.TEST_BASE_URL || 'https://api.adityamaurya.dev';
const API_KEY = process.env.PROXY_API_KEY;
const MODELS = [
  (process.env.TEST_MODEL_DEEPSEEK || 'deepseek-v4.1-flash'),
  (process.env.TEST_MODEL_QWEN || 'qwen3.8-27b-fable-distill-fp8')
];

const authHeaders = { Authorization: `Bearer ${API_KEY}` };
let passed = 0;
let failed = 0;

const check = (name, ok, detail = '') => {
  console.log(`${ok ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  ok ? passed++ : failed++;
};

const ask = async (model, question, maxTokens = 500) => {
  const res = await fetch(`${BASE_URL}/v1/chat/completions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...authHeaders },
    body: JSON.stringify({
      model,
      messages: [{ role: 'user', content: question }],
      max_tokens: maxTokens
    })
  });
  const data = await res.json();
  const message = data.choices?.[0]?.message;
  return { res, data, text: message?.content || message?.reasoning || '' };
};

const run = async () => {
  console.log(`\nTesting ${BASE_URL}/v1\n`);

  const health = await fetch(`${BASE_URL}/health`);
  check('health check', health.status === 200);

  const models = await fetch(`${BASE_URL}/v1/models`, { headers: authHeaders });
  const modelsData = await models.json().catch(() => ({}));
  const modelIds = (modelsData.data || []).map(m => m.id);
  check('list models (auth)', models.status === 200 && modelIds.length > 0, `${modelIds.length} models: ${modelIds.join(', ')}`);

  const badKey = await fetch(`${BASE_URL}/v1/models`, { headers: { Authorization: 'Bearer invalid-key' } });
  check('invalid key rejected (401)', badKey.status === 401);

  const noKey = await fetch(`${BASE_URL}/v1/models`);
  check('missing key rejected (401)', noKey.status === 401);

  for (const model of MODELS) {
    try {
      const { res, text } = await ask(model, 'What is the capital of France? Answer in one word.', 500);
      const answered = res.status === 200 && /paris/i.test(text);
      check(`chat completion (${model})`, answered, `status ${res.status}, answer: ${text.slice(0, 80).replace(/\n/g, ' ')}`);
    } catch (err) {
      check(`chat completion (${model})`, false, err.message);
    }
  }

  try {
    const stream = await fetch(`${BASE_URL}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeaders },
      body: JSON.stringify({
        model: MODELS[0],
        messages: [{ role: 'user', content: 'Count from 1 to 5.' }],
        max_tokens: 200,
        stream: true
      })
    });
    const contentType = stream.headers.get('content-type') || '';
    let chunks = 0;
    for await (const c of stream.body) {
      if (Buffer.from(c).toString().includes('chat.completion.chunk')) chunks++;
    }
    check(`streaming (${MODELS[0]})`, stream.status === 200 && contentType.includes('event-stream') && chunks > 0, `${chunks} SSE chunks`);
  } catch (err) {
    check('streaming', false, err.message);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed ? 1 : 0);
};

run().catch(err => {
  console.error('❌ test run crashed:', err.message);
  process.exit(1);
});
