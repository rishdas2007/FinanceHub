// Dependency validator - analyzes package changes and security vulnerabilities

import { Finding } from '../../../types/agent-interfaces.js';
import * as fs from 'fs';
import * as path from 'path';

interface DependencyAnalysis {
  newDependencies: string[];
  removedDependencies: string[];
  updatedDependencies: Array<{
    name: string;
    oldVersion: string;
    newVersion: string;
    changeType: 'major' | 'minor' | 'patch';
  }>;
  vulnerabilities: SecurityVulnerability[];
  licenseIssues: LicenseIssue[];
  sizeImpact: {
    added: number;
    removed: number;
    net: number;
  };
}

interface SecurityVulnerability {
  package: string;
  severity: 'critical' | 'high' | 'moderate' | 'low';
  title: string;
  description: string;
  affectedVersions: string;
  patchedVersions?: string;
}

interface LicenseIssue {
  package: string;
  license: string;
  compatibility: 'compatible' | 'incompatible' | 'unknown';
  risk: 'low' | 'medium' | 'high';
}

export class DependencyValidator {
  private readonly criticalPackages = [
    '@neondatabase/serverless',
    'drizzle-orm',
    'express',
    'react',
    'typescript',
    'tsx',
    'vite'
  ];

  private readonly problematicLicenses = [
    'GPL-3.0',
    'AGPL-3.0',
    'CPAL-1.0',
    'OSL-3.0'
  ];

  async validate(files: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Find package.json changes
    const packageJsonFiles = files.filter(f => f.includes('package.json'));
    
    if (packageJsonFiles.length === 0) {
      return findings; // No package changes
    }

    console.log(`📦 Analyzing ${packageJsonFiles.length} package.json files`);

    for (const packageFile of packageJsonFiles) {
      findings.push(...await this.analyzePackageChanges(packageFile));
    }

    // Analyze package-lock.json if present
    const packageLockFiles = files.filter(f => f.includes('package-lock.json'));
    for (const lockFile of packageLockFiles) {
      findings.push(...await this.analyzePackageLock(lockFile));
    }

    return findings;
  }

  private async analyzePackageChanges(packagePath: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      if (!fs.existsSync(packagePath)) {
        return findings;
      }

      const packageJson = JSON.parse(fs.readFileSync(packagePath, 'utf-8'));
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

      // Check for critical package changes
      findings.push(...this.validateCriticalPackages(dependencies, packagePath));

      // Check for security vulnerabilities
      findings.push(...await this.checkSecurityVulnerabilities(dependencies, packagePath));

      // Check for license issues
      findings.push(...this.checkLicenseCompatibility(dependencies, packagePath));

      // Validate version constraints
      findings.push(...this.validateVersionConstraints(dependencies, packagePath));

      // Check for deprecated packages
      findings.push(...this.checkDeprecatedPackages(dependencies, packagePath));

      // Analyze bundle size impact
      findings.push(...this.analyzeBundleSizeImpact(dependencies, packagePath));

    } catch (error) {
      findings.push({
        id: `package-analysis-error-${path.basename(packagePath)}`,
        type: 'error',
        severity: 'medium',
        category: 'dependencies',
        title: 'Package Analysis Failed',
        description: `Failed to analyze ${packagePath}: ${error}`,
        file: packagePath,
        rule: 'package-analysis'
      });
    }

    return findings;
  }

  private validateCriticalPackages(dependencies: Record<string, string>, packagePath: string): Finding[] {
    const findings: Finding[] = [];

    for (const criticalPackage of this.criticalPackages) {
      if (dependencies[criticalPackage]) {
        const version = dependencies[criticalPackage];

        // Check for flexible version ranges on critical packages
        if (this.hasFlexibleVersionRange(version)) {
          findings.push({
            id: `critical-package-flexible-version-${criticalPackage}`,
            type: 'warning',
            severity: 'medium',
            category: 'dependencies',
            title: `Critical Package Uses Flexible Version: ${criticalPackage}`,
            description: `Critical package ${criticalPackage} uses flexible version "${version}". Consider locking to exact version for stability.`,
            file: packagePath,
            rule: 'critical-packages-locked',
            fix: {
              type: 'replace',
              description: `Lock ${criticalPackage} to exact version`,
              automated: false,
              confidence: 80
            }
          });
        }

        // Check for very old versions
        if (this.isVeryOldVersion(criticalPackage, version)) {
          findings.push({
            id: `critical-package-old-version-${criticalPackage}`,
            type: 'warning',
            severity: 'high',
            category: 'dependencies',
            title: `Critical Package Outdated: ${criticalPackage}`,
            description: `Critical package ${criticalPackage}@${version} is significantly outdated. Consider updating for security and features.`,
            file: packagePath,
            rule: 'critical-packages-updated'
          });
        }
      }
    }

    return findings;
  }

  private async checkSecurityVulnerabilities(dependencies: Record<string, string>, packagePath: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Known vulnerable packages and versions (simplified check)
    const knownVulnerabilities = [
      { package: 'lodash', versions: ['<4.17.19'], severity: 'high' as const },
      { package: 'axios', versions: ['<0.21.1'], severity: 'moderate' as const },
      { package: 'express', versions: ['<4.17.1'], severity: 'high' as const },
      { package: 'moment', versions: ['*'], severity: 'low' as const, reason: 'deprecated' }
    ];

    for (const vuln of knownVulnerabilities) {
      if (dependencies[vuln.package]) {
        const version = dependencies[vuln.package];
        
        // Simple version check (in real implementation, use semver for proper comparison)
        if (vuln.versions.includes('*') || this.isVulnerableVersion(version, vuln.versions)) {
          findings.push({
            id: `vulnerability-${vuln.package}`,
            type: 'error',
            severity: vuln.severity === 'high' ? 'high' : vuln.severity === 'moderate' ? 'medium' : 'low',
            category: 'dependencies',
            title: `Security Vulnerability: ${vuln.package}`,
            description: `Package ${vuln.package}@${version} has known security vulnerability${vuln.reason ? ` (${vuln.reason})` : ''}`,
            file: packagePath,
            rule: 'no-vulnerable-dependencies',
            fix: {
              type: 'update',
              description: `Update ${vuln.package} to latest secure version`,
              automated: false,
              confidence: 90
            }
          });
        }
      }
    }

    return findings;
  }

  private checkLicenseCompatibility(dependencies: Record<string, string>, packagePath: string): Finding[] {
    const findings: Finding[] = [];

    // This would typically require reading package metadata
    // For now, check for commonly problematic packages
    const problematicPackages = [
      { name: 'gpl-licensed-package', license: 'GPL-3.0' },
      { name: 'agpl-package', license: 'AGPL-3.0' }
    ];

    for (const pkg of problematicPackages) {
      if (dependencies[pkg.name]) {
        findings.push({
          id: `license-issue-${pkg.name}`,
          type: 'warning',
          severity: 'medium',
          category: 'dependencies',
          title: `License Compatibility Issue: ${pkg.name}`,
          description: `Package ${pkg.name} uses ${pkg.license} license which may not be compatible with commercial projects`,
          file: packagePath,
          rule: 'license-compatibility'
        });
      }
    }

    return findings;
  }

  private validateVersionConstraints(dependencies: Record<string, string>, packagePath: string): Finding[] {
    const findings: Finding[] = [];

    for (const [name, version] of Object.entries(dependencies)) {
      // Check for overly permissive version ranges
      if (version.includes('*')) {
        findings.push({
          id: `wildcard-version-${name}`,
          type: 'warning',
          severity: 'medium',
          category: 'dependencies',
          title: `Wildcard Version Range: ${name}`,
          description: `Package ${name} uses wildcard version "${version}" which can cause unpredictable updates`,
          file: packagePath,
          rule: 'no-wildcard-versions'
        });
      }

      // Check for 'latest' tag
      if (version === 'latest') {
        findings.push({
          id: `latest-tag-${name}`,
          type: 'error',
          severity: 'high',
          category: 'dependencies',
          title: `Latest Tag Used: ${name}`,
          description: `Package ${name} uses "latest" tag which is non-deterministic and dangerous for production`,
          file: packagePath,
          rule: 'no-latest-tag'
        });
      }

      // Check for pre-release versions in production
      if (this.isPreReleaseVersion(version)) {
        findings.push({
          id: `prerelease-version-${name}`,
          type: 'warning',
          severity: 'medium',
          category: 'dependencies',
          title: `Pre-release Version: ${name}`,
          description: `Package ${name} uses pre-release version "${version}" which may be unstable`,
          file: packagePath,
          rule: 'no-prerelease-in-production'
        });
      }
    }

    return findings;
  }

  private checkDeprecatedPackages(dependencies: Record<string, string>, packagePath: string): Finding[] {
    const findings: Finding[] = [];

    // Known deprecated packages with alternatives
    const deprecatedPackages = [
      { name: 'moment', alternative: 'date-fns or dayjs' },
      { name: 'request', alternative: 'axios or node-fetch' },
      { name: 'babel-core', alternative: '@babel/core' },
      { name: 'tslint', alternative: 'eslint with @typescript-eslint' }
    ];

    for (const deprecated of deprecatedPackages) {
      if (dependencies[deprecated.name]) {
        findings.push({
          id: `deprecated-package-${deprecated.name}`,
          type: 'warning',
          severity: 'medium',
          category: 'dependencies',
          title: `Deprecated Package: ${deprecated.name}`,
          description: `Package ${deprecated.name} is deprecated. Consider migrating to ${deprecated.alternative}`,
          file: packagePath,
          rule: 'no-deprecated-packages',
          fix: {
            type: 'replace',
            description: `Replace ${deprecated.name} with ${deprecated.alternative}`,
            automated: false,
            confidence: 70
          }
        });
      }
    }

    return findings;
  }

  private analyzeBundleSizeImpact(dependencies: Record<string, string>, packagePath: string): Finding[] {
    const findings: Finding[] = [];

    // Known large packages that might impact bundle size
    const largePackages = [
      { name: 'lodash', size: '~70KB', alternative: 'lodash-es or individual functions' },
      { name: 'moment', size: '~230KB', alternative: 'date-fns (~20KB)' },
      { name: '@tensorflow/tfjs', size: '~400KB', alternative: 'consider lazy loading' },
      { name: 'rxjs', size: '~200KB', alternative: 'consider if all operators are needed' }
    ];

    for (const largePkg of largePackages) {
      if (dependencies[largePkg.name]) {
        findings.push({
          id: `large-package-${largePkg.name}`,
          type: 'info',
          severity: 'low',
          category: 'dependencies',
          title: `Large Package Detected: ${largePkg.name}`,
          description: `Package ${largePkg.name} (${largePkg.size}) may impact bundle size. ${largePkg.alternative}`,
          file: packagePath,
          rule: 'bundle-size-optimization'
        });
      }
    }

    // Check total dependency count
    const depCount = Object.keys(dependencies).length;
    if (depCount > 150) {
      findings.push({
        id: 'high-dependency-count',
        type: 'warning',
        severity: 'low',
        category: 'dependencies',
        title: 'High Dependency Count',
        description: `Project has ${depCount} dependencies. Consider auditing for unused packages to reduce complexity.`,
        file: packagePath,
        rule: 'dependency-count-audit'
      });
    }

    return findings;
  }

  private async analyzePackageLock(lockPath: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      if (!fs.existsSync(lockPath)) {
        return findings;
      }

      const lockContent = fs.readFileSync(lockPath, 'utf-8');
      
      // Check for package-lock.json version
      if (lockContent.includes('"lockfileVersion": 1')) {
        findings.push({
          id: 'old-package-lock-version',
          type: 'warning',
          severity: 'low',
          category: 'dependencies',
          title: 'Old package-lock.json Version',
          description: 'Using lockfileVersion 1. Consider updating to npm 7+ for better dependency resolution.',
          file: lockPath,
          rule: 'modern-package-lock'
        });
      }

      // Check for integrity issues (simplified)
      if (!lockContent.includes('integrity')) {
        findings.push({
          id: 'missing-package-integrity',
          type: 'warning',
          severity: 'medium',
          category: 'dependencies',
          title: 'Missing Package Integrity Checks',
          description: 'Package lock file missing integrity hashes. Regenerate with newer npm version.',
          file: lockPath,
          rule: 'package-integrity'
        });
      }

    } catch (error) {
      findings.push({
        id: 'package-lock-analysis-error',
        type: 'error',
        severity: 'low',
        category: 'dependencies',
        title: 'Package Lock Analysis Failed',
        description: `Failed to analyze package-lock.json: ${error}`,
        file: lockPath,
        rule: 'package-lock-analysis'
      });
    }

    return findings;
  }

  private hasFlexibleVersionRange(version: string): boolean {
    return version.includes('^') || version.includes('~') || version.includes('>=') || 
           version.includes('>') || version.includes('*') || version === 'latest';
  }

  private isVeryOldVersion(packageName: string, version: string): boolean {
    // Simplified check - in real implementation, would use registry API
    const oldVersionPatterns = [
      /^[01]\./,  // Major version 0 or 1
      /^2\.[0-5]\./, // Very old 2.x versions
    ];

    const cleanVersion = version.replace(/[^0-9.]/g, '');
    return oldVersionPatterns.some(pattern => pattern.test(cleanVersion));
  }

  private isVulnerableVersion(currentVersion: string, vulnerableRanges: string[]): boolean {
    // Simplified vulnerability check
    // In real implementation, would use proper semver comparison
    for (const range of vulnerableRanges) {
      if (range.includes('<')) {
        // Extract version after <
        const maxVersion = range.replace('<', '').trim();
        // Simple string comparison (would use semver.lt in real implementation)
        if (currentVersion < maxVersion) {
          return true;
        }
      }
    }
    return false;
  }

  private isPreReleaseVersion(version: string): boolean {
    return /-(alpha|beta|rc|pre|dev|snapshot)/i.test(version);
  }
}