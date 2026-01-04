import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getSessionUser, isSuperAdmin } from '@/lib/auth';
import { calculateInvoiceTotals } from '@/lib/invoice-calculations';
import {
  buildAutoDeductionEntries,
  buildYtdInsuranceIndex,
  calculateAutoDeductions,
  getAutoDeductionConfigFromCompany,
  getYtdInsurance,
  mergeDeductionsWithAuto,
  normalizeDeductionType,
  isDispatchDeduction,
  isFactoringDeduction,
} from '@/lib/auto-deductions';
import {
  buildContentDisposition,
  findNonByteStringChar,
  sanitizeHeaderValue,
} from '@/lib/export-headers';
import {
  generateReportXLSX,
  generateDeltaReportXLSX,
  type DriverSheetData,
  type WeekData,
  type ExpenseData,
  type LoadData,
} from '@/lib/xlsx-generator';
import { validateTruckNumbers } from '@/lib/truck-mapping';

export const dynamic = 'force-dynamic';

type UnicodeDiagnostic = {
  field: string;
  context: string;
  index: number;
  codePoint: number;
  sample: string;
};

const UNICODE_DIAGNOSTIC_LIMIT = 5;

function truncateValue(value: string, maxLength = 80): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength)}...`;
}

function collectUnicodeDiagnostics(
  driversData: DriverSheetData[],
  limit = UNICODE_DIAGNOSTIC_LIMIT
): UnicodeDiagnostic[] {
  const diagnostics: UnicodeDiagnostic[] = [];

  const record = (value: string | null | undefined, field: string, context: string) => {
    if (!value || diagnostics.length >= limit) return;
    const hit = findNonByteStringChar(value);
    if (!hit) return;
    diagnostics.push({
      field,
      context,
      index: hit.index,
      codePoint: hit.codePoint,
      sample: truncateValue(value),
    });
  };

  for (const driver of driversData) {
    const driverContext = `driverId=${driver.driverId}`;
    record(driver.driverName, 'driverName', driverContext);
    record(driver.companyName, 'companyName', driverContext);
    record(driver.truckNumber, 'truckNumber', driverContext);

    for (const week of driver.weeks) {
      const weekContext = `${driverContext},week=${week.weekNumber}`;
      for (const load of week.loads) {
        const loadContext = `${weekContext},loadRef=${load.loadRef || 'n/a'}`;
        record(load.loadRef, 'loadRef', loadContext);
        record(load.vendor, 'vendor', loadContext);
        record(load.driverName, 'load.driverName', loadContext);
        record(load.fromState, 'fromState', loadContext);
        record(load.toState, 'toState', loadContext);

        if (diagnostics.length >= limit) break;
      }
      if (diagnostics.length >= limit) break;
    }
    if (diagnostics.length >= limit) break;
  }

  return diagnostics;
}

function mapDeductionToExpenseKey(deductionType: string): keyof ExpenseData | null {
  const typeUpper = normalizeDeductionType(deductionType);

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
 * Get week number based on fixed template start (Week 1 = Dec 21, 2025).
 */
function getWeekNumber(date: Date): number {
  const base = new Date(2025, 11, 21);
  base.setHours(0, 0, 0, 0);
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const diffDays = Math.floor((d.getTime() - base.getTime()) / 86400000);
  const weekNo = Math.floor(diffDays / 7) + 1;
  return Math.min(50, Math.max(1, weekNo));
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

const MAX_LOADS_PER_WEEK = 6;

function normalizeVendor(value: string): string {
  return value.trim().toLowerCase();
}

function addExpenses(target: ExpenseData, source: ExpenseData) {
  target.factoring += source.factoring;
  target.dispatch += source.dispatch;
  target.fuel += source.fuel;
  target.maintenance += source.maintenance;
  target.tollsViolations += source.tollsViolations;
  target.insurance += source.insurance;
  target.trailer += source.trailer;
  target.payback += source.payback;
  target.eld += source.eld;
  target.camera += source.camera;
  target.driverPercent += source.driverPercent;
  target.advanced += source.advanced;
}

function addYtdExpenses(
  target: DriverSheetData['ytdExpenses'],
  source: DriverSheetData['ytdExpenses']
) {
  target.fuel += source.fuel;
  target.tolls += source.tolls;
  target.trailer += source.trailer;
  target.eld += source.eld;
  target.camera += source.camera;
  target.driverPercent += source.driverPercent;
  target.maintenance += source.maintenance;
  target.insurance += source.insurance;
  target.payback += source.payback;
  target.advanced += source.advanced;
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
    const vendorParam = searchParams.get('vendor');

    const companyId = companyIdParam ? Number(companyIdParam) : null;
    const driverId = driverIdParam ? Number(driverIdParam) : null;
    const dateFrom = dateFromParam ? new Date(dateFromParam) : null;
    const dateTo = dateToParam ? new Date(dateToParam) : null;
    const vendorFilter = vendorParam?.trim() ? normalizeVendor(vendorParam) : null;

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
    const warnings = [...validation.warnings];

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
    if (warnings.length > 0) {
      console.warn('Export warnings:', warnings);
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
        driver: { include: { company: true } },
      },
    });

    const filteredInvoices = invoices.flatMap((invoice) => {
      if (!vendorFilter) return [invoice];
      const filteredLoads = invoice.loads.filter((load) =>
        normalizeVendor(load.vendor || '') === vendorFilter
      );
      if (!filteredLoads.length) return [];
      return [{ ...invoice, loads: filteredLoads }];
    });

    const filteredYtdInvoices = ytdInvoices.flatMap((invoice) => {
      if (!vendorFilter) return [invoice];
      const filteredLoads = invoice.loads.filter((load) =>
        normalizeVendor(load.vendor || '') === vendorFilter
      );
      if (!filteredLoads.length) return [];
      return [{ ...invoice, loads: filteredLoads }];
    });

    const ytdInsuranceIndex = buildYtdInsuranceIndex(filteredYtdInvoices);

    // Group invoices by driver
    const invoicesByDriver = new Map<number, typeof invoices>();
    filteredInvoices.forEach((invoice) => {
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

    filteredYtdInvoices.forEach((invoice) => {
      const current = ytdByDriver.get(invoice.driver_id) || {
        ytdGross: 0,
        ytdNetPay: 0,
        ytdExpenses: createEmptyYtdExpenses(),
      };

      const autoConfig = getAutoDeductionConfigFromCompany(invoice.driver?.company || {});
      const ytdInsurance = getYtdInsurance(ytdInsuranceIndex, invoice.driver_id, invoice.week_end);
      const autoAmounts = calculateAutoDeductions(ytdInsurance, autoConfig);
      const autoEntries = buildAutoDeductionEntries(autoAmounts, autoConfig);
      const mergedDeductions = mergeDeductionsWithAuto(invoice.deductions, autoEntries);

      const totals = calculateInvoiceTotals({
        loads: invoice.loads,
        deductions: mergedDeductions,
        percent: invoice.percent,
        tax_percent: invoice.tax_percent || 0,
        driver_type: invoice.driver.type,
      });

      current.ytdGross += totals.gross;
      current.ytdNetPay += totals.net;

      // Aggregate YTD expenses
      invoice.deductions.forEach((ded) => {
        const typeUpper = normalizeDeductionType(ded.deduction_type);
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
    const driversToExport = mode === 'changes' || vendorFilter
      ? drivers.filter((d) => invoicesByDriver.has(d.id))
      : drivers;

    if (mode === 'changes' && driversToExport.length === 0) {
      return NextResponse.json(
        { message: 'No changes since last export' },
        { status: 200 }
      );
    }

    const driversWithTruckNumbers = driversToExport.filter((driver) => {
      const truckInfo = validation.driverTruckMap.get(driver.id);
      return !!truckInfo?.truckNumber;
    });

    if (driversWithTruckNumbers.length === 0) {
      return NextResponse.json(
        {
          message: 'No drivers available for export (missing truck numbers)',
          warnings
        },
        { status: 200 }
      );
    }

    // Build driver sheet data
    type TruckGroup = {
      truckNumber: string;
      driverIds: number[];
      driverNames: string[];
      companyNames: string[];
      weeksByNumber: Map<number, WeekData>;
      ytdGross: number;
      ytdNetPay: number;
      ytdExpenses: DriverSheetData['ytdExpenses'];
    };

    const truckGroups = new Map<string, TruckGroup>();
    const truckToDrivers = new Map<string, Array<{ id: number; name: string }>>();

    const driversData: DriverSheetData[] = driversWithTruckNumbers.map((driver) => {
      const driverInvoices = invoicesByDriver.get(driver.id) || [];
      const ytdData = ytdByDriver.get(driver.id) || {
        ytdGross: 0,
        ytdNetPay: 0,
        ytdExpenses: createEmptyYtdExpenses(),
      };

      const truckInfo = validation.driverTruckMap.get(driver.id);
      const truckNumber = truckInfo?.truckNumber;
      if (!truckNumber) {
        throw new Error(`Missing truck number mapping for driver ${driver.name} (ID: ${driver.id})`);
      }

      const existingDrivers = truckToDrivers.get(truckNumber) || [];
      existingDrivers.push({ id: driver.id, name: driver.name });
      truckToDrivers.set(truckNumber, existingDrivers);

      // Convert invoices to week data
      const weeks: WeekData[] = driverInvoices.map((invoice) => {
        const expenses = createEmptyExpenses();

        const autoConfig = getAutoDeductionConfigFromCompany(driver.company || {});
        const ytdInsurance = getYtdInsurance(ytdInsuranceIndex, driver.id, invoice.week_end);
        const autoAmounts = calculateAutoDeductions(ytdInsurance, autoConfig);
        const autoEntries = buildAutoDeductionEntries(autoAmounts, autoConfig);

        expenses.factoring = autoAmounts.factoring;
        expenses.dispatch = autoAmounts.dispatch;

        // Map deductions to expense categories (skip manual factoring/dispatch)
        invoice.deductions.forEach((ded) => {
          if (isFactoringDeduction(ded.deduction_type) || isDispatchDeduction(ded.deduction_type)) {
            return;
          }
          const key = mapDeductionToExpenseKey(ded.deduction_type);
          if (key) {
            expenses[key] += ded.amount;
          }
        });

        // Calculate driver percent (company cut or driver pay)
        const mergedDeductions = mergeDeductionsWithAuto(invoice.deductions, autoEntries);
        const totals = calculateInvoiceTotals({
          loads: invoice.loads,
          deductions: mergedDeductions,
          percent: invoice.percent,
          tax_percent: invoice.tax_percent || 0,
          driver_type: invoice.driver.type,
        });
        expenses.driverPercent = invoice.percent || 0;

        // Map loads with REAL data
        const loads: LoadData[] = invoice.loads
          .slice()
          .sort((a, b) => a.load_date.getTime() - b.load_date.getTime())
          .map((load) => ({
            loadRef: load.load_ref,
            vendor: load.vendor || '',
            driverName: driver.name,
            puDate: load.load_date, // Using load_date as pickup date
            delDate: load.delivery_date || null,
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

    for (const [truckNumber, driverList] of truckToDrivers.entries()) {
      if (driverList.length > 1) {
        const driverNames = driverList.map((d) => `${d.name} (ID: ${d.id})`).join(', ');
        warnings.push(
          `Duplicate truck number ${truckNumber} used by: ${driverNames}. Data merged into a single tab.`
        );
      }
    }

    for (const driverData of driversData) {
      const truckNumber = driverData.truckNumber;
      const group =
        truckGroups.get(truckNumber) || {
          truckNumber,
          driverIds: [],
          driverNames: [],
          companyNames: [],
          weeksByNumber: new Map<number, WeekData>(),
          ytdGross: 0,
          ytdNetPay: 0,
          ytdExpenses: createEmptyYtdExpenses(),
        };

      group.driverIds.push(driverData.driverId);
      group.driverNames.push(driverData.driverName);
      group.companyNames.push(driverData.companyName);
      group.ytdGross += driverData.ytdGross;
      group.ytdNetPay += driverData.ytdNetPay;
      addYtdExpenses(group.ytdExpenses, driverData.ytdExpenses);

      for (const weekData of driverData.weeks) {
        const existing = group.weeksByNumber.get(weekData.weekNumber);
        if (!existing) {
          group.weeksByNumber.set(weekData.weekNumber, {
            ...weekData,
            loads: [...weekData.loads],
            expenses: { ...weekData.expenses },
          });
          continue;
        }

        addExpenses(existing.expenses, weekData.expenses);
        existing.brokerTotal += weekData.brokerTotal;
        existing.hasData = existing.hasData || weekData.hasData;
        existing.weekStart =
          weekData.weekStart < existing.weekStart ? weekData.weekStart : existing.weekStart;
        existing.weekEnd =
          weekData.weekEnd > existing.weekEnd ? weekData.weekEnd : existing.weekEnd;

        const mergedLoads = [...existing.loads, ...weekData.loads];
        mergedLoads.sort((a, b) => {
          const aTime = a.puDate ? a.puDate.getTime() : 0;
          const bTime = b.puDate ? b.puDate.getTime() : 0;
          return aTime - bTime;
        });

        if (mergedLoads.length > MAX_LOADS_PER_WEEK) {
          warnings.push(
            `Truck ${truckNumber} week ${weekData.weekNumber} has ${mergedLoads.length} loads; only first ${MAX_LOADS_PER_WEEK} will be shown.`
          );
        }

        existing.loads = mergedLoads.slice(0, MAX_LOADS_PER_WEEK);
      }

      truckGroups.set(truckNumber, group);
    }

    const groupedDriversData: DriverSheetData[] = Array.from(truckGroups.values())
      .sort((a, b) => a.truckNumber.localeCompare(b.truckNumber))
      .map((group) => {
        const weeks = Array.from(group.weeksByNumber.values()).sort(
          (a, b) => a.weekNumber - b.weekNumber
        );
        return {
          driverId: group.driverIds[0],
          driverName: group.driverNames[0],
          truckNumber: group.truckNumber,
          companyName:
            new Set(group.companyNames).size > 1 ? 'Multiple' : group.companyNames[0] || 'Unknown',
          weeks,
          ytdGross: group.ytdGross,
          ytdNetPay: group.ytdNetPay,
          ytdExpenses: group.ytdExpenses,
        };
      });

    const unicodeDiagnostics = collectUnicodeDiagnostics(groupedDriversData);
    if (unicodeDiagnostics.length > 0) {
      console.warn('Export unicode diagnostics:', unicodeDiagnostics);
    }

    // Generate XLSX
    const xlsxBuffer = mode === 'changes'
      ? await generateDeltaReportXLSX(groupedDriversData)
      : await generateReportXLSX(groupedDriversData);

    // Log export
    await prisma.exportLog.create({
      data: {
        user_id: user.id,
        company_id: companyId || user.company_id,
        export_type: mode,
        scope,
        driver_ids: JSON.stringify(driversWithTruckNumbers.map((d) => d.id)),
      },
    });

    // Create filename - format: "OP Exp 2026.xlsx"
    const year = new Date().getFullYear();
    const modeStr = mode === 'changes' ? ' Delta' : '';
    const filename = `OP Exp ${year}${modeStr}.xlsx`;

    // Return file response
    const rawWarnings = warnings.join('; ');
    const warningsHeader = rawWarnings ? sanitizeHeaderValue(rawWarnings).slice(0, 900) : '';
    const warningsHit = rawWarnings ? findNonByteStringChar(rawWarnings) : null;
    if (warningsHit) {
      console.warn('Export warnings contained non-ByteString characters:', warningsHit);
    }

    const unicodeHeader = unicodeDiagnostics.length > 0
      ? sanitizeHeaderValue(
        unicodeDiagnostics
          .map((entry) =>
            `${entry.field}[${entry.context}] code=${entry.codePoint} idx=${entry.index}`
          )
          .join('; ')
      ).slice(0, 900)
      : '';

    const headers: Record<string, string> = {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': buildContentDisposition(filename),
      'Cache-Control': 'no-cache',
    };

    if (warningsHeader) headers['X-Export-Warnings'] = warningsHeader;
    if (unicodeHeader) headers['X-Export-Unicode'] = unicodeHeader;

    const buffer = Buffer.isBuffer(xlsxBuffer)
      ? xlsxBuffer
      : Buffer.from(xlsxBuffer);

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers,
    });
  } catch (error) {
    console.error('Export error:', error);
    return NextResponse.json(
      { error: 'Failed to generate export', details: String(error) },
      { status: 500 }
    );
  }
}
