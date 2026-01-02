import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, stringifyCsv } from '../lib/csv';

test('parseCsv handles quoted fields', () => {
  const csv = 'name,amount\n\"Fuel, Toll\",25';
  const rows = parseCsv(csv);
  assert.deepEqual(rows, [['name', 'amount'], ['Fuel, Toll', '25']]);
});

test('stringifyCsv escapes commas and quotes', () => {
  const rows = [['note', 'value'], ['He said \"hi\"', '100,00']];
  const csv = stringifyCsv(rows);
  assert.equal(csv, 'note,value\n\"He said \"\"hi\"\"\",\"100,00\"');
});
