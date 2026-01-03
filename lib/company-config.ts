// Company Configuration - Single source of truth for company details
// This ensures consistent email/address across invoices and PDFs

export const SHARED_COMPANY_ADDRESS = '2700 E Dublin Granville Rd, Suite 295, Columbus, OH 43231';

// Company name (lowercase key) -> email mapping
export const COMPANY_EMAILS: Record<string, string> = {
  weyrah: 'weyrahtransport02@gmail.com',
  'weyrah transport': 'weyrahtransport02@gmail.com',
  'weyrah transport llc': 'weyrahtransport02@gmail.com',
  hade: 'hadetransport1@gmail.com',
  'hade transport': 'hadetransport1@gmail.com',
  'hade transport llc': 'hadetransport1@gmail.com',
  bakar: 'bakartrucking0@gmail.com',
  'bakar trucking': 'bakartrucking0@gmail.com',
  'bakar trucking llc': 'bakartrucking0@gmail.com',
  zamo: 'zamologistics614@gmail.com',
  'zamo logistics': 'zamologistics614@gmail.com',
  'zamo logistics llc': 'zamologistics614@gmail.com',
  sss: 'SSSlogisticsllc11@gmail.com',
  'sss logistics': 'SSSlogisticsllc11@gmail.com',
  'sss logistics llc': 'SSSlogisticsllc11@gmail.com',
};

/**
 * Get the email for a company by name
 * Matches partial/fuzzy company names (case insensitive)
 */
export function getCompanyEmail(companyName: string): string | null {
  if (!companyName) return null;
  const normalized = companyName.toLowerCase().trim();

  // Direct match
  if (COMPANY_EMAILS[normalized]) {
    return COMPANY_EMAILS[normalized];
  }

  // Partial match - check if company name starts with a known key
  for (const [key, email] of Object.entries(COMPANY_EMAILS)) {
    if (normalized.startsWith(key) || key.startsWith(normalized)) {
      return email;
    }
  }

  return null;
}

/**
 * Get company details (email + address) by name
 * Returns the shared address for all known companies
 */
export function getCompanyDetails(companyName: string): {
  email: string | null;
  address: string;
} {
  return {
    email: getCompanyEmail(companyName),
    address: SHARED_COMPANY_ADDRESS,
  };
}

/**
 * Check if a company name is known/configured
 */
export function isKnownCompany(companyName: string): boolean {
  return getCompanyEmail(companyName) !== null;
}
