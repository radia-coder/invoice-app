# Invoice App Improvements

## Reference: OP Exp Spreadsheet Format (Weyrah 2026)

This document outlines improvements needed to support the full Owner-Operator expense tracking spreadsheet format.

---

## 1. Extend InvoiceLoad Model

### Current Fields
- `load_ref` (LOAD#)
- `from_location` (FROM STATE)
- `to_location` (TO STATE)
- `load_date`
- `amount` (RATES$$)

### New Fields Needed
| Field | Type | Description |
|-------|------|-------------|
| `vendor` | String | Broker/Vendor name |
| `pickup_date` | DateTime | Pickup date (PU DATE) |
| `delivery_date` | DateTime | Delivery date (DEL DATE) |

---

## 2. Extend Deduction Types

### Currently Supported
- Fuel
- Toll (TOLLS/VIOLATIONS)
- Insurance
- ELD
- Other

### New Deduction Types Needed
| Type | Description | Calculated? |
|------|-------------|-------------|
| FACTORING | Factoring fee | Yes - `YTD_NET_PAY * 0.02` (2%) |
| DISPATCH | Dispatch fee | No |
| MAINTENANCE | Vehicle maintenance | No |
| TRAILER | Trailer expenses | No |
| PAYBACK | Payback/advances repayment | No |
| CAMERA | Camera/dashcam fees | No |
| ADVANCED | Cash advances | No |

---

## 3. Calculated Deductions

Some deductions are calculated based on formulas rather than fixed amounts.

### Proposed Schema Addition
```prisma
model DeductionType {
  id              Int       @id @default(autoincrement())
  name            String
  company_id      Int?
  is_default      Boolean   @default(false)
  is_calculated   Boolean   @default(false)    // NEW
  formula         String?                       // NEW - e.g., "YTD_NET_PAY * 0.02"
  formula_base    String?                       // NEW - "WEEKLY_GROSS", "YTD_NET_PAY", etc.
  formula_percent Float?                        // NEW - 0.02 for 2%
  created_at      DateTime  @default(now())

  company         Company?  @relation(fields: [company_id], references: [id], onDelete: Cascade)
  @@unique([name, company_id])
}
```

### Formula Bases
| Base | Description |
|------|-------------|
| `WEEKLY_GROSS` | Current week's gross total |
| `WEEKLY_NET_PAY` | Current week's net pay |
| `YTD_GROSS` | Year-to-date gross |
| `YTD_NET_PAY` | Year-to-date net pay |
| `BROKER_TOTALS` | Total from broker loads |

### Example: Factoring Calculation
```
FACTORING = YTD_NET_PAY * 0.02
```

---

## 4. YTD (Year-to-Date) Tracking

### New Aggregation Queries Needed
- `getYTDGross(driverId, year)` - Sum of all gross for driver in year
- `getYTDNetPay(driverId, year)` - Sum of all net pay for driver in year
- `getYTDByCompany(companyId, year)` - Aggregated YTD for all drivers

### Display in Weekly Summary Card
Add to `WeeklySummaryCard.tsx`:
- YTD GROSS (yellow highlight)
- YTD NET PAY (yellow highlight)

---

## 5. Summary Fields

### Current
- WEEKLY GROSS ✓
- WEEKLY NET PAY ✓

### Needed
- BROKER TOTALS (subtotal of loads by broker)
- TOTAL OWE (sum of all deductions)
- YTD GROSS
- YTD NET PAY

---

## 6. UI Changes

### Weekly Summary Card Enhancements
1. Add YTD section at bottom of card
2. Show TOTAL OWE as separate line
3. Color coding to match spreadsheet:
   - Yellow: TOTAL OWE, YTD GROSS, YTD NET PAY
   - Blue: WEEKLY GROSS
   - Gray: WEEKLY NET PAY
   - Green: Positive amounts
   - Red: Negative amounts (deductions)

### Load Entry Form Enhancements
1. Add Vendor/Broker dropdown
2. Separate Pickup Date and Delivery Date fields
3. State dropdowns for FROM STATE / TO STATE

---

## 7. Implementation Priority

### Phase 1 (High Priority)
- [ ] Add new deduction types (FACTORING, DISPATCH, MAINTENANCE, etc.)
- [ ] Add YTD aggregation queries
- [ ] Display YTD in Weekly Summary

### Phase 2 (Medium Priority)
- [ ] Extend InvoiceLoad with vendor, pickup_date, delivery_date
- [ ] Implement calculated deductions (formula-based)
- [ ] Update load entry form

### Phase 3 (Lower Priority)
- [ ] Broker grouping and BROKER TOTALS
- [ ] Color coding in UI
- [ ] Export to spreadsheet format

---

## 8. Database Migration Plan

### Migration 1: Add Load Fields
```sql
ALTER TABLE InvoiceLoad ADD COLUMN vendor TEXT;
ALTER TABLE InvoiceLoad ADD COLUMN pickup_date DATETIME;
ALTER TABLE InvoiceLoad ADD COLUMN delivery_date DATETIME;
```

### Migration 2: Add Calculated Deduction Fields
```sql
ALTER TABLE DeductionType ADD COLUMN is_calculated BOOLEAN DEFAULT FALSE;
ALTER TABLE DeductionType ADD COLUMN formula_base TEXT;
ALTER TABLE DeductionType ADD COLUMN formula_percent REAL;
```

---

## Notes

- DRIVER 31% is already handled by the `percent` field on Invoice
- Formula example: `FACTORING = I9 * 0.02` where I9 = YTD NET PAY
- Each company may have different deduction types and formulas
