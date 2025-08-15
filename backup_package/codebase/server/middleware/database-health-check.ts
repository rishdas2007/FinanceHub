// Database Health Check Middleware - RCA Implementation
// Implements startup schema validation and runtime health checks

import { db } from '../db.js';
import { sql } from 'drizzle-orm';

interface SchemaCheckResult {
  table: string;
  exists: boolean;
  hasData: boolean;
  rowCount: number;
  requiredColumns: string[];
  missingColumns: string[];
}

interface DatabaseHealthStatus {
  healthy: boolean;
  checks: SchemaCheckResult[];
  warnings: string[];
  errors: string[];
  timestamp: Date;
}

// Required table schemas for ETF metrics
const REQUIRED_SCHEMAS = {
  equity_features_daily: [
    'symbol', 'asof_date', 'z_close', 'rsi14', 'sma20', 'sma50', 
    'macd', 'macd_signal', 'boll_up', 'boll_mid', 'boll_low', 'percent_b', 'atr'
  ],
  equity_daily_bars: [
    'symbol', 'ts_utc', 'open', 'high', 'low', 'close', 'volume'
  ],
  stock_data: [
    'symbol', 'timestamp', 'price', 'change_percent'
  ],
  technical_indicators: [
    'symbol', 'rsi', 'macd_line', 'macd_signal', 'bb_upper', 'bb_middle', 'bb_lower'
  ]
};

export class DatabaseHealthChecker {
  private static instance: DatabaseHealthChecker;
  private lastCheck: DatabaseHealthStatus | null = null;
  private checkInterval: NodeJS.Timeout | null = null;

  static getInstance(): DatabaseHealthChecker {
    if (!DatabaseHealthChecker.instance) {
      DatabaseHealthChecker.instance = new DatabaseHealthChecker();
    }
    return DatabaseHealthChecker.instance;
  }

  async checkTableExists(tableName: string): Promise<boolean> {
    try {
      const result = await db.execute(sql`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = ${tableName}
        )
      `);
      return result.rows[0]?.exists === true;
    } catch (error) {
      console.error(`Error checking table ${tableName}:`, error);
      return false;
    }
  }

  async checkTableColumns(tableName: string, requiredColumns: string[]): Promise<string[]> {
    try {
      const result = await db.execute(sql`
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = ${tableName}
      `);
      
      const existingColumns = result.rows.map((row: any) => row.column_name);
      return requiredColumns.filter(col => !existingColumns.includes(col));
    } catch (error) {
      console.error(`Error checking columns for ${tableName}:`, error);
      return requiredColumns; // Assume all missing on error
    }
  }

  async checkTableData(tableName: string): Promise<{ hasData: boolean; rowCount: number }> {
    try {
      const result = await db.execute(sql.raw(`SELECT COUNT(*) as count FROM ${tableName}`));
      const rowCount = parseInt(result.rows[0]?.count || '0');
      return {
        hasData: rowCount > 0,
        rowCount
      };
    } catch (error) {
      console.error(`Error checking data for ${tableName}:`, error);
      return { hasData: false, rowCount: 0 };
    }
  }

  async performFullHealthCheck(): Promise<DatabaseHealthStatus> {
    const checks: SchemaCheckResult[] = [];
    const warnings: string[] = [];
    const errors: string[] = [];

    console.log('🔍 Performing comprehensive database health check...');

    for (const [tableName, requiredColumns] of Object.entries(REQUIRED_SCHEMAS)) {
      try {
        const exists = await this.checkTableExists(tableName);
        let hasData = false;
        let rowCount = 0;
        let missingColumns: string[] = [];

        if (exists) {
          missingColumns = await this.checkTableColumns(tableName, requiredColumns);
          const dataCheck = await this.checkTableData(tableName);
          hasData = dataCheck.hasData;
          rowCount = dataCheck.rowCount;

          // Critical data checks
          if (tableName === 'equity_features_daily' && rowCount === 0) {
            warnings.push(`⚠️ ${tableName} exists but is empty - ETF metrics will use fallback data`);
          }
          
          if (missingColumns.length > 0) {
            errors.push(`❌ ${tableName} missing required columns: ${missingColumns.join(', ')}`);
          }
        } else {
          errors.push(`❌ Required table ${tableName} does not exist`);
        }

        checks.push({
          table: tableName,
          exists,
          hasData,
          rowCount,
          requiredColumns,
          missingColumns
        });

      } catch (error) {
        errors.push(`❌ Failed to check ${tableName}: ${error}`);
        checks.push({
          table: tableName,
          exists: false,
          hasData: false,
          rowCount: 0,
          requiredColumns,
          missingColumns: requiredColumns
        });
      }
    }

    const healthy = errors.length === 0;
    
    this.lastCheck = {
      healthy,
      checks,
      warnings,
      errors,
      timestamp: new Date()
    };

    // Log results
    if (healthy) {
      console.log('✅ Database health check passed');
      if (warnings.length > 0) {
        console.log('⚠️ Warnings detected:');
        warnings.forEach(warning => console.log(`  ${warning}`));
      }
    } else {
      console.error('❌ Database health check failed:');
      errors.forEach(error => console.error(`  ${error}`));
    }

    return this.lastCheck;
  }

  async startPeriodicHealthChecks(intervalMs: number = 300000): Promise<void> {
    // Initial check
    await this.performFullHealthCheck();
    
    // Periodic checks
    this.checkInterval = setInterval(async () => {
      await this.performFullHealthCheck();
    }, intervalMs);
  }

  stopPeriodicHealthChecks(): void {
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
  }

  getLastCheckResult(): DatabaseHealthStatus | null {
    return this.lastCheck;
  }

  // Quick health check for API endpoints
  async quickHealthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      // Test basic connectivity
      await db.execute(sql`SELECT 1`);
      
      // Check if critical tables for ETF metrics exist and have some data
      const etfFeaturesExists = await this.checkTableExists('equity_features_daily');
      const stockDataExists = await this.checkTableExists('stock_data');
      
      if (!stockDataExists) {
        return { healthy: false, message: 'Critical table stock_data missing' };
      }

      if (!etfFeaturesExists) {
        return { healthy: false, message: 'equity_features_daily table missing - using fallback mode' };
      }

      const { rowCount } = await this.checkTableData('equity_features_daily');
      if (rowCount === 0) {
        return { healthy: true, message: 'equity_features_daily empty - ETF metrics using fallback data sources' };
      }

      return { healthy: true, message: 'All systems operational' };
    } catch (error) {
      return { healthy: false, message: `Database connectivity error: ${error}` };
    }
  }
}

// Startup validation middleware
export async function validateDatabaseOnStartup(): Promise<void> {
  const healthChecker = DatabaseHealthChecker.getInstance();
  const result = await healthChecker.performFullHealthCheck();
  
  // Don't abort startup, but log issues
  if (!result.healthy) {
    console.error('🚨 Database health issues detected at startup:');
    result.errors.forEach(error => console.error(`  ${error}`));
    console.log('📝 Application will continue with degraded functionality');
  }
  
  if (result.warnings.length > 0) {
    console.log('⚠️ Database warnings at startup:');
    result.warnings.forEach(warning => console.log(`  ${warning}`));
  }
}

// Health check route handler
export async function healthCheckHandler(req: any, res: any): Promise<void> {
  const healthChecker = DatabaseHealthChecker.getInstance();
  const result = await healthChecker.quickHealthCheck();
  
  res.status(result.healthy ? 200 : 503).json({
    healthy: result.healthy,
    message: result.message,
    timestamp: new Date().toISOString(),
    checks: healthChecker.getLastCheckResult()
  });
}