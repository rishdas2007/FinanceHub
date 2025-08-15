// Pre-deployment validation checks

import { Finding, AgentConfig } from '../../../types/agent-interfaces.js';
import * as fs from 'fs';
import * as path from 'path';

interface PreDeploymentChecks {
  buildStatus: 'pass' | 'fail';
  testResults: TestSuiteResults;
  typeCheckResults: TypeCheckResults;
  securityScanResults: SecurityScanResults;
  bundleAnalysis: BundleAnalysisResults;
  economicDataPipeline: 'healthy' | 'degraded' | 'broken';
  apiKeyValidation: 'valid' | 'expired' | 'missing';
  databaseConnectivity: 'connected' | 'disconnected';
  criticalServicesHealth: ServiceHealthStatus[];
}

interface TestSuiteResults {
  passed: number;
  failed: number;
  coverage: number;
  criticalTestsPassing: boolean;
}

interface TypeCheckResults {
  success: boolean;
  errors: number;
  warnings: number;
}

interface SecurityScanResults {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

interface BundleAnalysisResults {
  sizeMB: number;
  sizeIncrease: number;
  performanceImpact: 'none' | 'minor' | 'moderate' | 'severe';
}

interface ServiceHealthStatus {
  name: string;
  status: 'healthy' | 'degraded' | 'down';
  responseTime: number;
  errorRate: number;
}

export class PreDeploymentValidator {
  async validate(config: AgentConfig): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Check build status
    findings.push(...await this.validateBuildStatus());
    
    // Validate test suite results
    findings.push(...await this.validateTestSuite());
    
    // Check TypeScript compilation
    findings.push(...await this.validateTypeScript());
    
    // Validate environment variables
    findings.push(...await this.validateEnvironmentVariables());
    
    // Check API keys and external service connectivity
    findings.push(...await this.validateExternalServices());
    
    // Validate critical database tables
    findings.push(...await this.validateDatabaseSchema());
    
    // Check bundle size and performance impact
    findings.push(...await this.validateBundleSize());

    return findings;
  }

  private async validateBuildStatus(): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      // Check if build artifacts exist
      const distPath = path.join(process.cwd(), 'dist');
      if (!fs.existsSync(distPath)) {
        findings.push({
          id: 'build-artifacts-missing',
          type: 'error',
          severity: 'critical',
          category: 'build',
          title: 'Build Artifacts Missing',
          description: 'No build artifacts found. Run npm run build before deployment.',
          rule: 'build-required'
        });
      }

      // Check package.json scripts
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        
        if (!packageJson.scripts?.build) {
          findings.push({
            id: 'missing-build-script',
            type: 'warning',
            severity: 'medium',
            category: 'build',
            title: 'Missing Build Script',
            description: 'No build script defined in package.json',
            rule: 'build-script-required'
          });
        }

        if (!packageJson.scripts?.start) {
          findings.push({
            id: 'missing-start-script',
            type: 'error',
            severity: 'high',
            category: 'build',
            title: 'Missing Start Script',
            description: 'No start script defined in package.json',
            rule: 'start-script-required'
          });
        }
      }

    } catch (error) {
      findings.push({
        id: 'build-validation-error',
        type: 'error',
        severity: 'high',
        category: 'build',
        title: 'Build Validation Failed',
        description: `Failed to validate build status: ${error}`,
        rule: 'build-validation'
      });
    }

    return findings;
  }

  private async validateTestSuite(): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      // Check for test files
      const testPatterns = [
        'test/**/*.test.ts',
        'tests/**/*.test.ts',
        '**/*.test.ts',
        '**/*.spec.ts'
      ];

      let hasTests = false;
      for (const pattern of testPatterns) {
        const testDir = pattern.split('/')[0];
        if (fs.existsSync(testDir)) {
          hasTests = true;
          break;
        }
      }

      if (!hasTests) {
        findings.push({
          id: 'no-tests-found',
          type: 'warning',
          severity: 'medium',
          category: 'testing',
          title: 'No Tests Found',
          description: 'No test files detected. Consider adding tests for critical functionality.',
          rule: 'tests-recommended'
        });
      }

      // Check for test configuration
      const testConfigs = ['jest.config.js', 'vitest.config.ts', 'playwright.config.ts'];
      const hasTestConfig = testConfigs.some(config => fs.existsSync(config));

      if (hasTests && !hasTestConfig) {
        findings.push({
          id: 'missing-test-config',
          type: 'warning',
          severity: 'low',
          category: 'testing',
          title: 'Missing Test Configuration',
          description: 'Test files found but no test configuration detected.',
          rule: 'test-config-recommended'
        });
      }

    } catch (error) {
      findings.push({
        id: 'test-validation-error',
        type: 'error',
        severity: 'medium',
        category: 'testing',
        title: 'Test Validation Failed',
        description: `Failed to validate test suite: ${error}`,
        rule: 'test-validation'
      });
    }

    return findings;
  }

  private async validateTypeScript(): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
      if (fs.existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
        
        // Check for strict mode
        if (!tsconfig.compilerOptions?.strict) {
          findings.push({
            id: 'typescript-not-strict',
            type: 'warning',
            severity: 'medium',
            category: 'type-safety',
            title: 'TypeScript Strict Mode Disabled',
            description: 'Consider enabling strict mode for better type safety.',
            rule: 'typescript-strict-mode'
          });
        }

        // Check for important strict flags
        const importantFlags = [
          'noImplicitAny',
          'strictNullChecks',
          'strictFunctionTypes'
        ];

        for (const flag of importantFlags) {
          if (!tsconfig.compilerOptions?.[flag]) {
            findings.push({
              id: `typescript-missing-${flag.toLowerCase()}`,
              type: 'info',
              severity: 'low',
              category: 'type-safety',
              title: `TypeScript ${flag} Disabled`,
              description: `Consider enabling ${flag} for better type safety.`,
              rule: 'typescript-strict-flags'
            });
          }
        }

      } else {
        findings.push({
          id: 'missing-tsconfig',
          type: 'warning',
          severity: 'medium',
          category: 'type-safety',
          title: 'Missing TypeScript Configuration',
          description: 'No tsconfig.json found. TypeScript compilation may fail.',
          rule: 'tsconfig-required'
        });
      }

    } catch (error) {
      findings.push({
        id: 'typescript-validation-error',
        type: 'error',
        severity: 'medium',
        category: 'type-safety',
        title: 'TypeScript Validation Failed',
        description: `Failed to validate TypeScript configuration: ${error}`,
        rule: 'typescript-validation'
      });
    }

    return findings;
  }

  private async validateEnvironmentVariables(): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Critical environment variables for FinanceHub Pro
    const criticalEnvVars = [
      'DATABASE_URL',
      'FRED_API_KEY',
      'TWELVE_DATA_API_KEY',
      'NODE_ENV'
    ];

    const recommendedEnvVars = [
      'SENDGRID_API_KEY',
      'OPENAI_API_KEY',
      'REDIS_URL'
    ];

    // Check critical environment variables
    for (const envVar of criticalEnvVars) {
      if (!process.env[envVar]) {
        findings.push({
          id: `missing-critical-env-${envVar.toLowerCase()}`,
          type: 'error',
          severity: 'critical',
          category: 'environment',
          title: `Missing Critical Environment Variable: ${envVar}`,
          description: `Required environment variable ${envVar} is not set. Application will fail to start.`,
          rule: 'critical-env-vars-required'
        });
      }
    }

    // Check recommended environment variables
    for (const envVar of recommendedEnvVars) {
      if (!process.env[envVar]) {
        findings.push({
          id: `missing-recommended-env-${envVar.toLowerCase()}`,
          type: 'warning',
          severity: 'medium',
          category: 'environment',
          title: `Missing Recommended Environment Variable: ${envVar}`,
          description: `Recommended environment variable ${envVar} is not set. Some features may not work.`,
          rule: 'recommended-env-vars'
        });
      }
    }

    // Check NODE_ENV for production deployment
    if (process.env.NODE_ENV !== 'production' && process.env.NODE_ENV !== 'development') {
      findings.push({
        id: 'invalid-node-env',
        type: 'warning',
        severity: 'medium',
        category: 'environment',
        title: 'Invalid NODE_ENV',
        description: `NODE_ENV is set to '${process.env.NODE_ENV}'. Should be 'production' for deployment.`,
        rule: 'valid-node-env'
      });
    }

    return findings;
  }

  private async validateExternalServices(): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Validate FRED API key
    if (process.env.FRED_API_KEY) {
      try {
        // Basic validation - check if key format is correct
        if (process.env.FRED_API_KEY.length < 32) {
          findings.push({
            id: 'invalid-fred-api-key-format',
            type: 'warning',
            severity: 'high',
            category: 'external-services',
            title: 'FRED API Key Format Invalid',
            description: 'FRED API key appears to be invalid format. Economic data pipeline may fail.',
            rule: 'valid-api-keys'
          });
        }
      } catch (error) {
        findings.push({
          id: 'fred-api-validation-error',
          type: 'error',
          severity: 'medium',
          category: 'external-services',
          title: 'FRED API Validation Failed',
          description: `Failed to validate FRED API key: ${error}`,
          rule: 'api-key-validation'
        });
      }
    }

    // Validate Twelve Data API key
    if (process.env.TWELVE_DATA_API_KEY) {
      try {
        if (process.env.TWELVE_DATA_API_KEY.length < 16) {
          findings.push({
            id: 'invalid-twelve-data-api-key-format',
            type: 'warning',
            severity: 'high',
            category: 'external-services',
            title: 'Twelve Data API Key Format Invalid',
            description: 'Twelve Data API key appears to be invalid format. Market data pipeline may fail.',
            rule: 'valid-api-keys'
          });
        }
      } catch (error) {
        findings.push({
          id: 'twelve-data-api-validation-error',
          type: 'error',
          severity: 'medium',
          category: 'external-services',
          title: 'Twelve Data API Validation Failed',
          description: `Failed to validate Twelve Data API key: ${error}`,
          rule: 'api-key-validation'
        });
      }
    }

    return findings;
  }

  private async validateDatabaseSchema(): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      // Check if schema files exist
      const schemaPath = path.join(process.cwd(), 'shared', 'schema.ts');
      if (fs.existsSync(schemaPath)) {
        const schemaContent = fs.readFileSync(schemaPath, 'utf-8');
        
        // Check for critical financial data tables
        const criticalTables = [
          'users',
          'stockData',
          'technicalIndicators',
          'economicIndicatorsCurrent',
          'econSeriesDef',
          'econSeriesObservation'
        ];

        for (const table of criticalTables) {
          if (!schemaContent.includes(table)) {
            findings.push({
              id: `missing-table-definition-${table}`,
              type: 'warning',
              severity: 'medium',
              category: 'database',
              title: `Missing Table Definition: ${table}`,
              description: `Critical table ${table} not found in schema definition.`,
              rule: 'critical-tables-required'
            });
          }
        }

      } else {
        findings.push({
          id: 'missing-database-schema',
          type: 'error',
          severity: 'high',
          category: 'database',
          title: 'Missing Database Schema',
          description: 'No database schema file found. Database operations may fail.',
          rule: 'database-schema-required'
        });
      }

    } catch (error) {
      findings.push({
        id: 'database-validation-error',
        type: 'error',
        severity: 'medium',
        category: 'database',
        title: 'Database Validation Failed',
        description: `Failed to validate database schema: ${error}`,
        rule: 'database-validation'
      });
    }

    return findings;
  }

  private async validateBundleSize(): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        
        // Check for large dependencies that might impact bundle size
        const largeDependencies = [
          'lodash', '@tensorflow/tfjs', 'moment', 'rxjs'
        ];

        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        for (const dep of largeDependencies) {
          if (dependencies[dep]) {
            findings.push({
              id: `large-dependency-${dep}`,
              type: 'info',
              severity: 'low',
              category: 'performance',
              title: `Large Dependency Detected: ${dep}`,
              description: `${dep} is a large dependency that may impact bundle size. Consider alternatives if possible.`,
              rule: 'bundle-size-optimization'
            });
          }
        }

        // Check dependency count
        const depCount = Object.keys(dependencies).length;
        if (depCount > 100) {
          findings.push({
            id: 'high-dependency-count',
            type: 'warning',
            severity: 'low',
            category: 'performance',
            title: 'High Dependency Count',
            description: `${depCount} dependencies detected. Consider auditing for unused dependencies.`,
            rule: 'dependency-audit'
          });
        }
      }

    } catch (error) {
      findings.push({
        id: 'bundle-validation-error',
        type: 'error',
        severity: 'low',
        category: 'performance',
        title: 'Bundle Validation Failed',
        description: `Failed to validate bundle size: ${error}`,
        rule: 'bundle-validation'
      });
    }

    return findings;
  }
}