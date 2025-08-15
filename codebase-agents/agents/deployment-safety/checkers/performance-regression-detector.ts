// Performance regression detector - identifies potential performance issues

import { Finding } from '../../../types/agent-interfaces.js';
import * as fs from 'fs';
import * as path from 'path';

interface PerformanceMetric {
  endpoint: string;
  method: string;
  baselineResponseTime: number;
  currentResponseTime: number;
  memoryUsage: number;
  cpuUsage: number;
  regressionFactor: number;
}

interface PerformanceIssue {
  type: 'response-time' | 'memory-usage' | 'cpu-usage' | 'bundle-size' | 'database-query';
  severity: 'critical' | 'high' | 'medium' | 'low';
  description: string;
  impact: string;
  recommendation: string;
}

export class PerformanceRegressionDetector {
  private readonly performanceThresholds = {
    criticalEndpoints: {
      '/api/economic-health/dashboard': 500, // ms
      '/api/top-movers': 300,
      '/api/market-status': 100,
      '/api/momentum-analysis': 400
    },
    memoryUsage: 512, // MB
    bundleSize: 2048, // KB
    databaseQueryTime: 100 // ms
  };

  async detect(files: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Analyze code changes for performance impact
    findings.push(...await this.analyzeCodeChanges(files));
    
    // Check for bundle size impact
    findings.push(...await this.analyzeBundleSize(files));
    
    // Detect database performance issues
    findings.push(...await this.analyzeDatabasePerformance(files));
    
    // Check for memory leaks and inefficient patterns
    findings.push(...await this.analyzeMemoryPatterns(files));
    
    // Validate caching strategies
    findings.push(...await this.analyzeCachingStrategies(files));

    return findings;
  }

  private async analyzeCodeChanges(files: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    for (const file of files) {
      try {
        if (!fs.existsSync(file) || !this.isCodeFile(file)) {
          continue;
        }

        const content = fs.readFileSync(file, 'utf-8');
        findings.push(...this.detectPerformanceAntiPatterns(content, file));
        
      } catch (error) {
        // Skip files that can't be read
      }
    }

    return findings;
  }

  private isCodeFile(filePath: string): boolean {
    const extensions = ['.ts', '.tsx', '.js', '.jsx'];
    return extensions.some(ext => filePath.endsWith(ext));
  }

  private detectPerformanceAntiPatterns(content: string, filePath: string): Finding[] {
    const findings: Finding[] = [];

    // Anti-pattern 1: Synchronous operations in hot paths
    if (this.isApiRoute(filePath)) {
      const syncPatterns = [
        /fs\.readFileSync/g,
        /fs\.writeFileSync/g,
        /JSON\.parse\([^)]*fs\.readFileSync/g
      ];

      for (const pattern of syncPatterns) {
        const matches = content.match(pattern);
        if (matches) {
          findings.push({
            id: `sync-operation-in-api-${path.basename(filePath)}`,
            type: 'warning',
            severity: 'high',
            category: 'performance',
            title: 'Synchronous Operation in API Route',
            description: `Found ${matches.length} synchronous file operations in API route. This can block the event loop.`,
            file: filePath,
            rule: 'async-operations-only',
            fix: {
              type: 'replace',
              description: 'Replace with async equivalents (fs.promises.readFile, etc.)',
              automated: false,
              confidence: 90
            }
          });
        }
      }
    }

    // Anti-pattern 2: Inefficient loops and iterations
    const inefficientPatterns = [
      { pattern: /for\s*\(\s*let\s+\w+\s*=\s*0.*length.*\+\+.*\)\s*{[\s\S]*?for\s*\(/g, description: 'Nested loops detected' },
      { pattern: /\.forEach\s*\([^)]*\)\s*{[\s\S]*?\.forEach/g, description: 'Nested forEach operations' },
      { pattern: /\.map\s*\([^)]*\)\s*{[\s\S]*?\.filter/g, description: 'Map followed by filter (consider filter first)' }
    ];

    for (const { pattern, description } of inefficientPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        findings.push({
          id: `inefficient-iteration-${path.basename(filePath)}`,
          type: 'warning',
          severity: 'medium',
          category: 'performance',
          title: 'Inefficient Iteration Pattern',
          description: `${description} found in ${filePath}. Consider optimization.`,
          file: filePath,
          rule: 'efficient-iterations'
        });
      }
    }

    // Anti-pattern 3: Inefficient database queries
    if (content.includes('drizzle') || content.includes('query') || content.includes('select')) {
      // Check for N+1 query patterns
      if (content.match(/for\s*\(.*\)\s*{[\s\S]*?(select|query|find)/g)) {
        findings.push({
          id: `potential-n-plus-1-${path.basename(filePath)}`,
          type: 'warning',
          severity: 'high',
          category: 'performance',
          title: 'Potential N+1 Query Pattern',
          description: 'Loop containing database queries detected. Consider using batch operations or joins.',
          file: filePath,
          rule: 'avoid-n-plus-1-queries'
        });
      }

      // Check for missing WHERE clauses on large tables
      const financialTables = ['econ_series_observation', 'historical_stock_data', 'technical_indicators'];
      for (const table of financialTables) {
        if (content.includes(table) && content.includes('select') && !content.includes('where')) {
          findings.push({
            id: `missing-where-clause-${table}-${path.basename(filePath)}`,
            type: 'error',
            severity: 'critical',
            category: 'performance',
            title: `Missing WHERE Clause on Large Table: ${table}`,
            description: `Query on large financial table ${table} without WHERE clause will cause performance issues`,
            file: filePath,
            rule: 'large-table-where-required'
          });
        }
      }
    }

    // Anti-pattern 4: Unoptimized React patterns
    if (filePath.endsWith('.tsx') || filePath.endsWith('.jsx')) {
      // Missing dependency arrays in useEffect
      if (content.includes('useEffect') && !content.includes('[]') && !content.includes('[')) {
        findings.push({
          id: `missing-dependency-array-${path.basename(filePath)}`,
          type: 'warning',
          severity: 'medium',
          category: 'performance',
          title: 'Missing useEffect Dependency Array',
          description: 'useEffect without dependency array will run on every render',
          file: filePath,
          rule: 'useeffect-dependency-array'
        });
      }

      // Inline object creation in JSX
      const inlineObjectPattern = /(\w+)=\{\{[^}]+\}\}/g;
      const inlineObjectMatches = content.match(inlineObjectPattern);
      if (inlineObjectMatches && inlineObjectMatches.length > 2) {
        findings.push({
          id: `inline-objects-jsx-${path.basename(filePath)}`,
          type: 'warning',
          severity: 'low',
          category: 'performance',
          title: 'Inline Objects in JSX',
          description: 'Multiple inline object creation in JSX can cause unnecessary re-renders',
          file: filePath,
          rule: 'avoid-inline-objects-jsx'
        });
      }
    }

    // Anti-pattern 5: Heavy computations in render
    if (content.includes('useState') || content.includes('useEffect')) {
      const heavyComputationPatterns = [
        /JSON\.parse\s*\(/g,
        /JSON\.stringify\s*\(/g,
        /\.sort\s*\(/g,
        /\.filter\s*\([^)]*\)\s*\.map/g
      ];

      for (const pattern of heavyComputationPatterns) {
        const matches = content.match(pattern);
        if (matches && matches.length > 3) {
          findings.push({
            id: `heavy-computation-render-${path.basename(filePath)}`,
            type: 'warning',
            severity: 'medium',
            category: 'performance',
            title: 'Heavy Computations in Component',
            description: 'Heavy computations detected in component. Consider useMemo or moving to service.',
            file: filePath,
            rule: 'optimize-heavy-computations'
          });
        }
      }
    }

    return findings;
  }

  private isApiRoute(filePath: string): boolean {
    return filePath.includes('routes/') || 
           filePath.includes('controllers/') || 
           filePath.includes('api/') ||
           (filePath.includes('server/') && filePath.endsWith('.ts'));
  }

  private async analyzeBundleSize(files: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      // Check for large imports
      for (const file of files) {
        if (!fs.existsSync(file) || !this.isCodeFile(file)) {
          continue;
        }

        const content = fs.readFileSync(file, 'utf-8');
        
        // Check for large library imports
        const largeLibraries = [
          { name: 'lodash', alternative: 'lodash-es or specific functions' },
          { name: 'moment', alternative: 'date-fns or dayjs' },
          { name: '@tensorflow/tfjs', alternative: 'lazy loading' },
          { name: 'rxjs', alternative: 'specific operators only' }
        ];

        for (const lib of largeLibraries) {
          const importPattern = new RegExp(`import.*from\\s+['"\`]${lib.name}['"\`]`, 'g');
          if (importPattern.test(content)) {
            findings.push({
              id: `large-library-import-${lib.name}-${path.basename(file)}`,
              type: 'warning',
              severity: 'low',
              category: 'performance',
              title: `Large Library Import: ${lib.name}`,
              description: `Importing large library ${lib.name}. Consider ${lib.alternative} for better bundle size.`,
              file: file,
              rule: 'optimize-bundle-size'
            });
          }
        }

        // Check for barrel imports (can cause large bundles)
        const barrelImportPattern = /import\s+\{[^}]{50,}\}\s+from/g;
        const barrelMatches = content.match(barrelImportPattern);
        if (barrelMatches) {
          findings.push({
            id: `barrel-import-${path.basename(file)}`,
            type: 'info',
            severity: 'low',
            category: 'performance',
            title: 'Large Barrel Import',
            description: 'Large barrel import detected. Consider importing only needed functions.',
            file: file,
            rule: 'selective-imports'
          });
        }
      }

      // Check package.json for bundle analysis
      const packageJsonPath = 'package.json';
      if (fs.existsSync(packageJsonPath)) {
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));
        
        const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };
        const depCount = Object.keys(dependencies).length;
        
        if (depCount > 100) {
          findings.push({
            id: 'high-dependency-count-bundle-impact',
            type: 'warning',
            severity: 'low',
            category: 'performance',
            title: 'High Dependency Count May Impact Bundle Size',
            description: `${depCount} dependencies may impact bundle size. Consider dependency audit.`,
            rule: 'dependency-audit'
          });
        }
      }

    } catch (error) {
      findings.push({
        id: 'bundle-analysis-error',
        type: 'error',
        severity: 'low',
        category: 'performance',
        title: 'Bundle Size Analysis Failed',
        description: `Failed to analyze bundle size impact: ${error}`,
        rule: 'bundle-analysis'
      });
    }

    return findings;
  }

  private async analyzeDatabasePerformance(files: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      for (const file of files) {
        if (!fs.existsSync(file) || !file.includes('server/')) {
          continue;
        }

        const content = fs.readFileSync(file, 'utf-8');

        // Check for missing indexes on financial data queries
        if (content.includes('WHERE') || content.includes('ORDER BY')) {
          const financialTables = ['econ_series_observation', 'historical_stock_data'];
          
          for (const table of financialTables) {
            if (content.includes(table)) {
              findings.push({
                id: `potential-missing-index-${table}-${path.basename(file)}`,
                type: 'warning',
                severity: 'medium',
                category: 'performance',
                title: `Potential Missing Database Index: ${table}`,
                description: `Query on large table ${table} may need database index for optimal performance`,
                file: file,
                rule: 'financial-table-indexes'
              });
            }
          }
        }

        // Check for SELECT * queries
        if (content.includes('SELECT *') || content.includes('select *')) {
          findings.push({
            id: `select-star-query-${path.basename(file)}`,
            type: 'warning',
            severity: 'medium',
            category: 'performance',
            title: 'SELECT * Query Detected',
            description: 'SELECT * queries can impact performance. Select only needed columns.',
            file: file,
            rule: 'selective-columns'
          });
        }

        // Check for missing connection pooling
        if (content.includes('database') && !content.includes('pool')) {
          findings.push({
            id: `missing-connection-pooling-${path.basename(file)}`,
            type: 'warning',
            severity: 'medium',
            category: 'performance',
            title: 'Missing Database Connection Pooling',
            description: 'Database operations should use connection pooling for better performance',
            file: file,
            rule: 'connection-pooling'
          });
        }
      }

    } catch (error) {
      findings.push({
        id: 'database-performance-analysis-error',
        type: 'error',
        severity: 'low',
        category: 'performance',
        title: 'Database Performance Analysis Failed',
        description: `Failed to analyze database performance: ${error}`,
        rule: 'database-performance-analysis'
      });
    }

    return findings;
  }

  private async analyzeMemoryPatterns(files: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      for (const file of files) {
        if (!fs.existsSync(file) || !this.isCodeFile(file)) {
          continue;
        }

        const content = fs.readFileSync(file, 'utf-8');

        // Check for potential memory leaks
        const memoryLeakPatterns = [
          { pattern: /setInterval\s*\(/g, description: 'setInterval without clearInterval' },
          { pattern: /setTimeout\s*\(/g, description: 'setTimeout usage (check if cleared)' },
          { pattern: /addEventListener\s*\(/g, description: 'Event listeners (check if removed)' },
          { pattern: /new\s+Array\s*\(\s*\d{4,}\s*\)/g, description: 'Large array allocation' }
        ];

        for (const { pattern, description } of memoryLeakPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            // Check if cleanup is present
            const hasCleanup = content.includes('clearInterval') || 
                             content.includes('clearTimeout') ||
                             content.includes('removeEventListener') ||
                             content.includes('useEffect') && content.includes('return');

            if (!hasCleanup && matches.length > 0) {
              findings.push({
                id: `potential-memory-leak-${path.basename(file)}`,
                type: 'warning',
                severity: 'medium',
                category: 'performance',
                title: 'Potential Memory Leak',
                description: `${description} detected without apparent cleanup in ${file}`,
                file: file,
                rule: 'memory-leak-prevention'
              });
            }
          }
        }

        // Check for large object creation in loops
        if (content.match(/for\s*\(.*\)\s*{[\s\S]*?new\s+\w+\s*\(/g)) {
          findings.push({
            id: `object-creation-in-loop-${path.basename(file)}`,
            type: 'warning',
            severity: 'medium',
            category: 'performance',
            title: 'Object Creation in Loop',
            description: 'Creating objects inside loops can cause memory pressure',
            file: file,
            rule: 'avoid-object-creation-loops'
          });
        }
      }

    } catch (error) {
      findings.push({
        id: 'memory-analysis-error',
        type: 'error',
        severity: 'low',
        category: 'performance',
        title: 'Memory Pattern Analysis Failed',
        description: `Failed to analyze memory patterns: ${error}`,
        rule: 'memory-analysis'
      });
    }

    return findings;
  }

  private async analyzeCachingStrategies(files: string[]): Promise<Finding[]> {
    const findings: Finding[] = [];

    try {
      let hasCaching = false;
      let hasDistributedCaching = false;

      for (const file of files) {
        if (!fs.existsSync(file)) {
          continue;
        }

        const content = fs.readFileSync(file, 'utf-8');

        // Check for caching implementation
        if (content.includes('cache') || content.includes('redis')) {
          hasCaching = true;
          
          if (content.includes('redis') || content.includes('memcached')) {
            hasDistributedCaching = true;
          }
        }

        // Check for expensive operations without caching
        const expensiveOperations = [
          'JSON.parse',
          'JSON.stringify',
          'fetch(',
          'axios.',
          'db.query',
          'db.select'
        ];

        const hasExpensiveOps = expensiveOperations.some(op => content.includes(op));
        const isApiRoute = this.isApiRoute(file);

        if (hasExpensiveOps && isApiRoute && !content.includes('cache')) {
          findings.push({
            id: `missing-caching-${path.basename(file)}`,
            type: 'warning',
            severity: 'medium',
            category: 'performance',
            title: 'Missing Caching for Expensive Operations',
            description: `API route with expensive operations should implement caching`,
            file: file,
            rule: 'cache-expensive-operations'
          });
        }
      }

      // Overall caching strategy assessment
      if (!hasCaching) {
        findings.push({
          id: 'no-caching-strategy',
          type: 'warning',
          severity: 'medium',
          category: 'performance',
          title: 'No Caching Strategy Detected',
          description: 'Financial applications benefit from caching for performance. Consider implementing caching.',
          rule: 'caching-strategy-recommended'
        });
      } else if (!hasDistributedCaching) {
        findings.push({
          id: 'no-distributed-caching',
          type: 'info',
          severity: 'low',
          category: 'performance',
          title: 'No Distributed Caching Detected',
          description: 'Consider Redis or similar for distributed caching in production.',
          rule: 'distributed-caching-recommended'
        });
      }

    } catch (error) {
      findings.push({
        id: 'caching-analysis-error',
        type: 'error',
        severity: 'low',
        category: 'performance',
        title: 'Caching Strategy Analysis Failed',
        description: `Failed to analyze caching strategies: ${error}`,
        rule: 'caching-analysis'
      });
    }

    return findings;
  }
}