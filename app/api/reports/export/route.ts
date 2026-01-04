import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, isSuperAdmin } from '@/lib/auth';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';
import {
  generateReportXLSX,
  generateDeltaReportXLSX,
  type DriverSheetData,
  type WeekData,
  type ExpenseData,
  type LoadData,
} from '@/lib/xlsx-generator';
import {
  getTruckNumber,
  validateTruckNumbers,
} from '@/lib/truck-mapping';

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

/**
 * Get ISO week number for a date
 */
function getWeekNumber(date: Date): number {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Set to nearest Thursday (for ISO week calculation)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7));
  const yearStart = new Date(d.getFullYear(), 0, 1);
  const weekNo = Math.ceil((((d.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return weekNo;
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

function createEmptyYtdExpenses(): DriverSheetData['ytdExpenses'] {
  return {
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
    const mode = searchParams.get('mode') || 'full'; // 'full' or 'changes'
    const companyIdParam = searchParams.get('companyId');
    const driverIdParam = searchParams.get('driverId');
    const dateFromParam = searchParams.get('dateFrom');
    const dateToParam = searchParams.get('dateTo');

    const companyId = companyIdParam ? Number(companyIdParam) : null;
    const driverId = driverIdParam ? Number(driverIdParam) : null;
    const dateFrom = dateFromParam ? new Date(dateFromParam) : null;
    const dateTo = dateToParam ? new Date(dateToParam) : null;

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

    // Fetch all relevant drivers first
    const drivers = await prisma.driver.findMany({
      where: driverWhere,
      include: { company: true },
      orderBy: { name: 'asc' },
    });

    // ========== VALIDATION STEP ==========
    const validation = validateTruckNumbers(drivers);

    if (!validation.isValid) {
      return NextResponse.json(
        {
          error: 'Truck number validation failed',
          details: validation.errors,
          warnings: validation.warnings,
        },
        { status: 400 }
      );
    }

    // Log warnings but continue
    if (validation.warnings.length > 0) {
      console.warn('Export warnings:', validation.warnings);
    }

    // Build where clause for invoices
    const invoiceWhere: any = {
      driver_id: { in: drivers.map((d) => d.id) },
    };

    if (dateFrom || dateTo) {
      invoiceWhere.week_end = {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lte: dateTo } : {}),
      };
    }

    // For delta mode, get last export time and filter by updated_at
    let lastExportTime: Date | null = null;
    if (mode === 'changes') {
      const lastExport = await prisma.exportLog.findFirst({
        where: {
          company_id: companyId || (isSuperAdmin(user) ? undefined : user.company_id),
        },
        orderBy: { exported_at: 'desc' },
      });

      if (lastExport) {
        lastExportTime = lastExport.exported_at;
        invoiceWhere.updated_at = { gt: lastExportTime };
      }
    }

    // Fetch invoices with all related data
    const invoices = await prisma.invoice.findMany({
      where: invoiceWhere,
      include: {
        company: true,
        driver: true,
        loads: true,
        deductions: true,
      },
      orderBy: [{ week_start: 'asc' }],
    });

    // Get YTD invoices (from Jan 1 of current year)
    const currentYear = dateTo ? dateTo.getFullYear() : new Date().getFullYear();
    const yearStart = new Date(currentYear, 0, 1);

    const ytdInvoices = await prisma.invoice.findMany({
      where: {
        driver_id: { in: drivers.map((d) => d.id) },
        week_end: {
          gte: yearStart,
          ...(dateTo ? { lte: dateTo } : {}),
        },
      },
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

    // Calculate YTD by driver
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
        ytdExpenses: createEmptyYtdExpenses(),
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

    // For delta mode, only include drivers with changes
    const driversToExport = mode === 'changes'
      ? drivers.filter((d) => invoicesByDriver.has(d.id))
      : drivers;

    if (mode === 'changes' && driversToExport.length === 0) {
      return NextResponse.json(
        { message: 'No changes since last export' },
        { status: 200 }
      );
    }

    // Build driver sheet data
    const driversData: DriverSheetData[] = driversToExport.map((driver) => {
      const driverInvoices = invoicesByDriver.get(driver.id) || [];
      const ytdData = ytdByDriver.get(driver.id) || {
        ytdGross: 0,
        ytdNetPay: 0,
        ytdExpenses: createEmptyYtdExpenses(),
      };

      // Get truck number from mapping (preserves leading zeros)
      const truckNumber = getTruckNumber(driver.name, driver.id, driver.truck_number);

      // Convert invoices to week data
      const weeks: WeekData[] = driverInvoices.map((invoice) => {
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

        // Map loads with REAL data
        const loads: LoadData[] = invoice.loads.map((load) => ({
          loadRef: load.load_ref,
          vendor: '', // TODO: Add vendor field to InvoiceLoad model
          driverName: driver.name,
          puDate: load.load_date, // Using load_date as pickup date
          delDate: null, // TODO: Add delivery_date field to InvoiceLoad model
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
          hasData: true,
        };
      });

      return {
        driverId: driver.id,
        driverName: driver.name,
        truckNumber, // String - preserves leading zeros like "TRK 007"
        companyName: driver.company?.name || 'Unknown',
        weeks,
        ytdGross: ytdData.ytdGross,
        ytdNetPay: ytdData.ytdNetPay,
        ytdExpenses: ytdData.ytdExpenses,
      };
    });

    // Generate XLSX
    const xlsxBuffer = mode === 'changes'
      ? await generateDeltaReportXLSX(driversData)
      : await generateReportXLSX(driversData);

    // Log export
    await prisma.exportLog.create({
      data: {
        user_id: user.id,
        company_id: companyId || user.company_id,
        export_type: mode,
        scope,
        driver_ids: JSON.stringify(driversToExport.map((d) => d.id)),
      },
    });

    // Create filename
    const dateStr = new Date().toISOString().split('T')[0];
    const modeStr = mode === 'changes' ? '-delta' : '';
    const filename = `settlement-report${modeStr}-${dateStr}.xlsx`;

    // Return file response
    return new NextResponse(new Uint8Array(xlsxBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-cache',
        'X-Export-Warnings': validation.warnings.length > 0 ? validation.warnings.join('; ') : '',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate export', details: String(error) },
      { status: 500 }
    );
  }
}
