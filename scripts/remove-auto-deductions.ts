import { PrismaClient } from '@prisma/client';
import { isFactoringDeduction, isDispatchDeduction } from '../lib/auto-deductions';

const prisma = new PrismaClient();

async function removeAutoDeductions() {
  console.log('🔍 Searching for Factoring and Dispatch deductions...\n');

  // First, get all deductions to check
  const allDeductions = await prisma.invoiceDeduction.findMany({
    select: {
      id: true,
      deduction_type: true,
      amount: true,
      note: true,
      invoice: {
        select: {
          invoice_number: true,
          driver: {
            select: {
              name: true,
            },
          },
        },
      },
    },
  });

  // Filter to find Factoring and Dispatch deductions
  const toDelete = allDeductions.filter(
    (d) => isFactoringDeduction(d.deduction_type) || isDispatchDeduction(d.deduction_type)
  );

  if (toDelete.length === 0) {
    console.log('✅ No Factoring or Dispatch deductions found. Database is clean!');
    return;
  }

  console.log(`Found ${toDelete.length} auto-deductions to remove:\n`);

  // Group by type for summary
  const factoringCount = toDelete.filter((d) => isFactoringDeduction(d.deduction_type)).length;
  const dispatchCount = toDelete.filter((d) => isDispatchDeduction(d.deduction_type)).length;

  console.log(`  📊 Factoring deductions: ${factoringCount}`);
  console.log(`  📊 Dispatch deductions: ${dispatchCount}\n`);

  // Show first 10 examples
  console.log('Examples (showing first 10):');
  toDelete.slice(0, 10).forEach((d) => {
    console.log(
      `  - ${d.invoice.driver.name} (${d.invoice.invoice_number}): ${d.deduction_type} - $${d.amount.toFixed(2)} ${d.note ? `(${d.note})` : ''}`
    );
  });

  if (toDelete.length > 10) {
    console.log(`  ... and ${toDelete.length - 10} more\n`);
  } else {
    console.log('');
  }

  // Delete them
  console.log('🗑️  Deleting auto-deductions...');

  const result = await prisma.invoiceDeduction.deleteMany({
    where: {
      id: {
        in: toDelete.map((d) => d.id),
      },
    },
  });

  console.log(`\n✅ Successfully deleted ${result.count} auto-deductions from the database!`);
}

removeAutoDeductions()
  .catch((error) => {
    console.error('❌ Error:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
