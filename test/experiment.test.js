import assert from 'node:assert/strict';
import { test } from 'node:test';
import { compareTrial, exampleTrial, freezeExperiment } from '../src/experiment.js';
import { ENGINE_VERSION, fitCalibration, simulate } from '../src/simulation.js';

const decision = (comprehension) => ({ comprehension, reason: '合成样本理解情况' });
const smallRun = { population: 3_000, days: 14 };

test('freezes a versioned experiment and rejects changed scenario, version or trial definitions', () => {
  const offers = { a: { version: 'catalog-1', content: '同款商品，原价' }, b: { version: 'catalog-2', content: '同款商品，首发优惠' } };
  const result = simulate(smallRun);
  const spec = freezeExperiment({ config: smallRun, offers, startDate: '2026-11-20' });
  assert.equal(spec.engineVersion, ENGINE_VERSION);
  assert.ok(Object.isFrozen(spec.config.variants.a));
  assert.ok(Object.isFrozen(spec.offers.a));
  assert.equal(freezeExperiment(JSON.parse(JSON.stringify(spec))).id, spec.id);
  assert.notEqual(freezeExperiment({ ...spec, config: { ...spec.config, seed: 43 } }).id, spec.id);
  assert.throws(() => freezeExperiment({ config: smallRun, startDate: '2026-02-30' }), /日期/);
  const trial = exampleTrial(spec, result);
  assert.equal(compareTrial(spec, result, trial).source, 'synthetic-demo');
  assert.throws(() => compareTrial({ ...spec, tolerance: 0.08 }, result, trial), /已发生变化/);
  assert.throws(() => compareTrial(spec, { ...result, version: '1.0.0' }, trial), /与冻结实验不一致/);
  assert.throws(() => compareTrial(spec, result, { ...trial, days: 15 }), /观察窗口/);
  const changedChannel = { ...trial, arms: { ...trial.arms, b: { ...trial.arms.b, channel: 'retail' } } };
  assert.throws(() => compareTrial(spec, result, changedChannel), /版本或渠道/);
});

test('compares paired simulation to independent real arms and diagnoses the first observable funnel gap', () => {
  const result = simulate(smallRun);
  const spec = freezeExperiment({ config: result.config });
  const trial = exampleTrial(spec, result);
  trial.source = 'field';
  trial.arms.a = { ...trial.arms.a, assigned: 4_000, exposed: 2_930, converted: 300, stages: { purchase: 300 } };
  trial.arms.b = { ...trial.arms.b, assigned: 4_000, exposed: 2_930, converted: 100, stages: { purchase: 100 } };
  const report = compareTrial(spec, result, trial);
  assert.equal(report.arms.a.rate, 300 / 4_000);
  assert.equal(report.arms.a.simulatedRate, result.a.converted / result.a.population);
  assert.equal(report.comparison.realLift, 100 / 4_000 - 300 / 4_000);
  assert.equal(report.comparison.simulatedLift, result.assignedComparison.lift);
  assert.equal(report.comparison.direction, 'a');
  assert.equal(report.comparison.agreement, 'opposite');
  assert.equal(report.firstMismatch.stage, 'purchase');
  assert.ok(report.comparison.realInterval[1] < 0);
  assert.equal(report.arms.b.calibratedRate, null);

  const calibration = fitCalibration([{
    experimentId: 'earlier-trial', variant: 'a', split: 'train', metric: 'purchase', days: 14,
    channel: 'ecommerce', region: 'all', segment: 'all',
    simulatedExposed: 2_000, simulatedConverted: 150, realExposed: 1_000, realConverted: 60,
  }]);
  const adjusted = simulate(result.config, { calibration });
  const adjustedReport = compareTrial(spec, adjusted, trial);
  assert.equal(adjustedReport.arms.a.simulatedRate, report.arms.a.simulatedRate);
  assert.equal(adjustedReport.arms.a.calibratedRate, adjusted.a.calibratedRate * (adjusted.a.exposed / adjusted.a.population));
});

test('reports descriptive evidence for cluster assignment, exposure selection, or sample-ratio mismatch', () => {
  const result = simulate({ ...smallRun, product: 'app', metric: 'paid' });
  for (const choice of [{ unit: 'store' }, { unit: 'timeBlock' }, { denominator: 'exposed' }]) {
    const spec = freezeExperiment({ config: result.config, ...choice });
    const trial = exampleTrial(spec, result);
    const report = compareTrial(spec, result, trial);
    assert.equal(report.quality.availableIntervals, false);
    assert.equal(report.quality.conditionalExposure, spec.denominator === 'exposed');
    assert.equal(report.comparison.direction, 'unavailable');
    assert.deepEqual(report.comparison.realInterval, [null, null]);
  }

  const spec = freezeExperiment({ config: result.config });
  const trial = exampleTrial(spec, result);
  trial.arms.a.assigned = 80_000;
  assert.equal(compareTrial(spec, result, trial).quality.sampleRatioMismatch, true);
  const impossible = structuredClone(trial);
  impossible.arms.b.stages.install = 0;
  assert.throws(() => compareTrial(spec, result, impossible), /后续阶段/);
  const unknown = { ...trial, source: 'unverified' };
  assert.throws(() => compareTrial(spec, result, unknown), /试点来源/);
});

test('uses paired, validated model sample decisions and replays them without a model', () => {
  const baseline = simulate(smallRun);
  assert.equal(baseline.modelSample.length, 48);
  assert.equal(new Set(baseline.modelSample.slice(0, 8).map(({ region }) => region)).size, 8);
  const selected = baseline.modelSample.map(({ id }) => id);
  const entries = selected.map((agentId) => ({ agentId, a: decision('unclear'), b: decision('clear') }));
  const profile = { provider: 'ollama', model: 'demo', apiKey: 'omit-me' };
  const interview = simulate(smallRun, { decisions: { selected, entries, mode: 'interview', profile } });
  assert.deepEqual(interview.a, baseline.a);
  assert.deepEqual(interview.b, baseline.b);
  assert.equal(interview.ai.applied, 0);

  entries[0].b = decision('invalid');
  entries.push(entries[1]);
  entries.push({ agentId: 999_999, a: decision('clear'), b: decision('clear') });
  const hybrid = simulate(smallRun, { decisions: { selected, entries, mode: 'hybrid', profile } });
  assert.equal(hybrid.ai.applied, 46);
  assert.equal(hybrid.ai.fallback, 2);
  assert.ok(hybrid.ai.changed > 0);
  assert.equal(hybrid.a.exposed, baseline.a.exposed);
  assert.equal(hybrid.b.exposed, baseline.b.exposed);
  assert.ok(hybrid.a.considered <= baseline.a.considered);
  assert.ok(hybrid.b.considered >= baseline.b.considered);
  assert.deepEqual(hybrid.ai.profile, { provider: 'ollama', model: 'demo' });
  assert.deepEqual(simulate(smallRun, { decisions: hybrid.ai }), hybrid);
});

test('street traces represent underlying ordered stages and regional day counts reconcile', () => {
  const result = simulate({ ...smallRun, product: 'app', metric: 'paid', variants: { b: { channel: 'retail' } } });
  const orders = ['exposed', 'considered', 'install', 'activation', 'paid', 'exit'];
  for (const agent of result.agents) for (const arm of ['a', 'b']) {
    const trace = agent.trace[arm];
    if (agent[arm].day === null) assert.equal(trace.length, 0);
    else {
      assert.equal(trace[0].type, 'exposed');
      assert.equal(trace.filter(({ type }) => type !== 'exit').at(-1).type, agent[arm].stage);
      trace.forEach((event, index) => {
        assert.equal(event.order, index);
        assert.equal(event.day, agent[arm].day);
        assert.ok(event.minute >= 0 && event.minute < 1440);
        assert.equal(event.channel, result.config.variants[arm].channel);
        if (index > 0) {
          assert.ok(orders.indexOf(trace[index - 1].type) < orders.indexOf(event.type));
          assert.ok(trace[index - 1].minute < event.minute);
        }
      });
    }
  }
  for (const { daily, a, b } of result.groups.regions) {
    assert.equal(daily.reduce((total, day) => total + day.a.exposed, 0), a.exposed);
    assert.equal(daily.reduce((total, day) => total + day.b.converted, 0), b.converted);
  }
});

test('charges delivery fees only for hardware purchased online', () => {
  const offer = { name: '同款硬件', price: 100, shippingFee: 0 };
  const online = simulate({ ...smallRun, variants: { a: offer, b: { ...offer, shippingFee: 30 } } });
  assert.equal(online.a.exposed, online.b.exposed);
  assert.ok(online.b.purchase < online.a.purchase);
  const inStore = simulate({ ...smallRun, variants: {
    a: { ...offer, channel: 'retail' }, b: { ...offer, channel: 'retail', shippingFee: 30 },
  } });
  assert.deepEqual(inStore.a, inStore.b);
});
