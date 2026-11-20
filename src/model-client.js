const endpoint = new URL('../api/models', import.meta.url);

async function request(action = '', data, signal) {
  const response = await fetch(`${endpoint.href}${action}`, {
    ...(data === undefined ? {} : {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    }),
    signal,
    cache: 'no-store',
  });
  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error('模型服务不可用，请用本机服务打开 Counterfolk。');
  }
  if (!response.ok) {
    const error = new Error(result?.error?.message ?? '模型服务请求失败。');
    error.code = result?.error?.code;
    throw error;
  }
  return result;
}

export async function getModelCapabilities({ signal } = {}) {
  try {
    return await request('', undefined, signal);
  } catch {
    return { available: false, providers: [] };
  }
}

export function testModelConnection(profile, { signal } = {}) {
  return request('/test', { profile }, signal);
}

export function runModelPanel({ profile, product, personas }, { signal } = {}) {
  return request('/run', { profile, product, personas }, signal);
}
