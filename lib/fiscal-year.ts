/**
 * Fiscal year utilities for invoice calculations
 * Fiscal year runs from December 21 to December 20
 */

/**
 * Calculate the start of the fiscal year for a given date
 * If the date is between Dec 21-31, the fiscal year starts Dec 21 of current year
 * Otherwise, it starts Dec 21 of previous year
 */
export function getYearStart(weekEnd: Date): Date {
  const currentYear = weekEnd.getFullYear();
  const currentMonth = weekEnd.getMonth();
  const currentDay = weekEnd.getDate();

  return currentMonth === 11 && currentDay >= 21
    ? new Date(currentYear, 11, 21)
    : new Date(currentYear - 1, 11, 21);
}
