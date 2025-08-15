// Environment parity validator - ensures dev/staging/prod consistency

import { Finding, AgentConfig } from '../../../types/agent-interfaces.js';
import * as fs from 'fs';
import * as path from 'path';

interface EnvironmentParity {
  development: EnvironmentConfig;
  staging: EnvironmentConfig;
  production: EnvironmentConfig;
  discrepancies: EnvironmentDiscrepancy[];
}

interface EnvironmentConfig {
  nodeVersion: string;
  dependencies: Record<string, string>;
  environmentVariables: string[];
  buildConfiguration: Record<string, any>;
  databaseConfiguration: DatabaseConfig;
  serviceConfiguration: ServiceConfig;
}

interface DatabaseConfig {
  provider: string;
  connectionPoolSize?: number;
  ssl: boolean;
  migrations: boolean;
}

interface ServiceConfig {
  port: number;
  cors: boolean;
  logging: string;
  monitoring: boolean;
}

interface EnvironmentDiscrepancy {
  type: 'version' | 'dependency' | 'config' | 'environment';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  environments: string[];
  impact: string;
}

export class EnvironmentParityValidator {
  async validate(config: AgentConfig): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Validate Node.js version consistency
    findings.push(...await this.validateNodeVersions());
    
    // Check package.json consistency
    findings.push(...await this.validateDependencyVersions());
    
    // Validate environment variable parity
    findings.push(...await this.validateEnvironmentVariables());
    
    // Check build configuration consistency
    findings.push(...await this.validateBuildConfiguration());
    
    // Validate deployment configuration
    findings.push(...await this.validateDeploymentConfiguration());

    return findings;
  }

  private async validateNodeVersions(): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      // Check .nvmrc file for Node.js version specification
      const nvmrcPath = path.join(process.cwd(), '.nvmrc');
      if (fs.existsSync(nvmrcPath)) {
        const specifiedVersion = fs.readFileSync(nvmrcPath, 'utf-8').trim();
        const currentVersion = process.version;

        if (!this.isCompatibleNodeVersion(specifiedVersion, currentVersion)) {
          findings.push({
            id: 'node-version-mismatch',
            type: 'warning',
            severity: 'high',
            category: 'environment-parity',
            title: 'Node.js Version Mismatch',
            description: `Current Node.js version ${currentVersion} doesn't match specified version ${specifiedVersion}`,
            rule: 'node-version-consistency',
            fix: {
              type: 'update',
              description: `Update Node.js to ${specifiedVersion} or update .nvmrc`,
              automated: false,
              confidence: 80
            }
          });
        }
      } else {
        findings.push({
          id: 'missing-nvmrc',
          type: 'warning',
          severity: 'medium',
          category: 'environment-parity',
          title: 'Missing .nvmrc File',
          description: 'No .nvmrc file found. Node.js version not locked for consistent deployments.',
          rule: 'node-version-locked'
        });
      }

      // Check package.json engines field
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        
        if (!packageJson.engines?.node) {
          findings.push({
            id: 'missing-node-engine-spec',
            type: 'warning',
            severity: 'medium',
            category: 'environment-parity',
            title: 'Missing Node.js Engine Specification',
            description: 'No Node.js version specified in package.json engines field',
            rule: 'engine-version-specified'
          });
        }
      }

    } catch (error) {
      findings.push({
        id: 'node-version-validation-error',
        type: 'error',
        severity: 'medium',
        category: 'environment-parity',
        title: 'Node Version Validation Failed',
        description: `Failed to validate Node.js versions: ${error}`,
        rule: 'node-version-validation'
      });
    }

    return findings;
  }

  private async validateDependencyVersions(): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageLockPath = path.join(process.cwd(), 'package-lock.json');

      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

        // Check for version ranges that might cause inconsistencies
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        
        for (const [name, version] of Object.entries(dependencies) as [string, string][]) {
          if (this.hasFlexibleVersionRange(version)) {
            findings.push({
              id: `flexible-version-${name}`,
              type: 'warning',
              severity: 'low',
              category: 'environment-parity',
              title: `Flexible Version Range: ${name}`,
              description: `Dependency ${name} uses flexible version range "${version}" which may cause inconsistencies`,
              rule: 'locked-dependency-versions'
            });
          }
        }

        // Check for critical dependencies that should be locked
        const criticalDependencies = [
          '@neondatabase/serverless',
          'drizzle-orm',
          'express',
          'tsx',
          'typescript'
        ];

        for (const dep of criticalDependencies) {
          if (dependencies[dep] && this.hasFlexibleVersionRange(dependencies[dep])) {
            findings.push({
              id: `critical-dep-flexible-${dep}`,
              type: 'warning',
              severity: 'medium',
              category: 'environment-parity',
              title: `Critical Dependency Not Locked: ${dep}`,
              description: `Critical dependency ${dep} should use exact version for production stability`,
              rule: 'critical-deps-locked'
            });
          }
        }

        // Check if package-lock.json exists
        if (!fs.existsSync(packageLockPath)) {
          findings.push({
            id: 'missing-package-lock',
            type: 'error',
            severity: 'high',
            category: 'environment-parity',
            title: 'Missing package-lock.json',
            description: 'No package-lock.json found. Dependency versions not locked for consistent deployments.',
            rule: 'package-lock-required'
          });
        }

        // Check for peer dependency warnings
        if (packageJson.peerDependencies) {
          findings.push({
            id: 'peer-dependencies-detected',
            type: 'info',
            severity: 'low',
            category: 'environment-parity',
            title: 'Peer Dependencies Detected',
            description: 'Peer dependencies found. Ensure they are installed in all environments.',
            rule: 'peer-deps-consistency'
          });
        }

      }

    } catch (error) {
      findings.push({
        id: 'dependency-validation-error',
        type: 'error',
        severity: 'medium',
        category: 'environment-parity',
        title: 'Dependency Validation Failed',
        description: `Failed to validate dependencies: ${error}`,
        rule: 'dependency-validation'
      });
    }

    return findings;
  }

  private async validateEnvironmentVariables(): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      // Check for .env files and their consistency
      const envFiles = ['.env', '.env.example', '.env.local', '.env.production'];
      const foundEnvFiles: string[] = [];

      for (const envFile of envFiles) {
        if (fs.existsSync(envFile)) {
          foundEnvFiles.push(envFile);
        }
      }

      if (foundEnvFiles.length === 0) {
        findings.push({
          id: 'no-env-files',
          type: 'warning',
          severity: 'medium',
          category: 'environment-parity',
          title: 'No Environment Files Found',
          description: 'No .env files found. Environment variables not documented.',
          rule: 'env-files-present'
        });
        return findings;
      }

      // Parse environment files and check consistency
      const envConfigs: Record<string, Set<string>> = {};
      
      for (const envFile of foundEnvFiles) {
        try {
          const content = fs.readFileSync(envFile, 'utf-8');
          const variables = this.parseEnvFile(content);
          envConfigs[envFile] = new Set(variables);
        } catch (error) {
          findings.push({
            id: `env-file-parse-error-${envFile}`,
            type: 'error',
            severity: 'medium',
            category: 'environment-parity',
            title: `Failed to Parse ${envFile}`,
            description: `Cannot parse environment file ${envFile}: ${error}`,
            rule: 'env-file-parseable'
          });
        }
      }

      // Check for .env.example consistency
      if (envConfigs['.env.example'] && envConfigs['.env']) {
        const example = envConfigs['.env.example'];
        const actual = envConfigs['.env'];

        // Variables in .env but not in .env.example
        const undocumented = [...actual].filter(v => !example.has(v));
        if (undocumented.length > 0) {
          findings.push({
            id: 'undocumented-env-vars',
            type: 'warning',
            severity: 'medium',
            category: 'environment-parity',
            title: 'Undocumented Environment Variables',
            description: `Variables in .env but not in .env.example: ${undocumented.join(', ')}`,
            rule: 'env-vars-documented'
          });
        }

        // Variables in .env.example but not in .env
        const missing = [...example].filter(v => !actual.has(v));
        if (missing.length > 0) {
          findings.push({
            id: 'missing-env-vars',
            type: 'warning',
            severity: 'high',
            category: 'environment-parity',
            title: 'Missing Environment Variables',
            description: `Variables documented in .env.example but missing from .env: ${missing.join(', ')}`,
            rule: 'env-vars-complete'
          });
        }
      }

      // Check for sensitive data in .env files
      for (const envFile of foundEnvFiles) {
        if (envFile !== '.env.example') {
          try {
            const content = fs.readFileSync(envFile, 'utf-8');
            if (this.containsSensitiveData(content)) {
              findings.push({
                id: `sensitive-data-in-${envFile}`,
                type: 'warning',
                severity: 'high',
                category: 'environment-parity',
                title: `Potential Sensitive Data in ${envFile}`,
                description: `File ${envFile} may contain sensitive data. Ensure it's not committed to version control.`,
                rule: 'no-sensitive-data-committed'
              });
            }
          } catch (error) {
            // Skip files that can't be read
          }
        }
      }

    } catch (error) {
      findings.push({
        id: 'env-validation-error',
        type: 'error',
        severity: 'medium',
        category: 'environment-parity',
        title: 'Environment Variable Validation Failed',
        description: `Failed to validate environment variables: ${error}`,
        rule: 'env-validation'
      });
    }

    return findings;
  }

  private async validateBuildConfiguration(): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      // Check for consistent build configuration across environments
      const configFiles = [
        'vite.config.ts',
        'tsconfig.json',
        'tailwind.config.ts',
        'drizzle.config.ts',
        'eslint.config.js',
        '.eslintrc.js'
      ];

      const missingConfigs: string[] = [];
      
      for (const configFile of configFiles) {
        if (!fs.existsSync(configFile)) {
          missingConfigs.push(configFile);
        }
      }

      if (missingConfigs.length > 0) {
        findings.push({
          id: 'missing-config-files',
          type: 'warning',
          severity: 'medium',
          category: 'environment-parity',
          title: 'Missing Configuration Files',
          description: `Missing configuration files: ${missingConfigs.join(', ')}`,
          rule: 'config-files-present'
        });
      }

      // Check TypeScript configuration
      const tsconfigPath = path.join(process.cwd(), 'tsconfig.json');
      if (fs.existsSync(tsconfigPath)) {
        const tsconfig = JSON.parse(fs.readFileSync(tsconfigPath, 'utf-8'));
        
        // Check for production-appropriate settings
        if (tsconfig.compilerOptions?.sourceMap !== false) {
          findings.push({
            id: 'source-maps-enabled',
            type: 'info',
            severity: 'low',
            category: 'environment-parity',
            title: 'Source Maps Enabled',
            description: 'Source maps are enabled. Consider disabling for production builds.',
            rule: 'production-build-optimization'
          });
        }

        if (!tsconfig.compilerOptions?.strict) {
          findings.push({
            id: 'typescript-not-strict',
            type: 'warning',
            severity: 'medium',
            category: 'environment-parity',
            title: 'TypeScript Strict Mode Disabled',
            description: 'TypeScript strict mode is disabled. Enable for better type safety.',
            rule: 'typescript-strict-mode'
          });
        }
      }

    } catch (error) {
      findings.push({
        id: 'build-config-validation-error',
        type: 'error',
        severity: 'medium',
        category: 'environment-parity',
        title: 'Build Configuration Validation Failed',
        description: `Failed to validate build configuration: ${error}`,
        rule: 'build-config-validation'
      });
    }

    return findings;
  }

  private async validateDeploymentConfiguration(): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      // Check for deployment configuration files
      const deploymentFiles = [
        'Dockerfile',
        'docker-compose.yml',
        '.dockerignore',
        'ecosystem.config.js', // PM2 config
        'replit.toml',
        '.replit'
      ];

      const foundDeploymentFiles: string[] = [];
      
      for (const file of deploymentFiles) {
        if (fs.existsSync(file)) {
          foundDeploymentFiles.push(file);
        }
      }

      if (foundDeploymentFiles.length === 0) {
        findings.push({
          id: 'no-deployment-config',
          type: 'warning',
          severity: 'medium',
          category: 'environment-parity',
          title: 'No Deployment Configuration Found',
          description: 'No deployment configuration files found (Dockerfile, docker-compose.yml, etc.)',
          rule: 'deployment-config-present'
        });
      }

      // Validate Dockerfile if present
      if (fs.existsSync('Dockerfile')) {
        const dockerfile = fs.readFileSync('Dockerfile', 'utf-8');
        
        if (!dockerfile.includes('NODE_ENV')) {
          findings.push({
            id: 'dockerfile-missing-node-env',
            type: 'warning',
            severity: 'medium',
            category: 'environment-parity',
            title: 'Dockerfile Missing NODE_ENV',
            description: 'Dockerfile should set NODE_ENV for proper environment configuration',
            rule: 'dockerfile-node-env'
          });
        }

        if (!dockerfile.includes('USER ') || dockerfile.includes('USER root')) {
          findings.push({
            id: 'dockerfile-runs-as-root',
            type: 'warning',
            severity: 'high',
            category: 'environment-parity',
            title: 'Dockerfile Runs as Root',
            description: 'Container should not run as root user for security reasons',
            rule: 'docker-non-root-user'
          });
        }
      }

      // Check for .dockerignore
      if (fs.existsSync('Dockerfile') && !fs.existsSync('.dockerignore')) {
        findings.push({
          id: 'missing-dockerignore',
          type: 'warning',
          severity: 'low',
          category: 'environment-parity',
          title: 'Missing .dockerignore',
          description: 'No .dockerignore file found. Build context may include unnecessary files.',
          rule: 'dockerignore-present'
        });
      }

    } catch (error) {
      findings.push({
        id: 'deployment-config-validation-error',
        type: 'error',
        severity: 'medium',
        category: 'environment-parity',
        title: 'Deployment Configuration Validation Failed',
        description: `Failed to validate deployment configuration: ${error}`,
        rule: 'deployment-config-validation'
      });
    }

    return findings;
  }

  private isCompatibleNodeVersion(specified: string, current: string): boolean {
    // Remove 'v' prefix if present
    const cleanSpecified = specified.replace(/^v/, '');
    const cleanCurrent = current.replace(/^v/, '');

    // Simple major.minor comparison
    const [specMajor, specMinor] = cleanSpecified.split('.').map(Number);
    const [currMajor, currMinor] = cleanCurrent.split('.').map(Number);

    return specMajor === currMajor && specMinor === currMinor;
  }

  private hasFlexibleVersionRange(version: string): boolean {
    // Check for version ranges that could cause inconsistencies
    return version.includes('^') || version.includes('~') || version.includes('>=') || 
           version.includes('>') || version.includes('*') || version === 'latest';
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

  private containsSensitiveData(content: string): boolean {
    const sensitivePatterns = [
      /api[_-]?key\s*=\s*[a-zA-Z0-9]{20,}/i,
      /secret\s*=\s*[a-zA-Z0-9]{20,}/i,
      /password\s*=\s*[^\n\r]{8,}/i,
      /token\s*=\s*[a-zA-Z0-9]{20,}/i,
      /private[_-]?key\s*=\s*[^\n\r]{20,}/i
    ];

    return sensitivePatterns.some(pattern => pattern.test(content));
  }
}