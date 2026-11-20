import { simulate } from './simulation.js';

self.addEventListener('message', ({ data: { config, calibration, decisions } }) => {
  try {
    const started = performance.now();
    const result = simulate(config, {
      calibration, decisions,
      onProgress: (fraction) => self.postMessage({ type: 'progress', fraction }),
    });
    self.postMessage({ type: 'complete', result, durationMs: Math.round(performance.now() - started) });
  } catch (error) {
    self.postMessage({ type: 'error', message: error.message });
  }
});
