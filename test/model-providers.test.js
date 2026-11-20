import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { normalizeModelProfile, runModelInference, testModelProfile } from '../server/model-providers.js';
import { createModelRoutes } from '../server/model-routes.js';

const profile = { provider: 'ollama', model: 'qwen2.5:7b', concurrency: 2, maxCalls: 4 };
const product = {
  name: 'Pocket monitor', type: 'hardware', currency: 'USD', description: 'Display the indoor air quality.',
  variants: {
    a: { name: 'A labeled control', price: 149, channel: 'ecommerce', shippingFee: 8, description: 'Measure CO₂.' },
    b: { name: 'B labeled treatment', price: 119, channel: 'retail', shippingFee: 8, description: 'Measure room temperature.' },
  },
};
const personas = [
  { id: 15, region: 'us', language: 'en', segment: 'practical', culture: 'routine', budget: 140 },
  { id: 30, region: 'jp', language: 'ja', segment: 'enthusiast', culture: 'independent', budget: 260 },
];

function ollamaReply(comprehension = 'clear', reason = 'The main benefit is explained.') {
  return Response.json({ message: { content: JSON.stringify({ comprehension, reason }) } });
}

function openAIReply(value) {
  return Response.json({ choices: [{ message: { content: JSON.stringify(value) } }] });
}

test('Ollama validates a structured request and keeps paired offers isolated', async () => {
  const recorded = [];
  const fetchImpl = async (url, options) => {
    const request = JSON.parse(options.body);
    const inputs = JSON.parse(request.messages[1].content);
    recorded.push(inputs);
    assert.equal(url, 'http://127.0.0.1:11434/api/chat');
    assert.equal(options.redirect, 'error');
    assert.equal(request.format.properties.comprehension.enum.join(','), 'clear,neutral,unclear');
    assert.ok(!Object.hasOwn(inputs.product, 'variants'));
    assert.ok(!Object.hasOwn(inputs.shopper, 'id'));
    assert.ok(!Object.hasOwn(inputs.offer, 'name'));
    return ollamaReply(inputs.offer.price === 149 ? 'clear' : 'neutral');
  };
  const result = await runModelInference({ profile, product, personas }, { fetchImpl, env: {} });
  assert.deepEqual(recorded.map(({ offer }) => offer.price), [149, 119, 149, 119]);
  assert.deepEqual(recorded.map(({ offer }) => offer.shippingFee), [8, 0, 8, 0]);
  assert.deepEqual(result.results.map(({ id }) => id), [15, 30]);
  assert.equal(result.results[1].a.decision.comprehension, 'clear');
  assert.equal(result.results[1].b.decision.comprehension, 'neutral');
  assert.deepEqual(result.usage, { requests: 4, succeeded: 4, failed: 0 });
  assert.deepEqual(result.model, { provider: 'ollama', model: 'qwen2.5:7b' });
});

test('identical A/A offer facts share the same model decision per resident', async () => {
  const sameOffer = { ...product, variants: { a: product.variants.a, b: { ...product.variants.a, name: 'Renamed label' } } };
  let modelCalls = 0;
  const fetchImpl = async () => ollamaReply('neutral', `Call ${++modelCalls}`);
  const result = await runModelInference({ profile, product: sameOffer, personas }, { fetchImpl, env: {} });
  assert.equal(modelCalls, personas.length);
  assert.deepEqual(result.usage, { requests: 2, succeeded: 2, failed: 0 });
  assert.ok(result.results.every(({ a, b }) => a === b));
});

test('connection check supports environment credentials and never echoes them', async () => {
  const key = 'test-secret-for-unit-test';
  const fetchImpl = async (url, options) => {
    assert.equal(url, 'https://api.openai.com/v1/chat/completions');
    assert.equal(options.headers.Authorization, `Bearer ${key}`);
    assert.equal(JSON.parse(options.body).response_format.json_schema.strict, true);
    return openAIReply({ comprehension: 'neutral', reason: 'I am unsure about the features.' });
  };
  const result = await testModelProfile({ provider: 'openai', model: 'gpt-4.1-mini' }, {
    fetchImpl, env: { COUNTERFOLK_OPENAI_API_KEY: key },
  });
  assert.equal(result.model.model, 'gpt-4.1-mini');
  assert.match(result.promptVersion, /^product-comprehension/);
  assert.ok(!JSON.stringify(result).includes(key));
});

test('records a failed decision without leaking upstream response text or credentials', async () => {
  const key = 'test-secret-for-unit-test';
  const fetchImpl = async (_, options) => {
    assert.equal(options.headers.Authorization, `Bearer ${key}`);
    const offer = JSON.parse(JSON.parse(options.body).messages[1].content).offer;
    return offer.price === 119
      ? Response.json({ error: { message: key } }, { status: 429 })
      : openAIReply({ comprehension: 'clear', reason: `Accidentally echoed ${key}` });
  };
  const result = await runModelInference({
    profile: { provider: 'openai', model: 'gpt-4.1-mini', apiKey: key }, product, personas,
  }, { fetchImpl, env: {} });
  assert.deepEqual(result.usage, { requests: 4, succeeded: 0, failed: 4 });
  assert.equal(result.results[0].a.error.code, 'invalid_decision');
  assert.equal(result.results[0].b.error.code, 'provider_quota');
  assert.ok(!JSON.stringify(result).includes(key));
});

test('validates provider endpoints and model-call budgets before sending product data', async () => {
  assert.throws(() => normalizeModelProfile({ ...profile, baseUrl: 'https://not-local.example' }), /本机/);
  assert.throws(() => normalizeModelProfile({ ...profile, provider: 'compatible', baseUrl: 'https://not-approved.example/v1' }, { env: {} }), /COUNTERFOLK_COMPATIBLE_URL/);
  const baseUrl = 'https://selected.example/v1';
  const env = { COUNTERFOLK_COMPATIBLE_URL: baseUrl, COUNTERFOLK_COMPATIBLE_API_KEY: 'test-key' };
  const settings = normalizeModelProfile({ ...profile, provider: 'compatible', baseUrl }, { env });
  assert.equal(settings.endpoint, `${baseUrl}/chat/completions`);
  assert.equal(settings.apiKey, 'test-key');
  const local = normalizeModelProfile({ ...profile, provider: 'compatible', baseUrl: 'http://localhost:9000' }, { env });
  assert.equal(local.endpoint, 'http://127.0.0.1:9000/v1/chat/completions');
  assert.equal(local.apiKey, '');
  await assert.rejects(() => runModelInference({ profile: { ...profile, maxCalls: 2 }, product, personas }, {
    fetchImpl: () => assert.fail('call budget must be checked before fetch'),
  }), /数量/);
});

function mockRoute(url, { method = 'POST', headers = {}, payload = '{}', remoteAddress = '127.0.0.1' } = {}) {
  const request = Readable.from([Buffer.from(payload)]);
  Object.assign(request, {
    url, method, socket: { remoteAddress },
    headers: { host: '127.0.0.1:4177', 'content-type': 'application/json', origin: 'http://127.0.0.1:4177', ...headers },
  });
  const response = new EventEmitter();
  response.setHeader = () => response;
  response.writeHead = (status) => { response.status = status; return response; };
  response.end = (body) => { response.body = JSON.parse(body); };
  return { request, response };
}

test('loopback routes enforce origin and host and cap chunked bodies', async () => {
  let calls = 0;
  const handle = createModelRoutes({ fetchImpl: () => { calls++; return ollamaReply(); } });
  for (const config of [
    { headers: { origin: 'https://third-party.example' } },
    { headers: { host: 'example.test:4177' } },
    { headers: { origin: undefined } },
    { remoteAddress: '192.0.2.1' },
  ]) {
    const { request, response } = mockRoute('/api/models/test', config);
    assert.equal(await handle(request, response), true);
    assert.equal(response.status, 403);
  }
  const oversized = mockRoute('/api/models/test', { payload: ' '.repeat(65_537) });
  assert.equal(await handle(oversized.request, oversized.response), true);
  assert.equal(oversized.response.status, 413);
  assert.equal(calls, 0);
  const permitted = mockRoute('/api/models/test', { payload: JSON.stringify({ profile }) });
  assert.equal(await handle(permitted.request, permitted.response), true);
  assert.equal(permitted.response.status, 200);
  assert.equal(calls, 1);
});
