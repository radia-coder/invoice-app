import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildAutoDeductionEntries,
  buildYtdInsuranceIndex,
  calculateAutoDeductions,
  getAutoDeductionConfigFromCompany,
  getYtdInsurance,
  mergeDeductionsWithAuto
} from '../lib/auto-deductions';

test('calculates factoring and dispatch from YTD insurance', () => {
  const config = getAutoDeductionConfigFromCompany({
    factoring_rate: 2,
    dispatch_rate: 6,
    auto_deduction_base: 'YTD_INSURANCE'
  });

  const amounts = calculateAutoDeductions(1500, config);
  const entries = buildAutoDeductionEntries(amounts, config);

  assert.equal(amounts.factoring, 30);
  assert.equal(amounts.dispatch, 90);
  assert.equal(entries[0].deduction_type, 'Factoring');
  assert.equal(entries[1].deduction_type, 'Dispatch');
});

test('merges auto deductions while removing manual factoring/dispatch', () => {
  const merged = mergeDeductionsWithAuto(
    [
      { deduction_type: 'Fuel', amount: 100 },
      { deduction_type: 'Factoring Fee', amount: 25 },
      { deduction_type: 'dispatch', amount: 50 }
    ],
    [
      { deduction_type: 'Factoring', amount: 30 },
      { deduction_type: 'Dispatch', amount: 90 }
    ]
  );

  assert.equal(merged.length, 3);
  assert.ok(merged.some((ded) => ded.deduction_type === 'Fuel'));
  assert.ok(merged.some((ded) => ded.deduction_type === 'Factoring' && ded.amount === 30));
  assert.ok(merged.some((ded) => ded.deduction_type === 'Dispatch' && ded.amount === 90));
});

test('builds YTD insurance index and returns running totals', () => {
  const invoices = [
    {
      driver_id: 1,
      week_end: new Date('2026-01-04'),
      deductions: [{ deduction_type: 'Insurance', amount: 100 }]
    },
    {
      driver_id: 1,
      week_end: new Date('2026-01-11'),
      deductions: [{ deduction_type: 'INSURANCE', amount: 50 }]
    }
  ];

  const index = buildYtdInsuranceIndex(invoices);
  assert.equal(getYtdInsurance(index, 1, new Date('2026-01-04')), 100);
  assert.equal(getYtdInsurance(index, 1, new Date('2026-01-11')), 150);
});
