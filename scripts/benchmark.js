import { DEFAULT_CONFIG, simulate } from '../src/simulation.js';

const config = { ...DEFAULT_CONFIG, population: 100_000 };
const started = performance.now();
const { a, b } = simulate(config);
const elapsed = Math.round(performance.now() - started);
console.log(JSON.stringify({
  agents: config.population,
  days: config.days,
  durationMs: elapsed,
  a: { exposed: a.exposed, converted: a.converted, rate: a.rate },
  b: { exposed: b.exposed, converted: b.converted, rate: b.rate },
}, null, 2));
