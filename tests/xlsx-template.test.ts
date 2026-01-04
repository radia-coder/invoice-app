import test from 'node:test';
import assert from 'node:assert/strict';
import ExcelJS from 'exceljs';
import { generateReportXLSX, type DriverSheetData } from '../lib/xlsx-generator';

function buildDriverData(id: number, truckNumber: string, sheetName?: string): DriverSheetData {
  return {
    driverId: id,
    driverName: `Driver ${id}`,
    truckNumber,
    sheetName,
    companyName: 'Test Co',
    weeks: [],
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
    },
  };
}

test('driver sheet has 50 week blocks and no Week label column', async () => {
  const buffer = await generateReportXLSX([buildDriverData(1, 'TRK 001')]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Buffer);

  const sheet = workbook.getWorksheet('TRK 001');
  assert.ok(sheet);

  const week1Cell = sheet.getCell(1, 1).value;
  const week50Row = 1 + (50 - 1) * 18;
  const week50Cell = sheet.getCell(week50Row, 1).value;
  const weekInfoCell = sheet.getCell(1, 12).value;

  assert.equal(week1Cell, 'WEEK 1');
  assert.equal(week50Cell, 'WEEK 50');
  assert.equal(weekInfoCell ?? '', '');
});

test('driver sheet uses truck number as tab name by default', async () => {
  const buffer = await generateReportXLSX([buildDriverData(1, 'TRK 9215')]);
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer as unknown as Buffer);

  const sheetNames = workbook.worksheets.map((sheet) => sheet.name);
  assert.ok(sheetNames.includes('TRK 9215'));
});
