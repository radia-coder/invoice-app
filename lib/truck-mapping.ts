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
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

type TruckMatchType = 'exact' | 'partial' | 'fuzzy' | 'db' | 'none';

type TruckMatchResult = {
  truckNumber: string | null;
  matchType: TruckMatchType;
  matchedName?: string;
};

const NORMALIZED_TRUCK_MAP = new Map<string, string>();
const NORMALIZED_NAME_MAP = new Map<string, string>();

for (const [name, truckNumber] of Object.entries(DRIVER_TRUCK_MAP)) {
  const normalized = normalizeDriverName(name);
  NORMALIZED_TRUCK_MAP.set(normalized, truckNumber);
  NORMALIZED_NAME_MAP.set(normalized, name);
}

function levenshteinDistance(a: string, b: string): number {
  const dp: number[][] = Array.from({ length: a.length + 1 }, () =>
    Array(b.length + 1).fill(0)
  );

  for (let i = 0; i <= a.length; i++) dp[i][0] = i;
  for (let j = 0; j <= b.length; j++) dp[0][j] = j;

  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(
        dp[i - 1][j] + 1,
        dp[i][j - 1] + 1,
        dp[i - 1][j - 1] + cost
      );
    }
  }

  return dp[a.length][b.length];
}

function findTruckNumber(driverName: string): TruckMatchResult {
  const normalized = normalizeDriverName(driverName);
  if (!normalized) {
    return { truckNumber: null, matchType: 'none' };
  }
  const direct = NORMALIZED_TRUCK_MAP.get(normalized);
  if (direct) {
    return { truckNumber: direct, matchType: 'exact', matchedName: NORMALIZED_NAME_MAP.get(normalized) };
  }

  const partialCandidates: string[] = [];
  for (const [normalizedName] of NORMALIZED_TRUCK_MAP.entries()) {
    if (
      normalizedName.includes(normalized) ||
      normalized.includes(normalizedName)
    ) {
      partialCandidates.push(normalizedName);
    }
  }

  if (partialCandidates.length === 1) {
    const candidate = partialCandidates[0];
    return {
      truckNumber: NORMALIZED_TRUCK_MAP.get(candidate) || null,
      matchType: 'partial',
      matchedName: NORMALIZED_NAME_MAP.get(candidate),
    };
  }

  let bestCandidate: string | null = null;
  let bestDistance = Number.POSITIVE_INFINITY;
  let bestCount = 0;
  const maxDistance = normalized.length <= 10 ? 2 : 3;

  for (const [normalizedName] of NORMALIZED_TRUCK_MAP.entries()) {
    const distance = levenshteinDistance(normalized, normalizedName);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestCandidate = normalizedName;
      bestCount = 1;
    } else if (distance === bestDistance) {
      bestCount += 1;
    }
  }

  if (bestCandidate && bestDistance <= maxDistance && bestCount === 1) {
    return {
      truckNumber: NORMALIZED_TRUCK_MAP.get(bestCandidate) || null,
      matchType: 'fuzzy',
      matchedName: NORMALIZED_NAME_MAP.get(bestCandidate),
    };
  }

  return { truckNumber: null, matchType: 'none' };
}

/**
 * Get truck number for a driver by name
 * Returns the truck number from the mapping or database, otherwise null
 */
export function getTruckNumber(
  driverName: string,
  _driverId: number,
  dbTruckNumber?: string | null
): string | null {
  if (dbTruckNumber && dbTruckNumber.trim()) {
    return dbTruckNumber.trim();
  }
  const matched = findTruckNumber(driverName);
  if (matched.truckNumber) {
    return matched.truckNumber;
  }

  return null;
}

/**
 * Validation result for export
 */
export interface TruckValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  driverTruckMap: Map<
    number,
    {
      name: string;
      truckNumber: string | null;
      isMapped: boolean;
      matchType: TruckMatchType;
      matchedName?: string;
    }
  >;
}

/**
 * Validate all drivers have correct truck numbers before export
 */
export function validateTruckNumbers(
  drivers: Array<{ id: number; name: string; truck_number?: string | null }>
): TruckValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const driverTruckMap = new Map<
    number,
    {
      name: string;
      truckNumber: string | null;
      isMapped: boolean;
      matchType: TruckMatchType;
      matchedName?: string;
    }
  >();

  // Track truck numbers to detect duplicates
  const truckToDrivers = new Map<string, Array<{ id: number; name: string }>>();

  // Track unmapped drivers
  const unmappedDrivers: string[] = [];

  for (const driver of drivers) {
    let matchResult: TruckMatchResult;
    if (driver.truck_number && driver.truck_number.trim()) {
      matchResult = { truckNumber: driver.truck_number.trim(), matchType: 'db' };
    } else {
      matchResult = findTruckNumber(driver.name);
    }
    const isMapped = matchResult.matchType !== 'none';
    const truckNumber = matchResult.truckNumber ?? null;

    // Store in result map
    driverTruckMap.set(driver.id, {
      name: driver.name,
      truckNumber,
      isMapped,
      matchType: matchResult.matchType,
      matchedName: matchResult.matchedName,
    });

    if (!truckNumber) {
      unmappedDrivers.push(`${driver.name} (ID: ${driver.id})`);
      continue;
    }

    // Track for duplicate detection
    const existing = truckToDrivers.get(truckNumber) || [];
    existing.push({ id: driver.id, name: driver.name });
    truckToDrivers.set(truckNumber, existing);

    // Track unmapped
    if (!isMapped) {
      warnings.push(
        `Non-exact name match: ${driver.name} -> ${matchResult.matchedName || 'unknown'} (${matchResult.matchType})`
      );
    } else if (matchResult.matchType === 'partial' || matchResult.matchType === 'fuzzy') {
      warnings.push(
        `Name match used: ${driver.name} -> ${matchResult.matchedName || 'unknown'} (${matchResult.matchType})`
      );
    }
  }

  // Check for problematic duplicates
  for (const [truckNum, driverList] of truckToDrivers.entries()) {
    if (driverList.length > 1) {
      const driverNames = driverList.map(d => `${d.name} (ID: ${d.id})`).join(', ');

      warnings.push(`Duplicate truck number ${truckNum} shared by: ${driverNames}`);
    }
  }

  // Warn about unmapped drivers
  if (unmappedDrivers.length > 0) {
    warnings.push(
      `${unmappedDrivers.length} driver(s) missing a truck number and will be skipped: ${unmappedDrivers.join('; ')}`
    );
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
