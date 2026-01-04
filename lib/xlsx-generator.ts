import ExcelJS from 'exceljs';
import { format } from 'date-fns';

// Types
interface LoadData {
  loadRef: string | null;
  vendor: string;
  driverName: string;
  puDate: Date | null;
  delDate: Date | null;
  fromState: string;
  toState: string;
  rate: number;
}

interface ExpenseData {
  factoring: number;
  dispatch: number;
  fuel: number;
  maintenance: number;
  tollsViolations: number;
  insurance: number;
  trailer: number;
  payback: number;
  eld: number;
  camera: number;
  driverPercent: number;
  advanced: number;
}

interface WeekData {
  weekNumber: number;
  weekStart: Date;
  weekEnd: Date;
  loads: LoadData[];
  expenses: ExpenseData;
  brokerTotal: number;
  hasData: boolean; // Whether this week has actual invoice data
}

interface DriverSheetData {
  driverId: number;
  driverName: string;
  truckNumber: string; // STRING - preserves leading zeros
  sheetName?: string;
  companyName: string;
  weeks: WeekData[];
  ytdGross: number;
  ytdNetPay: number;
  ytdExpenses: {
    fuel: number;
    tolls: number;
    trailer: number;
    eld: number;
    camera: number;
    driverPercent: number;
    maintenance: number;
    insurance: number;
    payback: number;
    advanced: number;
  };
}

// Color definitions (ARGB format for ExcelJS)
const COLORS = {
  black: 'FF000000',
  yellow: 'FFFFD700',
  gold: 'FFFFCC00',
  lightPurple: 'FFE6E6FA',
  lavender: 'FFCCCCFF',
  peach: 'FFFFDAB9',
  lightOrange: 'FFFFEFD5',
  lightBlue: 'FFADD8E6',
  darkGreen: 'FF006400',
  brightGreen: 'FF00FF00',
  neonGreen: 'FF39FF14',
  emeraldGreen: 'FF50C878',
  gray: 'FFC0C0C0',
  lightGray: 'FFD3D3D3',
  darkGray: 'FF404040',
  red: 'FFFF0000',
  white: 'FFFFFFFF',
};

// Each week block is exactly 18 rows (no gaps between weeks)
const ROWS_PER_WEEK = 18;
const MAX_EXPENSE_ROWS = 12;
const MAX_WEEKS = 50;
const MAX_LOADS_PER_WEEK = 6;
const TEMPLATE_WEEK_1_START = new Date(2025, 11, 21);

function setCellStyle(
  cell: ExcelJS.Cell,
  options: {
    bgColor?: string;
    fontColor?: string;
    bold?: boolean;
    align?: 'left' | 'center' | 'right';
    valign?: 'top' | 'middle' | 'bottom';
    numFmt?: string;
    border?: boolean;
    fontSize?: number;
  }
) {
  if (options.bgColor) {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: options.bgColor },
    };
  }

  cell.font = {
    color: { argb: options.fontColor || COLORS.black },
    bold: options.bold || false,
    size: options.fontSize || 11,
  };

  cell.alignment = {
    horizontal: options.align || 'left',
    vertical: options.valign || 'middle',
  };

  if (options.numFmt) {
    cell.numFmt = options.numFmt;
  }

  if (options.border) {
    cell.border = {
      top: { style: 'thin', color: { argb: COLORS.black } },
      left: { style: 'thin', color: { argb: COLORS.black } },
      bottom: { style: 'thin', color: { argb: COLORS.black } },
      right: { style: 'thin', color: { argb: COLORS.black } },
    };
  }
}

function formatDateForCell(date: Date | null): string {
  if (!date) return '';
  try {
    return format(new Date(date), 'MM/dd/yy');
  } catch {
    return '';
  }
}

function setColumnWidths(worksheet: ExcelJS.Worksheet) {
  worksheet.getColumn('A').width = 12;
  worksheet.getColumn('B').width = 12;
  worksheet.getColumn('C').width = 18;
  worksheet.getColumn('D').width = 18;
  worksheet.getColumn('E').width = 12;
  worksheet.getColumn('F').width = 12;
  worksheet.getColumn('G').width = 14;
  worksheet.getColumn('H').width = 14;
  worksheet.getColumn('I').width = 12;
  worksheet.getColumn('J').width = 18;
  worksheet.getColumn('K').width = 12;
}

/**
 * Create a single week block starting at the given row
 * Returns the next row number after this block
 */
function createWeekBlock(
  worksheet: ExcelJS.Worksheet,
  weekData: WeekData,
  startRow: number,
  ytdData?: {
    ytdGross: number;
    ytdNetPay: number;
    ytdExpenses: DriverSheetData['ytdExpenses'];
  }
): number {
  const r = startRow;

  // ===== ROW 1: HEADER ROW (Week #, LOAD#, VENDOR, etc.) =====
  const headers = [
    `WEEK ${weekData.weekNumber}`,
    'LOAD#',
    'VENDOR',
    'Driver',
    'PU DATE',
    'DEL DATE',
    'FROM STATE',
    'TO STATE',
    'RATE$',
    'EXPENSES',
    'AMOUNT',
  ];

  headers.forEach((header, idx) => {
    const cell = worksheet.getCell(r, idx + 1);
    cell.value = header;
    setCellStyle(cell, {
      bgColor: COLORS.black,
      fontColor: COLORS.yellow,
      bold: true,
      align: 'center',
      valign: 'middle',
    });
  });

  // ===== ROW 2: BROKER label + first expense =====
  const brokerCell = worksheet.getCell(r + 1, 1); // A2
  brokerCell.value = 'BROKER';
  setCellStyle(brokerCell, {
    bgColor: COLORS.black,
    fontColor: COLORS.yellow,
    bold: true,
  });

  // Rate sub-header (I2) - light blue
  const rateSubHeader = worksheet.getCell(r + 1, 9); // I2
  setCellStyle(rateSubHeader, {
    bgColor: COLORS.lightBlue,
    bold: true,
  });

  // ===== EXPENSE LABELS AND AMOUNTS (J2:K13) =====
  const expenseLabels = [
    'FACTORING',
    'DISPATCH',
    'FUEL',
    'MAINTENANCE',
    'TOLLS/VIOLATIONS',
    'INSURANCE',
    'TRAILER',
    'PAYBACK',
    'ELD',
    'CAMERA',
    'DRIVER ..%',
    'ADVANCED',
  ];

  const expenseValues = [
    weekData.expenses.factoring,
    weekData.expenses.dispatch,
    weekData.expenses.fuel,
    weekData.expenses.maintenance,
    weekData.expenses.tollsViolations,
    weekData.expenses.insurance,
    weekData.expenses.trailer,
    weekData.expenses.payback,
    weekData.expenses.eld,
    weekData.expenses.camera,
    weekData.expenses.driverPercent,
    weekData.expenses.advanced,
  ];

  for (let idx = 0; idx < MAX_EXPENSE_ROWS; idx++) {
    const expenseRow = r + 1 + idx;
    const label = expenseLabels[idx] ?? '';
    const amount = expenseValues[idx] ?? 0;

    // Label cell (J column)
    const labelCell = worksheet.getCell(expenseRow, 10); // Column J
    labelCell.value = label;
    setCellStyle(labelCell, {
      bgColor: COLORS.gray,
      bold: true,
    });

    const isDriverPercent = label.startsWith('DRIVER');

    // Amount cell (K column)
    const amountCell = worksheet.getCell(expenseRow, 11); // Column K
    amountCell.value = isDriverPercent ? (amount || 0) / 100 : amount || 0;
    setCellStyle(amountCell, {
      bgColor: COLORS.lightBlue,
      bold: true,
      numFmt: isDriverPercent ? '0.##%' : '"$"#,##0.00',
    });
  }

  // ===== ROWS 3-8: LOAD LABELS (A3-A8) and LOAD DATA (B3-H8, I3-I8) =====
  for (let i = 0; i < MAX_LOADS_PER_WEEK; i++) {
    const loadRow = r + 2 + i;

    // Load label (A column) - LOAD #1, LOAD #2, etc.
    const labelCell = worksheet.getCell(loadRow, 1); // Column A
    labelCell.value = `LOAD #${i + 1}`;
    setCellStyle(labelCell, {
      bgColor: COLORS.black,
      fontColor: COLORS.lavender,
      bold: true,
    });

    // Load data cells (B-H) - peach background with borders
    for (let col = 2; col <= 8; col++) {
      const dataCell = worksheet.getCell(loadRow, col);
      setCellStyle(dataCell, {
        bgColor: COLORS.peach,
        border: true,
      });
    }

    // Rate cell (I column) - light blue
    const rateCell = worksheet.getCell(loadRow, 9); // Column I
    setCellStyle(rateCell, {
      bgColor: COLORS.lightBlue,
      bold: true,
      numFmt: '"$"#,##0.00',
      border: true,
    });

    // Fill actual load data if available
    const load = weekData.loads[i];
    if (load) {
      worksheet.getCell(loadRow, 2).value = load.loadRef || ''; // B - LOAD#
      worksheet.getCell(loadRow, 3).value = load.vendor || ''; // C - VENDOR
      worksheet.getCell(loadRow, 4).value = load.driverName || ''; // D - Driver
      worksheet.getCell(loadRow, 5).value = formatDateForCell(load.puDate); // E - PU DATE
      worksheet.getCell(loadRow, 6).value = formatDateForCell(load.delDate); // F - DEL DATE
      worksheet.getCell(loadRow, 7).value = load.fromState || ''; // G - FROM STATE
      worksheet.getCell(loadRow, 8).value = load.toState || ''; // H - TO STATE
      worksheet.getCell(loadRow, 9).value = load.rate || 0; // I - RATE$
    } else {
      worksheet.getCell(loadRow, 9).value = 0; // Empty rate
    }
  }

  // ===== ROW 9: BROKER TOTALS =====
  const totalsRow = r + 8;

  // Merge A9:H9 for "BROKER TOTALS" label
  worksheet.mergeCells(totalsRow, 1, totalsRow, 8);
  const brokerTotalsCell = worksheet.getCell(totalsRow, 1);
  brokerTotalsCell.value = 'BROKER TOTALS';
  setCellStyle(brokerTotalsCell, {
    bgColor: COLORS.black,
    fontColor: COLORS.yellow,
    bold: true,
    align: 'center',
  });

  // Broker total sum formula (I9)
  const brokerSumCell = worksheet.getCell(totalsRow, 9);
  brokerSumCell.value = { formula: `SUM(I${r + 2}:I${r + 7})` };
  setCellStyle(brokerSumCell, {
    bgColor: COLORS.darkGreen,
    fontColor: COLORS.brightGreen,
    bold: true,
    numFmt: '"$"#,##0.00',
  });

  // ===== ROW 14: TOTAL OWE =====
  const totalOweRow = r + 1 + MAX_EXPENSE_ROWS;
  const totalOweLabelCell = worksheet.getCell(totalOweRow, 10); // J14
  totalOweLabelCell.value = 'TOTAL OWE';
  setCellStyle(totalOweLabelCell, {
    bgColor: COLORS.red,
    fontColor: COLORS.white,
    bold: true,
  });

  const totalOweAmountCell = worksheet.getCell(totalOweRow, 11); // K14
  totalOweAmountCell.value = { formula: `SUM(K${r + 1}:K${r + MAX_EXPENSE_ROWS})` };
  setCellStyle(totalOweAmountCell, {
    bgColor: COLORS.red,
    fontColor: COLORS.white,
    bold: true,
    numFmt: '"$"#,##0.00',
  });

  // ===== ROW 15: WEEKLY GROSS =====
  const weeklyGrossRow = totalOweRow + 1;
  const weeklyGrossLabelCell = worksheet.getCell(weeklyGrossRow, 10); // J15
  weeklyGrossLabelCell.value = 'WEEKLY GROSS';
  setCellStyle(weeklyGrossLabelCell, {
    bgColor: COLORS.black,
    fontColor: COLORS.neonGreen,
    bold: true,
  });

  const weeklyGrossAmountCell = worksheet.getCell(weeklyGrossRow, 11); // K15
  weeklyGrossAmountCell.value = { formula: `I${totalsRow}` };
  setCellStyle(weeklyGrossAmountCell, {
    bgColor: COLORS.black,
    fontColor: COLORS.neonGreen,
    bold: true,
    numFmt: '"$"#,##0.00',
  });

  // ===== ROW 16: WEEKLY NET PAY =====
  const weeklyNetRow = weeklyGrossRow + 1;
  const weeklyNetLabelCell = worksheet.getCell(weeklyNetRow, 10); // J16
  weeklyNetLabelCell.value = 'WEEKLY NET PAY';
  setCellStyle(weeklyNetLabelCell, {
    bgColor: COLORS.darkGray,
    fontColor: COLORS.brightGreen,
    bold: true,
  });

  const weeklyNetAmountCell = worksheet.getCell(weeklyNetRow, 11); // K16
  weeklyNetAmountCell.value = { formula: `K${weeklyGrossRow}-K${totalOweRow}` };
  setCellStyle(weeklyNetAmountCell, {
    bgColor: COLORS.darkGray,
    fontColor: COLORS.brightGreen,
    bold: true,
    numFmt: '"$"#,##0.00',
  });

  // ===== ROW 17: YTD GROSS =====
  const ytdGrossRow = weeklyNetRow + 1;
  const ytdGrossLabelCell = worksheet.getCell(ytdGrossRow, 10); // J17
  ytdGrossLabelCell.value = 'YTD GROSS';
  setCellStyle(ytdGrossLabelCell, {
    bgColor: COLORS.gold,
    fontColor: COLORS.black,
    bold: true,
  });

  const ytdGrossAmountCell = worksheet.getCell(ytdGrossRow, 11); // K17
  ytdGrossAmountCell.value = ytdData?.ytdGross || 0;
  setCellStyle(ytdGrossAmountCell, {
    bgColor: COLORS.gold,
    fontColor: COLORS.black,
    bold: true,
    numFmt: '"$"#,##0.00',
  });

  // ===== ROW 18: YTD NET PAY =====
  const ytdNetRow = ytdGrossRow + 1;
  const ytdNetLabelCell = worksheet.getCell(ytdNetRow, 10); // J18
  ytdNetLabelCell.value = 'YTD NET PAY';
  setCellStyle(ytdNetLabelCell, {
    bgColor: COLORS.gold,
    fontColor: COLORS.black,
    bold: true,
  });

  const ytdNetAmountCell = worksheet.getCell(ytdNetRow, 11); // K18
  ytdNetAmountCell.value = ytdData?.ytdNetPay || 0;
  setCellStyle(ytdNetAmountCell, {
    bgColor: COLORS.lightBlue,
    fontColor: COLORS.black,
    bold: true,
    numFmt: '"$"#,##0.00',
  });

  // Return next row (no gap - Week 2 starts immediately after Week 1)
  return r + ROWS_PER_WEEK;
}

function createSampleSheet(workbook: ExcelJS.Workbook) {
  const worksheet = workbook.addWorksheet('SAMPLE');
  setColumnWidths(worksheet);

  // Create 3 sample week blocks to show the template
  let currentRow = 1;

  for (let weekNum = 1; weekNum <= 3; weekNum++) {
    const sampleWeek: WeekData = {
      weekNumber: weekNum,
      weekStart: getWeekStartDate(weekNum),
      weekEnd: getWeekEndDate(weekNum),
      loads: [],
      expenses: {
        factoring: 0,
        dispatch: 0,
        fuel: 0,
        maintenance: 0,
        tollsViolations: 0,
        insurance: 0,
        trailer: 0,
        payback: 0,
        eld: 0,
        camera: 0,
        driverPercent: 0,
        advanced: 0,
      },
      brokerTotal: 0,
      hasData: false,
    };

    currentRow = createWeekBlock(worksheet, sampleWeek, currentRow);
  }

  return worksheet;
}

function createDriverSheet(
  workbook: ExcelJS.Workbook,
  driverData: DriverSheetData
) {
  // Sheet name is the truck number (max 31 chars for Excel)
  const sheetBaseName = driverData.sheetName || driverData.truckNumber;
  const sheetName = sheetBaseName.substring(0, 31);
  const worksheet = workbook.addWorksheet(sheetName);
  setColumnWidths(worksheet);

  // Create all 50 week blocks
  let currentRow = 1;

  for (let weekIdx = 0; weekIdx < MAX_WEEKS; weekIdx++) {
    const weekNum = weekIdx + 1;

    // Find matching week data or create empty template
    const weekData = driverData.weeks.find((w) => w.weekNumber === weekNum) || {
      weekNumber: weekNum,
      weekStart: getWeekStartDate(weekNum),
      weekEnd: getWeekEndDate(weekNum),
      loads: [],
      expenses: {
        factoring: 0,
        dispatch: 0,
        fuel: 0,
        maintenance: 0,
        tollsViolations: 0,
        insurance: 0,
        trailer: 0,
        payback: 0,
        eld: 0,
        camera: 0,
        driverPercent: 0,
        advanced: 0,
      },
      brokerTotal: 0,
      hasData: false,
    };

    // Include YTD data on the last week that has data, or on week 50
    const isLastWeekWithData =
      weekIdx === driverData.weeks.length - 1 || weekNum === MAX_WEEKS;

    currentRow = createWeekBlock(
      worksheet,
      weekData,
      currentRow,
      isLastWeekWithData
        ? {
            ytdGross: driverData.ytdGross,
            ytdNetPay: driverData.ytdNetPay,
            ytdExpenses: driverData.ytdExpenses,
          }
        : undefined
    );
  }

  return worksheet;
}

/**
 * Get the start date of a week number in a given year
 */
function getWeekStartDate(weekNumber: number): Date {
  const daysToAdd = (weekNumber - 1) * 7;
  return new Date(TEMPLATE_WEEK_1_START.getTime() + daysToAdd * 24 * 60 * 60 * 1000);
}

/**
 * Get the end date of a week number in a given year
 */
function getWeekEndDate(weekNumber: number): Date {
  const startDate = getWeekStartDate(weekNumber);
  return new Date(startDate.getTime() + 6 * 24 * 60 * 60 * 1000);
}

/**
 * Generate the full report XLSX with all drivers
 */
export async function generateReportXLSX(
  driversData: DriverSheetData[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Invoice App';
  workbook.created = new Date();

  // Create SAMPLE sheet first
  createSampleSheet(workbook);

  // Create a sheet for each driver (sorted by truck number)
  const sortedDrivers = [...driversData].sort((a, b) =>
    a.truckNumber.localeCompare(b.truckNumber)
  );

  for (const driverData of sortedDrivers) {
    createDriverSheet(workbook, driverData);
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

/**
 * Generate a delta export with only changed drivers
 */
export async function generateDeltaReportXLSX(
  changedDriversData: DriverSheetData[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Invoice App';
  workbook.created = new Date();

  // No SAMPLE sheet for delta exports

  // Create a sheet for each changed driver
  const sortedDrivers = [...changedDriversData].sort((a, b) =>
    a.truckNumber.localeCompare(b.truckNumber)
  );

  for (const driverData of sortedDrivers) {
    createDriverSheet(workbook, driverData);
  }

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export type { DriverSheetData, WeekData, LoadData, ExpenseData };
