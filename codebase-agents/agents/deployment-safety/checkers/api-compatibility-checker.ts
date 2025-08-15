// API compatibility checker - detects breaking changes in API endpoints

import { Finding } from '../../../types/agent-interfaces.js';
import * as fs from 'fs';
import * as path from 'path';

interface ApiEndpoint {
  path: string;
  method: string;
  parameters: ApiParameter[];
  responseSchema: any;
  authentication: boolean;
  deprecated: boolean;
}

interface ApiParameter {
  name: string;
  type: string;
  required: boolean;
  location: 'query' | 'body' | 'path' | 'header';
}

interface BreakingChange {
  type: 'removed-endpoint' | 'removed-parameter' | 'changed-parameter-type' | 'added-required-parameter' | 'changed-response-schema';
  endpoint: string;
  parameter?: string;
  oldValue?: any;
  newValue?: any;
  impact: 'critical' | 'high' | 'medium' | 'low';
}

export class ApiCompatibilityChecker {
  private readonly criticalEndpoints = [
    '/api/economic-pulse',
    '/api/etf-metrics-v2', 
    '/api/fred-incremental',
    '/api/unified-dashboard',
    '/api/enhanced-zscore',
    '/api/health/system-status',
    '/api/economic-health/dashboard',
    '/api/top-movers',
    '/api/momentum-analysis',
    '/api/market-status'
  ];

  async checkCompatibility(files: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Find API route files
    const routeFiles = this.findRouteFiles(files);
    
    if (routeFiles.length === 0) {
      return findings; // No route changes
    }

    console.log(`🔗 Checking API compatibility for ${routeFiles.length} route files`);

    for (const routeFile of routeFiles) {
      findings.push(...await this.analyzeRouteFile(routeFile));
    }

    // Check for breaking changes in critical endpoints
    findings.push(...await this.checkCriticalEndpoints(routeFiles));

    return findings;
  }

  private findRouteFiles(files: string[]): string[] {
    return files.filter(file => 
      file.includes('routes/') ||
      file.includes('controllers/') ||
      file.includes('api/') ||
      (file.includes('server/') && (file.endsWith('.ts') || file.endsWith('.js')))
    );
  }

  private async analyzeRouteFile(filePath: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      const content = fs.readFileSync(filePath, 'utf-8');

      // Check for potential breaking changes in route definitions
      findings.push(...this.detectRouteChanges(content, filePath));
      
      // Check for response format changes
      findings.push(...this.detectResponseChanges(content, filePath));
      
      // Check for authentication changes
      findings.push(...this.detectAuthenticationChanges(content, filePath));
      
      // Check for deprecation markers
      findings.push(...this.detectDeprecatedEndpoints(content, filePath));

    } catch (error) {
      findings.push({
        id: `route-analysis-error-${path.basename(filePath)}`,
        type: 'error',
        severity: 'medium',
        category: 'api-compatibility',
        title: 'Route Analysis Failed',
        description: `Failed to analyze route file: ${error}`,
        file: filePath,
        rule: 'route-analysis'
      });
    }

    return findings;
  }

  private detectRouteChanges(content: string, filePath: string): Finding[] {
    const findings: Finding[] = [];

    // Detect route definitions (Express.js patterns)
    const routePatterns = [
      /router\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /app\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g,
      /express\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`]/g
    ];

    const routes: Array<{ method: string; path: string; line: number }> = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      for (const pattern of routePatterns) {
        const matches = [...line.matchAll(pattern)];
        for (const match of matches) {
          const method = match[1].toUpperCase();
          const routePath = match[2];
          
          routes.push({
            method,
            path: routePath,
            line: i + 1
          });

          // Check if this is a critical endpoint being modified
          if (this.criticalEndpoints.some(critical => routePath.includes(critical))) {
            findings.push({
              id: `critical-endpoint-modified-${method}-${routePath.replace(/[^a-zA-Z0-9]/g, '-')}`,
              type: 'warning',
              severity: 'high',
              category: 'api-compatibility',
              title: `Critical Endpoint Modified: ${method} ${routePath}`,
              description: `Critical endpoint being modified. Ensure backward compatibility is maintained.`,
              file: filePath,
              line: i + 1,
              rule: 'critical-endpoint-stability'
            });
          }
        }
      }
    }

    // Check for routes that might be removed (commented out)
    const commentedRoutes = content.match(/\/\/.*router\.(get|post|put|patch|delete)/g);
    if (commentedRoutes && commentedRoutes.length > 0) {
      findings.push({
        id: `commented-routes-${path.basename(filePath)}`,
        type: 'warning',
        severity: 'medium',
        category: 'api-compatibility',
        title: 'Commented Out Routes Detected',
        description: `${commentedRoutes.length} routes appear to be commented out. This may indicate removed endpoints.`,
        file: filePath,
        rule: 'route-removal-detection'
      });
    }

    return findings;
  }

  private detectResponseChanges(content: string, filePath: string): Finding[] {
    const findings: Finding[] = [];

    // Look for response format changes
    const responsePatterns = [
      /res\.json\s*\(\s*{[^}]*}/g,
      /response\s*=\s*{[^}]*}/g,
      /return\s+{[^}]*}/g
    ];

    // Check for financial data response structures
    const financialResponseFields = [
      'economicHealthScore',
      'etfMovers', 
      'technicalIndicators',
      'zScore',
      'momentumStrategies',
      'indicators'
    ];

    for (const field of financialResponseFields) {
      // Check if field is being removed or renamed
      const fieldPattern = new RegExp(`["'\`]${field}["'\`]\\s*:`, 'g');
      const commentedFieldPattern = new RegExp(`//.*["'\`]${field}["'\`]`, 'g');
      
      const hasField = fieldPattern.test(content);
      const hasCommentedField = commentedFieldPattern.test(content);

      if (hasCommentedField && !hasField) {
        findings.push({
          id: `response-field-removed-${field}`,
          type: 'error',
          severity: 'critical',
          category: 'api-compatibility',
          title: `Critical Response Field Removed: ${field}`,
          description: `Financial data field "${field}" appears to be removed from API response. This is a breaking change.`,
          file: filePath,
          rule: 'no-breaking-response-changes',
          fix: {
            type: 'review',
            description: `Restore ${field} field or implement API versioning`,
            automated: false,
            confidence: 90
          }
        });
      }
    }

    // Check for error response changes
    if (content.includes('res.status(') || content.includes('throw new')) {
      // Look for changes in error response format
      const errorPatterns = [
        /res\.status\(\s*(\d+)\s*\)\.json\s*\(\s*{[^}]*error[^}]*}/g,
        /throw\s+new\s+Error\s*\(/g
      ];

      // This is a simplified check - in practice, would compare against previous version
      if (content.includes('error') && content.includes('message')) {
        // Good - following standard error format
      } else {
        findings.push({
          id: `non-standard-error-format-${path.basename(filePath)}`,
          type: 'warning',
          severity: 'medium',
          category: 'api-compatibility',
          title: 'Non-standard Error Response Format',
          description: 'Error responses should follow consistent format with error and message fields',
          file: filePath,
          rule: 'standard-error-format'
        });
      }
    }

    return findings;
  }

  private detectAuthenticationChanges(content: string, filePath: string): Finding[] {
    const findings: Finding[] = [];

    // Check for authentication middleware changes
    const authPatterns = [
      /authenticate/i,
      /authorize/i,
      /requireAuth/i,
      /passport/i,
      /jwt/i,
      /bearer/i
    ];

    const hasAuth = authPatterns.some(pattern => pattern.test(content));
    
    if (hasAuth) {
      // Check for potential authentication breaking changes
      if (content.includes('// TODO') && content.toLowerCase().includes('auth')) {
        findings.push({
          id: `auth-todo-${path.basename(filePath)}`,
          type: 'warning',
          severity: 'high',
          category: 'api-compatibility',
          title: 'Authentication TODO Found',
          description: 'Authentication-related TODO comments found. Ensure authentication is properly implemented.',
          file: filePath,
          rule: 'auth-implementation-complete'
        });
      }

      // Check for hardcoded credentials (security risk)
      const credentialPatterns = [
        /password\s*=\s*['"`][^'"`]{8,}['"`]/i,
        /secret\s*=\s*['"`][^'"`]{16,}['"`]/i,
        /api[_-]?key\s*=\s*['"`][^'"`]{16,}['"`]/i
      ];

      for (const pattern of credentialPatterns) {
        if (pattern.test(content)) {
          findings.push({
            id: `hardcoded-credentials-${path.basename(filePath)}`,
            type: 'error',
            severity: 'critical',
            category: 'api-compatibility',
            title: 'Hardcoded Credentials Detected',
            description: 'Hardcoded credentials found in source code. This is a critical security risk.',
            file: filePath,
            rule: 'no-hardcoded-credentials'
          });
        }
      }
    }

    return findings;
  }

  private detectDeprecatedEndpoints(content: string, filePath: string): Finding[] {
    const findings: Finding[] = [];

    // Look for deprecation markers
    const deprecationPatterns = [
      /@deprecated/i,
      /\/\*\*[\s\S]*@deprecated[\s\S]*\*\//i,
      /\/\/.*deprecated/i,
      /console\.warn.*deprecated/i
    ];

    for (const pattern of deprecationPatterns) {
      if (pattern.test(content)) {
        findings.push({
          id: `deprecated-endpoint-${path.basename(filePath)}`,
          type: 'warning',
          severity: 'medium',
          category: 'api-compatibility',
          title: 'Deprecated Endpoint Detected',
          description: 'File contains deprecated endpoints. Ensure proper deprecation timeline and migration path.',
          file: filePath,
          rule: 'deprecated-endpoint-handling'
        });
      }
    }

    // Check for version numbers in routes
    const versionPatterns = [
      /\/v[12]\//g,
      /\/api\/v[12]\//g
    ];

    for (const pattern of versionPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        findings.push({
          id: `api-versioning-${path.basename(filePath)}`,
          type: 'info',
          severity: 'low',
          category: 'api-compatibility',
          title: 'API Versioning Detected',
          description: `API versioning found: ${matches.join(', ')}. Ensure proper version migration strategy.`,
          file: filePath,
          rule: 'api-versioning-strategy'
        });
      }
    }

    return findings;
  }

  private async checkCriticalEndpoints(routeFiles: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const endpoint of this.criticalEndpoints) {
      let endpointFound = false;

      for (const routeFile of routeFiles) {
        try {
          const content = fs.readFileSync(routeFile, 'utf-8');
          if (content.includes(endpoint)) {
            endpointFound = true;
            
            // Perform deep analysis on critical endpoints
            findings.push(...this.analyzeCriticalEndpoint(endpoint, content, routeFile));
            break;
          }
        } catch (error) {
          // Skip files that can't be read
        }
      }

      if (!endpointFound) {
        findings.push({
          id: `critical-endpoint-missing-${endpoint.replace(/[^a-zA-Z0-9]/g, '-')}`,
          type: 'error',
          severity: 'critical',
          category: 'api-compatibility',
          title: `Critical Endpoint Missing: ${endpoint}`,
          description: `Critical endpoint ${endpoint} not found in route files. This may break frontend functionality.`,
          rule: 'critical-endpoints-present'
        });
      }
    }

    return findings;
  }

  private analyzeCriticalEndpoint(endpoint: string, content: string, filePath: string): Finding[] {
    const findings: Finding[] = [];

    // Check for proper error handling
    if (!content.includes('try') && !content.includes('catch')) {
      findings.push({
        id: `critical-endpoint-no-error-handling-${endpoint.replace(/[^a-zA-Z0-9]/g, '-')}`,
        type: 'warning',
        severity: 'high',
        category: 'api-compatibility',
        title: `Critical Endpoint Missing Error Handling: ${endpoint}`,
        description: `Critical endpoint ${endpoint} lacks proper error handling`,
        file: filePath,
        rule: 'critical-endpoint-error-handling'
      });
    }

    // Check for input validation
    const validationPatterns = [
      /req\.body/,
      /req\.params/,
      /req\.query/
    ];

    const hasInputs = validationPatterns.some(pattern => pattern.test(content));
    if (hasInputs && !content.includes('validate') && !content.includes('schema')) {
      findings.push({
        id: `critical-endpoint-no-validation-${endpoint.replace(/[^a-zA-Z0-9]/g, '-')}`,
        type: 'warning',
        severity: 'medium',
        category: 'api-compatibility',
        title: `Critical Endpoint Missing Input Validation: ${endpoint}`,
        description: `Critical endpoint ${endpoint} accepts input but lacks validation`,
        file: filePath,
        rule: 'critical-endpoint-input-validation'
      });
    }

    // Check for rate limiting
    if (!content.includes('rateLimit') && !content.includes('rateLimiter')) {
      findings.push({
        id: `critical-endpoint-no-rate-limiting-${endpoint.replace(/[^a-zA-Z0-9]/g, '-')}`,
        type: 'info',
        severity: 'low',
        category: 'api-compatibility',
        title: `Critical Endpoint Missing Rate Limiting: ${endpoint}`,
        description: `Consider adding rate limiting to critical endpoint ${endpoint}`,
        file: filePath,
        rule: 'critical-endpoint-rate-limiting'
      });
    }

    return findings;
  }
}