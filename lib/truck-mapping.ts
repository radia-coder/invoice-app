/**
 * Official Driver → Truck Number Mapping
 * IMPORTANT: Truck numbers are STRINGS to preserve leading zeros
 */

// Map: Driver Name (lowercase, trimmed) → Truck Number (string)
const DRIVER_TRUCK_MAP: Record<string, string> = {
  // Bakar
  'wandu mazgabu': 'TRK 902',

  // Hade
  'ahmed farah': 'TRK 517',
  'ayub mohamed': 'TRK 1649',
  'ishmael bundu': 'TRK 056',
  'jabuti faqi': 'TRK 354',
  'mohamed dikale': 'TRK 520',
  'mohamud ahmed': 'TRK 316',
  'zakaria muse': 'TRK 768',

  // SSS
  'adan yusuf': 'TRK 1468',
  'issack rashid': 'TRK 03171',
  'samatar ahmed': 'TRK 6878',

  // Weyrah
  'abdihakin shilow': 'TRK 819',
  'abdirahman ahmed ali': 'TRK 4564',
  'abdiwahid kadiye': 'TRK 133',
  'abdurahman husein': 'TRK 648',
  'abukar mohamed abdisalam': 'TRK 9215',
  'dahir abdulle': 'TRK 172',
  'habib hashi': 'TRK 158',
  'hassan shire': 'TRK 7840',
  'kamara saidu': 'TRK 167',
  'nur mohamed': 'TRK 9215', // Note: Same TRK as Abukar Mohamed Abdisalam
  'sharif ali': 'TRK 457',
  'sybiss kevin': 'TRK 725',

  // Zamo
  'abdihakim elmi': 'TRK 040',
  'ahmed ali': 'TRK 476',
  'ahmed dahir abdi': 'TRK 007',
  'abdiqani abraham': 'TRK 265',
};

// Normalize driver name for lookup
function normalizeDriverName(name: string): string {
  return name.toLowerCase().trim();
}

/**
 * Get truck number for a driver by name
 * Returns the truck number from the mapping, or generates a fallback
 */
export function getTruckNumber(driverName: string, driverId: number, dbTruckNumber?: string | null): string {
  // First, check the hardcoded mapping
  const normalized = normalizeDriverName(driverName);
  const mappedTruck = DRIVER_TRUCK_MAP[normalized];

  if (mappedTruck) {
    return mappedTruck;
  }

  // If not in mapping, use database value if available
  if (dbTruckNumber && dbTruckNumber.trim()) {
    return dbTruckNumber.trim();
  }

  // Fallback: generate from driver ID (but flag as unmapped)
  return `TRK ${driverId.toString().padStart(3, '0')}`;
}

/**
 * Validation result for export
 */
export interface TruckValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  driverTruckMap: Map<number, { name: string; truckNumber: string; isMapped: boolean }>;
}

/**
 * Validate all drivers have correct truck numbers before export
 */
export function validateTruckNumbers(
  drivers: Array<{ id: number; name: string; truck_number?: string | null }>
): TruckValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const driverTruckMap = new Map<number, { name: string; truckNumber: string; isMapped: boolean }>();

  // Track truck numbers to detect duplicates
  const truckToDrivers = new Map<string, Array<{ id: number; name: string }>>();

  // Track unmapped drivers
  const unmappedDrivers: string[] = [];

  for (const driver of drivers) {
    const normalized = normalizeDriverName(driver.name);
    const mappedTruck = DRIVER_TRUCK_MAP[normalized];
    const isMapped = !!mappedTruck;

    const truckNumber = getTruckNumber(driver.name, driver.id, driver.truck_number);

    // Store in result map
    driverTruckMap.set(driver.id, {
      name: driver.name,
      truckNumber,
      isMapped,
    });

    // Track for duplicate detection
    const existing = truckToDrivers.get(truckNumber) || [];
    existing.push({ id: driver.id, name: driver.name });
    truckToDrivers.set(truckNumber, existing);

    // Track unmapped
    if (!isMapped) {
      unmappedDrivers.push(`${driver.name} (ID: ${driver.id}) → ${truckNumber}`);
    }
  }

  // Check for problematic duplicates
  // Note: Some duplicates are intentional (TRK 9215 for Abukar and Nur Mohamed)
  const knownDuplicates = new Set(['TRK 9215']);

  for (const [truckNum, driverList] of truckToDrivers.entries()) {
    if (driverList.length > 1) {
      const driverNames = driverList.map(d => `${d.name} (ID: ${d.id})`).join(', ');

      if (knownDuplicates.has(truckNum)) {
        warnings.push(`Known duplicate ${truckNum} shared by: ${driverNames}`);
      } else {
        // Unknown duplicate - this is an error
        errors.push(`Unexpected duplicate truck number ${truckNum} for drivers: ${driverNames}`);
      }
    }
  }

  // Warn about unmapped drivers
  if (unmappedDrivers.length > 0) {
    warnings.push(`${unmappedDrivers.length} driver(s) not in official mapping: ${unmappedDrivers.join('; ')}`);
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
    driverTruckMap,
  };
}

/**
 * Get all known driver names from the mapping
 */
export function getKnownDriverNames(): string[] {
  return Object.keys(DRIVER_TRUCK_MAP);
}

/**
 * Check if a driver name is in the official mapping
 */
export function isDriverMapped(driverName: string): boolean {
  return normalizeDriverName(driverName) in DRIVER_TRUCK_MAP;
}
