// US States - Single source of truth for state data
export const US_STATES: { code: string; name: string }[] = [
  { code: 'AL', name: 'Alabama' },
  { code: 'AK', name: 'Alaska' },
  { code: 'AZ', name: 'Arizona' },
  { code: 'AR', name: 'Arkansas' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'CT', name: 'Connecticut' },
  { code: 'DE', name: 'Delaware' },
  { code: 'FL', name: 'Florida' },
  { code: 'GA', name: 'Georgia' },
  { code: 'HI', name: 'Hawaii' },
  { code: 'ID', name: 'Idaho' },
  { code: 'IL', name: 'Illinois' },
  { code: 'IN', name: 'Indiana' },
  { code: 'IA', name: 'Iowa' },
  { code: 'KS', name: 'Kansas' },
  { code: 'KY', name: 'Kentucky' },
  { code: 'LA', name: 'Louisiana' },
  { code: 'ME', name: 'Maine' },
  { code: 'MD', name: 'Maryland' },
  { code: 'MA', name: 'Massachusetts' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MN', name: 'Minnesota' },
  { code: 'MS', name: 'Mississippi' },
  { code: 'MO', name: 'Missouri' },
  { code: 'MT', name: 'Montana' },
  { code: 'NE', name: 'Nebraska' },
  { code: 'NV', name: 'Nevada' },
  { code: 'NH', name: 'New Hampshire' },
  { code: 'NJ', name: 'New Jersey' },
  { code: 'NM', name: 'New Mexico' },
  { code: 'NY', name: 'New York' },
  { code: 'NC', name: 'North Carolina' },
  { code: 'ND', name: 'North Dakota' },
  { code: 'OH', name: 'Ohio' },
  { code: 'OK', name: 'Oklahoma' },
  { code: 'OR', name: 'Oregon' },
  { code: 'PA', name: 'Pennsylvania' },
  { code: 'RI', name: 'Rhode Island' },
  { code: 'SC', name: 'South Carolina' },
  { code: 'SD', name: 'South Dakota' },
  { code: 'TN', name: 'Tennessee' },
  { code: 'TX', name: 'Texas' },
  { code: 'UT', name: 'Utah' },
  { code: 'VT', name: 'Vermont' },
  { code: 'VA', name: 'Virginia' },
  { code: 'WA', name: 'Washington' },
  { code: 'WV', name: 'West Virginia' },
  { code: 'WI', name: 'Wisconsin' },
  { code: 'WY', name: 'Wyoming' },
];

// Set for fast lookup of valid codes
export const STATE_CODES = new Set(US_STATES.map(s => s.code));

// Map for name -> code lookup (case insensitive)
const nameToCodeMap = new Map<string, string>();
US_STATES.forEach(s => {
  nameToCodeMap.set(s.name.toLowerCase(), s.code);
  nameToCodeMap.set(s.code.toLowerCase(), s.code);
});

/**
 * Normalize state input to 2-letter uppercase code
 * Accepts full name ("Ohio") or abbreviation ("oh", "OH")
 * Returns null if invalid
 */
export function normalizeState(input: string): string | null {
  if (!input) return null;
  const trimmed = input.trim().toLowerCase();
  return nameToCodeMap.get(trimmed) || null;
}

/**
 * Check if a state code is valid
 */
export function isValidStateCode(code: string): boolean {
  return STATE_CODES.has(code.toUpperCase());
}

/**
 * Get state name from code
 */
export function getStateName(code: string): string | null {
  const state = US_STATES.find(s => s.code === code.toUpperCase());
  return state?.name || null;
}

/**
 * Filter states by search query (matches name or code)
 */
export function filterStates(query: string): { code: string; name: string }[] {
  if (!query) return US_STATES;
  const q = query.toLowerCase();
  return US_STATES.filter(
    s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
  );
}

/**
 * Parse "City, ST" format into { city, state }
 * Returns null for state if not found/invalid
 */
export function parseLocation(location: string): { city: string; state: string | null } {
  if (!location) return { city: '', state: null };

  const parts = location.split(',').map(p => p.trim());
  if (parts.length === 1) {
    return { city: parts[0], state: null };
  }

  const city = parts.slice(0, -1).join(', ');
  const statePart = parts[parts.length - 1];
  const state = normalizeState(statePart);

  return { city, state };
}

/**
 * Format city and state into "City, ST" format
 */
export function formatLocation(city: string, state: string): string {
  const normalizedState = normalizeState(state);
  if (!city && !normalizedState) return '';
  if (!normalizedState) return city;
  if (!city) return normalizedState;
  return `${city}, ${normalizedState}`;
}
