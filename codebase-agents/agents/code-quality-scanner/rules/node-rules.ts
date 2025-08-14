// Node.js/Express-specific code quality rules

import { Finding } from '../../../types/agent-interfaces.js';

export class NodeRules {
  async analyze(filePath: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for missing error handling in async functions
      if (line.includes('async') && line.includes('function')) {
        const functionContent = this.extractFunctionContent(lines, i);
        if (!functionContent.includes('try') || !functionContent.includes('catch')) {
          findings.push({
            id: `node-async-error-${lineNumber}`,
            type: 'warning',
            severity: 'high',
            category: 'error-handling',
            title: 'Missing Error Handling in Async Function',
            description: 'Async functions should have proper try-catch error handling',
            file: filePath,
            line: lineNumber,
            rule: 'node-async-error-handling'
          });
        }
      }

      // Check for Express route handlers without error handling
      if (line.includes('app.') && (line.includes('get') || line.includes('post') || line.includes('put') || line.includes('delete'))) {
        const routeContent = this.extractRouteContent(lines, i);
        if (!routeContent.includes('try') && !routeContent.includes('.catch')) {
          findings.push({
            id: `node-route-error-${lineNumber}`,
            type: 'warning',
            severity: 'high',
            category: 'error-handling',
            title: 'Missing Error Handling in Route',
            description: 'Express routes should have error handling',
            file: filePath,
            line: lineNumber,
            rule: 'express-error-handling'
          });
        }
      }

      // Check for SQL injection vulnerabilities
      if (line.includes('SELECT') || line.includes('INSERT') || line.includes('UPDATE') || line.includes('DELETE')) {
        if (line.includes('${') || line.includes('" + ') || line.includes("' + ")) {
          findings.push({
            id: `node-sql-injection-${lineNumber}`,
            type: 'error',
            severity: 'critical',
            category: 'security',
            title: 'Potential SQL Injection',
            description: 'SQL queries should use parameterized statements',
            file: filePath,
            line: lineNumber,
            rule: 'node-sql-injection-prevention'
          });
        }
      }

      // Check for hardcoded credentials
      const credentialPatterns = [
        /password\s*=\s*["'][\w@#$%^&*()]+["']/i,
        /api_key\s*=\s*["'][a-zA-Z0-9]+["']/i,
        /secret\s*=\s*["'][a-zA-Z0-9]+["']/i,
        /token\s*=\s*["'][a-zA-Z0-9]+["']/i
      ];

      for (const pattern of credentialPatterns) {
        if (pattern.test(line)) {
          findings.push({
            id: `node-hardcoded-creds-${lineNumber}`,
            type: 'error',
            severity: 'critical',
            category: 'security',
            title: 'Hardcoded Credentials',
            description: 'Credentials should be stored in environment variables',
            file: filePath,
            line: lineNumber,
            rule: 'node-no-hardcoded-credentials',
            fix: {
              type: 'replace',
              description: 'Move to environment variable',
              automated: false,
              confidence: 80
            }
          });
        }
      }

      // Check for missing input validation
      if (line.includes('req.body') || line.includes('req.params') || line.includes('req.query')) {
        if (!content.includes('zod') && !content.includes('joi') && !content.includes('validator')) {
          findings.push({
            id: `node-input-validation-${lineNumber}`,
            type: 'warning',
            severity: 'medium',
            category: 'security',
            title: 'Missing Input Validation',
            description: 'User inputs should be validated before processing',
            file: filePath,
            line: lineNumber,
            rule: 'node-input-validation'
          });
        }
      }

      // Check for missing rate limiting
      if (line.includes('app.use') && !content.includes('rateLimit') && !content.includes('rate-limit')) {
        findings.push({
          id: `node-rate-limit-${lineNumber}`,
          type: 'info',
          severity: 'low',
          category: 'security',
          title: 'Consider Rate Limiting',
          description: 'API endpoints should have rate limiting for security',
          file: filePath,
          line: lineNumber,
          rule: 'express-rate-limiting'
        });
      }

      // Check for proper logging
      if (line.includes('console.log') && !line.includes('development')) {
        findings.push({
          id: `node-logging-${lineNumber}`,
          type: 'info',
          severity: 'low',
          category: 'observability',
          title: 'Use Structured Logging',
          description: 'Consider using structured logging (like Pino) instead of console.log',
          file: filePath,
          line: lineNumber,
          rule: 'node-structured-logging'
        });
      }

      // FinanceHub specific: Check for financial data validation
      if (line.includes('price') || line.includes('amount') || line.includes('value')) {
        if (line.includes('req.body') && !content.includes('parseFloat') && !content.includes('Number(')) {
          findings.push({
            id: `node-financial-validation-${lineNumber}`,
            type: 'warning',
            severity: 'medium',
            category: 'financial-accuracy',
            title: 'Financial Data Should Be Validated',
            description: 'Financial values should be properly parsed and validated',
            file: filePath,
            line: lineNumber,
            rule: 'financial-data-validation'
          });
        }
      }

      // Check for database connection handling
      if (line.includes('database') || line.includes('db.')) {
        if (!content.includes('finally') && content.includes('connection')) {
          findings.push({
            id: `node-db-connection-${lineNumber}`,
            type: 'warning',
            severity: 'medium',
            category: 'resource-management',
            title: 'Database Connection Should Be Properly Closed',
            description: 'Ensure database connections are closed in finally block',
            file: filePath,
            line: lineNumber,
            rule: 'node-db-connection-handling'
          });
        }
      }
    }

    return findings;
  }

  private extractFunctionContent(lines: string[], startIndex: number): string {
    const content = [];
    let braceCount = 0;
    let started = false;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      content.push(line);

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          started = true;
        } else if (char === '}') {
          braceCount--;
        }
      }

      if (started && braceCount === 0) {
        break;
      }
    }

    return content.join('\n');
  }

  private extractRouteContent(lines: string[], startIndex: number): string {
    // Similar to extractFunctionContent but for route handlers
    return this.extractFunctionContent(lines, startIndex);
  }
}