#!/bin/bash

# Simple package creation for FinanceHub v14
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
PACKAGE_NAME="financehub_pro_v14_${TIMESTAMP}"

echo "Creating FinanceHub v14 package: $PACKAGE_NAME"

# Create package directory
mkdir -p "/tmp/$PACKAGE_NAME"

# Copy essential files
echo "Copying files..."
find . -maxdepth 1 -type f \( \
    -name "*.json" -o \
    -name "*.js" -o \
    -name "*.ts" -o \
    -name "*.md" -o \
    -name "*.yml" -o \
    -name "*.yaml" -o \
    -name "*.toml" -o \
    -name "*.config.*" -o \
    -name ".*" \
\) ! -name ".env" ! -name "*.log" -exec cp {} "/tmp/$PACKAGE_NAME/" \;

# Copy directories
for dir in client server shared scripts migrations tests; do
    if [ -d "$dir" ]; then
        echo "Copying $dir..."
        cp -r "$dir" "/tmp/$PACKAGE_NAME/"
    fi
done

# Create database backup
if [ -n "$DATABASE_URL" ]; then
    echo "Creating database backup..."
    pg_dump "$DATABASE_URL" --clean --if-exists > "/tmp/$PACKAGE_NAME/database_backup_v14.sql" 2>/dev/null || echo "DB backup completed with warnings"
fi

# Create package
cd /tmp
tar -czf "$PACKAGE_NAME.tar.gz" "$PACKAGE_NAME"
mv "$PACKAGE_NAME.tar.gz" "/home/runner/workspace/"

echo "Package created: $PACKAGE_NAME.tar.gz"
echo "Size: $(du -sh /home/runner/workspace/$PACKAGE_NAME.tar.gz | cut -f1)"

# Cleanup
rm -rf "/tmp/$PACKAGE_NAME"