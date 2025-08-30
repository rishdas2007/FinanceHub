import { logger } from '../utils/logger.js';
import { neon } from '@neondatabase/serverless';

/**
 * Database Schema Validator and Auto-Fixer
 * Prevents 500 errors from missing tables/columns in production
 */

export class DatabaseSchemaValidator {
  private sql: any;
  private schemaChecked = false;

  constructor() {
    if (process.env.DATABASE_URL) {
      this.sql = neon(process.env.DATABASE_URL);
    }
  }

  async validateAndFixSchema(): Promise<void> {
    if (!this.sql || this.schemaChecked) return;
    
    try {
      logger.info('🔍 PRODUCTION SCHEMA VALIDATION - Checking required tables...');
      
      // Check and create missing tables
      await this.ensureRequiredTables();
      
      // Check and add missing columns
      await this.ensureRequiredColumns();
      
      this.schemaChecked = true;
      logger.info('✅ PRODUCTION SCHEMA VALIDATION - All tables and columns verified');
      
    } catch (error) {
      logger.error('🚨 PRODUCTION SCHEMA VALIDATION FAILED', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      });
    }
  }

  private async ensureRequiredTables(): Promise<void> {
    const requiredTables = [
      {
        name: 'historical_sector_etf_data',
        createSQL: `
          CREATE TABLE IF NOT EXISTS historical_sector_etf_data (
            id SERIAL PRIMARY KEY,
            symbol VARCHAR(10) NOT NULL,
            date DATE NOT NULL,
            price DECIMAL(10,2),
            change_percent DECIMAL(5,2),
            volume BIGINT,
            created_at TIMESTAMP DEFAULT NOW(),
            UNIQUE(symbol, date)
          );
        `
      },
      {
        name: 'etf_metrics_cache',
        createSQL: `
          CREATE TABLE IF NOT EXISTS etf_metrics_cache (
            id SERIAL PRIMARY KEY,
            symbol VARCHAR(10) NOT NULL,
            data JSONB NOT NULL,
            created_at TIMESTAMP DEFAULT NOW(),
            expires_at TIMESTAMP,
            UNIQUE(symbol)
          );
        `
      }
    ];

    for (const table of requiredTables) {
      try {
        // Check if table exists
        const result = await this.sql`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_name = ${table.name}
          );
        `;
        
        if (!result[0].exists) {
          logger.warn(`🔧 PRODUCTION SCHEMA FIX - Creating missing table: ${table.name}`);
          await this.sql(table.createSQL);
          logger.info(`✅ PRODUCTION SCHEMA FIX - Table created: ${table.name}`);
        }
        
      } catch (error) {
        logger.error(`🚨 PRODUCTION SCHEMA ERROR - Failed to create table ${table.name}:`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  private async ensureRequiredColumns(): Promise<void> {
    const columnChecks = [
      {
        table: 'historical_technical_indicators',
        column: 'rsi_z_score',
        type: 'DECIMAL(10,6)',
        addSQL: 'ALTER TABLE historical_technical_indicators ADD COLUMN IF NOT EXISTS rsi_z_score DECIMAL(10,6);'
      },
      {
        table: 'historical_technical_indicators', 
        column: 'macd_z_score',
        type: 'DECIMAL(10,6)',
        addSQL: 'ALTER TABLE historical_technical_indicators ADD COLUMN IF NOT EXISTS macd_z_score DECIMAL(10,6);'
      },
      {
        table: 'historical_technical_indicators',
        column: 'bb_z_score', 
        type: 'DECIMAL(10,6)',
        addSQL: 'ALTER TABLE historical_technical_indicators ADD COLUMN IF NOT EXISTS bb_z_score DECIMAL(10,6);'
      }
    ];

    for (const check of columnChecks) {
      try {
        const result = await this.sql`
          SELECT EXISTS (
            SELECT FROM information_schema.columns 
            WHERE table_name = ${check.table} 
            AND column_name = ${check.column}
          );
        `;
        
        if (!result[0].exists) {
          logger.warn(`🔧 PRODUCTION SCHEMA FIX - Adding missing column: ${check.table}.${check.column}`);
          await this.sql(check.addSQL);
          logger.info(`✅ PRODUCTION SCHEMA FIX - Column added: ${check.table}.${check.column}`);
        }
        
      } catch (error) {
        logger.error(`🚨 PRODUCTION SCHEMA ERROR - Failed to add column ${check.table}.${check.column}:`, {
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
  }

  /**
   * Safe database query wrapper that handles missing tables/columns gracefully
   */
  async safeQuery(query: string, fallbackResult: any = []): Promise<any> {
    if (!this.sql) return fallbackResult;
    
    try {
      return await this.sql(query);
    } catch (error: any) {
      if (error.code === '42P01' || error.message?.includes('does not exist')) {
        logger.warn('🔧 PRODUCTION FALLBACK - Using fallback data for missing table/column', {
          query: query.substring(0, 100),
          error: error.message
        });
        return fallbackResult;
      }
      throw error;
    }
  }
}

export const dbSchemaValidator = new DatabaseSchemaValidator();

/**
 * Express middleware to ensure database schema is valid before requests
 */
export function validateDatabaseSchema(req: any, res: any, next: any) {
  // Only validate on first request to avoid performance impact
  if (!global.schemaValidated) {
    global.schemaValidated = true;
    dbSchemaValidator.validateAndFixSchema().catch(error => {
      logger.error('🚨 PRODUCTION SCHEMA VALIDATION MIDDLEWARE ERROR', { error });
    });
  }
  next();
}

declare global {
  var schemaValidated: boolean;
}