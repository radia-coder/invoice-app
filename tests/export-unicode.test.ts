import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildContentDisposition,
  findNonByteStringChar,
  sanitizeHeaderValue,
} from '../lib/export-headers';
import {
  generateReportXLSX,
  type DriverSheetData,
  type ExpenseData,
} from '../lib/xlsx-generator';

test('sanitizeHeaderValue removes non-ByteString characters', () => {
  const raw = 'Warning: driver José → Логистика';
  const sanitized = sanitizeHeaderValue(raw);

  assert.ok(findNonByteStringChar(raw));
  assert.equal(findNonByteStringChar(sanitized), null);
});

test('buildContentDisposition encodes unicode filenames safely', () => {
  const header = buildContentDisposition('settlement-报告→.xlsx');
  assert.ok(header.includes('filename*='));
  assert.equal(findNonByteStringChar(header), null);
});

test('generateReportXLSX handles unicode cell data', async () => {
  const expenses: ExpenseData = {
    factoring: 0,
    dispatch: 0,
    fuel: 0,
    maintenance: 0,
    tollsViolations: 0,
    insurance: 0,
    trailer: 0,
    parts: 0,
    payback: 0,
    eld: 0,
    camera: 0,
    driverPercent: 0,
    advanced: 0,
  };

  const driversData: DriverSheetData[] = [
    {
      driverId: 1,
      driverName: 'José → 龙',
      truckNumber: 'TRK 001',
      companyName: 'Müller Logistics',
      weeks: [
        {
          weekNumber: 1,
          weekStart: new Date('2024-01-01'),
          weekEnd: new Date('2024-01-07'),
          loads: [
            {
              loadRef: 'LD-α→β',
              vendor: 'Acme → Café',
              driverName: 'José → 龙',
              puDate: new Date('2024-01-02'),
              delDate: null,
              fromState: 'México',
              toState: 'Québec',
              rate: 123,
            },
          ],
          expenses,
          driverPercentRate: 0,
          brokerTotal: 123,
          hasData: true,
        },
      ],
      ytdGross: 0,
      ytdNetPay: 0,
      ytdExpenses: {
        fuel: 0,
        tolls: 0,
        trailer: 0,
        eld: 0,
        camera: 0,
        driverPercent: 0,
        maintenance: 0,
        insurance: 0,
        payback: 0,
        advanced: 0,
        parts: 0,
        dispatch: 0,
      },
    },
  ];

  const buffer = await generateReportXLSX(driversData);
  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 0);
});
