import assert from 'node:assert/strict';
import { test } from 'node:test';
import { DEFAULT_CONFIG, evaluateCalibration, fitCalibration, normalizeConfig, simulate } from '../src/simulation.js';

function checkFunnel(stats, product) {
  assert.ok(stats.population >= stats.exposed);
  assert.ok(stats.exposed >= stats.considered);
  if (product === 'app') {
    assert.ok(stats.considered >= stats.install);
    assert.ok(stats.install >= stats.activation);
    assert.ok(stats.activation >= stats.paid);
    assert.equal(stats.purchase, 0);
  } else {
    assert.ok(stats.considered >= stats.purchase);
    assert.equal(stats.install + stats.activation + stats.paid, 0);
  }
  assert.equal(Object.values(stats.reasons).reduce((sum, count) => sum + count, 0), stats.population - stats.converted);
  if (stats.exposed === 0) {
    assert.equal(stats.rate, null);
    assert.deepEqual(stats.interval, [null, null]);
    assert.equal(stats.targetStatus, 'no-data');
  } else {
    assert.equal(stats.rate, stats.converted / stats.exposed);
    assert.ok(stats.interval[0] - 1e-12 <= stats.rate && stats.rate <= stats.interval[1] + 1e-12);
  }
}

test('runs 100,000 paired residents and reconciles every aggregation', () => {
  const progress = [];
  const result = simulate({ days: 90, variants: { b: { channel: 'retail' } } }, { onProgress: value => progress.push(value) });
  assert.equal(result.config.population, 100_000);
  assert.equal(result.daily.length, 90);
  for (const arm of ['a', 'b']) {
    const total = result[arm];
    checkFunnel(total, 'hardware');
    assert.equal(total.population, result.config.population);
    for (const groups of Object.values(result.groups)) {
      for (const group of groups) checkFunnel(group[arm], 'hardware');
      for (const field of ['population', 'exposed', 'considered', 'converted']) {
        assert.equal(groups.reduce((sum, group) => sum + group[arm][field], 0), total[field]);
      }
    }
    assert.equal(result.daily.reduce((sum, day) => sum + day[arm].converted, 0), total.converted);
    assert.equal(result.daily.reduce((sum, day) => sum + day[arm].exposed, 0), total.exposed);
    assert.equal(result.daily.reduce((sum, day) => sum + day[arm].population, 0), total.exposed);
  }
  assert.equal(result.agents.length, 32);
  assert.equal(result.comparison.lift, result.b.rate - result.a.rate);
  assert.ok(result.comparison.interval[0] <= result.comparison.lift && result.comparison.lift <= result.comparison.interval[1]);
  assert.equal(progress[0], 0);
  assert.equal(progress.at(-1), 1);
  assert.ok(progress.every((value, index) => index === 0 || value > progress[index - 1]));
});

test('replays exactly and identical alternatives share the same exposure and result', () => {
  const input = { population: 1_200, regions: ['cn'], segments: ['value'], culture: 'routine', languages: ['pt'], variants: { b: DEFAULT_CONFIG.variants.a } };
  const result = simulate(input);
  assert.deepEqual(result, simulate(input));
  assert.notDeepEqual(result, simulate({ ...input, seed: 43 }));
  assert.deepEqual(result.a, result.b);
  assert.deepEqual(result.comparison, { lift: 0, interval: [0, 0] });
  for (const agent of result.agents) {
    assert.equal(agent.region, 'cn');
    assert.equal(agent.segment, 'value');
    assert.equal(agent.culture, 'routine');
    assert.equal(agent.language, 'pt');
    assert.ok(agent.budget > 0);
    assert.deepEqual(agent.a, agent.b);
  }
});

test('keeps app install, activation and paid distinct on the same arm history', () => {
  const config = { product: 'app', population: 10_000 };
  const install = simulate({ ...config, metric: 'install' });
  const activate = simulate({ ...config, metric: 'activation' });
  const paid = simulate({ ...config, metric: 'paid' });
  for (const arm of ['a', 'b']) {
    for (const run of [install, activate, paid]) checkFunnel(run[arm], 'app');
    assert.equal(install[arm].paid, paid[arm].converted);
    assert.equal(install[arm].activation, activate[arm].converted);
    assert.ok(install[arm].rate > activate[arm].rate);
    assert.ok(activate[arm].rate > paid[arm].rate);
  }
  assert.throws(() => normalizeConfig({ product: 'app', metric: 'purchase' }), /转化事件/);
  assert.throws(() => normalizeConfig({ population: 100_001 }), /Agent 数量/);
  assert.throws(() => normalizeConfig({ regions: [] }), /国家或地区/);
});

const training = {
  experimentId: 'pilot-01', variant: 'a', split: 'train', metric: 'purchase', days: 14, channel: 'ecommerce',
  region: 'all', segment: 'all', simulatedExposed: 1_000, simulatedConverted: 150, realExposed: 1_000, realConverted: 300,
};
const holdout = { ...training, experimentId: 'pilot-02', split: 'holdout', simulatedConverted: 160, realConverted: 320 };

test('fits with training only and scores the same holdout strata before and after calibration', () => {
  const unmatched = { ...holdout, experimentId: 'pilot-03', channel: 'retail', realConverted: 100 };
  const rows = [training, holdout, unmatched];
  const model = fitCalibration(rows);
  assert.deepEqual(model.groups, fitCalibration([training]).groups);
  assert.deepEqual(model.trainExperiments, ['pilot-01']);
  const evaluated = evaluateCalibration(rows, model);
  assert.equal(evaluated.matchedRows, 1);
  assert.equal(evaluated.realExposed, 2_000);
  assert.equal(evaluated.matchedRealExposed, 1_000);
  assert.equal(evaluated.rawMAE, 0.16);
  assert.ok(evaluated.calibratedMAE < 0.02);
  assert.equal(evaluated.rows[1].calibratedRate, null);

  const adjusted = simulate({ population: 3_000, variants: { b: { channel: 'retail' } } }, { calibration: model });
  assert.ok(adjusted.a.calibratedRate > adjusted.a.rate);
  assert.equal(adjusted.b.calibratedRate, null);
  assert.ok(adjusted.groups.regions.every(region => region.a.calibratedRate === null));
  assert.equal(simulate({ population: 1_000, days: 7 }, { calibration: model }).a.calibratedRate, null);
});

test('applies crossed calibrations only to the corresponding country and buyer segment', () => {
  const model = fitCalibration([{ ...training, region: 'us', segment: 'value' }]);
  const result = simulate({ population: 3_000, regions: ['us', 'jp'] }, { calibration: model });
  const crossed = result.groups.regionSegments.find(({ region, segment }) => region === 'us' && segment === 'value');
  assert.equal(crossed.id, 'us/value');
  assert.ok(crossed.a.calibratedRate > crossed.a.rate);
  assert.equal(result.a.calibratedRate, null);
  assert.ok(result.groups.regionSegments.filter(group => group !== crossed).every(({ a }) => a.calibratedRate === null));
});

test('rejects impossible counts, holdout leakage and overlapping population rows', () => {
  assert.throws(() => fitCalibration([{ ...training, realConverted: 1001 }]), /真实转化数/);
  assert.throws(() => fitCalibration([{ ...training, simulatedExposed: 0 }]), /模拟曝光数/);
  assert.throws(() => fitCalibration([training, { ...holdout, experimentId: training.experimentId }]), /同时出现在训练与留出集/);
  assert.throws(() => fitCalibration([training, { ...training, region: 'us' }]), /重复或重叠/);
  assert.doesNotThrow(() => fitCalibration([{ ...training, region: 'us' }, { ...training, region: 'cn' }]));
  assert.throws(() => evaluateCalibration([{ ...training, split: 'holdout' }], fitCalibration([training])), /已用于训练/);
});
