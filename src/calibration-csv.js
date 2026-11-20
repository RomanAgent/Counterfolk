export const CSV_COLUMNS = [
  'experimentId', 'variant', 'split', 'metric', 'days', 'channel', 'region', 'segment',
  'simulatedExposed', 'simulatedConverted', 'realExposed', 'realConverted',
];

const numericColumns = new Set(['days', ...CSV_COLUMNS.slice(8)]);

export function parseCalibrationCsv(input) {
  if (input.length > 500_000) throw new Error('CSV 超过 50 万字符，请分批整理后再导入。');

  const records = [];
  let record = [];
  let cell = '';
  let inQuotes = false;
  let closedQuote = false;

  function endCell() {
    record.push(cell.trim());
    cell = '';
    closedQuote = false;
  }

  function endRecord() {
    endCell();
    if (record.some(Boolean)) records.push(record);
    record = [];
  }

  const csv = input.replace(/^\uFEFF/, '');
  for (let i = 0; i < csv.length; i += 1) {
    const character = csv[i];
    if (inQuotes) {
      if (character !== '"') cell += character;
      else if (csv[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else {
        inQuotes = false;
        closedQuote = true;
      }
    } else if (character === ',') endCell();
    else if (character === '\r' || character === '\n') {
      endRecord();
      if (character === '\r' && csv[i + 1] === '\n') i += 1;
    } else if (closedQuote) {
      if (!/\s/.test(character)) throw new Error('带引号的字段后需要逗号或换行。');
    } else if (character === '"') {
      if (cell.trim()) throw new Error('发现字段内未转义的引号。');
      cell = '';
      inQuotes = true;
    } else cell += character;
  }
  if (inQuotes) throw new Error('CSV 中有未闭合的引号。');
  endRecord();

  const header = records.shift() ?? [];
  if (header.length !== CSV_COLUMNS.length || !CSV_COLUMNS.every((key) => header.includes(key))) {
    throw new Error('CSV 表头与要求的 12 个字段不一致。');
  }
  if (!records.length) throw new Error('请先添加试点数据。');
  return records.map((values, index) => {
    if (values.length !== header.length || values.some((value) => !value)) {
      throw new Error(`第 ${index + 1} 条记录有空字段或字段数量不正确。`);
    }
    return Object.fromEntries(header.map((key, position) => {
      const value = values[position];
      if (!numericColumns.has(key)) return [key, value];
      if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value))) {
        throw new Error(`第 ${index + 1} 条记录的 ${key} 需要填写整数。`);
      }
      return [key, Number(value)];
    }));
  });
}

export function exampleCalibrationCsv(config) {
  const { metric, days, variants } = config;
  return [
    CSV_COLUMNS,
    ['example-train', 'a', 'train', metric, days, variants.a.channel, 'all', 'all', 9200, 1104, 2400, 237],
    ['example-train', 'b', 'train', metric, days, variants.b.channel, 'all', 'all', 8900, 1157, 2600, 276],
    ['example-holdout', 'a', 'holdout', metric, days, variants.a.channel, 'all', 'all', 10700, 1391, 2800, 303],
    ['example-holdout', 'b', 'holdout', metric, days, variants.b.channel, 'all', 'all', 10100, 1414, 3100, 358],
  ].map((record) => record.join(',')).join('\n');
}
