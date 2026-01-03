import ExcelJS from 'exceljs';
import { format } from 'date-fns';

// Types
interface LoadData {
  loadRef: string | null;
  vendor: string;
  driver: string;
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
}

interface DriverSheetData {
  driverName: string;
  truckNumber: string;
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

// Row offset for each week block (25 rows per week)
const ROWS_PER_WEEK = 25;

function getWeekStartRow(weekIndex: number): number {
  return weekIndex * ROWS_PER_WEEK + 1;
}

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

function formatDateCell(date: Date | null): string {
  if (!date) return '';
  return format(new Date(date), 'MM/dd/yy');
}

function createWeekBlock(
  worksheet: ExcelJS.Worksheet,
  weekData: WeekData,
  startRow: number,
  ytdData?: {
    ytdGross: number;
    ytdNetPay: number;
    ytdExpenses: DriverSheetData['ytdExpenses'];
  }
) {
  const r = startRow;

  // Set column widths (only once, on first week)
  if (startRow === 1) {
    worksheet.getColumn('A').width = 12;
    worksheet.getColumn('B').width = 12;
    worksheet.getColumn('C').width = 15;
    worksheet.getColumn('D').width = 15;
    worksheet.getColumn('E').width = 12;
    worksheet.getColumn('F').width = 12;
    worksheet.getColumn('G').width = 12;
    worksheet.getColumn('H').width = 12;
    worksheet.getColumn('I').width = 12;
    worksheet.getColumn('J').width = 18;
    worksheet.getColumn('K').width = 12;
  }

  // ===== ROW 1: HEADER ROW =====
  const headerRow = worksheet.getRow(r);
  const headers = ['WEEK ' + weekData.weekNumber, 'LOAD#', 'VENDOR', 'Driver', 'PU DATE', 'DEL DATE', 'FROM STATE', 'TO STATE', 'RATE$', 'EXPENSES', 'AMOUNT'];

  headers.forEach((header, idx) => {
    const cell = headerRow.getCell(idx + 1);
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
  const brokerCell = worksheet.getCell(`A${r + 1}`);
  brokerCell.value = 'BROKER';
  setCellStyle(brokerCell, {
    bgColor: COLORS.black,
    fontColor: COLORS.yellow,
    bold: true,
  });

  // Rate sub-header (I2)
  const rateSubHeader = worksheet.getCell(`I${r + 1}`);
  setCellStyle(rateSubHeader, {
    bgColor: COLORS.lightBlue,
    bold: true,
  });

  // ===== ROWS 3-8: LOAD LABELS (A3-A8) and LOAD DATA (B3-H8) =====
  for (let i = 0; i < 6; i++) {
    const loadRow = r + 2 + i;

    // Load label (A column)
    const labelCell = worksheet.getCell(`A${loadRow}`);
    labelCell.value = `LOAD #${i + 1}`;
    setCellStyle(labelCell, {
      bgColor: COLORS.black,
      fontColor: COLORS.lavender,
      bold: true,
    });

    // Load data cells (B-H) - peach background
    for (let col = 2; col <= 8; col++) {
      const dataCell = worksheet.getRow(loadRow).getCell(col);
      setCellStyle(dataCell, {
        bgColor: COLORS.peach,
        border: true,
      });
    }

    // Rate cell (I column) - light blue
    const rateCell = worksheet.getCell(`I${loadRow}`);
    setCellStyle(rateCell, {
      bgColor: COLORS.lightBlue,
      bold: true,
      numFmt: '"$"#,##0.00',
      border: true,
    });

    // Fill load data if available
    const load = weekData.loads[i];
    if (load) {
      worksheet.getCell(`B${loadRow}`).value = load.loadRef || '';
      worksheet.getCell(`C${loadRow}`).value = load.vendor || '';
      worksheet.getCell(`D${loadRow}`).value = load.driver || '';
      worksheet.getCell(`E${loadRow}`).value = formatDateCell(load.puDate);
      worksheet.getCell(`F${loadRow}`).value = formatDateCell(load.delDate);
      worksheet.getCell(`G${loadRow}`).value = load.fromState || '';
      worksheet.getCell(`H${loadRow}`).value = load.toState || '';
      rateCell.value = load.rate || 0;
    } else {
      rateCell.value = 0;
    }
  }

  // ===== ROW 9: BROKER TOTALS =====
  const totalsRow = r + 8;

  // Merge A9:H9 for "BROKER TOTALS" label
  worksheet.mergeCells(`A${totalsRow}:H${totalsRow}`);
  const brokerTotalsCell = worksheet.getCell(`A${totalsRow}`);
  brokerTotalsCell.value = 'BROKER TOTALS';
  setCellStyle(brokerTotalsCell, {
    bgColor: COLORS.black,
    fontColor: COLORS.yellow,
    bold: true,
    align: 'center',
  });

  // Broker total sum (I9)
  const brokerSumCell = worksheet.getCell(`I${totalsRow}`);
  brokerSumCell.value = { formula: `SUM(I${r + 2}:I${r + 7})` };
  setCellStyle(brokerSumCell, {
    bgColor: COLORS.darkGreen,
    fontColor: COLORS.brightGreen,
    bold: true,
    numFmt: '"$"#,##0.00',
  });

  // ===== EXPENSES SECTION (J and K columns) =====
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
    'DRIVER 31%',
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

  expenseLabels.forEach((label, idx) => {
    const expenseRow = r + 1 + idx;

    // Label cell (J)
    const labelCell = worksheet.getCell(`J${expenseRow}`);
    labelCell.value = label;
    setCellStyle(labelCell, {
      bgColor: COLORS.gray,
      bold: true,
    });

    // Amount cell (K)
    const amountCell = worksheet.getCell(`K${expenseRow}`);
    amountCell.value = expenseValues[idx] || 0;
    setCellStyle(amountCell, {
      bgColor: COLORS.lightBlue,
      bold: true,
      numFmt: '"$"#,##0.00',
    });
  });

  // ===== TOTAL OWE (Row after expenses) =====
  const totalOweRow = r + 13;
  const totalOweLabelCell = worksheet.getCell(`J${totalOweRow}`);
  totalOweLabelCell.value = 'TOTAL OWE';
  setCellStyle(totalOweLabelCell, {
    bgColor: COLORS.red,
    fontColor: COLORS.white,
    bold: true,
  });

  const totalOweAmountCell = worksheet.getCell(`K${totalOweRow}`);
  totalOweAmountCell.value = { formula: `SUM(K${r + 1}:K${r + 12})` };
  setCellStyle(totalOweAmountCell, {
    bgColor: COLORS.red,
    fontColor: COLORS.white,
    bold: true,
    numFmt: '"$"#,##0.00',
  });

  // ===== WEEKLY GROSS =====
  const weeklyGrossRow = r + 14;
  const weeklyGrossLabelCell = worksheet.getCell(`J${weeklyGrossRow}`);
  weeklyGrossLabelCell.value = 'WEEKLY GROSS';
  setCellStyle(weeklyGrossLabelCell, {
    bgColor: COLORS.black,
    fontColor: COLORS.neonGreen,
    bold: true,
  });

  const weeklyGrossAmountCell = worksheet.getCell(`K${weeklyGrossRow}`);
  weeklyGrossAmountCell.value = { formula: `I${totalsRow}` };
  setCellStyle(weeklyGrossAmountCell, {
    bgColor: COLORS.black,
    fontColor: COLORS.neonGreen,
    bold: true,
    numFmt: '"$"#,##0.00',
  });

  // ===== WEEKLY NET PAY =====
  const weeklyNetRow = r + 15;
  const weeklyNetLabelCell = worksheet.getCell(`J${weeklyNetRow}`);
  weeklyNetLabelCell.value = 'WEEKLY NET PAY';
  setCellStyle(weeklyNetLabelCell, {
    bgColor: COLORS.darkGray,
    fontColor: COLORS.brightGreen,
    bold: true,
  });

  const weeklyNetAmountCell = worksheet.getCell(`K${weeklyNetRow}`);
  weeklyNetAmountCell.value = { formula: `K${weeklyGrossRow}-K${totalOweRow}` };
  setCellStyle(weeklyNetAmountCell, {
    bgColor: COLORS.darkGray,
    fontColor: COLORS.brightGreen,
    bold: true,
    numFmt: '"$"#,##0.00',
  });

  // ===== YTD GROSS =====
  const ytdGrossRow = r + 16;
  const ytdGrossLabelCell = worksheet.getCell(`J${ytdGrossRow}`);
  ytdGrossLabelCell.value = 'YTD GROSS';
  setCellStyle(ytdGrossLabelCell, {
    bgColor: COLORS.gold,
    fontColor: COLORS.black,
    bold: true,
  });

  const ytdGrossAmountCell = worksheet.getCell(`K${ytdGrossRow}`);
  ytdGrossAmountCell.value = ytdData?.ytdGross || 0;
  setCellStyle(ytdGrossAmountCell, {
    bgColor: COLORS.gold,
    fontColor: COLORS.black,
    bold: true,
    numFmt: '"$"#,##0.00',
  });

  // ===== YTD NET PAY =====
  const ytdNetRow = r + 17;
  const ytdNetLabelCell = worksheet.getCell(`J${ytdNetRow}`);
  ytdNetLabelCell.value = 'YTD NET PAY';
  setCellStyle(ytdNetLabelCell, {
    bgColor: COLORS.gold,
    fontColor: COLORS.black,
    bold: true,
  });

  const ytdNetAmountCell = worksheet.getCell(`K${ytdNetRow}`);
  ytdNetAmountCell.value = ytdData?.ytdNetPay || 0;
  setCellStyle(ytdNetAmountCell, {
    bgColor: COLORS.lightBlue,
    fontColor: COLORS.black,
    bold: true,
    numFmt: '"$"#,##0.00',
  });

  // ===== YTD EXPENSE SUMMARY =====
  if (ytdData) {
    const ytdExpenseLabels = [
      { label: 'YTD FUEL', value: ytdData.ytdExpenses.fuel },
      { label: 'YTD TOLLS', value: ytdData.ytdExpenses.tolls },
      { label: 'YTD TRAILER', value: ytdData.ytdExpenses.trailer },
      { label: 'YTD ELD', value: ytdData.ytdExpenses.eld },
      { label: 'YTD CAMERA', value: ytdData.ytdExpenses.camera },
      { label: 'YTD DRIVER 31%', value: ytdData.ytdExpenses.driverPercent },
      { label: 'YTD MAINTENANCE', value: ytdData.ytdExpenses.maintenance },
      { label: 'YTD INSURANCE', value: ytdData.ytdExpenses.insurance },
      { label: 'YTD PAYBACK', value: ytdData.ytdExpenses.payback },
      { label: 'YTD ADVANCED', value: ytdData.ytdExpenses.advanced },
    ];

    ytdExpenseLabels.forEach((item, idx) => {
      const ytdExpRow = r + 18 + idx;

      const ytdExpLabelCell = worksheet.getCell(`J${ytdExpRow}`);
      ytdExpLabelCell.value = item.label;
      setCellStyle(ytdExpLabelCell, {
        bgColor: COLORS.lightGray,
        fontColor: COLORS.black,
        bold: true,
      });

      const ytdExpAmountCell = worksheet.getCell(`K${ytdExpRow}`);
      ytdExpAmountCell.value = item.value || 0;
      setCellStyle(ytdExpAmountCell, {
        bgColor: COLORS.lightGray,
        fontColor: COLORS.black,
        bold: true,
        numFmt: '"$"#,##0.00',
      });
    });

    // YTD TOTAL OWE
    const ytdTotalOweRow = r + 28;
    const ytdTotalOweLabelCell = worksheet.getCell(`J${ytdTotalOweRow}`);
    ytdTotalOweLabelCell.value = 'YTD TOTAL OWE';
    setCellStyle(ytdTotalOweLabelCell, {
      bgColor: COLORS.red,
      fontColor: COLORS.black,
      bold: true,
    });

    const ytdTotalOweAmountCell = worksheet.getCell(`K${ytdTotalOweRow}`);
    ytdTotalOweAmountCell.value = { formula: `SUM(K${r + 18}:K${r + 27})` };
    setCellStyle(ytdTotalOweAmountCell, {
      bgColor: COLORS.red,
      fontColor: COLORS.black,
      bold: true,
      numFmt: '"$"#,##0.00',
    });
  }
}

function createSampleSheet(workbook: ExcelJS.Workbook) {
  const worksheet = workbook.addWorksheet('SAMPLE');

  // Create empty template with Week 1 placeholder
  const sampleWeek: WeekData = {
    weekNumber: 1,
    weekStart: new Date('2026-01-01'),
    weekEnd: new Date('2026-01-07'),
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
  };

  createWeekBlock(worksheet, sampleWeek, 1);

  return worksheet;
}

function createDriverSheet(
  workbook: ExcelJS.Workbook,
  driverData: DriverSheetData
) {
  const sheetName = driverData.truckNumber || `Driver ${driverData.driverName}`;
  // Excel sheet names have max 31 chars
  const truncatedName = sheetName.substring(0, 31);
  const worksheet = workbook.addWorksheet(truncatedName);

  // Add week start/end at top (before the block)
  if (driverData.weeks.length > 0) {
    const firstWeek = driverData.weeks[0];
    worksheet.getCell('A1').value = `Week Start: ${formatDateCell(firstWeek.weekStart)}`;
    worksheet.getCell('C1').value = `Week End: ${formatDateCell(firstWeek.weekEnd)}`;
    worksheet.getCell('A1').font = { bold: true };
    worksheet.getCell('C1').font = { bold: true };

    // Shift all content down by 2 rows for the header
    driverData.weeks.forEach((week, idx) => {
      const startRow = getWeekStartRow(idx) + 2; // +2 for header rows
      createWeekBlock(
        worksheet,
        week,
        startRow,
        idx === driverData.weeks.length - 1
          ? {
              ytdGross: driverData.ytdGross,
              ytdNetPay: driverData.ytdNetPay,
              ytdExpenses: driverData.ytdExpenses,
            }
          : undefined
      );
    });
  }

  return worksheet;
}

export async function generateReportXLSX(
  driversData: DriverSheetData[]
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Invoice App';
  workbook.created = new Date();

  // Create SAMPLE sheet first
  createSampleSheet(workbook);

  // Create a sheet for each driver
  driversData.forEach((driverData) => {
    createDriverSheet(workbook, driverData);
  });

  // Generate buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
}

export type { DriverSheetData, WeekData, LoadData, ExpenseData };
