// Breaking change detector - identifies potential breaking changes

import { Finding } from '../../../types/agent-interfaces.js';
import * as fs from 'fs';
import * as path from 'path';

interface BreakingChange {
  type: 'api' | 'database' | 'interface' | 'dependency' | 'environment';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  impact: string;
  mitigation: string;
}

export class BreakingChangeDetector {
  async detect(files: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Detect API breaking changes
    findings.push(...await this.detectApiBreakingChanges(files));
    
    // Detect database schema breaking changes
    findings.push(...await this.detectDatabaseBreakingChanges(files));
    
    // Detect interface breaking changes
    findings.push(...await this.detectInterfaceBreakingChanges(files));
    
    // Detect dependency breaking changes
    findings.push(...await this.detectDependencyBreakingChanges(files));
    
    // Detect environment breaking changes
    findings.push(...await this.detectEnvironmentBreakingChanges(files));

    return findings;
  }

  private async detectApiBreakingChanges(files: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    const routeFiles = files.filter(f => 
      f.includes('routes/') || f.includes('controllers/') || f.includes('api/')
    );

    for (const routeFile of routeFiles) {
      try {
        if (!fs.existsSync(routeFile)) {
          continue;
        }

        const content = fs.readFileSync(routeFile, 'utf-8');
        
        // Check for removed endpoints (commented out routes)
        const commentedRoutes = content.match(/\/\/.*router\.(get|post|put|patch|delete)/g);
        if (commentedRoutes && commentedRoutes.length > 0) {
          findings.push({
            id: `api-endpoints-removed-${path.basename(routeFile)}`,
            type: 'error',
            severity: 'critical',
            category: 'breaking-changes',
            title: 'API Endpoints Appear to be Removed',
            description: `${commentedRoutes.length} API endpoints appear to be commented out/removed`,
            file: routeFile,
            rule: 'no-endpoint-removal',
            fix: {
              type: 'review',
              description: 'Implement API versioning or deprecation strategy before removing endpoints',
              automated: false,
              confidence: 80
            }
          });
        }

        // Check for parameter requirement changes
        if (content.includes('req.body') || content.includes('req.params')) {
          // Look for new required parameters
          const requiredPattern = /req\.(body|params|query)\.(\w+)/g;
          const requiredFields = [...content.matchAll(requiredPattern)];
          
          if (requiredFields.length > 0) {
            // Check if there's validation for these fields
            const hasValidation = content.includes('validate') || content.includes('required');
            
            if (hasValidation && !content.includes('optional')) {
              findings.push({
                id: `new-required-parameters-${path.basename(routeFile)}`,
                type: 'warning',
                severity: 'high',
                category: 'breaking-changes',
                title: 'New Required Parameters Detected',
                description: 'Adding required parameters is a breaking change for API consumers',
                file: routeFile,
                rule: 'backward-compatible-parameters'
              });
            }
          }
        }

        // Check for response format changes
        const responsePatterns = [
          /res\.json\s*\(\s*{[^}]*error[^}]*}/g,  // Error response format
          /res\.status\s*\(\s*\d+\s*\)/g,        // Status code changes
          /throw\s+new\s+Error/g                  // New error throwing
        ];

        for (const pattern of responsePatterns) {
          const matches = content.match(pattern);
          if (matches && matches.length > 2) {
            findings.push({
              id: `response-format-changes-${path.basename(routeFile)}`,
              type: 'warning',
              severity: 'medium',
              category: 'breaking-changes',
              title: 'Response Format Changes Detected',
              description: 'Changes to response format may break API consumers',
              file: routeFile,
              rule: 'stable-response-format'
            });
          }
        }

      } catch (error) {
        // Skip files that can't be read
      }
    }

    return findings;
  }

  private async detectDatabaseBreakingChanges(files: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    const migrationFiles = files.filter(f => 
      f.includes('migrations/') || f.includes('migrate/') || f.endsWith('.sql')
    );

    for (const migrationFile of migrationFiles) {
      try {
        if (!fs.existsSync(migrationFile)) {
          continue;
        }

        const content = fs.readFileSync(migrationFile, 'utf-8');
        const upperContent = content.toUpperCase();

        // Critical breaking changes
        const criticalOperations = [
          { op: 'DROP TABLE', impact: 'Data loss, application failure' },
          { op: 'DROP COLUMN', impact: 'Data loss, query failures' },
          { op: 'TRUNCATE', impact: 'Complete data loss' }
        ];

        for (const { op, impact } of criticalOperations) {
          if (upperContent.includes(op)) {
            findings.push({
              id: `critical-db-breaking-change-${op.toLowerCase().replace(/\s+/g, '-')}-${path.basename(migrationFile)}`,
              type: 'error',
              severity: 'critical',
              category: 'breaking-changes',
              title: `Critical Database Breaking Change: ${op}`,
              description: `${op} operation will cause: ${impact}`,
              file: migrationFile,
              rule: 'no-destructive-migrations',
              fix: {
                type: 'review',
                description: 'Create backup, test migration, prepare rollback plan',
                automated: false,
                confidence: 95
              }
            });
          }
        }

        // Column type changes that could break applications
        if (upperContent.includes('ALTER COLUMN') && upperContent.includes('TYPE')) {
          findings.push({
            id: `column-type-change-${path.basename(migrationFile)}`,
            type: 'warning',
            severity: 'high',
            category: 'breaking-changes',
            title: 'Column Type Change Detected',
            description: 'Changing column types can break application code and cause data conversion issues',
            file: migrationFile,
            rule: 'safe-column-changes'
          });
        }

        // Index removal that could affect performance
        if (upperContent.includes('DROP INDEX')) {
          findings.push({
            id: `index-removal-${path.basename(migrationFile)}`,
            type: 'warning',
            severity: 'medium',
            category: 'breaking-changes',
            title: 'Database Index Removal',
            description: 'Removing indexes can severely impact query performance',
            file: migrationFile,
            rule: 'preserve-performance-indexes'
          });
        }

      } catch (error) {
        // Skip files that can't be read
      }
    }

    // Check schema changes
    const schemaFiles = files.filter(f => f.includes('schema'));
    for (const schemaFile of schemaFiles) {
      try {
        if (!fs.existsSync(schemaFile)) {
          continue;
        }

        const content = fs.readFileSync(schemaFile, 'utf-8');
        
        // Check for removed table definitions
        const commentedTables = content.match(/\/\/.*export.*=.*table/g);
        if (commentedTables && commentedTables.length > 0) {
          findings.push({
            id: `schema-tables-removed-${path.basename(schemaFile)}`,
            type: 'error',
            severity: 'critical',
            category: 'breaking-changes',
            title: 'Database Tables Removed from Schema',
            description: 'Removing table definitions will break database operations',
            file: schemaFile,
            rule: 'preserve-table-definitions'
          });
        }

      } catch (error) {
        // Skip files that can't be read
      }
    }

    return findings;
  }

  private async detectInterfaceBreakingChanges(files: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    const typeFiles = files.filter(f => 
      f.endsWith('.ts') && (f.includes('types/') || f.includes('interfaces/') || f.includes('shared/'))
    );

    for (const typeFile of typeFiles) {
      try {
        if (!fs.existsSync(typeFile)) {
          continue;
        }

        const content = fs.readFileSync(typeFile, 'utf-8');

        // Check for removed interface properties
        const commentedProperties = content.match(/\/\/.*\w+\s*:\s*\w+/g);
        if (commentedProperties && commentedProperties.length > 0) {
          findings.push({
            id: `interface-properties-removed-${path.basename(typeFile)}`,
            type: 'warning',
            severity: 'high',
            category: 'breaking-changes',
            title: 'Interface Properties Appear to be Removed',
            description: 'Removing interface properties can break TypeScript compilation',
            file: typeFile,
            rule: 'preserve-interface-compatibility'
          });
        }

        // Check for type changes that could break consumers
        const typeChanges = [
          /\w+\s*:\s*string.*number/g,  // string to number
          /\w+\s*:\s*number.*string/g,  // number to string
          /\w+\s*\?\s*:\s*\w+.*\w+\s*:\s*\w+/g  // optional to required
        ];

        for (const pattern of typeChanges) {
          if (pattern.test(content)) {
            findings.push({
              id: `interface-type-changes-${path.basename(typeFile)}`,
              type: 'warning',
              severity: 'medium',
              category: 'breaking-changes',
              title: 'Interface Type Changes Detected',
              description: 'Type changes can break consumers of these interfaces',
              file: typeFile,
              rule: 'stable-interface-types'
            });
          }
        }

        // Check for removed exported interfaces/types
        const commentedExports = content.match(/\/\/.*export.*interface|\/\/.*export.*type/g);
        if (commentedExports && commentedExports.length > 0) {
          findings.push({
            id: `exported-types-removed-${path.basename(typeFile)}`,
            type: 'error',
            severity: 'high',
            category: 'breaking-changes',
            title: 'Exported Types/Interfaces Removed',
            description: 'Removing exported types will break modules that import them',
            file: typeFile,
            rule: 'preserve-exported-types'
          });
        }

      } catch (error) {
        // Skip files that can't be read
      }
    }

    return findings;
  }

  private async detectDependencyBreakingChanges(files: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    const packageFiles = files.filter(f => f.includes('package.json'));
    
    for (const packageFile of packageFiles) {
      try {
        if (!fs.existsSync(packageFile)) {
          continue;
        }

        const packageJson = JSON.parse(fs.readFileSync(packageFile, 'utf-8'));
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

        // Check for major version updates
        for (const [name, version] of Object.entries(dependencies) as [string, string][]) {
          if (this.isMajorVersionUpdate(version)) {
            const severity = this.getCriticalDependencySeverity(name);
            
            findings.push({
              id: `major-version-update-${name}`,
              type: 'warning',
              severity,
              category: 'breaking-changes',
              title: `Major Version Update: ${name}`,
              description: `Dependency ${name} has major version update which may contain breaking changes`,
              file: packageFile,
              rule: 'careful-major-updates'
            });
          }
        }

        // Check for removed dependencies
        // This would require comparing with previous version - simplified check
        const criticalDependencies = [
          '@neondatabase/serverless',
          'drizzle-orm',
          'express',
          'react'
        ];

        for (const criticalDep of criticalDependencies) {
          if (!dependencies[criticalDep]) {
            findings.push({
              id: `critical-dependency-missing-${criticalDep}`,
              type: 'error',
              severity: 'critical',
              category: 'breaking-changes',
              title: `Critical Dependency Missing: ${criticalDep}`,
              description: `Critical dependency ${criticalDep} is missing from package.json`,
              file: packageFile,
              rule: 'preserve-critical-dependencies'
            });
          }
        }

      } catch (error) {
        findings.push({
          id: `package-analysis-error-${path.basename(packageFile)}`,
          type: 'error',
          severity: 'medium',
          category: 'breaking-changes',
          title: 'Package Analysis Failed',
          description: `Failed to analyze package.json: ${error}`,
          file: packageFile,
          rule: 'package-analysis'
        });
      }
    }

    return findings;
  }

  private async detectEnvironmentBreakingChanges(files: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      // Check for new required environment variables
      const envExamplePath = '.env.example';
      const envPath = '.env';

      if (fs.existsSync(envExamplePath)) {
        const envExampleContent = fs.readFileSync(envExamplePath, 'utf-8');
        const envVariables = this.parseEnvFile(envExampleContent);

        // Check for critical environment variables
        const criticalEnvVars = [
          'DATABASE_URL',
          'FRED_API_KEY', 
          'TWELVE_DATA_API_KEY',
          'NODE_ENV'
        ];

        for (const envVar of criticalEnvVars) {
          if (envVariables.includes(envVar) && !process.env[envVar]) {
            findings.push({
              id: `missing-critical-env-var-${envVar.toLowerCase()}`,
              type: 'error',
              severity: 'critical',
              category: 'breaking-changes',
              title: `Missing Critical Environment Variable: ${envVar}`,
              description: `Critical environment variable ${envVar} is required but not set`,
              rule: 'required-env-vars'
            });
          }
        }

        // Check for new environment variables that weren't there before
        // This would require git diff - simplified approach
        if (envVariables.length > 10) {
          findings.push({
            id: 'many-env-vars-required',
            type: 'warning',
            severity: 'medium',
            category: 'breaking-changes',
            title: 'Many Environment Variables Required',
            description: `${envVariables.length} environment variables required. Ensure deployment environments are updated.`,
            rule: 'env-var-documentation'
          });
        }
      }

      // Check for Node.js version requirements
      const packageJsonPath = 'package.json';
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        
        if (packageJson.engines?.node) {
          const requiredNode = packageJson.engines.node;
          const currentNode = process.version;
          
          if (!this.isNodeVersionCompatible(requiredNode, currentNode)) {
            findings.push({
              id: 'node-version-incompatible',
              type: 'error',
              severity: 'high',
              category: 'breaking-changes',
              title: 'Node.js Version Incompatibility',
              description: `Required Node.js ${requiredNode} but current version is ${currentNode}`,
              rule: 'node-version-compatibility'
            });
          }
        }
      }

    } catch (error) {
      findings.push({
        id: 'environment-analysis-error',
        type: 'error',
        severity: 'medium',
        category: 'breaking-changes',
        title: 'Environment Analysis Failed',
        description: `Failed to analyze environment changes: ${error}`,
        rule: 'environment-analysis'
      });
    }

    return findings;
  }

  private isMajorVersionUpdate(version: string): boolean {
    // Check if version string indicates a major update
    // This is simplified - would need to compare with previous version
    return version.includes('^') && !version.includes('0.');
  }

  private getCriticalDependencySeverity(dependencyName: string): 'critical' | 'high' | 'medium' | 'low' {
    const criticalDeps = ['express', 'react', 'drizzle-orm', '@neondatabase/serverless'];
    const highDeps = ['typescript', 'vite', 'tsx'];
    
    if (criticalDeps.includes(dependencyName)) return 'critical';
    if (highDeps.includes(dependencyName)) return 'high';
    return 'medium';
  }

  private parseEnvFile(content: string): string[] {
    const variables: string[] = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const equalIndex = trimmed.indexOf('=');
        if (equalIndex > 0) {
          const varName = trimmed.substring(0, equalIndex).trim();
          variables.push(varName);
        }
      }
    }

    return variables;
  }

  private isNodeVersionCompatible(required: string, current: string): boolean {
    // Simplified version check
    const requiredMajor = parseInt(required.replace(/[^\d]/g, ''));
    const currentMajor = parseInt(current.replace(/[^\d]/g, ''));
    
    return currentMajor >= requiredMajor;
  }
}