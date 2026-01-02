import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateInvoiceTotals } from '../lib/invoice-calculations';

test('calculateInvoiceTotals handles company driver payout', () => {
  const totals = calculateInvoiceTotals({
    loads: [{ amount: 1000 }],
    deductions: [{ amount: 50 }],
    percent: 25,
    tax_percent: 10,
    driver_type: 'Company Driver'
  });

  assert.equal(totals.gross, 1000);
  assert.equal(totals.percentAmount, 250);
  assert.equal(totals.fixedDed, 50);
  assert.equal(totals.taxAmount, 100);
  assert.equal(totals.net, 100);
});

test('calculateInvoiceTotals handles owner-operator payout', () => {
  const totals = calculateInvoiceTotals({
    loads: [{ amount: 2000 }],
    deductions: [{ amount: 100 }],
    percent: 15,
    tax_percent: 5,
    driver_type: 'Owner-Operator'
  });

  assert.equal(totals.gross, 2000);
  assert.equal(totals.percentAmount, 300);
  assert.equal(totals.fixedDed, 100);
  assert.equal(totals.taxAmount, 100);
  assert.equal(totals.net, 1500);
});
