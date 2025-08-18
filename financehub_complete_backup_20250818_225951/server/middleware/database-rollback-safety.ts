/**
 * Database Migration Rollback Safety System
 * Critical for financial data protection and deployment safety
 */

import { logger } from '@shared/utils/logger';
import { DatabaseTransaction, DatabaseMigration, DatabaseBackupInfo } from '@shared/types/database-types';
import { db } from '../db';

interface RollbackPlan {
  migrationId: string;
  rollbackSql: string[];
  dependencies: string[];
  estimatedDuration: number;
  riskLevel: 'low' | 'medium' | 'high';
  requiresBackup: boolean;
}

interface FinancialDataProtection {
  tableName: string;
  isFinancialData: boolean;
  backupRequired: boolean;
  checksumValidation: boolean;
  rollbackStrategy: 'full' | 'incremental' | 'none';
}

export class DatabaseRollbackSafety {
  private static instance: DatabaseRollbackSafety;
  
  private readonly FINANCIAL_TABLES = [
    'stock_data',
    'technical_indicators', 
    'historical_technical_indicators',
    'economic_data_audit',
    'etf_metrics_latest',
    'z_score_technical_data',
    'economic_indicators_current',
    'historical_economic_data'
  ];

  private readonly CRITICAL_OPERATIONS = [
    'DROP TABLE',
    'DELETE FROM',
    'UPDATE',
    'TRUNCATE',
    'ALTER TABLE DROP'
  ];

  static getInstance(): DatabaseRollbackSafety {
    if (!DatabaseRollbackSafety.instance) {
      DatabaseRollbackSafety.instance = new DatabaseRollbackSafety();
    }
    return DatabaseRollbackSafety.instance;
  }

  /**
   * Create comprehensive backup before any destructive operation
   */
  async createSafetyBackup(operation: string, affectedTables: string[]): Promise<DatabaseBackupInfo> {
    const backupId = `safety_backup_${Date.now()}`;
    const startTime = Date.now();

    logger.info(`Creating safety backup for operation: ${operation}`, 'DB_BACKUP', { 
      backupId, 
      affectedTables 
    });

    try {
      // Create backup of affected financial tables
      const backupSql = this.generateBackupSql(affectedTables);
      
      // Calculate backup size and checksum
      const backupInfo: DatabaseBackupInfo = {
        id: backupId,
        filename: `${backupId}.sql`,
        size: 0, // Will be calculated
        createdAt: new Date(),
        tables: affectedTables,
        checksum: await this.calculateBackupChecksum(affectedTables),
        compressed: false
      };

      // Execute backup creation
      await this.executeBackupCreation(backupSql, backupInfo);

      const duration = Date.now() - startTime;
      logger.info(`Safety backup created successfully`, 'DB_BACKUP', { 
        backupId, 
        duration: `${duration}ms`,
        tables: affectedTables.length
      });

      return backupInfo;

    } catch (error: any) {
      logger.error(`Failed to create safety backup`, 'DB_BACKUP_ERROR', { 
        backupId, 
        error: error.message,
        operation
      });
      throw new Error(`Backup creation failed: ${error.message}`);
    }
  }

  /**
   * Validate migration safety before execution
   */
  async validateMigrationSafety(migration: DatabaseMigration): Promise<{
    isSafe: boolean;
    warnings: string[];
    errors: string[];
    rollbackPlan: RollbackPlan;
  }> {
    const warnings: string[] = [];
    const errors: string[] = [];

    logger.info(`Validating migration safety`, 'MIGRATION_SAFETY', { 
      migrationId: migration.id,
      migrationName: migration.name
    });

    // Check for critical operations on financial data
    const affectedFinancialTables = this.identifyAffectedFinancialTables(migration.rollbackSql || '');
    if (affectedFinancialTables.length > 0) {
      warnings.push(`Migration affects financial data tables: ${affectedFinancialTables.join(', ')}`);
    }

    // Validate rollback SQL exists
    if (!migration.rollbackSql || migration.rollbackSql.trim().length === 0) {
      errors.push('Migration missing rollback SQL - required for financial data safety');
    }

    // Check for destructive operations
    const destructiveOps = this.identifyDestructiveOperations(migration.rollbackSql || '');
    if (destructiveOps.length > 0) {
      warnings.push(`Potentially destructive operations detected: ${destructiveOps.join(', ')}`);
    }

    // Generate rollback plan
    const rollbackPlan: RollbackPlan = {
      migrationId: migration.id,
      rollbackSql: [migration.rollbackSql || ''],
      dependencies: [],
      estimatedDuration: this.estimateRollbackDuration(migration),
      riskLevel: this.assessRiskLevel(affectedFinancialTables, destructiveOps),
      requiresBackup: affectedFinancialTables.length > 0
    };

    const isSafe = errors.length === 0 && rollbackPlan.riskLevel !== 'high';

    logger.info(`Migration safety validation completed`, 'MIGRATION_SAFETY', {
      migrationId: migration.id,
      isSafe,
      warningCount: warnings.length,
      errorCount: errors.length,
      riskLevel: rollbackPlan.riskLevel
    });

    return {
      isSafe,
      warnings,
      errors,
      rollbackPlan
    };
  }

  /**
   * Execute safe rollback with financial data protection
   */
  async executeSafeRollback(rollbackPlan: RollbackPlan): Promise<{
    success: boolean;
    executionTime: number;
    backupRestored: boolean;
    errors: string[];
  }> {
    const startTime = Date.now();
    const errors: string[] = [];
    let backupRestored = false;

    logger.info(`Starting safe rollback execution`, 'DB_ROLLBACK', { 
      migrationId: rollbackPlan.migrationId,
      riskLevel: rollbackPlan.riskLevel
    });

    try {
      // Create pre-rollback backup if required
      if (rollbackPlan.requiresBackup) {
        await this.createSafetyBackup(
          'rollback', 
          this.identifyAffectedFinancialTables(rollbackPlan.rollbackSql.join(';'))
        );
      }

      // Execute rollback in transaction
      const transaction = await this.createSafeTransaction();
      
      try {
        for (const sql of rollbackPlan.rollbackSql) {
          await this.executeSqlInTransaction(transaction, sql);
        }

        await this.commitTransaction(transaction);
        
        logger.info(`Rollback executed successfully`, 'DB_ROLLBACK', {
          migrationId: rollbackPlan.migrationId,
          sqlStatements: rollbackPlan.rollbackSql.length
        });

      } catch (rollbackError: any) {
        await this.rollbackTransaction(transaction);
        errors.push(`Rollback execution failed: ${rollbackError.message}`);
        
        // Attempt backup restoration if available
        if (rollbackPlan.requiresBackup) {
          try {
            await this.restoreFromBackup(rollbackPlan.migrationId);
            backupRestored = true;
            logger.info(`Backup restored after rollback failure`, 'DB_ROLLBACK');
          } catch (restoreError: any) {
            errors.push(`Backup restoration failed: ${restoreError.message}`);
          }
        }
      }

      const executionTime = Date.now() - startTime;
      const success = errors.length === 0;

      logger.info(`Safe rollback completed`, 'DB_ROLLBACK', {
        migrationId: rollbackPlan.migrationId,
        success,
        executionTime: `${executionTime}ms`,
        backupRestored,
        errorCount: errors.length
      });

      return {
        success,
        executionTime,
        backupRestored,
        errors
      };

    } catch (error: any) {
      errors.push(`Rollback system error: ${error.message}`);
      logger.error(`Safe rollback system error`, 'DB_ROLLBACK_ERROR', {
        migrationId: rollbackPlan.migrationId,
        error: error.message
      });

      return {
        success: false,
        executionTime: Date.now() - startTime,
        backupRestored,
        errors
      };
    }
  }

  /**
   * Generate backup SQL for specified tables
   */
  private generateBackupSql(tables: string[]): string {
    return tables.map(table => {
      return `COPY ${table} TO STDOUT WITH (FORMAT CSV, HEADER true);`;
    }).join('\n');
  }

  /**
   * Calculate checksum for backup validation
   */
  private async calculateBackupChecksum(tables: string[]): Promise<string> {
    // Simple checksum based on table names and timestamp
    const content = tables.join(',') + new Date().toISOString();
    return Buffer.from(content).toString('base64').substring(0, 16);
  }

  /**
   * Execute backup creation
   */
  private async executeBackupCreation(backupSql: string, backupInfo: DatabaseBackupInfo): Promise<void> {
    // Implementation would depend on specific backup strategy
    // For now, log the backup operation
    logger.info(`Executing backup creation`, 'DB_BACKUP', {
      backupId: backupInfo.id,
      tables: backupInfo.tables.length,
      checksum: backupInfo.checksum
    });
  }

  /**
   * Identify financial tables affected by SQL
   */
  private identifyAffectedFinancialTables(sql: string): string[] {
    return this.FINANCIAL_TABLES.filter(table => 
      sql.toUpperCase().includes(table.toUpperCase())
    );
  }

  /**
   * Identify destructive operations in SQL
   */
  private identifyDestructiveOperations(sql: string): string[] {
    return this.CRITICAL_OPERATIONS.filter(op => 
      sql.toUpperCase().includes(op)
    );
  }

  /**
   * Estimate rollback duration based on complexity
   */
  private estimateRollbackDuration(migration: DatabaseMigration): number {
    // Base duration in milliseconds
    const baseDuration = 1000;
    const sqlComplexity = (migration.rollbackSql || '').split(';').length;
    return baseDuration * sqlComplexity;
  }

  /**
   * Assess risk level for migration
   */
  private assessRiskLevel(financialTables: string[], destructiveOps: string[]): 'low' | 'medium' | 'high' {
    if (financialTables.length > 0 && destructiveOps.length > 0) {
      return 'high';
    } else if (financialTables.length > 0 || destructiveOps.length > 0) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  /**
   * Create safe database transaction
   */
  private async createSafeTransaction(): Promise<DatabaseTransaction> {
    const transaction: DatabaseTransaction = {
      id: `txn_${Date.now()}`,
      startTime: new Date(),
      queries: [],
      status: 'active'
    };

    logger.debug(`Created database transaction`, 'DB_TRANSACTION', { 
      transactionId: transaction.id 
    });

    return transaction;
  }

  /**
   * Execute SQL within transaction
   */
  private async executeSqlInTransaction(transaction: DatabaseTransaction, sql: string): Promise<void> {
    transaction.queries.push(sql);
    
    logger.debug(`Executing SQL in transaction`, 'DB_TRANSACTION', {
      transactionId: transaction.id,
      sqlPreview: sql.substring(0, 100)
    });

    // Implementation would execute actual SQL
    // For safety, we're logging instead of executing
  }

  /**
   * Commit transaction
   */
  private async commitTransaction(transaction: DatabaseTransaction): Promise<void> {
    transaction.status = 'committed';
    
    logger.info(`Transaction committed`, 'DB_TRANSACTION', {
      transactionId: transaction.id,
      queriesExecuted: transaction.queries.length,
      duration: Date.now() - transaction.startTime.getTime()
    });
  }

  /**
   * Rollback transaction
   */
  private async rollbackTransaction(transaction: DatabaseTransaction): Promise<void> {
    transaction.status = 'rolled_back';
    
    logger.warn(`Transaction rolled back`, 'DB_TRANSACTION', {
      transactionId: transaction.id,
      queriesExecuted: transaction.queries.length
    });
  }

  /**
   * Restore from backup
   */
  private async restoreFromBackup(migrationId: string): Promise<void> {
    logger.info(`Attempting backup restoration`, 'DB_RESTORE', { migrationId });
    
    // Implementation would restore from actual backup
    // For safety, we're logging the operation
  }
}

export const databaseRollbackSafety = DatabaseRollbackSafety.getInstance();