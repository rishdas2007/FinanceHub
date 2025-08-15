// Database migration safety validator

import { Finding } from '../../../types/agent-interfaces.js';
import * as fs from 'fs';
import * as path from 'path';

interface MigrationSafetyChecks {
  hasRollbackPlan: boolean;
  preservesExistingData: boolean;
  maintainsDataIntegrity: boolean;
  backupCreated: boolean;
  estimatedDowntime: number;
  affectedTableSizes: Record<string, number>;
  lockingOperations: string[];
  preservesHistoricalData: boolean;
  maintainsAuditTrail: boolean;
  preservesCalculationAccuracy: boolean;
}

export class DatabaseMigrationValidator {
  async validateMigrations(files: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];
    
    // Find migration files
    const migrationFiles = this.findMigrationFiles(files);
    
    if (migrationFiles.length === 0) {
      return findings; // No migrations to validate
    }

    console.log(`🗄️ Found ${migrationFiles.length} migration files to validate`);

    for (const migrationFile of migrationFiles) {
      findings.push(...await this.validateMigrationFile(migrationFile));
    }

    // Check for migration conflicts
    findings.push(...await this.checkMigrationConflicts(migrationFiles));

    return findings;
  }

  private findMigrationFiles(files: string[]): string[] {
    return files.filter(file => 
      file.includes('migrations/') || 
      file.includes('migrate/') ||
      (file.endsWith('.sql') && !file.includes('test')) ||
      file.includes('drizzle') ||
      file.includes('schema-changes')
    );
  }

  private async validateMigrationFile(filePath: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const upperContent = content.toUpperCase();

      // Check for dangerous operations
      const dangerousOperations = [
        { op: 'DROP TABLE', severity: 'critical' as const },
        { op: 'DROP COLUMN', severity: 'critical' as const },
        { op: 'TRUNCATE', severity: 'critical' as const },
        { op: 'DELETE FROM', severity: 'high' as const },
        { op: 'ALTER COLUMN', severity: 'high' as const },
        { op: 'ALTER TABLE', severity: 'medium' as const }
      ];

      for (const { op, severity } of dangerousOperations) {
        if (upperContent.includes(op)) {
          const isFinancialTable = this.affectsFinancialData(content);
          const adjustedSeverity = isFinancialTable && severity !== 'critical' ? 'high' : severity;

          findings.push({
            id: `dangerous-migration-${op.toLowerCase().replace(/\s+/g, '-')}-${path.basename(filePath)}`,
            type: 'error',
            severity: adjustedSeverity,
            category: 'database-migration',
            title: `Dangerous Migration Operation: ${op}`,
            description: `Migration contains ${op} which could ${isFinancialTable ? 'destroy critical financial data' : 'cause data loss'}`,
            file: filePath,
            rule: 'no-dangerous-operations',
            fix: {
              type: 'review',
              description: 'Review migration for data safety, create backup plan, test in staging',
              automated: false,
              confidence: 90
            }
          });
        }
      }

      // Check for missing rollback strategy
      if (!this.hasRollbackStrategy(content)) {
        findings.push({
          id: `missing-rollback-${path.basename(filePath)}`,
          type: 'warning',
          severity: 'high',
          category: 'database-migration',
          title: 'Migration Missing Rollback Strategy',
          description: 'No rollback plan defined for database migration',
          file: filePath,
          rule: 'rollback-required',
          fix: {
            type: 'add',
            description: 'Add DOWN migration or rollback instructions',
            automated: false,
            confidence: 70
          }
        });
      }

      // Check for transaction safety
      if (!this.hasTransactionSafety(content)) {
        findings.push({
          id: `missing-transaction-${path.basename(filePath)}`,
          type: 'warning',
          severity: 'medium',
          category: 'database-migration',
          title: 'Migration Not Transaction-Safe',
          description: 'Migration should be wrapped in transaction for atomicity',
          file: filePath,
          rule: 'transaction-safety'
        });
      }

      // Check for index creation strategy
      if (upperContent.includes('CREATE INDEX') && !upperContent.includes('CONCURRENTLY')) {
        findings.push({
          id: `blocking-index-creation-${path.basename(filePath)}`,
          type: 'warning',
          severity: 'medium',
          category: 'database-migration',
          title: 'Blocking Index Creation',
          description: 'Index creation without CONCURRENTLY may lock table during creation',
          file: filePath,
          rule: 'non-blocking-index-creation'
        });
      }

      // Financial data specific checks
      if (this.affectsFinancialData(content)) {
        findings.push(...this.validateFinancialDataMigration(content, filePath));
      }

    } catch (error) {
      findings.push({
        id: `migration-read-error-${path.basename(filePath)}`,
        type: 'error',
        severity: 'medium',
        category: 'database-migration',
        title: 'Failed to Read Migration File',
        description: `Cannot read migration file: ${error}`,
        file: filePath,
        rule: 'migration-file-readable'
      });
    }

    return findings;
  }

  private validateFinancialDataMigration(content: string, filePath: string): Finding[] {
    const findings: Finding[] = [];

    // Check for proper precision maintenance in financial calculations
    if (content.toLowerCase().includes('decimal') || content.toLowerCase().includes('numeric')) {
      const precisionPattern = /DECIMAL\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi;
      const matches = [...content.matchAll(precisionPattern)];
      
      for (const match of matches) {
        const precision = parseInt(match[1]);
        const scale = parseInt(match[2]);
        
        if (scale < 2) {
          findings.push({
            id: `insufficient-financial-precision-${path.basename(filePath)}`,
            type: 'warning',
            severity: 'high',
            category: 'database-migration',
            title: 'Insufficient Financial Data Precision',
            description: `DECIMAL(${precision},${scale}) may not provide sufficient precision for financial calculations`,
            file: filePath,
            rule: 'financial-precision-requirements'
          });
        }
      }
    }

    // Check for foreign key constraints on financial data
    const financialTables = this.getFinancialTableNames();
    for (const table of financialTables) {
      if (content.toLowerCase().includes(table.toLowerCase()) && 
          content.toUpperCase().includes('FOREIGN KEY')) {
        
        findings.push({
          id: `financial-table-foreign-key-${table}-${path.basename(filePath)}`,
          type: 'info',
          severity: 'low',
          category: 'database-migration',
          title: 'Foreign Key on Financial Table',
          description: `Adding foreign key to financial table ${table}. Ensure referential integrity is maintained.`,
          file: filePath,
          rule: 'financial-referential-integrity'
        });
      }
    }

    return findings;
  }

  private affectsFinancialData(content: string): boolean {
    const financialTables = this.getFinancialTableNames();
    const lowerContent = content.toLowerCase();
    
    return financialTables.some(table => 
      lowerContent.includes(table.toLowerCase())
    );
  }

  private getFinancialTableNames(): string[] {
    return [
      'econ_series_def',
      'econ_series_observation', 
      'econ_series_features',
      'zscore_technical_indicators',
      'economic_indicators_history',
      'economic_indicators_current',
      'historical_stock_data',
      'technical_indicators',
      'market_sentiment',
      'stock_data',
      'etf_metrics_latest',
      'financial_data',
      'trading_data',
      'price_history'
    ];
  }

  private hasRollbackStrategy(content: string): boolean {
    const rollbackIndicators = [
      'rollback',
      'down',
      'revert',
      'undo',
      'DROP INDEX IF EXISTS', // Common rollback pattern
      'DROP TABLE IF EXISTS', // Common rollback pattern
      'ALTER TABLE ... DROP COLUMN', // Rollback pattern
    ];

    const lowerContent = content.toLowerCase();
    return rollbackIndicators.some(indicator => 
      lowerContent.includes(indicator.toLowerCase())
    );
  }

  private hasTransactionSafety(content: string): boolean {
    const upperContent = content.toUpperCase();
    return (
      upperContent.includes('BEGIN') || 
      upperContent.includes('START TRANSACTION') ||
      upperContent.includes('COMMIT') ||
      upperContent.includes('ROLLBACK')
    );
  }

  private async checkMigrationConflicts(migrationFiles: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    if (migrationFiles.length > 1) {
      // Check for potential conflicts between migrations
      const operations: Array<{ file: string; operation: string; table: string }> = [];

      for (const file of migrationFiles) {
        try {
          const content = fs.readFileSync(file, 'utf-8');
          const upperContent = content.toUpperCase();

          // Extract operations and tables
          const tableMatches = [...content.matchAll(/(?:CREATE|ALTER|DROP)\s+TABLE\s+(\w+)/gi)];
          for (const match of tableMatches) {
            operations.push({
              file,
              operation: match[0].split(' ')[0].toUpperCase(),
              table: match[1]
            });
          }

        } catch (error) {
          // Skip files that can't be read
        }
      }

      // Check for conflicting operations on same table
      const tableOperations = new Map<string, Array<{ file: string; operation: string }>>();
      
      for (const op of operations) {
        if (!tableOperations.has(op.table)) {
          tableOperations.set(op.table, []);
        }
        tableOperations.get(op.table)!.push({ file: op.file, operation: op.operation });
      }

      for (const [table, ops] of tableOperations) {
        if (ops.length > 1) {
          const hasConflict = this.detectOperationConflicts(ops);
          if (hasConflict) {
            findings.push({
              id: `migration-conflict-${table}`,
              type: 'warning',
              severity: 'high',
              category: 'database-migration',
              title: `Conflicting Migrations on Table: ${table}`,
              description: `Multiple migrations affect table ${table}, potential conflicts detected`,
              rule: 'migration-conflicts',
              metadata: {
                table,
                conflicts: ops.map(op => `${op.operation} in ${path.basename(op.file)}`)
              }
            });
          }
        }
      }
    }

    return findings;
  }

  private detectOperationConflicts(operations: Array<{ file: string; operation: string }>): boolean {
    const ops = operations.map(op => op.operation);
    
    // Check for dangerous combinations
    if (ops.includes('DROP') && ops.includes('CREATE')) {
      return true; // DROP and CREATE on same table
    }
    
    if (ops.includes('DROP') && ops.includes('ALTER')) {
      return true; // DROP and ALTER on same table
    }

    if (ops.filter(op => op === 'ALTER').length > 1) {
      return true; // Multiple ALTER operations may conflict
    }

    return false;
  }
}