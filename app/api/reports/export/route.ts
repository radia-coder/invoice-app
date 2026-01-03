import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, isSuperAdmin } from '@/lib/auth';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';
import {
  generateReportXLSX,
  type DriverSheetData,
  type WeekData,
  type ExpenseData,
} from '@/lib/xlsx-generator';

export const dynamic = 'force-dynamic';

// Map deduction types to expense categories
function mapDeductionToExpenseKey(deductionType: string): keyof ExpenseData | null {
  const typeUpper = deductionType.toUpperCase();

  if (typeUpper.includes('FACTORING')) return 'factoring';
  if (typeUpper.includes('DISPATCH')) return 'dispatch';
  if (typeUpper.includes('FUEL')) return 'fuel';
  if (typeUpper.includes('MAINTENANCE')) return 'maintenance';
  if (typeUpper.includes('TOLL') || typeUpper.includes('VIOLATION')) return 'tollsViolations';
  if (typeUpper.includes('INSURANCE')) return 'insurance';
  if (typeUpper.includes('TRAILER')) return 'trailer';
  if (typeUpper.includes('PAYBACK')) return 'payback';
  if (typeUpper.includes('ELD')) return 'eld';
  if (typeUpper.includes('CAMERA')) return 'camera';
  if (typeUpper.includes('ADVANCED') || typeUpper.includes('ADVANCE')) return 'advanced';

  return null;
}

function getWeekNumber(date: Date): number {
  const startOfYear = new Date(date.getFullYear(), 0, 1);
  const diff = date.getTime() - startOfYear.getTime();
  const oneWeek = 7 * 24 * 60 * 60 * 1000;
  return Math.ceil((diff + startOfYear.getDay() * 24 * 60 * 60 * 1000) / oneWeek);
}

function createEmptyExpenses(): ExpenseData {
  return {
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
  };
}

export async function GET(request: NextRequest) {
  try {
    const user = await getSessionUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const scope = searchParams.get('scope') || 'all';
    const companyIdParam = searchParams.get('companyId');
    const driverIdParam = searchParams.get('driverId');
    const dateFromParam = searchParams.get('dateFrom');
    const dateToParam = searchParams.get('dateTo');

    const companyId = companyIdParam ? Number(companyIdParam) : null;
    const driverId = driverIdParam ? Number(driverIdParam) : null;
    const dateFrom = dateFromParam ? new Date(dateFromParam) : null;
    const dateTo = dateToParam ? new Date(dateToParam) : null;

    // Build where clause for invoices
    const invoiceWhere: any = {};

    if (!isSuperAdmin(user)) {
      invoiceWhere.company_id = user.company_id ?? -1;
    } else if (scope === 'company' && companyId) {
      invoiceWhere.company_id = companyId;
    }

    if (scope === 'driver' && driverId) {
      invoiceWhere.driver_id = driverId;
    }

    if (dateFrom || dateTo) {
      invoiceWhere.week_end = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }

    // Build where clause for drivers
    const driverWhere: any = { status: 'active' };

    if (!isSuperAdmin(user)) {
      driverWhere.company_id = user.company_id ?? -1;
    } else if (scope === 'company' && companyId) {
      driverWhere.company_id = companyId;
    }

    if (scope === 'driver' && driverId) {
      driverWhere.id = driverId;
    }

    // Fetch drivers and their invoices
    const [drivers, invoices] = await Promise.all([
      prisma.driver.findMany({
        where: driverWhere,
        include: { company: true },
        orderBy: { name: 'asc' },
      }),
      prisma.invoice.findMany({
        where: invoiceWhere,
        include: {
          company: true,
          driver: true,
          loads: true,
          deductions: true,
        },
        orderBy: [{ week_start: 'asc' }],
      }),
    ]);

    // Get YTD invoices (from Jan 1 of current year)
    const currentYear = dateTo ? dateTo.getFullYear() : new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);

    const ytdInvoiceWhere: any = {
      ...invoiceWhere,
      week_end: {
        gte: yearStart,
        ...(dateTo ? { lte: dateTo } : {}),
      },
    };

    const ytdInvoices = await prisma.invoice.findMany({
      where: ytdInvoiceWhere,
      include: {
        loads: true,
        deductions: true,
        driver: true,
      },
    });

    // Group invoices by driver
    const invoicesByDriver = new Map<number, typeof invoices>();
    invoices.forEach((invoice) => {
      const driverInvoices = invoicesByDriver.get(invoice.driver_id) || [];
      driverInvoices.push(invoice);
      invoicesByDriver.set(invoice.driver_id, driverInvoices);
    });

    // Group YTD invoices by driver
    const ytdByDriver = new Map<
      number,
      {
        ytdGross: number;
        ytdNetPay: number;
        ytdExpenses: DriverSheetData['ytdExpenses'];
      }
    >();

    ytdInvoices.forEach((invoice) => {
      const current = ytdByDriver.get(invoice.driver_id) || {
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

      const totals = calculateInvoiceTotals({
        loads: invoice.loads,
        deductions: invoice.deductions,
        percent: invoice.percent,
        tax_percent: invoice.tax_percent || 0,
        driver_type: invoice.driver.type,
      });

      current.ytdGross += totals.gross;
      current.ytdNetPay += totals.net;

      // Aggregate YTD expenses
      invoice.deductions.forEach((ded) => {
        const typeUpper = ded.deduction_type.toUpperCase();
        if (typeUpper.includes('FUEL')) current.ytdExpenses.fuel += ded.amount;
        else if (typeUpper.includes('TOLL')) current.ytdExpenses.tolls += ded.amount;
        else if (typeUpper.includes('TRAILER')) current.ytdExpenses.trailer += ded.amount;
        else if (typeUpper.includes('ELD')) current.ytdExpenses.eld += ded.amount;
        else if (typeUpper.includes('CAMERA')) current.ytdExpenses.camera += ded.amount;
        else if (typeUpper.includes('MAINTENANCE')) current.ytdExpenses.maintenance += ded.amount;
        else if (typeUpper.includes('INSURANCE')) current.ytdExpenses.insurance += ded.amount;
        else if (typeUpper.includes('PAYBACK')) current.ytdExpenses.payback += ded.amount;
        else if (typeUpper.includes('ADVANCE')) current.ytdExpenses.advanced += ded.amount;
      });

      // Add driver percent to YTD
      current.ytdExpenses.driverPercent += totals.percentAmount;

      ytdByDriver.set(invoice.driver_id, current);
    });

    // Build driver sheet data
    const driversData: DriverSheetData[] = drivers.map((driver) => {
      const driverInvoices = invoicesByDriver.get(driver.id) || [];
      const ytdData = ytdByDriver.get(driver.id) || {
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

      // Convert invoices to week data
      const weeks: WeekData[] = driverInvoices.map((invoice, idx) => {
        const expenses = createEmptyExpenses();

        // Map deductions to expense categories
        invoice.deductions.forEach((ded) => {
          const key = mapDeductionToExpenseKey(ded.deduction_type);
          if (key) {
            expenses[key] += ded.amount;
          }
        });

        // Calculate driver percent (company cut or driver pay)
        const totals = calculateInvoiceTotals({
          loads: invoice.loads,
          deductions: invoice.deductions,
          percent: invoice.percent,
          tax_percent: invoice.tax_percent || 0,
          driver_type: invoice.driver.type,
        });
        expenses.driverPercent = totals.percentAmount;

        // Map loads
        const loads = invoice.loads.map((load) => ({
          loadRef: load.load_ref,
          vendor: '', // Will need to add vendor field to InvoiceLoad
          driver: driver.name,
          puDate: load.load_date,
          delDate: null, // Will need to add delivery_date field
          fromState: load.from_location,
          toState: load.to_location,
          rate: load.amount,
        }));

        return {
          weekNumber: getWeekNumber(invoice.week_start),
          weekStart: invoice.week_start,
          weekEnd: invoice.week_end,
          loads,
          expenses,
          brokerTotal: totals.gross,
        };
      });

      return {
        driverName: driver.name,
        truckNumber: driver.truck_number || `TRK ${driver.id.toString().padStart(3, '0')}`,
        companyName: driver.company?.name || 'Unknown',
        weeks,
        ytdGross: ytdData.ytdGross,
        ytdNetPay: ytdData.ytdNetPay,
        ytdExpenses: ytdData.ytdExpenses,
      };
    });

    // Generate XLSX
    const xlsxBuffer = await generateReportXLSX(driversData);

    // Create filename
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `settlement-report-${dateStr}.xlsx`;

    // Return file response
    return new NextResponse(new Uint8Array(xlsxBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate export' },
      { status: 500 }
    );
  }
}
