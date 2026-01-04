import fs from 'fs/promises';
import path from 'path';
import { prisma } from './prisma';
import { logInfo, logWarning, logError } from './logger';

/**
 * PDF Cleanup and Archival Utility
 * 
 * This module handles cleanup of old PDF files to prevent disk space issues.
 * It can:
 * 1. Delete PDFs for invoices older than a retention period
 * 2. Archive PDFs to cloud storage (optional)
 * 3. Clean up orphaned PDFs (files with no corresponding invoice)
 */

const PDF_DIR = path.join(process.cwd(), 'storage', 'pdfs');
const DEFAULT_RETENTION_DAYS = 90; // Keep PDFs for 90 days by default

export interface CleanupOptions {
  retentionDays?: number;
  dryRun?: boolean;
  deleteOrphaned?: boolean;
  archiveToCloud?: boolean;
}

export interface CleanupResult {
  deletedCount: number;
  deletedSize: number; // in bytes
  orphanedCount: number;
  archivedCount: number;
  errors: string[];
}

/**
 * Get file size in bytes
 */
async function getFileSize(filePath: string): Promise<number> {
  try {
    const stats = await fs.stat(filePath);
    return stats.size;
  } catch {
    return 0;
  }
}

/**
 * Delete a PDF file
 */
async function deletePdf(invoiceId: number): Promise<number> {
  const filePath = path.join(PDF_DIR, `${invoiceId}.pdf`);
  try {
    const size = await getFileSize(filePath);
    await fs.unlink(filePath);
    return size;
  } catch (error) {
    if ((error as any).code !== 'ENOENT') {
      throw error;
    }
    return 0;
  }
}

/**
 * Get all PDF files in storage directory
 */
async function getAllPdfFiles(): Promise<string[]> {
  try {
    const files = await fs.readdir(PDF_DIR);
    return files.filter(f => f.endsWith('.pdf'));
  } catch (error) {
    logError('PDF_CLEANUP', error, { directory: PDF_DIR });
    return [];
  }
}

/**
 * Clean up old PDFs based on retention policy
 */
export async function cleanupOldPdfs(options: CleanupOptions = {}): Promise<CleanupResult> {
  const {
    retentionDays = DEFAULT_RETENTION_DAYS,
    dryRun = false,
    deleteOrphaned = false,
  } = options;

  const result: CleanupResult = {
    deletedCount: 0,
    deletedSize: 0,
    orphanedCount: 0,
    archivedCount: 0,
    errors: [],
  };

  const context = dryRun ? 'PDF_CLEANUP (DRY RUN)' : 'PDF_CLEANUP';
  logInfo(context, `Starting cleanup with ${retentionDays} day retention policy`);

  try {
    // Calculate cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    // Find old invoices
    const oldInvoices = await prisma.invoice.findMany({
      where: {
        updated_at: {
          lt: cutoffDate,
        },
      },
      select: {
        id: true,
        invoice_number: true,
        updated_at: true,
      },
    });

    logInfo(context, `Found ${oldInvoices.length} invoices older than ${retentionDays} days`);

    // Delete PDFs for old invoices
    for (const invoice of oldInvoices) {
      try {
        const size = await getFileSize(path.join(PDF_DIR, `${invoice.id}.pdf`));
        
        if (size > 0) {
          if (!dryRun) {
            await deletePdf(invoice.id);
            logInfo(context, `Deleted PDF for invoice ${invoice.invoice_number} (${(size / 1024).toFixed(2)} KB)`);
          } else {
            logInfo(context, `Would delete PDF for invoice ${invoice.invoice_number} (${(size / 1024).toFixed(2)} KB)`);
          }
          
          result.deletedCount++;
          result.deletedSize += size;
        }
      } catch (error) {
        const errorMsg = `Failed to delete PDF for invoice ${invoice.invoice_number}`;
        logError(context, error, { invoiceId: invoice.id });
        result.errors.push(errorMsg);
      }
    }

    // Clean up orphaned PDFs (optional)
    if (deleteOrphaned) {
      logInfo(context, 'Checking for orphaned PDFs...');
      
      const allPdfFiles = await getAllPdfFiles();
      const validInvoiceIds = new Set(
        (await prisma.invoice.findMany({ select: { id: true } })).map(i => i.id.toString())
      );

      for (const file of allPdfFiles) {
        const invoiceId = file.replace('.pdf', '');
        
        if (!validInvoiceIds.has(invoiceId)) {
          const filePath = path.join(PDF_DIR, file);
          const size = await getFileSize(filePath);
          
          if (!dryRun) {
            await fs.unlink(filePath);
            logWarning(context, `Deleted orphaned PDF: ${file} (${(size / 1024).toFixed(2)} KB)`);
          } else {
            logWarning(context, `Would delete orphaned PDF: ${file} (${(size / 1024).toFixed(2)} KB)`);
          }
          
          result.orphanedCount++;
          result.deletedSize += size;
        }
      }
    }

    // Log summary
    const sizeMB = (result.deletedSize / (1024 * 1024)).toFixed(2);
    logInfo(context, `Cleanup completed: ${result.deletedCount} PDFs, ${sizeMB} MB ${dryRun ? '(would be) ' : ''}freed`);
    
    if (result.orphanedCount > 0) {
      logInfo(context, `Orphaned PDFs ${dryRun ? '(would be) ' : ''}removed: ${result.orphanedCount}`);
    }

    return result;

  } catch (error) {
    logError(context, error);
    result.errors.push('Cleanup failed with critical error');
    throw error;
  }
}

/**
 * Get PDF storage statistics
 */
export async function getPdfStorageStats() {
  try {
    const files = await getAllPdfFiles();
    let totalSize = 0;

    for (const file of files) {
      const filePath = path.join(PDF_DIR, file);
      totalSize += await getFileSize(filePath);
    }

    const totalCount = files.length;
    const totalSizeMB = (totalSize / (1024 * 1024)).toFixed(2);
    const avgSizeKB = totalCount > 0 ? ((totalSize / totalCount) / 1024).toFixed(2) : '0';

    return {
      totalCount,
      totalSize,
      totalSizeMB,
      avgSizeKB,
    };
  } catch (error) {
    logError('PDF_STATS', error);
    return {
      totalCount: 0,
      totalSize: 0,
      totalSizeMB: '0',
      avgSizeKB: '0',
    };
  }
}

/**
 * Check if disk space is running low
 * Returns true if PDF storage exceeds threshold
 */
export async function checkDiskSpaceWarning(thresholdMB = 10000): Promise<boolean> {
  const stats = await getPdfStorageStats();
  const totalMB = parseFloat(stats.totalSizeMB);
  
  if (totalMB > thresholdMB) {
    logWarning('PDF_STORAGE', `PDF storage (${totalMB} MB) exceeds threshold (${thresholdMB} MB)`);
    return true;
  }
  
  return false;
}
