import { freezeExperiment, compareTrial, exampleTrial } from './experiment.js';
import { CULTURES, LANGUAGES, METRICS, REGIONS, SEGMENTS } from './simulation.js';
import { getModelCapabilities, runModelPanel, testModelConnection } from './model-client.js';

const arms = ['a', 'b'];
const phases = { exposed: '曝光', purchase: '购买', install: '安装', activation: '激活', paid: '付费' };
const comprehension = { clear: '理解清楚', neutral: '基本理解', unclear: '仍有疑虑' };
const diagnoses = {
  exposed: '先核对分流、去重埋点、门店客流与渠道触达。',
  purchase: '优先核对到手价、税费、库存、配送和结账摩擦。',
  install: '核对商店页素材、设备兼容性和获取成本。',
  activation: '核对首次打开、激活事件定义与新手流程。',
  paid: '核对免费试用、付费墙、计费周期与价格敏感度。',
};
const bundleFormat = 'counterfolk-workbench-v1';

function key(config) {
  return JSON.stringify(config);
}

function predictionSnapshot(result) {
  const { config, version, comparison, assignedComparison } = result;
  return {
    config, version,
    comparison: { lift: comparison.lift, interval: comparison.interval },
    assignedComparison: { lift: assignedComparison.lift, interval: assignedComparison.interval },
    ...Object.fromEntries(arms.map((id) => [id, Object.fromEntries(
      ['population', 'exposed', 'considered', 'converted', 'rate', 'calibratedRate', 'purchase', 'install', 'activation', 'paid']
        .map((name) => [name, result[id][name]])
    )])),
  };
}

function validatePrediction(prediction, protocol) {
  if (prediction?.version !== protocol.engineVersion || key(prediction.config) !== key(protocol.config)
    || !prediction.comparison || !prediction.assignedComparison) {
    throw new Error('工作包内的预测与实验口径不一致。');
  }
  for (const id of arms) {
    const arm = prediction[id];
    if (!arm || arm.population !== protocol.config.population) throw new Error('工作包缺少方案人数。');
    for (const field of ['exposed', 'considered', 'converted', 'purchase', 'install', 'activation', 'paid']) {
      if (!Number.isSafeInteger(arm[field]) || arm[field] < 0 || arm[field] > arm.population) {
        throw new Error('工作包内的模拟计数无法读取。');
      }
    }
    if (arm.considered > arm.exposed || arm.converted > arm.exposed
      || arm.converted !== arm[protocol.config.metric] || arm.rate !== (arm.exposed ? arm.converted / arm.exposed : null)) {
      throw new Error('工作包内的模拟漏斗不一致。');
    }
    if (arm.calibratedRate !== null && (!Number.isFinite(arm.calibratedRate) || arm.calibratedRate < 0 || arm.calibratedRate > 1)) {
      throw new Error('工作包内的校准转化率无法读取。');
    }
  }
  const assignedLift = (prediction.b.converted - prediction.a.converted) / protocol.config.population;
  const conditionalLift = prediction.a.rate === null || prediction.b.rate === null ? null : prediction.b.rate - prediction.a.rate;
  for (const [comparison, expected] of [[prediction.comparison, conditionalLift], [prediction.assignedComparison, assignedLift]]) {
    if (comparison.lift !== expected && (!Number.isFinite(comparison.lift) || !Number.isFinite(expected)
      || Math.abs(comparison.lift - expected) > 1e-12)) throw new Error('工作包内的 A/B 差值与模拟计数不一致。');
    if (!Array.isArray(comparison.interval) || comparison.interval.length !== 2
      || comparison.interval.some((value) => value !== null && (!Number.isFinite(value) || Math.abs(value) > 1))) {
      throw new Error('工作包内的模拟区间无法读取。');
    }
  }
}

export function createExperimentTools({ runPrediction, download, escapeHtml, lookup, count, rate, points, message }) {
  const get = (id) => document.getElementById(id);
  const protocolForm = get('protocol-form');
  const modelForm = get('model-form');
  const trialForm = get('trial-form');
  let baseline = null;
  let workbench = null;
  let controller = null;
  let restoring = false;
  let simulationBusy = false;
  let modelAvailable = false;

  function refreshActions() {
    const ready = Boolean(workbench && baseline && key(workbench.protocol.config) === key(baseline.config));
    protocolForm.querySelector('[type="submit"]').disabled = !baseline || simulationBusy || restoring || Boolean(controller);
    get('workbench-upload').disabled = Boolean(controller) || simulationBusy || restoring;
    get('protocol-download').disabled = !workbench;
    get('model-test').disabled = !modelAvailable || Boolean(controller);
    get('model-run').disabled = !modelAvailable || !ready || Boolean(controller) || simulationBusy || restoring;
    for (const id of ['trial-example', 'trial-template', 'trial-compare']) get(id).disabled = !workbench || restoring;
    get('model-cancel').hidden = !controller;
    if (workbench) {
      const { protocol } = workbench;
      const denominator = protocol.denominator === 'assigned' ? '按分配人数' : '按曝光人数';
      get('trial-protocol').textContent = `${protocol.config.name} · ${protocol.config.days} 天 · ${denominator} · ${protocol.id}`;
    }
  }

  function readProfile() {
    const fields = new FormData(modelForm);
    const provider = fields.get('provider');
    return {
      provider, model: fields.get('model').trim(),
      baseUrl: provider === 'openai' ? '' : fields.get('baseUrl').trim(),
      apiKey: provider === 'ollama' ? '' : fields.get('apiKey').trim(),
      maxCalls: Number(fields.get('maxCalls')),
      concurrency: Number(fields.get('concurrency')),
    };
  }

  function providerFields() {
    const provider = modelForm.elements.provider.value;
    get('model-address').hidden = provider === 'openai';
    get('model-secret').hidden = provider === 'ollama';
    modelForm.elements.baseUrl.placeholder = provider === 'compatible' ? 'http://127.0.0.1:1234/v1' : 'http://127.0.0.1:11434';
    get('model-disclosure').textContent = provider === 'ollama'
      ? '商品素材和合成居民资料发送到本机 Ollama。'
      : '商品素材和合成居民资料发送到所选服务。密钥仅随本次本机请求使用。';
  }

  function clearReports() {
    get('model-results').replaceChildren();
    get('trial-results').replaceChildren();
    message(get('trial-feedback'), '');
    message(get('model-feedback'), '');
  }

  protocolForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!baseline || simulationBusy) return;
    const data = new FormData(protocolForm);
    try {
      const protocol = freezeExperiment({
        config: baseline.config, denominator: data.get('denominator'), unit: data.get('unit'),
        allocationB: Number(data.get('allocationB')) / 100, tolerance: Number(data.get('tolerance')) / 100,
        minimumEffect: Number(data.get('minimumEffect')) / 100,
        offers: {
          a: { version: data.get('versionA'), content: data.get('contentA') },
          b: { version: data.get('versionB'), content: data.get('contentB') },
        },
      });
      workbench = { format: bundleFormat, protocol, prediction: predictionSnapshot(baseline), frozenAt: new Date().toISOString(), model: null };
      clearReports();
      message(get('protocol-status'), `已锁定 ${protocol.id}。可导出实验工作包。`, 'success');
      refreshActions();
    } catch (error) {
      message(get('protocol-status'), error.message, 'error');
    }
  });

  protocolForm.addEventListener('input', () => {
    if (workbench) message(get('protocol-status'), '表单有改动。重新锁定后才会用于 AI 与真人对照。');
  });

  get('protocol-download').addEventListener('click', () => {
    if (workbench) download(workbench, `counterfolk-${workbench.protocol.id}.json`);
  });

  async function modelTask(action) {
    if (!modelAvailable || controller || !modelForm.reportValidity()) return;
    controller = new AbortController();
    refreshActions();
    const signal = controller.signal;
    const feedback = get('model-feedback');
    try {
      const profile = readProfile();
      message(feedback, action === 'test' ? '正在测试模型连接…' : '正在调用模型。每位样本最多两次请求…');
      if (action === 'test') {
        const test = await testModelConnection(profile, { signal });
        message(feedback, `连接成功 · ${test.model.model} · ${count(test.latencyMs)} ms`, 'success');
        return;
      }
      const frozen = workbench;
      const base = baseline;
      if (!frozen || !base || key(frozen.protocol.config) !== key(base.config)) throw new Error('请先为当前实验锁定口径。');
      const { protocol } = frozen;
      if (!protocol.offers.a.content || !protocol.offers.b.content) throw new Error('请填写并锁定 A/B 两组商品文案。');
      const personas = base.modelSample.slice(0, Math.floor(profile.maxCalls / 2)).map((persona) => ({
        ...persona, region: lookup(REGIONS, persona.region), language: lookup(LANGUAGES, persona.language),
        culture: lookup(CULTURES, persona.culture), segment: lookup(SEGMENTS, persona.segment),
      }));
      if (!personas.length) throw new Error('当前观察期内没有同时接触 A/B 渠道的居民样本。');
      const mode = modelForm.elements.mode.value;
      const panel = await runModelPanel({
        profile, personas,
        product: { name: base.config.name, type: base.config.product, currency: base.config.currency,
          variants: Object.fromEntries(arms.map((id) => [id, { ...base.config.variants[id], description: protocol.offers[id].content }])) },
      }, { signal });
      if (signal.aborted) return;
      if (frozen !== workbench || base !== baseline) throw new Error('调用期间实验已变化，请用当前口径重新运行。');
      const decisions = {
        mode, selected: personas.map(({ id }) => id),
        entries: panel.results.filter(({ a, b }) => a.status === 'ok' && b.status === 'ok')
          .map(({ id, a, b }) => ({ agentId: id, a: a.decision, b: b.decision })),
        profile: { ...panel.model, promptVersion: panel.promptVersion },
      };
      const result = await runPrediction(base.config, decisions);
      workbench.model = {
        capturedAt: new Date().toISOString(), decisions: result.ai, summary: panel.usage,
        prediction: mode === 'hybrid' ? predictionSnapshot(result) : null,
      };
      renderModel();
      get('trial-results').replaceChildren();
      if (!result.ai.successful) {
        const error = panel.results.flatMap(({ a, b }) => [a, b]).find(({ status }) => status === 'error');
        message(feedback, `没有可用的配对回复，已回退到规则。 ${error?.error?.message ?? ''}`.trim(), 'error');
      } else {
        message(feedback, mode === 'hybrid' ? '混合模拟已完成。结果可与冻结的规则基线对照。' : '访谈已完成，可在下方查看理由。', 'success');
      }
    } catch (error) {
      message(feedback, signal.aborted ? '已取消模型任务。' : error.message, signal.aborted ? '' : 'error');
    } finally {
      controller = null;
      refreshActions();
    }
  }

  function renderModel() {
    const model = workbench?.model;
    if (!model?.decisions) { get('model-results').replaceChildren(); return; }
    const { decisions, prediction, summary } = model;
    const baselineRate = workbench.prediction.b.rate;
    const badge = prediction ? `<span>B 组曝光后转化 ${rate(baselineRate)} · 混合 ${rate(prediction.b.rate)}</span>` : '';
    const cell = (value) => `<strong>${comprehension[value.comprehension] ?? '—'}</strong><small>${escapeHtml(value.reason)}</small>`;
    get('model-results').innerHTML = `<div class="tool-results-meta">
      <strong>${escapeHtml(decisions.profile?.model)} · ${decisions.mode === 'hybrid' ? '混合模拟' : '抽样访谈'}</strong>
      <span>配对成功 ${count(decisions.successful)} / ${count(decisions.attempted)} 位居民</span>
      <span>请求 ${count(summary?.requests)} 次 · 失败 ${count(summary?.failed)} 次</span>
      <span>回退 ${count(decisions.fallback)} 位 · 改变阶段 ${count(decisions.changed)} 位</span>${badge}
      <button type="button" class="button button-muted" id="model-replay">重放已记录决策</button>
    </div><div class="table-wrap tool-result-table"><table><thead><tr><th>居民</th><th>方案 A</th><th>方案 B</th></tr></thead><tbody>
      ${decisions.entries.map((value) => `<tr><td>#${count(value.agentId)}</td><td>${cell(value.a)}</td><td>${cell(value.b)}</td></tr>`).join('')
        || '<tr><td colspan="3">没有完整的 A/B 回复，模拟使用规则回退。</td></tr>'}
    </tbody></table></div>`;
    get('model-replay').addEventListener('click', async () => {
      if (controller || simulationBusy) return;
      try {
        await runPrediction(workbench.protocol.config, decisions);
        message(get('model-feedback'), '已重放，使用记录的模型输出。', 'success');
      } catch (error) {
        message(get('model-feedback'), error.message, 'error');
      }
    });
  }

  modelForm.elements.provider.addEventListener('change', () => {
    modelForm.elements.baseUrl.value = '';
    modelForm.elements.apiKey.value = '';
    providerFields();
  });
  modelForm.addEventListener('submit', (event) => { event.preventDefault(); modelTask('run'); });
  get('model-test').addEventListener('click', () => modelTask('test'));
  get('model-cancel').addEventListener('click', () => controller?.abort());
  providerFields();
  const onLoopback = location.protocol === 'http:' && ['127.0.0.1', 'localhost', '[::1]'].includes(location.hostname);
  async function checkModelService() {
    const capabilities = onLoopback ? await getModelCapabilities() : { available: false };
    modelAvailable = capabilities.available === true;
    get('model-status').textContent = modelAvailable ? '本机服务已就绪' : '静态演示';
    if (!modelAvailable) get('model-hint').textContent = '运行 npm run dev，从本机页面启用 Ollama 或云端 API。';
    refreshActions();
  }
  checkModelService();

  function renderTrial(report, hybrid) {
    const { comparison, funnel, firstMismatch, quality } = report;
    const demo = report.source === 'synthetic-demo';
    const observed = demo ? '示例' : '真人';
    const direction = {
      a: `${observed} A 更优`, b: `${observed} B 更优`,
      uncertain: `${observed}差异证据不足`, unavailable: '当前试点仅作描述性对照',
    };
    const heldInterval = comparison.realInterval.every(Number.isFinite)
      ? `${points(comparison.realInterval[0], true)} 至 ${points(comparison.realInterval[1], true)}` : '—';
    const issues = [
      quality.sampleRatioMismatch ? '实际分流比例偏离计划，先核对随机分流和试点埋点。' : '',
      quality.conditionalExposure ? '当前转化率按已曝光对象计算，需留意方案对曝光的影响。' : '',
      comparison.agreement === 'opposite' ? '预测与真人方向相反，请分市场或渠道复核并补做试点。' : '',
      firstMismatch ? `最早超出容差的阶段是「${phases[firstMismatch.stage]}」。${diagnoses[firstMismatch.stage]}` : '已观察的漏斗阶段均在设定容差内。',
    ].filter(Boolean);
    const stages = funnel.map(({ stage, a, b }) => `<tr><td>${phases[stage]}</td>
      <td>${rate(a?.simulation)} / ${rate(a?.real)}</td><td>${rate(b?.simulation)} / ${rate(b?.real)}</td></tr>`).join('');
    const hybridNote = hybrid
      ? `<span>B − A 混合预测 ${points(hybrid.comparison.simulatedLift, true)}</span><span>混合差值误差 ${points(hybrid.comparison.liftError, true)}</span>` : '';
    get('trial-results').innerHTML = `<div class="tool-results-meta">
      <strong>${demo ? '合成示例' : '真人试点'} · ${escapeHtml(report.trialId)}</strong>
      <span>${direction[comparison.direction]}</span><span>B − A 规则预测 ${points(comparison.simulatedLift, true)}</span>
      <span>${observed}观测 ${points(comparison.realLift, true)}</span><span>${observed} 95% 区间 ${heldInterval}</span>
      <span>规则差值误差 ${points(comparison.liftError, true)}</span>${hybridNote}</div>
      <div class="tool-diagnosis">${issues.map((issue) => `<p>${issue}</p>`).join('')}</div>
      <div class="table-wrap tool-result-table"><table><thead><tr><th>方案</th><th>试点分配 / 曝光 / 转化</th><th>规则预测</th>${hybrid ? '<th>混合预测</th>' : ''}<th>校准估计</th><th>${observed}观测</th><th>规则偏差</th></tr></thead><tbody>
      ${arms.map((id) => {
        const item = report.arms[id];
        return `<tr><td>${id.toUpperCase()}</td><td>${count(item.assigned)} / ${count(item.exposed)} / ${count(item.converted)}</td><td>${rate(item.simulatedRate)}</td>
          ${hybrid ? `<td>${rate(hybrid.arms[id].simulatedRate)}</td>` : ''}<td>${rate(item.calibratedRate)}</td><td>${rate(item.rate)}</td><td>${points(item.delta, true)}</td></tr>`;
      }).join('')}</tbody></table></div>
      <div class="table-wrap"><table><thead><tr><th>相对分配人数的漏斗</th><th>A 模拟 / 试点</th><th>B 模拟 / 试点</th></tr></thead><tbody>${stages}</tbody></table></div>`;
  }

  trialForm.addEventListener('submit', (event) => {
    event.preventDefault();
    if (!workbench) return;
    try {
      const trial = JSON.parse(get('trial-input').value);
      const { protocol, prediction, model } = workbench;
      const report = compareTrial(protocol, prediction, trial);
      const hybrid = model?.prediction ? compareTrial(protocol, model.prediction, trial) : null;
      renderTrial(report, hybrid);
      message(get('trial-feedback'), '已完成同口径检查和差异诊断。', 'success');
    } catch (error) {
      get('trial-results').replaceChildren();
      message(get('trial-feedback'), error instanceof SyntaxError ? '试点 JSON 格式无效。' : error.message, 'error');
    }
  });

  get('trial-example').addEventListener('click', () => {
    const { protocol, prediction } = workbench;
    get('trial-input').value = JSON.stringify(exampleTrial(protocol, prediction), null, 2);
    message(get('trial-feedback'), '已填入合成示例。');
  });

  get('trial-template').addEventListener('click', () => {
    const { protocol, prediction } = workbench;
    const template = exampleTrial(protocol, prediction);
    template.trialId = '';
    template.source = 'field';
    for (const item of Object.values(template.arms)) {
      item.assigned = null;
      item.exposed = null;
      item.converted = null;
      item.stages = {};
    }
    download(template, `counterfolk-pilot-${protocol.id}.json`);
  });

  get('trial-upload').addEventListener('change', async ({ target }) => {
    try {
      if (!target.files[0]) return;
      if (target.files[0].size > 1_000_000) throw new Error('试点文件超过大小上限。');
      get('trial-input').value = await target.files[0].text();
      message(get('trial-feedback'), '已读取文件，可进行口径核对。');
    } catch (error) {
      message(get('trial-feedback'), error.message, 'error');
    } finally { target.value = ''; }
  });

  get('workbench-upload').addEventListener('change', async ({ target }) => {
    const feedback = get('workbench-feedback');
    try {
      if (!target.files[0] || restoring) return;
      if (target.files[0].size > 2_500_000) throw new Error('工作包超过大小上限。');
      const json = JSON.parse(await target.files[0].text());
      const input = json.workbench ?? json;
      if (input?.format !== bundleFormat) throw new Error('需要 Counterfolk 实验工作包。');
      const protocol = freezeExperiment(input.protocol);
      if (protocol.id !== input.protocol?.id || input.protocol?.engineVersion !== protocol.engineVersion) {
        throw new Error('实验定义发生变化，或版本与当前引擎不一致。');
      }
      validatePrediction(input.prediction, protocol);
      if (input.model?.prediction) validatePrediction(input.model.prediction, protocol);
      const model = input.model?.decisions ? {
        capturedAt: typeof input.model.capturedAt === 'string' ? input.model.capturedAt : null,
        summary: { requests: Number(input.model.summary?.requests), failed: Number(input.model.summary?.failed) },
        decisions: sanitizeReplay(input.model.decisions),
        prediction: input.model.prediction ? predictionSnapshot(input.model.prediction) : null,
      } : null;
      restoring = true;
      refreshActions();
      await runPrediction(protocol.config);
      workbench = { format: bundleFormat, protocol, prediction: predictionSnapshot(input.prediction),
        frozenAt: typeof input.frozenAt === 'string' ? input.frozenAt.slice(0, 32) : null, model };
      for (const name of ['unit', 'denominator']) protocolForm.elements[name].value = protocol[name];
      for (const name of ['allocationB', 'tolerance', 'minimumEffect']) protocolForm.elements[name].value = Number((protocol[name] * 100).toFixed(8));
      for (const id of arms) {
        protocolForm.elements[`version${id.toUpperCase()}`].value = protocol.offers[id].version;
        protocolForm.elements[`content${id.toUpperCase()}`].value = protocol.offers[id].content;
      }
      clearReports();
      renderModel();
      message(get('protocol-status'), `已恢复 ${protocol.id} 的冻结预测。`, 'success');
      message(feedback, '工作包已导入。已恢复预先冻结的模拟预测。', 'success');
    } catch (error) {
      message(feedback, error instanceof SyntaxError ? '工作包 JSON 格式无效。' : error.message, 'error');
    } finally {
      restoring = false;
      target.value = '';
      refreshActions();
    }
  });

  function setResult(result) {
    if (!result.ai) baseline = result;
    if (workbench && key(workbench.protocol.config) !== key(result.config)) {
      message(get('protocol-status'), '当前方案已变更。重新锁定后可用于 AI，原工作包仍可用于真人对照。');
    } else if (!workbench) {
      message(get('protocol-status'), `当前实验 · ${result.config.name} · ${lookup(METRICS, result.config.metric)} · ${result.config.days} 天`);
    }
    refreshActions();
  }

  return {
    setResult,
    setBusy(value) { simulationBusy = value; refreshActions(); },
    exportBundle(config) { return workbench && key(config) === key(workbench.protocol.config) ? workbench : null; },
  };
}

function sanitizeReplay(input) {
  const decision = (item) => {
    if (!Object.hasOwn(comprehension, item?.comprehension) || typeof item.reason !== 'string'
      || !item.reason.trim() || item.reason.length > 500) throw new Error('工作包内的模型决策格式无效。');
    return { comprehension: item.comprehension, reason: item.reason };
  };
  if (!Array.isArray(input.selected) || !Array.isArray(input.entries) || input.selected.length > 20
    || input.entries.length > input.selected.length || input.selected.some((id) => !Number.isSafeInteger(id) || id <= 0)) {
    throw new Error('工作包内的模型样本格式无效。');
  }
  const selected = [...new Set(input.selected)];
  const entries = input.entries.map(({ agentId, a, b }) => {
    if (!selected.includes(agentId)) throw new Error('工作包内的模型样本与决策不一致。');
    return { agentId, a: decision(a), b: decision(b) };
  });
  if (new Set(entries.map((entry) => entry.agentId)).size !== entries.length) throw new Error('工作包内有重复模型决策。');
  const profile = Object.fromEntries(['provider', 'model', 'version', 'promptVersion'].filter((name) =>
    typeof input.profile?.[name] === 'string' && input.profile[name].length <= 160).map((name) => [name, input.profile[name]]));
  return {
    selected, entries, profile, mode: input.mode === 'interview' ? 'interview' : 'hybrid',
    attempted: selected.length, successful: entries.length, fallback: selected.length - entries.length,
    changed: Number.isSafeInteger(input.changed) && input.changed >= 0 && input.changed <= entries.length ? input.changed : 0,
  };
}
