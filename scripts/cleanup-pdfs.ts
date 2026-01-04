#!/usr/bin/env ts-node

/**
 * PDF Cleanup Script
 * 
 * This script can be run manually or via cron to clean up old PDF files
 * 
 * Usage:
 *   npm run cleanup-pdfs                    # Clean up PDFs older than 90 days
 *   npm run cleanup-pdfs -- --days 180      # Custom retention period
 *   npm run cleanup-pdfs -- --dry-run       # Preview what would be deleted
 *   npm run cleanup-pdfs -- --orphaned      # Also remove orphaned PDFs
 * 
 * Cron setup (monthly cleanup):
 *   0 3 1 * * cd /path/to/invoice-app && npm run cleanup-pdfs >> /var/log/pdf-cleanup.log 2>&1
 */

import { cleanupOldPdfs, getPdfStorageStats, checkDiskSpaceWarning } from '../lib/pdf-cleanup';

async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  const dryRun = args.includes('--dry-run');
  const deleteOrphaned = args.includes('--orphaned');
  const daysIndex = args.indexOf('--days');
  const retentionDays = daysIndex >= 0 && args[daysIndex + 1] 
    ? parseInt(args[daysIndex + 1], 10) 
    : 90;

  console.log('='.repeat(60));
  console.log('PDF CLEANUP SCRIPT');
  console.log('='.repeat(60));
  console.log(`Mode: ${dryRun ? 'DRY RUN (no files will be deleted)' : 'LIVE'}`);
  console.log(`Retention period: ${retentionDays} days`);
  console.log(`Delete orphaned PDFs: ${deleteOrphaned ? 'YES' : 'NO'}`);
  console.log('='.repeat(60));
  console.log();

  // Show current storage stats
  console.log('Current PDF Storage Statistics:');
  const statsBefore = await getPdfStorageStats();
  console.log(`  Total PDFs: ${statsBefore.totalCount}`);
  console.log(`  Total Size: ${statsBefore.totalSizeMB} MB`);
  console.log(`  Average Size: ${statsBefore.avgSizeKB} KB`);
  console.log();

  // Check disk space warning
  await checkDiskSpaceWarning(10000); // Warn if > 10GB
  console.log();

  // Run cleanup
  console.log('Starting cleanup...');
  console.log();

  const result = await cleanupOldPdfs({
    retentionDays,
    dryRun,
    deleteOrphaned,
  });

  // Show results
  console.log();
  console.log('='.repeat(60));
  console.log('CLEANUP RESULTS');
  console.log('='.repeat(60));
  console.log(`PDFs ${dryRun ? '(would be) ' : ''}deleted: ${result.deletedCount}`);
  console.log(`Orphaned PDFs ${dryRun ? '(would be) ' : ''}removed: ${result.orphanedCount}`);
  console.log(`Space ${dryRun ? '(would be) ' : ''}freed: ${(result.deletedSize / (1024 * 1024)).toFixed(2)} MB`);
  
  if (result.errors.length > 0) {
    console.log('\nErrors encountered:');
    result.errors.forEach(err => console.log(`  - ${err}`));
  }
  
  console.log('='.repeat(60));
  console.log();

  // Show updated storage stats
  if (!dryRun) {
    console.log('Updated PDF Storage Statistics:');
    const statsAfter = await getPdfStorageStats();
    console.log(`  Total PDFs: ${statsAfter.totalCount}`);
    console.log(`  Total Size: ${statsAfter.totalSizeMB} MB`);
    console.log(`  Average Size: ${statsAfter.avgSizeKB} KB`);
    
    const saved = parseFloat(statsBefore.totalSizeMB) - parseFloat(statsAfter.totalSizeMB);
    console.log(`  Space saved: ${saved.toFixed(2)} MB`);
    console.log();
  }

  console.log('Cleanup completed successfully!');
  process.exit(0);
}

main().catch((error) => {
  console.error('Fatal error during cleanup:');
  console.error(error);
  process.exit(1);
});
