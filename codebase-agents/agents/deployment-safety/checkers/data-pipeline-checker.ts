// Data pipeline checker - validates financial data pipeline integrity

import { Finding, AgentConfig } from '../../../types/agent-interfaces.js';
import * as fs from 'fs';
import * as path from 'path';

interface DataPipelineHealth {
  fredApiConnection: 'healthy' | 'degraded' | 'failed';
  twelveDataConnection: 'healthy' | 'degraded' | 'failed';
  databaseWriteCapacity: 'normal' | 'slow' | 'failed';
  cacheSystem: 'operational' | 'degraded' | 'down';
  scheduledJobs: ScheduledJobStatus[];
  dataFreshness: DataFreshnessCheck[];
}

interface ScheduledJobStatus {
  name: string;
  lastRun: Date;
  nextRun: Date;
  status: 'active' | 'paused' | 'failed';
  frequency: string;
}

interface DataFreshnessCheck {
  source: string;
  dataType: string;
  lastUpdate: Date;
  expectedFrequency: string;
  status: 'fresh' | 'stale' | 'missing';
}

export class DataPipelineChecker {
  private readonly criticalDataSources = [
    'FRED', 'TwelveData'
  ];

  private readonly criticalDataTypes = [
    'economic-indicators',
    'etf-prices',
    'technical-indicators',
    'z-scores',
    'market-sentiment'
  ];

  async validate(config: AgentConfig): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Check data pipeline configuration
    findings.push(...await this.validatePipelineConfiguration());
    
    // Validate data source integrations
    findings.push(...await this.validateDataSourceIntegrations());
    
    // Check scheduled job configurations  
    findings.push(...await this.validateScheduledJobs());
    
    // Validate data transformation logic
    findings.push(...await this.validateDataTransformations());
    
    // Check data quality and validation rules
    findings.push(...await this.validateDataQuality());

    return findings;
  }

  private async validatePipelineConfiguration(): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      // Check for data pipeline configuration files
      const configFiles = [
        'server/services/data-service.ts',
        'server/services/fred-service.ts', 
        'server/services/twelve-data-service.ts',
        'server/services/etl-service.ts',
        'server/jobs/',
        'server/cron/'
      ];

      const missingConfigs: string[] = [];
      
      for (const configPath of configFiles) {
        if (!fs.existsSync(configPath)) {
          missingConfigs.push(configPath);
        }
      }

      if (missingConfigs.length > 0) {
        findings.push({
          id: 'missing-data-pipeline-configs',
          type: 'warning',
          severity: 'high',
          category: 'data-pipeline',
          title: 'Missing Data Pipeline Configuration',
          description: `Missing data pipeline files: ${missingConfigs.join(', ')}`,
          rule: 'data-pipeline-config-complete'
        });
      }

      // Check for API key configuration
      const requiredEnvVars = ['FRED_API_KEY', 'TWELVE_DATA_API_KEY'];
      const missingKeys: string[] = [];

      for (const envVar of requiredEnvVars) {
        if (!process.env[envVar]) {
          missingKeys.push(envVar);
        }
      }

      if (missingKeys.length > 0) {
        findings.push({
          id: 'missing-data-api-keys',
          type: 'error',
          severity: 'critical',
          category: 'data-pipeline',
          title: 'Missing Data API Keys',
          description: `Required API keys not configured: ${missingKeys.join(', ')}`,
          rule: 'data-api-keys-required'
        });
      }

    } catch (error) {
      findings.push({
        id: 'pipeline-config-validation-error',
        type: 'error',
        severity: 'medium',
        category: 'data-pipeline',
        title: 'Pipeline Configuration Validation Failed',
        description: `Failed to validate pipeline configuration: ${error}`,
        rule: 'pipeline-config-validation'
      });
    }

    return findings;
  }

  private async validateDataSourceIntegrations(): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      // Check FRED API integration
      const fredServicePath = 'server/services/fred-service.ts';
      if (fs.existsSync(fredServicePath)) {
        const fredContent = fs.readFileSync(fredServicePath, 'utf-8');
        findings.push(...this.validateFredIntegration(fredContent, fredServicePath));
      }

      // Check Twelve Data API integration
      const twelveDataPath = 'server/services/twelve-data-service.ts';
      if (fs.existsSync(twelveDataPath)) {
        const twelveDataContent = fs.readFileSync(twelveDataPath, 'utf-8');
        findings.push(...this.validateTwelveDataIntegration(twelveDataContent, twelveDataPath));
      }

      // Check database connection handling
      findings.push(...await this.validateDatabaseConnections());

    } catch (error) {
      findings.push({
        id: 'data-source-validation-error',
        type: 'error',
        severity: 'medium',
        category: 'data-pipeline',
        title: 'Data Source Validation Failed',
        description: `Failed to validate data source integrations: ${error}`,
        rule: 'data-source-validation'
      });
    }

    return findings;
  }

  private validateFredIntegration(content: string, filePath: string): Finding[] {
    const findings: Finding[] = [];

    // Check for proper error handling
    if (!content.includes('try') || !content.includes('catch')) {
      findings.push({
        id: 'fred-no-error-handling',
        type: 'error',
        severity: 'high',
        category: 'data-pipeline',
        title: 'FRED Service Missing Error Handling',
        description: 'FRED API service lacks proper error handling for API failures',
        file: filePath,
        rule: 'api-error-handling-required'
      });
    }

    // Check for rate limiting
    if (!content.includes('rate') && !content.includes('limit')) {
      findings.push({
        id: 'fred-no-rate-limiting',
        type: 'warning',
        severity: 'medium',
        category: 'data-pipeline',
        title: 'FRED Service Missing Rate Limiting',
        description: 'FRED API service should implement rate limiting to avoid API quota exhaustion',
        file: filePath,
        rule: 'api-rate-limiting'
      });
    }

    // Check for data validation
    if (!content.includes('validate') && !content.includes('schema')) {
      findings.push({
        id: 'fred-no-data-validation',
        type: 'warning',
        severity: 'medium',
        category: 'data-pipeline',
        title: 'FRED Service Missing Data Validation',
        description: 'FRED API responses should be validated before processing',
        file: filePath,
        rule: 'api-response-validation'
      });
    }

    // Check for retry logic
    if (!content.includes('retry') && !content.includes('attempt')) {
      findings.push({
        id: 'fred-no-retry-logic',
        type: 'warning',
        severity: 'medium',
        category: 'data-pipeline',
        title: 'FRED Service Missing Retry Logic',
        description: 'FRED API service should implement retry logic for transient failures',
        file: filePath,
        rule: 'api-retry-logic'
      });
    }

    // Check for proper logging
    if (!content.includes('console.log') && !content.includes('logger')) {
      findings.push({
        id: 'fred-no-logging',
        type: 'info',
        severity: 'low',
        category: 'data-pipeline',
        title: 'FRED Service Missing Logging',
        description: 'Consider adding logging for debugging and monitoring',
        file: filePath,
        rule: 'api-logging'
      });
    }

    return findings;
  }

  private validateTwelveDataIntegration(content: string, filePath: string): Finding[] {
    const findings: Finding[] = [];

    // Check for proper error handling
    if (!content.includes('try') || !content.includes('catch')) {
      findings.push({
        id: 'twelve-data-no-error-handling',
        type: 'error',
        severity: 'high',
        category: 'data-pipeline',
        title: 'Twelve Data Service Missing Error Handling',
        description: 'Twelve Data API service lacks proper error handling for API failures',
        file: filePath,
        rule: 'api-error-handling-required'
      });
    }

    // Check for API key validation
    if (!content.includes('apikey') && !content.includes('api_key')) {
      findings.push({
        id: 'twelve-data-no-api-key',
        type: 'error',
        severity: 'critical',
        category: 'data-pipeline',
        title: 'Twelve Data Service Missing API Key',
        description: 'Twelve Data API service must include API key for authentication',
        file: filePath,
        rule: 'api-key-required'
      });
    }

    // Check for real-time data handling
    if (content.includes('price') && !content.includes('timestamp')) {
      findings.push({
        id: 'twelve-data-no-timestamps',
        type: 'warning',
        severity: 'medium',
        category: 'data-pipeline',
        title: 'Twelve Data Service Missing Timestamps',
        description: 'Price data should include timestamps for proper temporal analysis',
        file: filePath,
        rule: 'temporal-data-integrity'
      });
    }

    return findings;
  }

  private async validateDatabaseConnections(): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      // Check database configuration
      const dbConfigPath = 'server/db/index.ts';
      if (fs.existsSync(dbConfigPath)) {
        const dbContent = fs.readFileSync(dbConfigPath, 'utf-8');

        // Check for connection pooling
        if (!dbContent.includes('pool') && !dbContent.includes('Pool')) {
          findings.push({
            id: 'db-no-connection-pooling',
            type: 'warning',
            severity: 'medium',
            category: 'data-pipeline',
            title: 'Database Missing Connection Pooling',
            description: 'Database should use connection pooling for better performance',
            file: dbConfigPath,
            rule: 'db-connection-pooling'
          });
        }

        // Check for proper error handling
        if (!dbContent.includes('catch') && !dbContent.includes('error')) {
          findings.push({
            id: 'db-no-error-handling',
            type: 'error',
            severity: 'high',
            category: 'data-pipeline',
            title: 'Database Missing Error Handling',
            description: 'Database connections must handle errors gracefully',
            file: dbConfigPath,
            rule: 'db-error-handling'
          });
        }

        // Check for SSL configuration in production
        if (!dbContent.includes('ssl') && process.env.NODE_ENV === 'production') {
          findings.push({
            id: 'db-no-ssl-config',
            type: 'warning',
            severity: 'high',
            category: 'data-pipeline',
            title: 'Database Missing SSL Configuration',
            description: 'Production database connections should use SSL',
            file: dbConfigPath,
            rule: 'db-ssl-production'
          });
        }
      }

      // Check schema files for financial data integrity
      const schemaPath = 'shared/schema.ts';
      if (fs.existsSync(schemaPath)) {
        const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
        findings.push(...this.validateDatabaseSchema(schemaContent, schemaPath));
      }

    } catch (error) {
      findings.push({
        id: 'db-validation-error',
        type: 'error',
        severity: 'medium',
        category: 'data-pipeline',
        title: 'Database Validation Failed',
        description: `Failed to validate database connections: ${error}`,
        rule: 'db-validation'
      });
    }

    return findings;
  }

  private validateDatabaseSchema(content: string, filePath: string): Finding[] {
    const findings: Finding[] = [];

    // Critical financial tables that must exist
    const criticalTables = [
      'users',
      'stockData',
      'technicalIndicators', 
      'economicIndicatorsCurrent',
      'econSeriesDef',
      'econSeriesObservation'
    ];

    for (const table of criticalTables) {
      if (!content.includes(table)) {
        findings.push({
          id: `missing-critical-table-${table}`,
          type: 'error',
          severity: 'critical',
          category: 'data-pipeline',
          title: `Missing Critical Database Table: ${table}`,
          description: `Critical financial data table ${table} not found in schema`,
          file: filePath,
          rule: 'critical-tables-required'
        });
      }
    }

    // Check for proper decimal precision for financial data
    if (content.includes('decimal') || content.includes('numeric')) {
      const precisionPattern = /decimal\s*\(\s*(\d+)\s*,\s*(\d+)\s*\)/gi;
      const matches = [...content.matchAll(precisionPattern)];
      
      for (const match of matches) {
        const precision = parseInt(match[1]);
        const scale = parseInt(match[2]);
        
        if (scale < 2) {
          findings.push({
            id: 'insufficient-financial-precision',
            type: 'warning',
            severity: 'medium',
            category: 'data-pipeline',
            title: 'Insufficient Financial Data Precision',
            description: `DECIMAL(${precision},${scale}) may not provide sufficient precision for financial calculations`,
            file: filePath,
            rule: 'financial-precision-requirements'
          });
        }
      }
    }

    // Check for timestamp fields
    if (!content.includes('timestamp') && !content.includes('createdAt')) {
      findings.push({
        id: 'missing-timestamps',
        type: 'warning',
        severity: 'medium',
        category: 'data-pipeline',
        title: 'Missing Timestamp Fields',
        description: 'Financial data should include timestamp fields for temporal analysis',
        file: filePath,
        rule: 'temporal-data-tracking'
      });
    }

    return findings;
  }

  private async validateScheduledJobs(): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      // Look for cron job configurations
      const cronPaths = [
        'server/jobs/',
        'server/cron/',
        'server/schedulers/',
        'ecosystem.config.js'
      ];

      let hasScheduledJobs = false;
      
      for (const cronPath of cronPaths) {
        if (fs.existsSync(cronPath)) {
          hasScheduledJobs = true;
          
          if (fs.statSync(cronPath).isDirectory()) {
            const files = fs.readdirSync(cronPath);
            for (const file of files) {
              const fullPath = path.join(cronPath, file);
              if (file.endsWith('.ts') || file.endsWith('.js')) {
                const content = fs.readFileSync(fullPath, 'utf-8');
                findings.push(...this.validateCronJob(content, fullPath));
              }
            }
          } else {
            const content = fs.readFileSync(cronPath, 'utf-8');
            findings.push(...this.validateCronJob(content, cronPath));
          }
        }
      }

      if (!hasScheduledJobs) {
        findings.push({
          id: 'no-scheduled-jobs',
          type: 'warning',
          severity: 'medium',
          category: 'data-pipeline',
          title: 'No Scheduled Jobs Found',
          description: 'Financial data pipelines typically require scheduled jobs for data updates',
          rule: 'scheduled-jobs-required'
        });
      }

    } catch (error) {
      findings.push({
        id: 'scheduled-jobs-validation-error',
        type: 'error',
        severity: 'medium',
        category: 'data-pipeline',
        title: 'Scheduled Jobs Validation Failed',
        description: `Failed to validate scheduled jobs: ${error}`,
        rule: 'scheduled-jobs-validation'
      });
    }

    return findings;
  }

  private validateCronJob(content: string, filePath: string): Finding[] {
    const findings: Finding[] = [];

    // Check for proper cron schedule format
    const cronPattern = /['"`]\s*(\*|\d+|\d+-\d+|\d+\/\d+)\s+(\*|\d+|\d+-\d+|\d+\/\d+)\s+(\*|\d+|\d+-\d+|\d+\/\d+)\s+(\*|\d+|\d+-\d+|\d+\/\d+)\s+(\*|\d+|\d+-\d+|\d+\/\d+)\s*['"`]/g;
    
    if (!cronPattern.test(content) && !content.includes('setInterval') && !content.includes('setTimeout')) {
      findings.push({
        id: `invalid-cron-schedule-${path.basename(filePath)}`,
        type: 'warning',
        severity: 'medium',
        category: 'data-pipeline',
        title: 'Invalid Cron Schedule Format',
        description: 'Cron job schedule format appears to be invalid',
        file: filePath,
        rule: 'valid-cron-schedule'
      });
    }

    // Check for error handling in jobs
    if (!content.includes('try') || !content.includes('catch')) {
      findings.push({
        id: `cron-no-error-handling-${path.basename(filePath)}`,
        type: 'error',
        severity: 'high',
        category: 'data-pipeline',
        title: 'Cron Job Missing Error Handling',
        description: 'Scheduled jobs must handle errors to prevent silent failures',
        file: filePath,
        rule: 'cron-error-handling'
      });
    }

    // Check for logging
    if (!content.includes('console.log') && !content.includes('logger')) {
      findings.push({
        id: `cron-no-logging-${path.basename(filePath)}`,
        type: 'warning',
        severity: 'medium',
        category: 'data-pipeline',
        title: 'Cron Job Missing Logging',
        description: 'Scheduled jobs should log execution status for monitoring',
        file: filePath,
        rule: 'cron-logging'
      });
    }

    return findings;
  }

  private async validateDataTransformations(): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      // Look for data transformation services
      const transformationPaths = [
        'server/services/data-transformation-service.ts',
        'server/services/etl-service.ts',
        'server/services/data-converter.ts',
        'server/utils/data-utils.ts'
      ];

      for (const transformPath of transformationPaths) {
        if (fs.existsSync(transformPath)) {
          const content = fs.readFileSync(transformPath, 'utf-8');
          findings.push(...this.validateTransformationLogic(content, transformPath));
        }
      }

    } catch (error) {
      findings.push({
        id: 'data-transformation-validation-error',
        type: 'error',
        severity: 'medium',
        category: 'data-pipeline',
        title: 'Data Transformation Validation Failed',
        description: `Failed to validate data transformations: ${error}`,
        rule: 'data-transformation-validation'
      });
    }

    return findings;
  }

  private validateTransformationLogic(content: string, filePath: string): Finding[] {
    const findings: Finding[] = [];

    // Check for null/undefined handling
    if (!content.includes('null') && !content.includes('undefined')) {
      findings.push({
        id: `transformation-no-null-handling-${path.basename(filePath)}`,
        type: 'warning',
        severity: 'medium',
        category: 'data-pipeline',
        title: 'Data Transformation Missing Null Handling',
        description: 'Data transformations should handle null/undefined values',
        file: filePath,
        rule: 'null-handling-required'
      });
    }

    // Check for data type validation
    if (!content.includes('typeof') && !content.includes('isNaN') && !content.includes('Number.isFinite')) {
      findings.push({
        id: `transformation-no-type-validation-${path.basename(filePath)}`,
        type: 'warning',
        severity: 'medium',
        category: 'data-pipeline',
        title: 'Data Transformation Missing Type Validation',
        description: 'Data transformations should validate data types',
        file: filePath,
        rule: 'type-validation-required'
      });
    }

    // Check for mathematical precision issues
    if (content.includes('parseFloat') || content.includes('Number(')) {
      if (!content.includes('toFixed') && !content.includes('toPrecision')) {
        findings.push({
          id: `transformation-precision-risk-${path.basename(filePath)}`,
          type: 'warning',
          severity: 'low',
          category: 'data-pipeline',
          title: 'Potential Precision Loss in Financial Calculations',
          description: 'Consider using fixed precision for financial calculations',
          file: filePath,
          rule: 'financial-precision'
        });
      }
    }

    return findings;
  }

  private async validateDataQuality(): Promise<Finding[]> {
    const findings: Finding[] = [];

    // This would typically check data quality rules, validation schemas, etc.
    // For now, provide basic recommendations

    findings.push({
      id: 'data-quality-recommendations',
      type: 'info',
      severity: 'low',
      category: 'data-pipeline',
      title: 'Data Quality Recommendations',
      description: 'Consider implementing data quality checks: range validation, outlier detection, data freshness monitoring',
      rule: 'data-quality-monitoring'
    });

    return findings;
  }
}