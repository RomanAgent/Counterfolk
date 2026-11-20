import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CSV_COLUMNS, exampleCalibrationCsv, parseCalibrationCsv } from '../src/calibration-csv.js';
import { DEFAULT_CONFIG, evaluateCalibration, fitCalibration } from '../src/simulation.js';

test('imports quoted fields, escaped quotes, a BOM and CRLF line endings', () => {
  const row = '"pilot, ""beta""",a,train,purchase,14,ecommerce,all,all,100,10,50,4';
  const [record] = parseCalibrationCsv(`\uFEFF${CSV_COLUMNS.join(',')}\r\n${row}\r\n`);
  assert.equal(record.experimentId, 'pilot, "beta"');
  assert.equal(record.days, 14);
  assert.equal(record.realConverted, 4);
});

test('rejects incomplete quotes and missing numeric counts', () => {
  const header = CSV_COLUMNS.join(',');
  assert.throws(() => parseCalibrationCsv(`${header}\n"pilot`), /未闭合/);
  assert.throws(() => parseCalibrationCsv(`${header}\npilot,a,train,purchase,14,ecommerce,all,all,100,10,50,`), /空字段/);
});

test('the visual demo contains independent training and matching holdout rows', () => {
  const config = {
    ...DEFAULT_CONFIG,
    variants: { ...DEFAULT_CONFIG.variants, b: { ...DEFAULT_CONFIG.variants.b, channel: 'retail' } },
  };
  const rows = parseCalibrationCsv(exampleCalibrationCsv(config));
  const model = fitCalibration(rows);
  const report = evaluateCalibration(rows, model);
  assert.notDeepEqual(model.trainExperiments, model.holdoutExperiments);
  assert.equal(report.matchedRows, 2);
  assert.ok(report.calibratedMAE < report.rawMAE);
});
