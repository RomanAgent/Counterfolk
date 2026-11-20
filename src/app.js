import {
  CHANNELS, CULTURES, CURRENCIES, DEFAULT_CONFIG, ENGINE_VERSION, LANGUAGES, METRICS, REGIONS, SEGMENTS,
  evaluateCalibration, fitCalibration, normalizeConfig,
} from './simulation.js';
import { CSV_COLUMNS, exampleCalibrationCsv, parseCalibrationCsv } from './calibration-csv.js';
import { createTrendChart, createWorldMap } from './visuals.js';
import { createStreetView } from './street-view.js';
import { createExperimentTools } from './experiment-tools.js';

const get = (id) => document.getElementById(id);
const arms = ['a', 'b'];
const names = { world: '世界概览', street: '街区漫游', experiments: '实验管理', audience: '居民与人群', calibration: '真实结果校准' };
const stages = { unexposed: '未曝光', exposed: '已曝光', considered: '已考虑', purchase: '已购买', install: '已安装', activation: '已激活', paid: '已付费' };
const targetLabels = { met: '达到阈值', below: '低于目标', uncertain: '结果接近阈值', 'no-data': '暂无曝光' };
const integer = new Intl.NumberFormat('zh-CN');
const percent = new Intl.NumberFormat('zh-CN', { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 });
const datetime = new Intl.DateTimeFormat('zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
const initialConfig = { ...DEFAULT_CONFIG, variants: { ...DEFAULT_CONFIG.variants, b: { ...DEFAULT_CONFIG.variants.b, price: 109 } } };
const storageKey = 'counterfolk-v1';
const form = get('settings-form');
const settings = get('settings');
const matrix = get('group-select');

let saved = {};
try { saved = JSON.parse(localStorage.getItem(storageKey)) || {}; } catch { /* storage can be unavailable */ }
let history = Array.isArray(saved.history) ? saved.history.slice(0, 10) : [];
let calibration = null;
let selectedRegion = null;
let result = null;
let activeRun = null;
let lastDuration = null;
let toastTimer;
let csvIsExample = false;

const map = createWorldMap(get('world-map'), { onRegionChange: selectRegion });
const trend = createTrendChart(get('trend'));
const worker = new Worker(new URL('./worker.js', import.meta.url), { type: 'module' });
const streetView = createStreetView({
  onDemo: () => run({
    ...initialConfig, name: 'AirLoop 随身空气监测器 · 门店试卖',
    variants: Object.fromEntries(arms.map((id) => [id, { ...initialConfig.variants[id], channel: 'retail' }])),
  }),
  onNotify: toast,
});
const experimentTools = createExperimentTools({
  runPrediction, download: downloadJson, escapeHtml, lookup, count, rate, points, message,
});

function escapeHtml(value) {
  const chars = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  return String(value ?? '').replace(/[&<>"']/g, (char) => chars[char]);
}

function icon(name) {
  return `<svg aria-hidden="true"><use href="#icon-${name}"></use></svg>`;
}

function lookup(catalog, id) {
  return catalog.find((item) => item.id === id)?.name ?? id;
}

function rate(value) {
  return Number.isFinite(value) ? percent.format(value) : '—';
}

function points(value, sign = false) {
  if (!Number.isFinite(value)) return '—';
  const rounded = Math.round(value * 10_000) / 100;
  return `${sign && rounded > 0 ? '+' : ''}${rounded.toFixed(2)} 个百分点`;
}

function interval(bounds) {
  return bounds?.length ? `${rate(bounds[0])} 至 ${rate(bounds[1])}` : '—';
}

function count(value) {
  return Number.isFinite(value) ? integer.format(value) : '—';
}

function price(amount, currency) {
  return new Intl.NumberFormat('zh-CN', { style: 'currency', currency, maximumFractionDigits: 2 }).format(amount);
}

function message(element, value, tone = '') {
  element.textContent = value;
  element.dataset.tone = tone;
}

function toast(value, lasting = false) {
  const element = get('toast');
  clearTimeout(toastTimer);
  element.textContent = value;
  element.hidden = !value;
  if (value && !lasting) toastTimer = setTimeout(() => { element.hidden = true; }, 4000);
}

function persist() {
  try {
    localStorage.setItem(storageKey, JSON.stringify({
      history, config: result?.config ?? saved.config,
      calibration: calibration ? { csv: calibration.csv, example: calibration.example } : null,
    }));
  } catch {
    toast('浏览器存储不可用，本次结果可导出。');
  }
}

function route() {
  const hash = location.hash.slice(1);
  const current = Object.hasOwn(names, hash) ? hash : 'world';
  for (const view of document.querySelectorAll('[data-view]')) view.hidden = view.dataset.view !== current;
  for (const link of document.querySelectorAll('[data-route]')) {
    if (link.dataset.route === current) link.setAttribute('aria-current', 'page');
    else link.removeAttribute('aria-current');
  }
  get('breadcrumb-title').textContent = names[current];
  document.title = `${names[current]} · Counterfolk`;
  streetView.show(current === 'street', selectedRegion);
  window.scrollTo(0, 0);
}

function selectRegion(id) {
  const group = result?.groups.regions.find((item) => item.id === id);
  selectedRegion = group?.id ?? null;
  get('market-select').value = selectedRegion ?? 'all';
  map.update({ selectedRegion });
  for (const button of document.querySelectorAll('.market-item')) {
    button.setAttribute('aria-pressed', String(button.dataset.market === selectedRegion));
  }
  const { a, b } = group ?? result ?? {};
  const label = group ? `${group.name} · ${REGIONS.find((item) => item.id === group.id).city}` : '全部市场';
  get('market-description').textContent = result
    ? `${label} · ${count(a.population)} 位居民 · A ${rate(a.rate)} / B ${rate(b.rate)}`
    : '正在生成模拟世界';
  if (result) renderFunnel(a, b, label);
}

function options(items, field = (item) => item.name) {
  return items.map((item) => `<option value="${escapeHtml(item.id)}">${escapeHtml(field(item))}</option>`).join('');
}

function renderWorld() {
  const { config, a, b, daily, groups, comparison } = result;
  get('world-experiment-name').textContent = config.name;
  get('world-experiment-name').title = config.name;
  get('metric-population').textContent = count(config.population);
  get('metric-population-caption').textContent = `${groups.regions.length} 个市场 · ${config.days} 天观察期`;
  get('metric-a').textContent = rate(a.rate);
  get('metric-b').textContent = rate(b.rate);
  get('metric-a-caption').textContent = `${count(a.converted)} / ${count(a.exposed)} 人曝光`;
  const captionB = get('metric-b-caption');
  const lift = Number.isFinite(comparison?.lift) ? `较 A ${points(comparison.lift, true)}` : '';
  const adjusted = Number.isFinite(b.calibratedRate)
    ? `${calibration?.example ? '示例校准' : '校准估计'} ${rate(b.calibratedRate)}` : '';
  captionB.textContent = [lift, adjusted].filter(Boolean).join(' · ') || `${count(b.converted)} / ${count(b.exposed)} 人曝光`;
  captionB.dataset.tone = comparison?.lift > 0 ? 'good' : '';
  captionB.title = `${count(b.converted)} / ${count(b.exposed)} 人曝光`;
  get('metric-target').textContent = rate(config.target);
  const targetCaption = get('metric-target-caption');
  targetCaption.textContent = b.targetStatus ? `${result.ai?.mode === 'hybrid' ? '混合模拟' : '原始模拟'} · ${targetLabels[b.targetStatus]}` : '—';
  targetCaption.dataset.tone = b.targetStatus === 'met' ? 'good' : b.targetStatus === 'uncertain' ? 'warning' : '';
  get('market-select').innerHTML = '<option value="all">全部市场</option>' + options(groups.regions);
  get('market-list').innerHTML = groups.regions.map((group) => `
    <button class="market-item" type="button" data-market="${group.id}" aria-pressed="false">
      <i aria-hidden="true"></i><span>${escapeHtml(group.name)}</span><strong>${count(group.a.population)}</strong>
    </button>`).join('');
  map.update({ regionCounts: Object.fromEntries(groups.regions.map(({ id, a: stats }) => [id, stats.population])) });
  selectRegion(selectedRegion);
  trend.update({
    days: daily, metric: config.metric,
    variantAName: config.variants.a.name, variantBName: config.variants.b.name,
  });
}

function renderFunnel(a, b, label) {
  const { config } = result;
  const keys = [['exposed', '已曝光'], ['considered', '已考虑']];
  if (config.product === 'hardware') keys.push(['purchase', '已购买']);
  else keys.push(['install', '已安装'], ['activation', '已激活'], ['paid', '已付费']);
  get('funnel-note').textContent = `${label} · A / B`;
  const cap = Math.max(1, a.exposed, b.exposed);
  get('funnel').innerHTML = keys.map(([key, stage]) => `<div class="funnel-stage">
    <div class="funnel-counts"><span>${stage}</span><small>${count(a[key])} / ${count(b[key])}</small></div>
    <i class="bar-track" aria-hidden="true"><i class="bar variant-a" style="--fill:${100 * a[key] / cap}%"></i></i>
    <i class="bar-track" aria-hidden="true"><i class="bar variant-b" style="--fill:${100 * b[key] / cap}%"></i></i>
  </div>`).join('');
}

function renderExperiments() {
  const { config, a, b, comparison } = result;
  get('experiment-summary').innerHTML = `<article class="panel">
    <div class="panel-header"><div><h2>${escapeHtml(config.name)}</h2><p>${lookup(METRICS, config.metric)}转化 · ${config.days} 天${result.ai?.mode === 'hybrid' ? ' · AI 混合模拟' : ''}</p></div><button type="button" class="button button-muted" data-open-settings>${icon('settings')}调整参数</button></div>
    <div class="experiment-meta"><span>种子 ${config.seed}</span><span>${count(config.population)} 位居民</span><span>目标 ${rate(config.target)}</span><span>B − A ${points(comparison.lift, true)}</span><span>配对抽样区间 ${Number.isFinite(comparison.lift) ? comparison.interval.map(bound => points(bound, true)).join(' 至 ') : '—'}</span></div>
    <div class="variant-grid">${[a, b].map((stats, index) => {
      const id = arms[index];
      const variant = config.variants[id];
      return `<section class="variant-detail"><h3>${id.toUpperCase()} · ${escapeHtml(variant.name)}</h3><strong>${rate(stats.rate)}</strong>
        <p>${price(variant.price, config.currency)}${variant.shippingFee ? ` + 运费 ${price(variant.shippingFee, config.currency)}` : ''} · ${lookup(CHANNELS, variant.channel)} · ${count(stats.converted)} / ${count(stats.exposed)} 人曝光</p>
        <p>模拟抽样区间 ${interval(stats.interval)}</p>
        <p>${Number.isFinite(stats.calibratedRate) ? `${calibration?.example ? '示例校准' : '校准后估计'} ${rate(stats.calibratedRate)}` : '暂无同口径校准'}</p>
      </section>`;
    }).join('')}</div></article>`;
  get('run-list').innerHTML = history.map((entry, index) => `<tr>
    <td>${escapeHtml(entry.config.name)}<small>${datetime.format(new Date(entry.date))} · 种子 ${entry.config.seed}</small></td>
    <td>${lookup(METRICS, entry.config.metric)}</td><td>${count(entry.config.population)}</td>
    <td>${rate(entry.a)}</td><td>${rate(entry.b)}</td>
    <td><button type="button" class="button button-muted" data-replay="${index}">重放</button></td>
  </tr>`).join('') || '<tr><td colspan="6">还没有运行记录。</td></tr>';
}

function renderAudience() {
  if (!result) return;
  const rows = result.groups[matrix.value] ?? [];
  const cell = (stats) => `${rate(stats.rate)}${Number.isFinite(stats.calibratedRate) ? `<small>${calibration?.example ? '示例' : '校准'} ${rate(stats.calibratedRate)}</small>` : ''}`;
  get('audience-table').innerHTML = rows.map(({ name, a, b }) => `<tr>
    <td>${escapeHtml(name)}</td><td>${count(Math.max(a.population, b.population))}</td>
    <td>${count(a.exposed)}</td><td>${cell(a)}</td><td>${count(b.exposed)}</td><td>${cell(b)}</td>
  </tr>`).join('') || '<tr><td colspan="6">暂无数据。</td></tr>';
  get('exit-reasons').innerHTML = arms.map((id) => {
    const entry = Object.entries(result[id].reasons).sort((a, b) => b[1] - a[1]);
    return `<article class="panel"><div class="panel-header"><div><h2>${id.toUpperCase()} 退出原因</h2><p>本轮未达到主转化事件的居民</p></div></div><ul class="reason-list">
      ${entry.map(([reason, total]) => `<li><span>${escapeHtml(reason)}</span><strong>${count(total)}</strong></li>`).join('') || '<li>暂无退出记录。</li>'}
    </ul></article>`;
  }).join('');
  const event = (value) => `${stages[value.stage] ?? '—'}<small>${value.day ? `第 ${value.day} 天` : '观察期内'}${value.reason ? ` · ${escapeHtml(value.reason)}` : ''}</small>`;
  get('agent-samples').innerHTML = result.agents.map((agent) => `<tr>
    <td>#${agent.id}<small>预算 ${price(agent.budget, result.config.currency)}</small></td><td>${lookup(REGIONS, agent.region)}</td>
    <td>${escapeHtml(agent.occupation)} · ${lookup(CULTURES, agent.culture)}<small>${lookup(SEGMENTS, agent.segment)} · ${escapeHtml(agent.preference)}</small></td>
    <td>${lookup(LANGUAGES, agent.language)}</td><td>${event(agent.a)}</td><td>${event(agent.b)}</td>
  </tr>`).join('');
}

function run(config, options = {}) {
  if (activeRun) return false;
  activeRun = { record: options.record ?? true, announce: options.announce ?? true, complete: options.complete };
  experimentTools.setBusy(true);
  get('submit-run').disabled = true;
  get('export').disabled = true;
  for (const button of document.querySelectorAll('[data-replay]')) button.disabled = true;
  get('fit-calibration').disabled = true;
  get('clear-calibration').disabled = true;
  if (activeRun.announce) toast('正在运行模拟…', true);
  worker.postMessage({ config, calibration: calibration?.model ?? null, decisions: options.decisions });
  return true;
}

function runPrediction(config, decisions) {
  return new Promise((resolve, reject) => {
    const started = run(config, { decisions, record: false, announce: false, complete: (error, value) => {
      if (error) reject(new Error(error));
      else resolve(value);
    } });
    if (!started) reject(new Error('已有实验运行中，请稍后重试。'));
  });
}

function finishRun(error) {
  const task = activeRun;
  activeRun = null;
  experimentTools.setBusy(false);
  get('submit-run').disabled = false;
  get('export').disabled = !result;
  for (const button of document.querySelectorAll('[data-replay]')) button.disabled = false;
  get('fit-calibration').disabled = false;
  get('clear-calibration').disabled = false;
  if (error) {
    toast(error, true);
    if (settings.open) message(get('settings-feedback'), error, 'error');
  }
  task?.complete?.(error, result);
}

worker.addEventListener('message', ({ data }) => {
  if (data.type === 'progress') {
    if (activeRun?.announce) toast(`正在运行模拟 · ${Math.round(data.fraction * 100)}%`, true);
    return;
  }
  if (data.type === 'error') {
    finishRun(data.message);
    return;
  }
  if (data.type !== 'complete') return;
  const { record, announce } = activeRun ?? {};
  result = data.result;
  lastDuration = data.durationMs;
  if (record) {
    const key = JSON.stringify(result.config);
    history = [
      { config: result.config, date: Date.now(), a: result.a.rate, b: result.b.rate },
      ...history.filter((entry) => JSON.stringify(entry.config) !== key),
    ].slice(0, 10);
  }
  renderWorld();
  renderExperiments();
  renderAudience();
  streetView.setResult(result);
  experimentTools.setResult(result);
  persist();
  finishRun();
  if (announce) toast(`模拟完成 · ${count(result.config.population)} 位居民 · ${lastDuration} ms`);
});
worker.addEventListener('error', () => finishRun('无法启动模拟 Worker，请通过本地服务器打开页面后刷新。'));

function setMetrics(product, selected) {
  const select = form.elements.metric;
  select.innerHTML = options(METRICS.filter((item) => item.product === product));
  if ([...select.options].some((item) => item.value === selected)) select.value = selected;
}

function populateSettings(config) {
  for (const name of ['name', 'product', 'population', 'days', 'seed', 'culture', 'currency']) {
    form.elements.namedItem(name).value = config[name];
  }
  form.elements.target.value = Number((config.target * 100).toFixed(6));
  setMetrics(config.product, config.metric);
  for (const key of ['regions', 'segments', 'languages']) {
    for (const checkbox of form.querySelectorAll(`input[name="${key}"]`)) checkbox.checked = config[key].includes(checkbox.value);
  }
  for (const id of arms) {
    for (const key of ['name', 'price', 'shippingFee', 'appeal', 'localization', 'channel']) {
      form.elements.namedItem(`${id}-${key}`).value = config.variants[id][key] ?? 0;
    }
  }
  updateShippingFields();
}

function updateShippingFields() {
  for (const id of arms) {
    const field = form.elements.namedItem(`${id}-shippingFee`);
    field.disabled = form.elements.product.value !== 'hardware' || form.elements.namedItem(`${id}-channel`).value !== 'ecommerce';
    field.closest('label').hidden = field.disabled;
  }
}

function initializeSettings() {
  form.elements.currency.innerHTML = options(CURRENCIES, ({ id, name }) => `${id} · ${name}`);
  form.elements.culture.innerHTML = options(CULTURES);
  for (const [key, catalog] of [['regions', REGIONS], ['segments', SEGMENTS], ['languages', LANGUAGES]]) {
    get(`${key}-fields`).innerHTML = catalog.map(({ id, name }) =>
      `<label><input type="checkbox" name="${key}" value="${id}">${escapeHtml(name)}</label>`).join('');
  }
  get('variant-settings').innerHTML = arms.map((id) => `<fieldset><legend>方案 ${id.toUpperCase()}</legend><div class="variant-fields">
    <label>名称<input name="${id}-name" required maxlength="48"></label>
    <label>价格<input name="${id}-price" type="number" required min="0" max="10000000" step="any"></label>
    <label>投放渠道<select name="${id}-channel">${options(CHANNELS)}</select></label>
    <label>运费<input name="${id}-shippingFee" type="number" min="0" max="10000000" step="any" required></label>
    <label>吸引力 (0–100)<input name="${id}-appeal" type="number" required min="0" max="100" step="any"></label>
    <label>本地化 (0–100)<input name="${id}-localization" type="number" required min="0" max="100" step="any"></label>
  </div></fieldset>`).join('');
  for (const id of arms) form.elements.namedItem(`${id}-channel`).addEventListener('change', updateShippingFields);
  form.elements.product.addEventListener('change', () => {
    const { product, currency } = form.elements;
    setMetrics(product.value);
    const defaults = normalizeConfig({ product: product.value, currency: currency.value });
    for (const id of arms) form.elements.namedItem(`${id}-price`).value = Number(defaults.variants[id].price.toFixed(2));
    updateShippingFields();
  });
  form.addEventListener('submit', (event) => {
    event.preventDefault();
    if (activeRun) return;
    const fields = new FormData(form);
    try {
      const config = normalizeConfig({
        ...Object.fromEntries(fields),
        target: Number(fields.get('target')) / 100,
        regions: fields.getAll('regions'), segments: fields.getAll('segments'), languages: fields.getAll('languages'),
        variants: Object.fromEntries(arms.map((id) => [id, Object.fromEntries(
          ['name', 'price', 'shippingFee', 'channel', 'appeal', 'localization'].map((key) => [key, fields.get(`${id}-${key}`) ?? 0])
        )])),
      });
      settings.close();
      run(config);
    } catch (error) {
      message(get('settings-feedback'), error.message, 'error');
    }
  });
}

function fitCsv(csv, example) {
  const rows = parseCalibrationCsv(csv);
  const model = fitCalibration(rows);
  if (!model.holdoutExperiments.length) throw new Error('请添加至少一个独立的留出实验（holdout）。');
  return { model, report: evaluateCalibration(rows, model), csv, example };
}

function renderCalibration() {
  get('clear-calibration').hidden = !calibration;
  if (!calibration) {
    get('calibration-results').innerHTML = '';
    return;
  }
  const { report, model, example } = calibration;
  get('calibration-results').innerHTML = `<article class="panel">
    <div class="panel-header"><div><h2>${example ? '示例数据 · 留出验证' : '留出验证'}</h2><p>${count(model.trainExperiments.length)} 个训练实验 · ${count(model.holdoutExperiments.length)} 个留出实验</p></div></div>
    <div class="experiment-meta"><span>匹配 ${count(report.matchedRows)} / ${count(report.rows.length)} 行</span><span>匹配行真实曝光 ${count(report.matchedRealExposed)}</span></div>
    <div class="experiment-meta calibration-results-meta"><span>匹配行校准前误差 ${points(report.rawMAE)}</span><span>匹配行校准后误差 ${points(report.calibratedMAE)}</span><span>按真实曝光数加权</span></div>
    <div class="table-wrap"><table><thead><tr><th>留出实验</th><th>口径</th><th>模拟</th><th>校准</th><th>真实</th><th>真实曝光</th></tr></thead><tbody>
    ${report.rows.map((row) => `<tr><td>${escapeHtml(row.experimentId)} · ${row.variant.toUpperCase()}</td><td>${lookup(METRICS, row.metric)} · ${row.days} 天 · ${lookup(CHANNELS, row.channel)}<small>${row.region === 'all' ? '全部市场' : lookup(REGIONS, row.region)} · ${row.segment === 'all' ? '全部人群' : lookup(SEGMENTS, row.segment)}</small></td>
    <td>${rate(row.rawRate)}</td><td>${rate(row.calibratedRate)}</td><td>${rate(row.realRate)}</td><td>${count(row.realExposed)}</td></tr>`).join('')}
    </tbody></table></div>
  </article>`;
}

function downloadJson(value, filename) {
  const serialized = JSON.stringify(value, null, 2);
  const url = URL.createObjectURL(new Blob([serialized], { type: 'application/json' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportResult() {
  if (!result) return;
  downloadJson({
    ...result, durationMs: lastDuration,
    calibration: calibration ? { source: calibration.example ? 'synthetic-example' : 'user-import', model: calibration.model } : null,
    workbench: experimentTools.exportBundle(result.config),
  }, `counterfolk-${result.config.seed}-${new Date().toISOString().slice(0, 10)}.json`);
}

get('engine-version').textContent = `v${ENGINE_VERSION} · 规则驱动`;
get('csv-columns').textContent = CSV_COLUMNS.join(',');
get('market-select').addEventListener('change', ({ target }) => selectRegion(target.value));
get('market-list').addEventListener('click', ({ target }) => {
  const id = target.closest('[data-market]')?.dataset.market;
  if (id) selectRegion(id === selectedRegion ? null : id);
});
get('map-in').addEventListener('click', () => map.zoomIn());
get('map-out').addEventListener('click', () => map.zoomOut());
get('map-reset').addEventListener('click', () => { map.reset(); selectRegion(null); });
get('export').addEventListener('click', exportResult);
matrix.addEventListener('change', renderAudience);
get('close-settings').addEventListener('click', () => settings.close());
get('cancel-settings').addEventListener('click', () => settings.close());
document.addEventListener('click', ({ target }) => {
  if (target.closest('[data-open-settings]')) {
    populateSettings(result?.config ?? initialConfig);
    message(get('settings-feedback'), '');
    settings.showModal();
  }
  const replay = target.closest('[data-replay]');
  if (replay && !activeRun) run(history[Number(replay.dataset.replay)].config);
});
get('calibration-input').addEventListener('input', ({ target }) => {
  if (!target.value.trim()) csvIsExample = false;
});
get('load-example').addEventListener('click', () => {
  get('calibration-input').value = exampleCalibrationCsv(result?.config ?? initialConfig);
  csvIsExample = true;
  message(get('calibration-feedback'), '已填入合成示例，点击拟合并验证演示流程。');
});
get('csv-upload').addEventListener('change', async ({ target }) => {
  const file = target.files[0];
  if (!file) return;
  try {
    if (file.size > 1_500_000) throw new Error('文件过大，请缩小 CSV 后重试。');
    get('calibration-input').value = await file.text();
    csvIsExample = false;
    message(get('calibration-feedback'), `已读取 ${file.name}。`);
  } catch (error) {
    message(get('calibration-feedback'), error.message, 'error');
  } finally {
    target.value = '';
  }
});
get('fit-calibration').addEventListener('click', () => {
  try {
    calibration = fitCsv(get('calibration-input').value, csvIsExample);
    renderCalibration();
    persist();
    message(get('calibration-feedback'), calibration.report.matchedRows
      ? '拟合已应用，留出验证见下方。'
      : '拟合已应用。留出数据暂无同口径训练行。', 'success');
    run(result?.config ?? initialConfig, { record: false, announce: false });
  } catch (error) {
    message(get('calibration-feedback'), error.message, 'error');
  }
});
get('clear-calibration').addEventListener('click', () => {
  calibration = null;
  renderCalibration();
  persist();
  message(get('calibration-feedback'), '已恢复原始模拟。');
  run(result?.config ?? initialConfig, { record: false, announce: false });
});
window.addEventListener('hashchange', route);

initializeSettings();
route();
try {
  if (saved.calibration?.csv) {
    calibration = fitCsv(saved.calibration.csv, Boolean(saved.calibration.example));
    get('calibration-input').value = calibration.csv;
    csvIsExample = calibration.example;
    renderCalibration();
  }
} catch (error) {
  message(get('calibration-feedback'), `已保存的校准无法恢复。 ${error.message}`, 'error');
}
let bootConfig = initialConfig;
try { if (saved.config) bootConfig = normalizeConfig(saved.config); } catch { /* obsolete settings fall back to demo */ }
run(bootConfig, { record: history.length === 0, announce: false });
