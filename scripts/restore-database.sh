#!/bin/bash

##############################################################################
# Database Restore Script for Invoice Management System
#
# This script restores a PostgreSQL database from a backup file
#
# Usage:
#   ./scripts/restore-database.sh [backup-file.sql.gz]
#
# Example:
#   ./scripts/restore-database.sh ~/backups/invoice-db/invoice-db-2026-01-04-020000.sql.gz
##############################################################################

# Exit on error
set -e

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Logging functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if backup file is provided
if [ -z "$1" ]; then
    log_error "Usage: $0 <backup-file.sql.gz>"
    exit 1
fi

BACKUP_FILE="$1"

# Validate backup file exists
if [ ! -f "$BACKUP_FILE" ]; then
    log_error "Backup file not found: $BACKUP_FILE"
    exit 1
fi

log_info "Backup file: $BACKUP_FILE"

# Load environment variables
if [ -f "$PROJECT_DIR/.env" ]; then
    export $(grep -v '^#' "$PROJECT_DIR/.env" | xargs)
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

# Warning
log_warn "========================================="
log_warn "WARNING: This will REPLACE your current database!"
log_warn "All existing data will be lost."
log_warn "========================================="
read -p "Are you sure you want to continue? (yes/no): " CONFIRM

if [ "$CONFIRM" != "yes" ]; then
    log_info "Restore cancelled."
    exit 0
fi

# Decompress backup if needed
TEMP_FILE=""
if [[ "$BACKUP_FILE" == *.gz ]]; then
    log_info "Decompressing backup..."
    TEMP_FILE="${BACKUP_FILE%.gz}"
    gunzip -c "$BACKUP_FILE" > "$TEMP_FILE"
    RESTORE_FILE="$TEMP_FILE"
else
    RESTORE_FILE="$BACKUP_FILE"
fi

# Restore based on database type
if [[ "$DATABASE_URL" == postgresql* ]]; then
    log_info "Restoring PostgreSQL database..."
    
    # Parse DATABASE_URL
    DB_URL_REGEX="postgresql://([^:]+):([^@]+)@([^:]+):([^/]+)/(.*)"
    
    if [[ $DATABASE_URL =~ $DB_URL_REGEX ]]; then
        DB_USER="${BASH_REMATCH[1]}"
        DB_PASS="${BASH_REMATCH[2]}"
        DB_HOST="${BASH_REMATCH[3]}"
        DB_PORT="${BASH_REMATCH[4]}"
        DB_NAME="${BASH_REMATCH[5]}"
        DB_NAME="${DB_NAME%%\?*}"
        
        # Drop and recreate database
        log_warn "Dropping existing database..."
        PGPASSWORD="$DB_PASS" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d postgres \
            -c "DROP DATABASE IF EXISTS $DB_NAME;"
        
        log_info "Creating new database..."
        PGPASSWORD="$DB_PASS" psql \
            -h "$DB_HOST" \
            -p "$DB_PORT" \
            -U "$DB_USER" \
            -d postgres \
            -c "CREATE DATABASE $DB_NAME;"
        
        # Restore from backup
        log_info "Restoring from backup..."
        if [[ "$BACKUP_FILE" == *.dump* ]]; then
            # Custom format backup
            PGPASSWORD="$DB_PASS" pg_restore \
                -h "$DB_HOST" \
                -p "$DB_PORT" \
                -U "$DB_USER" \
                -d "$DB_NAME" \
                --verbose \
                "$RESTORE_FILE"
        else
            # Plain SQL backup
            PGPASSWORD="$DB_PASS" psql \
                -h "$DB_HOST" \
                -p "$DB_PORT" \
                -U "$DB_USER" \
                -d "$DB_NAME" \
                < "$RESTORE_FILE"
        fi
        
        log_info "PostgreSQL restore completed successfully!"
    else
        log_error "Could not parse PostgreSQL DATABASE_URL"
        exit 1
    fi
    
elif [[ "$DATABASE_URL" == file:* ]]; then
    log_info "Restoring SQLite database..."
    
    DB_FILE="${DATABASE_URL#file:}"
    DB_PATH="$PROJECT_DIR/$DB_FILE"
    
    # Backup current database
    if [ -f "$DB_PATH" ]; then
        CURRENT_BACKUP="${DB_PATH}.before-restore-$(date +%Y%m%d-%H%M%S)"
        cp "$DB_PATH" "$CURRENT_BACKUP"
        log_info "Current database backed up to: $CURRENT_BACKUP"
    fi
    
    # Restore from backup
    if [[ "$RESTORE_FILE" == *.db ]]; then
        cp "$RESTORE_FILE" "$DB_PATH"
    else
        sqlite3 "$DB_PATH" < "$RESTORE_FILE"
    fi
    
    log_info "SQLite restore completed successfully!"
else
    log_error "Unsupported database type in DATABASE_URL"
    exit 1
fi

# Clean up temporary file
if [ -n "$TEMP_FILE" ] && [ -f "$TEMP_FILE" ]; then
    rm "$TEMP_FILE"
fi

log_info "========================================="
log_info "Database restored successfully!"
log_info "You may need to restart your application."
log_info "========================================="

exit 0
