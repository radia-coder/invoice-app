#!/bin/bash

##############################################################################
# Database Backup Script for Invoice Management System
# 
# This script creates automated backups of the PostgreSQL database
# and optionally uploads them to Google Cloud Storage
#
# Usage:
#   ./scripts/backup-database.sh
#
# Setup cron job (daily at 2 AM):
#   crontab -e
#   0 2 * * * /path/to/invoice-app/scripts/backup-database.sh >> /var/log/invoice-backup.log 2>&1
##############################################################################

# Exit on error
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
BACKUP_DIR="${BACKUP_DIR:-$HOME/backups/invoice-db}"
DATE=$(date +%Y-%m-%d-%H%M%S)
BACKUP_FILE="invoice-db-$DATE.sql"
RETENTION_DAYS=${RETENTION_DAYS:-30}

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $(date '+%Y-%m-%d %H:%M:%S') - $1"
}

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
    # Load .env safely (handles spaces like "Name <email>")
    set -a
    # shellcheck disable=SC1090
    . "$PROJECT_DIR/.env"
    set +a
    log_info "Loaded environment variables from .env"
else
    log_error ".env file not found at $PROJECT_DIR/.env"
    exit 1
fi

# Validate DATABASE_URL
if [ -z "$DATABASE_URL" ]; then
    log_error "DATABASE_URL not set in .env file"
    exit 1
fi

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"
log_info "Backup directory: $BACKUP_DIR"

# Create backup
log_info "Starting database backup..."

# Check if using PostgreSQL or SQLite
if [[ "$DATABASE_URL" == postgresql* ]]; then
    # PostgreSQL backup using pg_dump
    log_info "Detected PostgreSQL database"
    
    # Parse DATABASE_URL to extract connection details
    # Format: postgresql://user:password@host:port/database
    DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.*)"
    
    if [[ $DATABASE_URL =~ $DB_URL_REGEX ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASS="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"
        
        # Remove query parameters from DB_NAME if present
        DB_NAME="${DB_NAME%%\?*}"
        
        # Create backup using pg_dump
        PGPASSWORD="$DB_PASS" pg_dump \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --format=custom \
            --file="$BACKUP_DIR/$BACKUP_FILE.dump" \
            --verbose
        
        # Also create a plain SQL backup for easier inspection
        PGPASSWORD="$DB_PASS" pg_dump \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d "$DB_NAME" \
            --format=plain \
            --file="$BACKUP_DIR/$BACKUP_FILE" \
            --verbose
        
        log_info "PostgreSQL backup created: $BACKUP_FILE"
        
    else
        log_error "Could not parse PostgreSQL DATABASE_URL"
        exit 1
    fi
    
elif [[ "$DATABASE_URL" == file:* ]]; then
    # SQLite backup (copy the database file)
    log_info "Detected SQLite database"
    
    DB_FILE="${DATABASE_URL#file:}"
    DB_PATH="$PROJECT_DIR/$DB_FILE"
    
    if [ -f "$DB_PATH" ]; then
        cp "$DB_PATH" "$BACKUP_DIR/$BACKUP_FILE.db"
        
        # Also create a SQL dump for easier inspection
        sqlite3 "$DB_PATH" .dump > "$BACKUP_DIR/$BACKUP_FILE"
        
        log_info "SQLite backup created: $BACKUP_FILE.db"
    else
        log_error "SQLite database file not found: $DB_PATH"
        exit 1
    fi
else
    log_error "Unsupported database type in DATABASE_URL"
    exit 1
fi

# Compress the backup
log_info "Compressing backup..."
gzip -f "$BACKUP_DIR/$BACKUP_FILE"
COMPRESSED_FILE="$BACKUP_FILE.gz"

# Get backup size
BACKUP_SIZE=$(du -h "$BACKUP_DIR/$COMPRESSED_FILE" | cut -f1)
log_info "Backup size: $BACKUP_SIZE"

# Upload to Google Cloud Storage (optional)
if command -v gsutil &> /dev/null && [ -n "$GCS_BACKUP_BUCKET" ]; then
    log_info "Uploading backup to Google Cloud Storage..."
    
    if gsutil cp "$BACKUP_DIR/$COMPRESSED_FILE" "gs://$GCS_BACKUP_BUCKET/backups/$COMPRESSED_FILE"; then
        log_info "Backup uploaded to gs://$GCS_BACKUP_BUCKET/backups/$COMPRESSED_FILE"
    else
        log_warn "Failed to upload to Google Cloud Storage, but local backup exists"
    fi
else
    log_warn "gsutil not found or GCS_BACKUP_BUCKET not set - skipping cloud upload"
fi

# Clean up old backups
log_info "Cleaning up backups older than $RETENTION_DAYS days..."
find "$BACKUP_DIR" -name "invoice-db-*.gz" -mtime +$RETENTION_DAYS -delete
find "$BACKUP_DIR" -name "invoice-db-*.dump" -mtime +$RETENTION_DAYS -delete 2>/dev/null || true

REMAINING_BACKUPS=$(find "$BACKUP_DIR" -name "invoice-db-*.gz" | wc -l)
log_info "Remaining backups: $REMAINING_BACKUPS"

# Verify backup integrity
log_info "Verifying backup integrity..."
if gzip -t "$BACKUP_DIR/$COMPRESSED_FILE"; then
    log_info "✓ Backup integrity verified"
else
    log_error "✗ Backup integrity check failed!"
    exit 1
fi

# Summary
log_info "========================================="
log_info "Backup completed successfully!"
log_info "Backup file: $COMPRESSED_FILE"
log_info "Location: $BACKUP_DIR"
log_info "Size: $BACKUP_SIZE"
log_info "========================================="

exit 0
