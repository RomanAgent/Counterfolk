export const ENGINE_VERSION = '1.0.0';

export const REGIONS = [
  { id: 'us', name: '美国', city: '纽约', latitude: 40.71, longitude: -74, language: 'en', locale: 'en-US' },
  { id: 'gb', name: '英国', city: '伦敦', latitude: 51.51, longitude: -0.13, language: 'en', locale: 'en-GB' },
  { id: 'de', name: '德国', city: '柏林', latitude: 52.52, longitude: 13.4, language: 'de', locale: 'de-DE' },
  { id: 'cn', name: '中国', city: '北京', latitude: 39.90, longitude: 116.41, language: 'zh', locale: 'zh-CN' },
  { id: 'in', name: '印度', city: '孟买', latitude: 19.08, longitude: 72.88, language: 'hi', locale: 'hi-IN' },
  { id: 'jp', name: '日本', city: '东京', latitude: 35.68, longitude: 139.69, language: 'ja', locale: 'ja-JP' },
  { id: 'au', name: '澳大利亚', city: '悉尼', latitude: -33.87, longitude: 151.21, language: 'en', locale: 'en-AU' },
  { id: 'br', name: '巴西', city: '圣保罗', latitude: -23.55, longitude: -46.63, language: 'pt', locale: 'pt-BR' },
];

export const SEGMENTS = [
  { id: 'value', name: '价格敏感型' },
  { id: 'practical', name: '实用导向型' },
  { id: 'enthusiast', name: '乐于尝鲜型' },
];

export const CHANNELS = [
  { id: 'ecommerce', name: '电商店铺' },
  { id: 'retail', name: '线下门店' },
];

export const CULTURES = [
  { id: 'mixed', name: '混合画像' },
  { id: 'independent', name: '自主探索' },
  { id: 'community', name: '重视社群' },
  { id: 'routine', name: '依赖熟悉流程' },
];

export const LANGUAGES = [
  { id: 'en', name: '英语' }, { id: 'zh', name: '中文' }, { id: 'de', name: '德语' },
  { id: 'ja', name: '日语' }, { id: 'hi', name: '印地语' }, { id: 'pt', name: '葡萄牙语' },
  { id: 'es', name: '西班牙语' }, { id: 'fr', name: '法语' }, { id: 'bn', name: '孟加拉语' },
];

export const METRICS = [
  { id: 'purchase', name: '购买', product: 'hardware' },
  { id: 'install', name: '安装', product: 'app' },
  { id: 'activation', name: '激活', product: 'app' },
  { id: 'paid', name: '付费', product: 'app' },
];

export const CURRENCIES = [
  { id: 'USD', name: '美元', scale: 1 }, { id: 'GBP', name: '英镑', scale: 0.8 },
  { id: 'EUR', name: '欧元', scale: 0.9 }, { id: 'JPY', name: '日元', scale: 140 },
  { id: 'BRL', name: '巴西雷亚尔', scale: 5 }, { id: 'CNY', name: '人民币', scale: 7 },
  { id: 'INR', name: '印度卢比', scale: 83 }, { id: 'AUD', name: '澳元', scale: 1.5 },
];

export const DEFAULT_CONFIG = {
  name: 'AirLoop 随身空气监测器',
  product: 'hardware',
  metric: 'purchase',
  population: 100_000,
  seed: 42,
  days: 14,
  target: 0.08,
  currency: 'USD',
  regions: REGIONS.map(({ id }) => id),
  segments: SEGMENTS.map(({ id }) => id),
  culture: 'mixed',
  languages: [],
  variants: {
    a: { name: '方案 A', price: 149, appeal: 58, localization: 75, channel: 'ecommerce' },
    b: { name: '方案 B', price: 119, appeal: 58, localization: 75, channel: 'ecommerce' },
  },
};

const ARM_IDS = ['a', 'b'];
const PRODUCTS = [{ id: 'hardware' }, { id: 'app' }];
const PROFILE_CULTURES = CULTURES.filter(({ id }) => id !== 'mixed');
const OCCUPATIONS = ['学生', '办公室职员', '自由职业者', '服务业职员', '技术人员'];
const Z_95 = 1.959963984540054;

function number(value, label, min, max, integer = false) {
  const parsed = typeof value === 'string' && value.trim() ? Number(value) : value;
  if (!Number.isFinite(parsed) || parsed < min || parsed > max || (integer && !Number.isSafeInteger(parsed))) {
    throw new Error(`${label}须为 ${min} 到 ${max} 的${integer ? '整数' : '数值'}。`);
  }
  return parsed;
}

function label(value, field, max = 100) {
  if (typeof value !== 'string' || !value.trim() || value.trim().length > max) {
    throw new Error(`${field}须填写 1 到 ${max} 个字符。`);
  }
  return value.trim();
}

function choice(value, catalog, field) {
  if (!catalog.some(({ id }) => id === value)) throw new Error(`${field}选项无效。`);
  return value;
}

function choices(values, catalog, field, allowEmpty = false) {
  if (!Array.isArray(values) || (!allowEmpty && !values.length)) throw new Error(`请选择${field}。`);
  const unique = [...new Set(values)];
  unique.forEach(value => choice(value, catalog, field));
  return unique;
}

export function normalizeConfig(input = {}) {
  const config = { ...DEFAULT_CONFIG, ...input };
  const product = choice(config.product, PRODUCTS, '产品类型');
  const metrics = METRICS.filter(item => item.product === product);
  const currency = choice(config.currency, CURRENCIES, '币种');
  const scale = CURRENCIES.find(({ id }) => id === currency).scale;
  const variants = Object.fromEntries(ARM_IDS.map(id => {
    const defaults = DEFAULT_CONFIG.variants[id];
    const price = (product === 'app' ? (id === 'a' ? 12 : 8) : defaults.price) * scale;
    const variant = { ...defaults, price, ...input.variants?.[id] };
    return [id, {
      name: label(variant.name, '方案名称', 48),
      price: number(variant.price, '价格', 0, 10_000_000),
      appeal: number(variant.appeal, '方案吸引力', 0, 100),
      localization: number(variant.localization, '本地化', 0, 100),
      channel: choice(variant.channel, CHANNELS, '渠道'),
    }];
  }));
  return {
    name: label(config.name, '实验名称'),
    product,
    metric: choice(input.metric ?? metrics[0].id, metrics, '转化事件'),
    population: number(config.population, 'Agent 数量', 1000, 100_000, true),
    seed: number(config.seed, '随机种子', 0, 4_294_967_295, true),
    days: number(config.days, '实验天数', 1, 90, true),
    target: number(config.target, '转化目标', 0, 1),
    currency,
    regions: choices(config.regions, REGIONS, '国家或地区'),
    segments: choices(config.segments, SEGMENTS, '买家类型'),
    culture: choice(config.culture, CULTURES, '文化偏好'),
    languages: choices(config.languages, LANGUAGES, '语言', true),
    variants,
  };
}

function randomFrom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let bits = Math.imul(state ^ (state >>> 15), state | 1);
    bits ^= bits + Math.imul(bits ^ (bits >>> 7), bits | 61);
    return ((bits ^ (bits >>> 14)) >>> 0) / 4_294_967_296;
  };
}

function sample(items, draw) {
  return items[Math.floor(draw * items.length)];
}

function probability(value) {
  return 1 / (1 + Math.exp(-value));
}

function logOdds(rate) {
  const clamped = Math.min(1 - 1e-12, Math.max(1e-12, rate));
  return Math.log(clamped / (1 - clamped));
}

function smoothedRate(converted, exposed) {
  return (converted + 0.5) / (exposed + 1);
}

function makeAgent(random, config, regionById, currencyScale) {
  const region = regionById[sample(config.regions, random())];
  const segment = sample(config.segments, random());
  const sampledCulture = sample(PROFILE_CULTURES, random()).id;
  const culture = config.culture === 'mixed' ? sampledCulture : config.culture;
  const languageDraw = random();
  const language = config.languages.length ? sample(config.languages, languageDraw) : region.language;
  const occupation = sample(OCCUPATIONS, random());
  const baseBudget = config.product === 'app' ? 16 : 175;
  const budget = baseBudget * currencyScale * Math.exp((random() - 0.5) * 1.7);
  const need = random();
  const onlinePreference = random();
  const novelty = random();
  return {
    region: region.id, segment, culture, language, occupation, budget, need, onlinePreference, novelty,
    preference: onlinePreference >= 0.6 ? '习惯线上比较' : onlinePreference <= 0.4 ? '习惯到店体验' : '线上和到店均可',
  };
}

function encounterDays(random, agent, days) {
  let ecommerce = null;
  let retail = null;
  for (let day = 1; day <= days; day++) {
    const weekend = day % 7 === 6 || day % 7 === 0;
    const shopChance = (agent.segment === 'enthusiast' ? 0.016 : 0) + agent.need * 0.02;
    const onlineChance = 0.03 + agent.onlinePreference * 0.10 + shopChance;
    const retailChance = 0.02 + (1 - agent.onlinePreference) * 0.07 + shopChance + (weekend ? 0.055 : 0);
    const onlineVisit = random() < onlineChance;
    const retailVisit = random() < retailChance;
    if (ecommerce === null && onlineVisit) ecommerce = day;
    if (retail === null && retailVisit) retail = day;
    if (ecommerce !== null && retail !== null) break;
  }
  return { ecommerce, retail };
}

function journey(agent, variant, product, metric, day, draws) {
  if (day === null) return { day, stage: 'unexposed', reason: '未访问测试渠道' };

  const appeal = variant.appeal / 100;
  const localization = variant.localization / 100;
  const languageFit = agent.language === 'en' ? 1 : localization;
  const experience = variant.channel === 'ecommerce' ? agent.onlinePreference : 1 - agent.onlinePreference;
  const relativePrice = Math.log1p(variant.price / agent.budget);
  const valueSensitivity = agent.segment === 'value' ? 1.45 : 1;
  const curiosity = agent.segment === 'enthusiast' ? 0.25 : 0;
  const cultureFit = agent.culture === 'community' && variant.channel === 'retail' ? 0.12 : 0;
  const routineBarrier = agent.culture === 'routine' ? (1 - experience) * 0.22 : 0;
  const considerChance = probability(
    -0.43 + 1.7 * (appeal - 0.5) + 2 * (agent.need - 0.5) + 0.6 * experience
    + curiosity + cultureFit - routineBarrier - 0.72 * relativePrice * valueSensitivity - 1.25 * (1 - languageFit),
  );
  if (draws.consider >= considerChance) {
    const reason = languageFit < 0.45 ? '商品信息缺少本地化' : '产品需求不足';
    return { day, stage: 'exposed', reason };
  }

  const competitorChance = Math.min(0.95, 0.15 + (1 - appeal) * 0.25 + relativePrice * 0.12);
  if (draws.competitor < competitorChance) return { day, stage: 'considered', reason: '选择了竞品' };

  if (product === 'hardware') {
    const purchaseChance = probability(
      -0.62 + 0.85 * appeal + 1.2 * (agent.need - 0.5) + 0.65 * experience
      - 1.9 * relativePrice * valueSensitivity - 0.8 * (1 - languageFit),
    );
    if (draws.action < purchaseChance) return { day, stage: 'purchase', reason: null };
    return { day, stage: 'considered', reason: relativePrice > 0.6 ? '价格超出预期' : '暂缓购买' };
  }

  const installChance = probability(-0.3 + appeal + 0.9 * agent.novelty + 0.9 * experience - 0.7 * (1 - languageFit));
  if (draws.action >= installChance) return { day, stage: 'considered', reason: '暂缓安装' };

  const activationChance = probability(-0.45 + 1.3 * appeal + 1.2 * agent.need - 1.3 * (1 - languageFit));
  if (draws.activate >= activationChance) {
    return { day, stage: 'install', reason: metric === 'install' ? null : '安装后未激活' };
  }

  const paidChance = probability(-0.75 + 1.15 * appeal + agent.need - 2.2 * relativePrice * valueSensitivity);
  if (draws.pay < paidChance) return { day, stage: 'paid', reason: null };
  return { day, stage: 'activation', reason: metric === 'paid' ? '激活后未付费' : null };
}

function counts() {
  return { population: 0, exposed: 0, considered: 0, purchase: 0, install: 0, activation: 0, paid: 0, reasons: {} };
}

function metricReached(stage, metric) {
  if (stage === metric) return true;
  if (metric === 'install') return stage === 'activation' || stage === 'paid';
  return metric === 'activation' && stage === 'paid';
}

function record(stats, { stage, reason }) {
  stats.population++;
  if (stage !== 'unexposed') stats.exposed++;
  if (stage !== 'unexposed' && stage !== 'exposed') stats.considered++;
  if (stage === 'purchase') stats.purchase++;
  if (metricReached(stage, 'install')) stats.install++;
  if (metricReached(stage, 'activation')) stats.activation++;
  if (stage === 'paid') stats.paid++;
  if (reason) stats.reasons[reason] = (stats.reasons[reason] ?? 0) + 1;
}

function wilson(converted, exposed) {
  if (exposed === 0) return [null, null];
  const rate = converted / exposed;
  const zSquared = Z_95 ** 2;
  const denominator = 1 + zSquared / exposed;
  const center = (rate + zSquared / (2 * exposed)) / denominator;
  const margin = Z_95 * Math.sqrt((rate * (1 - rate) + zSquared / (4 * exposed)) / exposed) / denominator;
  return [Math.max(0, center - margin), Math.min(1, center + margin)];
}

function matchingOffset(calibration, { metric, days, channel, region = 'all', segment = 'all' }) {
  if (calibration?.version !== ENGINE_VERSION) return null;
  const group = calibration.groups?.find(item =>
    item.metric === metric && item.days === days && item.channel === channel && item.region === region && item.segment === segment,
  );
  return group?.offset ?? null;
}

function finish(stats, config, calibration, dimensions = {}) {
  const converted = stats[config.metric];
  const rate = stats.exposed ? converted / stats.exposed : null;
  const interval = wilson(converted, stats.exposed);
  const { region, segment, channel } = dimensions;
  const offset = channel ? matchingOffset(calibration, { metric: config.metric, days: config.days, channel, region, segment }) : null;
  let targetStatus = 'no-data';
  if (rate !== null) {
    if (interval[0] >= config.target) targetStatus = 'met';
    else if (interval[1] < config.target) targetStatus = 'below';
    else targetStatus = 'uncertain';
  }
  return {
    ...stats, converted, rate, interval, targetStatus, targetMet: targetStatus === 'met',
    calibratedRate: offset === null || rate === null ? null : probability(logOdds(smoothedRate(converted, stats.exposed)) + offset),
    calibratedInterval: offset === null || rate === null ? null : interval.map(bound => probability(logOdds(bound) + offset)),
  };
}

function groupCounts(catalog, ids = null) {
  const enabled = ids ? catalog.filter(({ id }) => ids.includes(id)) : catalog;
  return Object.fromEntries(enabled.map(item => [item.id, { ...item, a: counts(), b: counts() }]));
}

function pairedComparison(a, b, pairedOutcomes, population) {
  if (a.rate === null || b.rate === null) return { lift: null, interval: [null, null] };
  const lift = b.rate - a.rate;
  // Estimate the variance of the difference between two ratios measured on the same residents.
  // Each cell represents unexposed (0), exposed (1), or converted (2) in each alternative.
  const variance = pairedOutcomes.reduce((sum, count, index) => {
    const outcomeA = Math.floor(index / 3);
    const outcomeB = index % 3;
    const influenceA = (Number(outcomeA === 2) - a.rate * Number(outcomeA > 0)) / a.exposed;
    const influenceB = (Number(outcomeB === 2) - b.rate * Number(outcomeB > 0)) / b.exposed;
    return sum + count * (influenceB - influenceA) ** 2;
  }, 0);
  const standardError = Math.sqrt(variance * population / (population - 1));
  return { lift, interval: [Math.max(-1, lift - Z_95 * standardError), Math.min(1, lift + Z_95 * standardError)] };
}

/** Each simulated agent can see each alternative once, using shared random draws across the pair. */
export function simulate(input = {}, { calibration, onProgress } = {}) {
  const config = normalizeConfig(input);
  const regionById = Object.fromEntries(REGIONS.map(item => [item.id, item]));
  const currencyScale = CURRENCIES.find(({ id }) => id === config.currency).scale;
  const cultures = config.culture === 'mixed' ? PROFILE_CULTURES.map(({ id }) => id) : [config.culture];
  const languages = config.languages.length ? config.languages : [...new Set(config.regions.map(id => regionById[id].language))];
  const regionSegments = REGIONS.filter(({ id }) => config.regions.includes(id)).flatMap(region =>
    SEGMENTS.filter(({ id }) => config.segments.includes(id)).map(segment => ({
      id: `${region.id}/${segment.id}`, name: `${region.name} · ${segment.name}`, region: region.id, segment: segment.id,
    })),
  );
  const random = randomFrom(config.seed);
  const totals = { a: counts(), b: counts() };
  const groups = {
    regions: groupCounts(REGIONS, config.regions),
    segments: groupCounts(SEGMENTS, config.segments),
    regionSegments: groupCounts(regionSegments),
    channels: groupCounts(CHANNELS),
    cultures: groupCounts(CULTURES, cultures),
    languages: groupCounts(LANGUAGES, languages),
  };
  const daily = Array.from({ length: config.days }, (_, index) => ({ day: index + 1, a: counts(), b: counts() }));
  const agents = [];
  const sampledByRegion = Object.fromEntries(config.regions.map(id => [id, 0]));
  const pairedOutcomes = new Uint32Array(9);
  const progressStep = Math.ceil(config.population / 20);
  onProgress?.(0);

  for (let index = 0; index < config.population; index++) {
    // One seed per agent keeps profiles stable when an experiment changes its duration or offer.
    const agentRandom = randomFrom(Math.floor(random() * 4_294_967_296));
    const agent = makeAgent(agentRandom, config, regionById, currencyScale);
    const draws = { consider: agentRandom(), competitor: agentRandom(), action: agentRandom(), activate: agentRandom(), pay: agentRandom() };
    const days = encounterDays(agentRandom, agent, config.days);
    const a = journey(agent, config.variants.a, config.product, config.metric, days[config.variants.a.channel], draws);
    const b = journey(agent, config.variants.b, config.product, config.metric, days[config.variants.b.channel], draws);
    const stages = { a, b };
    const regionSegment = groups.regionSegments[`${agent.region}/${agent.segment}`];
    for (const id of ARM_IDS) {
      const stage = stages[id];
      record(totals[id], stage);
      record(groups.regions[agent.region][id], stage);
      record(groups.segments[agent.segment][id], stage);
      record(regionSegment[id], stage);
      record(groups.channels[config.variants[id].channel][id], stage);
      record(groups.cultures[agent.culture][id], stage);
      record(groups.languages[agent.language][id], stage);
      if (stage.day !== null) record(daily[stage.day - 1][id], stage);
    }
    const outcomeA = Number(a.day !== null) + Number(metricReached(a.stage, config.metric));
    const outcomeB = Number(b.day !== null) + Number(metricReached(b.stage, config.metric));
    pairedOutcomes[outcomeA * 3 + outcomeB]++;

    if (sampledByRegion[agent.region] < 4) {
      const { region, segment, culture, language, occupation, budget, preference } = agent;
      sampledByRegion[agent.region]++;
      agents.push({ id: index + 1, region, segment, culture, language, occupation, budget: Math.round(budget), preference, a, b });
    }
    if ((index + 1) % progressStep === 0 && index + 1 < config.population) onProgress?.((index + 1) / config.population);
  }

  const a = finish(totals.a, config, calibration, { channel: config.variants.a.channel });
  const b = finish(totals.b, config, calibration, { channel: config.variants.b.channel });
  const groupResults = Object.fromEntries(Object.entries(groups).map(([group, items]) => [group, Object.values(items).map(item => {
    const region = group === 'regions' ? item.id : item.region;
    const segment = group === 'segments' ? item.id : item.segment;
    const groupCalibration = group === 'cultures' || group === 'languages' ? null : calibration;
    return {
      id: item.id,
      name: item.name,
      ...(group === 'regionSegments' ? { region, segment } : {}),
      a: finish(item.a, config, groupCalibration, { region, segment, channel: config.variants.a.channel }),
      b: finish(item.b, config, groupCalibration, { region, segment, channel: config.variants.b.channel }),
    };
  })]));
  const dayResults = daily.map(item => ({ day: item.day, a: finish(item.a, config), b: finish(item.b, config) }));
  const result = { config, version: ENGINE_VERSION, a, b, groups: groupResults, daily: dayResults, agents, comparison: pairedComparison(a, b, pairedOutcomes, config.population) };
  onProgress?.(1);
  return result;
}

function normalizeRows(rows) {
  if (!Array.isArray(rows)) throw new Error('校准数据须为汇总行列表。');
  const experiments = new Map();
  const strata = new Map();
  const exposuresBySplit = { train: 0, holdout: 0 };
  return rows.map((value, index) => {
    try {
      if (!value || typeof value !== 'object') throw new Error('汇总行须包含实验元数据及计数。');
      const row = {
        experimentId: label(value.experimentId, '实验 ID'),
        variant: choice(value.variant, ARM_IDS.map(id => ({ id })), '方案'),
        split: choice(value.split, [{ id: 'train' }, { id: 'holdout' }], '数据分组'),
        metric: choice(value.metric, METRICS, '转化事件'),
        days: number(value.days, '观察天数', 1, 90, true),
        channel: choice(value.channel, CHANNELS, '渠道'),
        region: value.region === 'all' ? value.region : choice(value.region, REGIONS, '国家或地区'),
        segment: value.segment === 'all' ? value.segment : choice(value.segment, SEGMENTS, '买家类型'),
        simulatedExposed: number(value.simulatedExposed, '模拟曝光数', 1, 100_000, true),
        realExposed: number(value.realExposed, '真实曝光数', 1, Number.MAX_SAFE_INTEGER, true),
      };
      row.simulatedConverted = number(value.simulatedConverted, '模拟转化数', 0, row.simulatedExposed, true);
      row.realConverted = number(value.realConverted, '真实转化数', 0, row.realExposed, true);
      exposuresBySplit[row.split] += row.realExposed;
      if (!Number.isSafeInteger(exposuresBySplit[row.split])) throw new Error('同一数据分组的总曝光数超过精确计数范围。');
      const previousSplit = experiments.get(row.experimentId);
      if (previousSplit && previousSplit !== row.split) throw new Error(`实验 ${row.experimentId} 同时出现在训练与留出集中。`);
      experiments.set(row.experimentId, row.split);
      const key = JSON.stringify([row.experimentId, row.variant, row.metric, row.days, row.channel]);
      const groups = strata.get(key) ?? [];
      const overlaps = (a, b) => a === b || a === 'all' || b === 'all';
      if (groups.some(item => overlaps(item.region, row.region) && overlaps(item.segment, row.segment))) {
        throw new Error(`实验 ${row.experimentId} 的同一方案包含重复或重叠的人群汇总。`);
      }
      groups.push(row);
      strata.set(key, groups);
      return row;
    } catch (error) {
      throw new Error(`第 ${index + 1} 行，${error.message}`);
    }
  });
}

function groupIdentity({ metric, days, channel, region, segment }) {
  return { metric, days, channel, region, segment };
}

/** Fit a regularized intercept shift on the log-odds scale for each matching stratum. */
export function fitCalibration(rows) {
  const normalized = normalizeRows(rows);
  const grouped = new Map();
  const training = normalized.filter(row => row.split === 'train');
  if (training.length === 0) throw new Error('至少需要一条训练数据。');
  for (const row of training) {
    const key = JSON.stringify(groupIdentity(row));
    const group = grouped.get(key) ?? [];
    group.push(row);
    grouped.set(key, group);
  }
  const groups = [...grouped.values()].map(items => {
    const realExposed = items.reduce((sum, row) => sum + row.realExposed, 0);
    const observed = items.reduce((sum, row) => sum + row.realConverted, 0);
    let low = -12;
    let high = 12;
    for (let iteration = 0; iteration < 60; iteration++) {
      const offset = (low + high) / 2;
      const expected = items.reduce((sum, row) => {
        const simulatedRate = smoothedRate(row.simulatedConverted, row.simulatedExposed);
        return sum + row.realExposed * probability(logOdds(simulatedRate) + offset);
      }, 0);
      if (expected + 4 * offset > observed) high = offset;
      else low = offset;
    }
    return { ...groupIdentity(items[0]), offset: (low + high) / 2, rows: items.length, realExposed };
  });
  return {
    version: ENGINE_VERSION,
    groups,
    trainExperiments: [...new Set(training.map(row => row.experimentId))],
    holdoutExperiments: [...new Set(normalized.filter(row => row.split === 'holdout').map(row => row.experimentId))],
  };
}

export function evaluateCalibration(rows, calibration) {
  if (!calibration || calibration.version !== ENGINE_VERSION) throw new Error('校准参数版本无效。');
  const holdout = normalizeRows(rows).filter(row => row.split === 'holdout');
  const trainedIds = new Set(calibration.trainExperiments);
  let realExposed = 0;
  let matchedRealExposed = 0;
  let matchedRows = 0;
  let allRawTotal = 0;
  let rawTotal = 0;
  let calibratedTotal = 0;
  const results = holdout.map(row => {
    if (trainedIds.has(row.experimentId)) throw new Error(`留出实验 ${row.experimentId} 已用于训练。`);
    const rawRate = row.simulatedConverted / row.simulatedExposed;
    const realRate = row.realConverted / row.realExposed;
    const rawError = Math.abs(rawRate - realRate);
    const offset = matchingOffset(calibration, row);
    const simulatedRate = smoothedRate(row.simulatedConverted, row.simulatedExposed);
    const calibratedRate = offset === null ? null : probability(logOdds(simulatedRate) + offset);
    const calibratedError = calibratedRate === null ? null : Math.abs(calibratedRate - realRate);
    realExposed += row.realExposed;
    allRawTotal += rawError * row.realExposed;
    if (calibratedError !== null) {
      matchedRows++;
      matchedRealExposed += row.realExposed;
      rawTotal += rawError * row.realExposed;
      calibratedTotal += calibratedError * row.realExposed;
    }
    return { ...row, rawRate, realRate, calibratedRate, rawError, calibratedError };
  });
  return {
    rows: results, realExposed, matchedRealExposed, matchedRows,
    allRawMAE: realExposed ? allRawTotal / realExposed : null,
    rawMAE: matchedRealExposed ? rawTotal / matchedRealExposed : null,
    calibratedMAE: matchedRealExposed ? calibratedTotal / matchedRealExposed : null,
  };
}
