import { LOOPBACK_NAMES, MODEL_PROVIDERS, ModelError, runModelInference, testModelProfile } from './model-providers.js';

const MAX_BODY_BYTES = 64 * 1024;
const MODELS = '/api/models';
const ACTIONS = new Set([`${MODELS}/test`, `${MODELS}/run`]);
const LOOPBACK_ADDRESSES = new Set(['127.0.0.1', '::1', '::ffff:127.0.0.1']);

function sendJson(response, status, body) {
  if (response.destroyed || response.writableEnded) return;
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  }).end(JSON.stringify(body));
}

function localOrigin(request) {
  if (!LOOPBACK_ADDRESSES.has(request.socket.remoteAddress)) return null;
  const host = request.headers.host ?? '';
  if (!/^(127\.0\.0\.1|localhost|\[::1\])(?::[1-9]\d{0,4})?$/i.test(host)) return null;
  try {
    const url = new URL(`http://${host}`);
    return LOOPBACK_NAMES.has(url.hostname) ? url.origin : null;
  } catch {
    return null;
  }
}

function readJson(request) {
  if (!/^application\/json(?:\s*;.*)?$/i.test(request.headers['content-type'] ?? '')) {
    throw new ModelError('content_type', '请提交 JSON 数据。', 415);
  }
  if (Number(request.headers['content-length']) > MAX_BODY_BYTES) {
    throw new ModelError('body_size', '请求数据过大。', 413);
  }

  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    function cleanup() {
      request.off('data', collect);
      request.off('end', complete);
      request.off('error', fail);
      request.off('aborted', fail);
    }
    function fail() {
      cleanup();
      reject(new ModelError('body_read', '无法读取请求数据。'));
    }
    function collect(chunk) {
      size += chunk.length;
      if (size > MAX_BODY_BYTES) {
        request.pause();
        cleanup();
        reject(new ModelError('body_size', '请求数据过大。', 413));
        return;
      }
      chunks.push(chunk);
    }
    function complete() {
      cleanup();
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString('utf8')));
      } catch {
        reject(new ModelError('invalid_json', '请求 JSON 无效。'));
      }
    }
    request.on('error', fail);
    request.on('aborted', fail);
    request.on('end', complete);
    request.on('data', collect);
  });
}

export function createModelRoutes({ fetchImpl = globalThis.fetch, env = process.env } = {}) {
  let busy = false;
  return async function handleModelRoute(request, response) {
    const path = request.url?.split('?')[0];
    if (path !== MODELS && !path?.startsWith(`${MODELS}/`)) return false;

    const origin = localOrigin(request);
    if (!origin || (request.headers.origin && request.headers.origin !== origin)
      || (request.headers['sec-fetch-site'] && !['same-origin', 'none'].includes(request.headers['sec-fetch-site']))) {
      sendJson(response, 403, { error: { code: 'origin', message: '模型接口仅接受当前本机页面的请求。' } });
      return true;
    }
    if (request.method === 'GET' && path === MODELS) {
      sendJson(response, 200, { available: true, providers: MODEL_PROVIDERS });
      return true;
    }
    if (!ACTIONS.has(path)) {
      sendJson(response, 404, { error: { code: 'not_found', message: '模型接口不存在。' } });
      return true;
    }
    if (request.method !== 'POST') {
      sendJson(response, 405, { error: { code: 'method', message: '模型操作需要 POST 请求。' } });
      return true;
    }
    if (request.headers.origin !== origin) {
      sendJson(response, 403, { error: { code: 'origin', message: '模型接口仅接受当前本机页面的请求。' } });
      return true;
    }
    if (busy) {
      sendJson(response, 429, { error: { code: 'busy', message: '已有模型任务，请等待当前任务完成。' } });
      return true;
    }

    busy = true;
    const controller = new AbortController();
    const cancel = () => controller.abort();
    response.once('close', cancel);
    try {
      const body = await readJson(request);
      const options = { fetchImpl, env, signal: controller.signal };
      const result = path.endsWith('/test') ? await testModelProfile(body?.profile, options)
        : await runModelInference(body, options);
      sendJson(response, 200, result);
    } catch (error) {
      if (error instanceof ModelError) {
        if (error.code === 'body_size') response.setHeader('Connection', 'close');
        sendJson(response, error.status, { error: { code: error.code, message: error.message } });
      } else {
        sendJson(response, 500, { error: { code: 'internal', message: '模型请求处理失败。' } });
      }
    } finally {
      response.off('close', cancel);
      busy = false;
    }
    return true;
  };
}
