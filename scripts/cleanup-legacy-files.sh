#!/bin/bash

# FinanceHub Pro - Legacy File Cleanup Script
# This script moves old implementation documents to an archive directory

echo "🧹 Starting FinanceHub Pro cleanup process..."

# Create archive directories
mkdir -p scripts/archive/implementation-docs
mkdir -p scripts/archive/backup-files
mkdir -p scripts/archive/test-scripts

# Move implementation documentation
echo "📚 Archiving implementation documentation..."
mv *IMPLEMENTATION*.md scripts/archive/implementation-docs/ 2>/dev/null || true
mv *SUCCESS*.md scripts/archive/implementation-docs/ 2>/dev/null || true
mv *ANALYSIS*.md scripts/archive/implementation-docs/ 2>/dev/null || true
mv *FIX*.md scripts/archive/implementation-docs/ 2>/dev/null || true
mv *VERIFICATION*.md scripts/archive/implementation-docs/ 2>/dev/null || true
mv PHASES_*.md scripts/archive/implementation-docs/ 2>/dev/null || true
mv OPTIMIZATION_*.md scripts/archive/implementation-docs/ 2>/dev/null || true

# Move backup and download files
echo "💾 Archiving backup files..."
mv BACKUP_*.md scripts/archive/backup-files/ 2>/dev/null || true
mv DOWNLOAD_*.md scripts/archive/backup-files/ 2>/dev/null || true
mv DOWNLOAD_*.txt scripts/archive/backup-files/ 2>/dev/null || true
mv *backup*.sql scripts/archive/backup-files/ 2>/dev/null || true
mv backup_summary.txt scripts/archive/backup-files/ 2>/dev/null || true

# Move test and analysis scripts
echo "🧪 Archiving test scripts..."
mv analyze-*.js scripts/archive/test-scripts/ 2>/dev/null || true
mv test-*.js scripts/archive/test-scripts/ 2>/dev/null || true
mv fix-*.js scripts/archive/test-scripts/ 2>/dev/null || true
mv run-*.js scripts/archive/test-scripts/ 2>/dev/null || true

# Move deployment and production files
echo "🚀 Archiving deployment files..."
mv DEPLOYMENT_*.md scripts/archive/implementation-docs/ 2>/dev/null || true
mv PRODUCTION_*.md scripts/archive/implementation-docs/ 2>/dev/null || true
mv TRAFFIC_*.md scripts/archive/implementation-docs/ 2>/dev/null || true

# Move architecture change logs (keep the main one)
mv ARCHITECTURE_CHANGES_*.md scripts/archive/implementation-docs/ 2>/dev/null || true

# Move ETF-specific documentation
mv ETF_*.md scripts/archive/implementation-docs/ 2>/dev/null || true

# Move economic and Z-score documentation
mv ECONOMIC_*.md scripts/archive/implementation-docs/ 2>/dev/null || true
mv Z_SCORE_*.md scripts/archive/implementation-docs/ 2>/dev/null || true
mv STANDARD_UNIT_*.md scripts/archive/implementation-docs/ 2>/dev/null || true

# Move RCA and methodology docs
mv RCA_*.md scripts/archive/implementation-docs/ 2>/dev/null || true
mv *METHODOLOGY*.md scripts/archive/implementation-docs/ 2>/dev/null || true

# Move package and tar files
mv *.tar.gz scripts/archive/backup-files/ 2>/dev/null || true
mv financehub_* scripts/archive/backup-files/ 2>/dev/null || true

# Count archived files
impl_count=$(find scripts/archive/implementation-docs -name "*.md" | wc -l)
backup_count=$(find scripts/archive/backup-files -type f | wc -l)
test_count=$(find scripts/archive/test-scripts -name "*.js" | wc -l)

echo "✅ Cleanup completed!"
echo "📊 Archived files:"
echo "   - Implementation docs: $impl_count"
echo "   - Backup files: $backup_count"
echo "   - Test scripts: $test_count"
echo ""
echo "🏗️  Clean monorepo structure ready!"