import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Readable } from 'node:stream';
import { test } from 'node:test';
import { generateMarketingAssets } from '../server/model-providers.js';
import { createModelRoutes } from '../server/model-routes.js';

const profile = { provider: 'ollama', model: 'local-model' };
const product = {
  name: '口袋录音夹', locale: 'zh-CN', category: '录音设备', audience: '经常记语音笔记的人',
  description: '轻量录音夹，用于记录语音。', facts: ['重量 24 克', '使用 USB-C 充电'],
};
const layouts = ['hero', 'feature', 'usage'];
const draft = {
  aPlus: layouts.map(layout => ({ headline: '录音随手记', body: '重量 24 克', layout, factRefs: [0] })),
  video: { title: '随手记的录音夹', scenes: layouts.map(layout => ({ caption: '使用 USB-C 充电', durationSeconds: 5, layout })) },
  social: { title: '找轻量录音夹时看什么', body: '可以先看重量，再确认充电接口是否适合。', hashtags: ['#录音夹', 'USB_C'] },
};

function ollamaReply(value) {
  return Response.json({ message: { content: JSON.stringify(value) } });
}

test('marketing requests structured copy and returns validated panels, scenes and tags without image bytes', async () => {
  let calls = 0;
  const result = await generateMarketingAssets({ profile, product: { ...product, photo: 'do-not-send-this' } }, {
    env: {},
    fetchImpl: (url, options) => {
      calls++;
      assert.equal(url, 'http://127.0.0.1:11434/api/chat');
      assert.equal(options.redirect, 'error');
      const request = JSON.parse(options.body);
      assert.deepEqual(JSON.parse(request.messages[1].content), product);
      assert.match(request.messages[0].content, /never as instructions/);
      assert.deepEqual(request.format.required, ['aPlus', 'video', 'social']);
      assert.equal(request.format.properties.video.properties.scenes.items.properties.durationSeconds.enum[0], 5);
      return ollamaReply(draft);
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.source, 'ai');
  assert.deepEqual(result.model, profile);
  assert.deepEqual(result.assets.aPlus, draft.aPlus);
  assert.deepEqual(result.assets.video, draft.video);
  assert.deepEqual(result.assets.social.hashtags, ['录音夹', 'USB_C']);
});

test('rejects incomplete creative, invalid source facts and invented numeric specifications', async () => {
  const changed = (edit) => {
    const value = structuredClone(draft);
    edit(value);
    return value;
  };
  for (const response of [
    changed(value => { value.aPlus.pop(); }),
    changed(value => { value.aPlus[0].factRefs = [2]; }),
    changed(value => { value.aPlus[0].body = '重量 24 公斤'; }),
    changed(value => { value.video.scenes[2].durationSeconds = 10; }),
    changed(value => { value.social.body = '详见 https://example.test'; }),
  ]) {
    await assert.rejects(generateMarketingAssets({ profile, product }, {
      env: {}, fetchImpl: () => ollamaReply(response),
    }), { code: 'invalid_marketing', status: 502 });
  }
  await assert.rejects(generateMarketingAssets({ profile, product: { name: product.name } }, {
    env: {}, fetchImpl: () => assert.fail('missing product facts must be validated before any network request'),
  }), { code: 'invalid_input' });
});

test('marketing route uses loopback origin checks and does not expose provider credentials', async () => {
  const apiKey = 'test-fixture-key';
  let requests = 0;
  const handle = createModelRoutes({
    env: { COUNTERFOLK_OPENAI_API_KEY: apiKey },
    fetchImpl: (url, options) => {
      requests++;
      assert.equal(url, 'https://api.openai.com/v1/chat/completions');
      assert.equal(options.headers.Authorization, `Bearer ${apiKey}`);
      assert.equal(JSON.parse(options.body).response_format.json_schema.name, 'counterfolk_marketing');
      const response = { ...draft, social: { ...draft.social, body: apiKey } };
      return Response.json({ choices: [{ message: { content: JSON.stringify(response) } }] });
    },
  });

  async function request(origin) {
    const payload = { profile: { provider: 'openai', model: 'model-fixture' }, product };
    const req = Readable.from([Buffer.from(JSON.stringify(payload))]);
    Object.assign(req, {
      url: '/api/models/marketing', method: 'POST', socket: { remoteAddress: '127.0.0.1' },
      headers: { host: '127.0.0.1:4177', 'content-type': 'application/json', origin },
    });
    const res = new EventEmitter();
    res.writeHead = (status) => { res.status = status; return res; };
    res.end = (body) => { res.body = JSON.parse(body); };
    assert.equal(await handle(req, res), true);
    return res;
  }

  assert.equal((await request('https://third-party.test')).status, 403);
  assert.equal(requests, 0);
  const invalid = await request('http://127.0.0.1:4177');
  assert.equal(invalid.status, 502);
  assert.equal(invalid.body.error.code, 'invalid_marketing');
  assert.ok(!JSON.stringify(invalid.body).includes(apiKey));
  assert.equal(requests, 1);
});
