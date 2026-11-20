import { ENGINE_VERSION, normalizeConfig, wilson } from './simulation.js';

export const EXPERIMENT_VERSION = 1;

const ARMS = ['a', 'b'];
const HARDWARE_STAGES = ['exposed', 'purchase'];
const APP_STAGES = ['exposed', 'install', 'activation', 'paid'];
const NUMERICAL_EPSILON = 1e-12;

function text(value, name, max, required = true) {
  if (typeof value === 'string' && value.trim().length <= max && (!required || value.trim())) return value.trim();
  throw new Error(`${name}须填写${required ? ' 1 到' : '最多'} ${max} 个字符。`);
}

function selection(value, choices, name) {
  if (choices.includes(value)) return value;
  throw new Error(`${name}选项无效。`);
}

function ratio(value, name, min = 0, max = 1) {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max) {
    throw new Error(`${name}须介于 ${min} 与 ${max} 之间。`);
  }
  return value;
}

function stableId(value) {
  // FNV-1a identifies identical manifests. It is not a signature or an authorization token.
  let hash = 0xcbf29ce484222325n;
  for (const byte of new TextEncoder().encode(JSON.stringify(value))) {
    hash = BigInt.asUintN(64, (hash ^ BigInt(byte)) * 0x100000001b3n);
  }
  return `cf${EXPERIMENT_VERSION}-${hash.toString(16).padStart(16, '0')}`;
}

function deepFreeze(value) {
  if (value && typeof value === 'object') {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}

export function freezeExperiment({
  config, denominator = 'assigned', unit = 'person', offers = {}, startDate = null,
  tolerance = 0.02, minimumEffect = 0, allocationB = 0.5,
} = {}) {
  const scenario = normalizeConfig(config);
  if (!offers || typeof offers !== 'object' || Array.isArray(offers)) throw new Error('方案素材格式无效。');
  if (startDate !== null && startDate !== '') {
    const parsed = typeof startDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(startDate) ? new Date(startDate) : null;
    if (!parsed || !Number.isFinite(+parsed) || parsed.toISOString().slice(0, 10) !== startDate) {
      throw new Error('计划开始日期格式须为 YYYY-MM-DD。');
    }
  }
  const manifest = {
    schemaVersion: EXPERIMENT_VERSION,
    engineVersion: ENGINE_VERSION,
    config: scenario,
    denominator: selection(denominator, ['assigned', 'exposed'], '分母'),
    unit: selection(unit, ['person', 'store', 'timeBlock'], '随机分配单位'),
    offers: Object.fromEntries(ARMS.map((id) => [id, {
      version: text(offers[id]?.version ?? `${id}-1`, `方案 ${id.toUpperCase()} 版本`, 100),
      content: text(offers[id]?.content ?? '', `方案 ${id.toUpperCase()} 素材`, 12_000, false),
    }])),
    startDate: startDate || null,
    tolerance: ratio(tolerance, '容许转化率误差'),
    minimumEffect: ratio(minimumEffect, '最小有意义差异'),
    allocationB: ratio(allocationB, 'B 方案分流比例', 0.01, 0.99),
  };
  return deepFreeze({ id: stableId(manifest), ...manifest });
}

function count(value, name, max = 1_000_000_000) {
  if (!Number.isSafeInteger(value) || value < 0 || value > max) throw new Error(`${name}须为 0 至 ${max} 之间的整数。`);
  return value;
}

function normalizeArm(input, spec, arm, stages) {
  const prefix = `方案 ${arm.toUpperCase()}`;
  if (!input || input.offerVersion !== spec.offers[arm].version || input.channel !== spec.config.variants[arm].channel) {
    throw new Error(`${prefix}的商品版本或渠道与冻结的实验不一致。`);
  }
  const assigned = count(input.assigned, `${prefix}分流人数`);
  if (!assigned) throw new Error(`${prefix}需要大于 0 的分流人数。`);
  const exposed = count(input.exposed, `${prefix}曝光人数`, assigned);
  const converted = count(input.converted, `${prefix}转化人数`, exposed);
  const observed = { exposed, [spec.config.metric]: converted };
  if (input.stages !== undefined) {
    if (!input.stages || typeof input.stages !== 'object' || Array.isArray(input.stages)) throw new Error(`${prefix}阶段计数格式无效。`);
    for (const [key, value] of Object.entries(input.stages)) {
      if (!stages.includes(key) || key === 'exposed') throw new Error(`${prefix}阶段 ${key} 无法与模拟口径对齐。`);
      const measured = count(value, `${prefix}阶段 ${key}`, exposed);
      if (key === spec.config.metric && measured !== converted) throw new Error(`${prefix}主指标阶段须等于 converted。`);
      observed[key] = measured;
    }
  }
  let previous = exposed;
  for (const stage of stages) {
    if (!Object.hasOwn(observed, stage)) continue;
    if (observed[stage] > previous) throw new Error(`${prefix}后续阶段人数超过前一阶段人数。`);
    previous = observed[stage];
  }
  return { assigned, exposed, converted, observed };
}

function independentDifference(a, b, lift) {
  const [loA, hiA] = a.interval;
  const [loB, hiB] = b.interval;
  return [
    Math.max(-1, lift - Math.hypot(b.rate - loB, hiA - a.rate)),
    Math.min(1, lift + Math.hypot(hiB - b.rate, a.rate - loA)),
  ];
}

function sampleRatioMismatch(arms, spec, randomized) {
  if (!randomized || spec.unit !== 'person') return null;
  const total = arms.a.assigned + arms.b.assigned;
  const expectedB = spec.allocationB * total;
  if (Math.min(expectedB, total - expectedB) < 5) return null;
  const standardized = (arms.b.assigned - expectedB) / Math.sqrt(total * spec.allocationB * (1 - spec.allocationB));
  return Math.abs(standardized) > 3.2905267;
}

export function compareTrial(spec, result, trial) {
  if (!spec || spec.schemaVersion !== EXPERIMENT_VERSION || spec.engineVersion !== ENGINE_VERSION) {
    throw new Error('实验版本与当前引擎不一致，请使用同版本记录重新运行。');
  }
  const verifiedSpec = freezeExperiment(spec);
  if (verifiedSpec.id !== spec.id) throw new Error('冻结后的实验定义已发生变化。');
  if (!result?.config || result.version !== spec.engineVersion || JSON.stringify(normalizeConfig(result.config)) !== JSON.stringify(verifiedSpec.config)) {
    throw new Error('当前模拟记录的版本、随机种子或参数与冻结实验不一致。');
  }
  const { config, denominator, unit } = spec;
  if (trial?.schemaVersion !== EXPERIMENT_VERSION || trial.experimentId !== spec.id
    || trial.metric !== config.metric || trial.days !== config.days || trial.unit !== unit || trial.denominator !== denominator) {
    throw new Error('试点的实验 ID、指标、观察窗口、分配单位或分母不一致。');
  }
  const trialId = text(trial.trialId, '试点 ID', 100);
  const source = selection(trial.source, ['field', 'synthetic-demo'], '试点来源');
  const design = selection(trial.design, ['randomized', 'observational'], '试点设计');
  const stages = config.product === 'hardware' ? HARDWARE_STAGES : APP_STAGES;
  const trialArms = Object.fromEntries(ARMS.map((arm) => [arm, normalizeArm(trial.arms?.[arm], spec, arm, stages)]));
  const randomized = design === 'randomized';
  const mismatch = sampleRatioMismatch(trialArms, spec, randomized);
  const availableIntervals = randomized && unit === 'person' && mismatch === false && denominator === 'assigned';
  const arms = Object.fromEntries(ARMS.map((arm) => {
    const { assigned, exposed, converted } = trialArms[arm];
    const simulated = result[arm];
    const exposureRate = simulated.exposed / simulated.population;
    const divisor = denominator === 'assigned' ? assigned : exposed;
    const rate = divisor ? converted / divisor : null;
    const simulatedRate = denominator === 'assigned' ? simulated.converted / simulated.population : simulated.rate;
    const calibratedRate = Number.isFinite(simulated.calibratedRate)
      ? simulated.calibratedRate * (denominator === 'assigned' ? exposureRate : 1)
      : null;
    return [arm, {
      assigned, exposed, converted, rate, simulatedRate, calibratedRate,
      interval: availableIntervals ? wilson(converted, divisor) : [null, null],
      delta: rate === null || simulatedRate === null ? null : simulatedRate - rate,
    }];
  }));
  const { a, b } = arms;
  const paired = denominator === 'assigned' ? result.assignedComparison : result.comparison;
  const realLift = a.rate !== null && b.rate !== null ? b.rate - a.rate : null;
  const realInterval = availableIntervals && realLift !== null ? independentDifference(a, b, realLift) : [null, null];
  const calibratedLift = a.calibratedRate !== null && b.calibratedRate !== null ? b.calibratedRate - a.calibratedRate : null;
  const direction = realInterval[0] === null ? 'unavailable'
    : realInterval[0] > spec.minimumEffect ? 'b'
      : realInterval[1] < -spec.minimumEffect ? 'a' : 'uncertain';
  const predictedDirection = Math.abs(paired.lift ?? 0) <= spec.minimumEffect ? 'uncertain' : paired.lift > 0 ? 'b' : 'a';
  const agreement = ['a', 'b'].includes(direction) && ['a', 'b'].includes(predictedDirection)
    ? direction === predictedDirection ? 'same' : 'opposite'
    : 'unresolved';
  const funnel = stages.map((stage) => ({ stage, ...Object.fromEntries(ARMS.map((arm) => {
    const { assigned, observed } = trialArms[arm];
    if (!Object.hasOwn(observed, stage)) return [arm, null];
    const simulation = result[arm][stage] / result[arm].population;
    const real = observed[stage] / assigned;
    return [arm, { simulation, real, delta: simulation - real }];
  })) }));
  const firstMismatch = funnel.find((row) => ARMS.some((arm) => Math.abs(row[arm]?.delta ?? 0) - spec.tolerance > NUMERICAL_EPSILON)) ?? null;
  return {
    trialId, source,
    quality: { design, unit, denominator, sampleRatioMismatch: mismatch, availableIntervals, conditionalExposure: denominator === 'exposed' },
    arms,
    comparison: {
      simulatedLift: paired.lift, simulatedInterval: paired.interval, calibratedLift,
      realLift, realInterval, liftError: realLift === null || paired.lift === null ? null : paired.lift - realLift,
      direction, predictedDirection, agreement,
    },
    funnel, firstMismatch,
  };
}

export function exampleTrial(spec, result) {
  if (!spec || !result) throw new Error('先冻结实验并运行模拟。');
  const { config } = spec;
  const stages = config.product === 'hardware' ? HARDWARE_STAGES : APP_STAGES;
  const syntheticExposed = { a: 3_920, b: 3_780 };
  return {
    schemaVersion: EXPERIMENT_VERSION, experimentId: spec.id, trialId: 'synthetic-pilot-example',
    source: 'synthetic-demo', design: 'randomized', metric: config.metric, days: config.days,
    unit: spec.unit, denominator: spec.denominator,
    arms: Object.fromEntries(ARMS.map((arm) => {
      const assigned = Math.round(8_000 * (arm === 'a' ? 1 - spec.allocationB : spec.allocationB));
      const exposed = Math.min(assigned, Math.round(syntheticExposed[arm] * assigned / 4_000));
      const stageCounts = Object.fromEntries(stages.slice(1).map((stage) => {
        const simulated = result[arm];
        const rate = simulated.population ? simulated[stage] / simulated.population : 0;
        const factor = arm === 'a' ? 0.93 : 0.68;
        return [stage, Math.min(exposed, Math.round(assigned * rate * factor))];
      }));
      return [arm, {
        offerVersion: spec.offers[arm].version, channel: config.variants[arm].channel,
        assigned, exposed, converted: stageCounts[config.metric], stages: stageCounts,
      }];
    })),
  };
}
