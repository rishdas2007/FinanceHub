#!/bin/bash
# Database Restoration Script for FinanceHub Pro v10.0.0
echo "🗃️ Restoring FinanceHub Pro database..."

if [ -f "database_backup_v10_complete.sql" ]; then
    echo "📥 Restoring from complete backup..."
    psql $DATABASE_URL < database_backup_v10_complete.sql
    echo "✅ Database restored successfully"
else
    echo "⚠️ No backup found, running Drizzle migrations..."
    npm run db:push
    echo "✅ Schema created successfully"
fi

echo "🔍 Database status:"
psql $DATABASE_URL -c "SELECT 'technical_indicators' as table_name, count(*) as records FROM technical_indicators
UNION ALL SELECT 'economic_indicators_current', count(*) FROM economic_indicators_current
UNION ALL SELECT 'historical_stock_data', count(*) FROM historical_stock_data;"
