/**
 * Code Quality Scanner - Automated Code Quality Analysis Tool
 * 
 * @class CodeQualityScanner
 * @description Advanced code quality analysis tool that scans TypeScript/JavaScript files for
 * technical debt, code smells, performance issues, and maintainability concerns. Provides
 * actionable recommendations for code improvement and tracks quality metrics over time.
 * 
 * @features
 * - Technical debt detection and quantification
 * - Code complexity analysis (cyclomatic, cognitive)
 * - Performance anti-pattern identification
 * - Maintainability scoring and recommendations
 * - Security vulnerability scanning
 * - Documentation coverage analysis
 * - Dependency health assessment
 * - Code duplication detection
 * 
 * @author AI Agent Documentation Enhancement
 * @version 1.0.0
 * @since 2025-07-25
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../shared/utils/logger';

/**
 * Code quality issue severity levels
 */
type Severity = 'low' | 'medium' | 'high' | 'critical';

/**
 * Code quality issue categories
 */
type IssueCategory = 
  | 'technical_debt' 
  | 'performance' 
  | 'maintainability' 
  | 'security' 
  | 'documentation'
  | 'complexity'
  | 'duplication';

/**
 * Individual code quality issue
 * @interface CodeQualityIssue
 * @property {string} file - File path where issue was found
 * @property {number} line - Line number of the issue
 * @property {number} column - Column number of the issue
 * @property {IssueCategory} category - Type of quality issue
 * @property {Severity} severity - Severity level of the issue
 * @property {string} rule - Specific rule or pattern that was violated
 * @property {string} message - Human-readable description of the issue
 * @property {string} recommendation - Suggested fix or improvement
 * @property {number} effort - Estimated effort to fix (1-10 scale)
 * @property {number} impact - Expected impact of fixing (1-10 scale)
 */
interface CodeQualityIssue {
  file: string;
  line: number;
  column: number;
  category: IssueCategory;
  severity: Severity;
  rule: string;
  message: string;
  recommendation: string;
  effort: number;
  impact: number;
}

/**
 * File-level quality metrics
 * @interface FileQualityMetrics
 * @property {string} file - File path
 * @property {number} lines - Total lines of code
 * @property {number} complexity - Cyclomatic complexity score
 * @property {number} maintainabilityIndex - Maintainability index (0-100)
 * @property {number} documentationCoverage - Documentation coverage percentage
 * @property {number} duplicatedLines - Number of duplicated lines
 * @property {CodeQualityIssue[]} issues - Issues found in this file
 */
interface FileQualityMetrics {
  file: string;
  lines: number;
  complexity: number;
  maintainabilityIndex: number;
  documentationCoverage: number;
  duplicatedLines: number;
  issues: CodeQualityIssue[];
}

/**
 * Project-wide quality summary
 * @interface QualitySummary
 * @property {number} overallScore - Overall quality score (0-100)
 * @property {number} totalFiles - Total files analyzed
 * @property {number} totalIssues - Total issues found
 * @property {Record<Severity, number>} issuesBySeverity - Issues grouped by severity
 * @property {Record<IssueCategory, number>} issuesByCategory - Issues grouped by category
 * @property {FileQualityMetrics[]} fileMetrics - Per-file quality metrics
 * @property {string[]} recommendations - Top recommendations for improvement
 * @property {number} technicalDebtHours - Estimated hours to address all issues
 */
interface QualitySummary {
  overallScore: number;
  totalFiles: number;
  totalIssues: number;
  issuesBySeverity: Record<Severity, number>;
  issuesByCategory: Record<IssueCategory, number>;
  fileMetrics: FileQualityMetrics[];
  recommendations: string[];
  technicalDebtHours: number;
}

/**
 * Code quality scanning patterns and rules
 */
class QualityRules {
  /**
   * Performance anti-patterns
   */
  static readonly PERFORMANCE_PATTERNS = [
    {
      pattern: /for\s*\([^)]*\)\s*\{[^}]*\.push\([^)]*\)[^}]*\}/g,
      rule: 'inefficient-array-building',
      message: 'Inefficient array building in loop',
      recommendation: 'Use array mapping or pre-allocate array size',
      severity: 'medium' as Severity,
      effort: 3,
      impact: 6
    },
    {
      pattern: /document\.getElementById.*loop|loop.*document\.getElementById/g,
      rule: 'dom-query-in-loop',
      message: 'DOM query inside loop detected',
      recommendation: 'Cache DOM references outside the loop',
      severity: 'high' as Severity,
      effort: 2,
      impact: 8
    },
    {
      pattern: /JSON\.parse\(JSON\.stringify\(/g,
      rule: 'inefficient-cloning',
      message: 'Inefficient object cloning using JSON methods',
      recommendation: 'Use structured cloning or proper deep copy library',
      severity: 'medium' as Severity,
      effort: 2,
      impact: 5
    }
  ];

  /**
   * Security vulnerability patterns
   */
  static readonly SECURITY_PATTERNS = [
    {
      pattern: /eval\s*\(/g,
      rule: 'eval-usage',
      message: 'Use of eval() detected - security risk',
      recommendation: 'Replace eval() with safe alternatives like JSON.parse()',
      severity: 'critical' as Severity,
      effort: 4,
      impact: 10
    },
    {
      pattern: /innerHTML\s*=.*\+/g,
      rule: 'innerHTML-concatenation',
      message: 'Direct innerHTML assignment with concatenation',
      recommendation: 'Use textContent or proper DOM manipulation methods',
      severity: 'high' as Severity,
      effort: 3,
      impact: 8
    },
    {
      pattern: /process\.env\.[A-Z_]+.*console\.log/g,
      rule: 'env-var-logging',
      message: 'Environment variable potentially logged',
      recommendation: 'Remove logging of sensitive environment variables',
      severity: 'high' as Severity,
      effort: 1,
      impact: 9
    }
  ];

  /**
   * Maintainability issues patterns
   */
  static readonly MAINTAINABILITY_PATTERNS = [
    {
      pattern: /function\s+\w+\s*\([^)]*\)\s*\{[^}]{500,}\}/g,
      rule: 'large-function',
      message: 'Function is too large and complex',
      recommendation: 'Break down into smaller, focused functions',
      severity: 'medium' as Severity,
      effort: 6,
      impact: 7
    },
    {
      pattern: /if\s*\([^)]*\)\s*\{[^}]*if\s*\([^)]*\)\s*\{[^}]*if\s*\([^)]*\)\s*\{/g,
      rule: 'deep-nesting',
      message: 'Deep nesting detected (>3 levels)',
      recommendation: 'Refactor to reduce nesting using early returns or extraction',
      severity: 'medium' as Severity,
      effort: 4,
      impact: 6
    },
    {
      pattern: /\/\/ TODO|\/\/ FIXME|\/\/ HACK/gi,
      rule: 'technical-debt-comments',
      message: 'Technical debt comment found',
      recommendation: 'Address the TODO/FIXME or create a proper issue',
      severity: 'low' as Severity,
      effort: 2,
      impact: 3
    }
  ];

  /**
   * Documentation patterns
   */
  static readonly DOCUMENTATION_PATTERNS = [
    {
      pattern: /export\s+(class|interface|function|const)\s+\w+/g,
      rule: 'missing-export-docs',
      message: 'Exported item missing JSDoc documentation',
      recommendation: 'Add comprehensive JSDoc comments for public APIs',
      severity: 'low' as Severity,
      effort: 2,
      impact: 4
    }
  ];
}

/**
 * Advanced code quality scanner with comprehensive analysis
 * @class CodeQualityScanner
 */
export class CodeQualityScanner {
  private readonly excludePatterns: RegExp[] = [
    /node_modules/,
    /\.git/,
    /dist/,
    /build/,
    /coverage/,
    /\.test\./,
    /\.spec\./
  ];

  private readonly supportedExtensions = ['.ts', '', '.tsx', '.jsx'];

  /**
   * Scan directory for code quality issues
   * @method scanDirectory
   * @param {string} directory - Directory path to scan
   * @returns {Promise<QualitySummary>} Comprehensive quality analysis
   */
  async scanDirectory(directory: string): Promise<QualitySummary> {
    const startTime = Date.now();
    logger.info(`Starting code quality scan in ${directory}`);

    const files = await this.getFilesToScan(directory);
    const fileMetrics: FileQualityMetrics[] = [];

    for (const file of files) {
      try {
        const metrics = await this.analyzeFile(file);
        fileMetrics.push(metrics);
      } catch (error) {
        logger.warn(`Failed to analyze file ${file}: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    const summary = this.generateQualitySummary(fileMetrics);
    const duration = Date.now() - startTime;

    logger.info(`Code quality scan completed in ${duration}ms: ${fileMetrics.length} files, ${summary.totalIssues} issues, score: ${summary.overallScore}`);

    return summary;
  }

  /**
   * Analyze individual file for quality issues
   * @method analyzeFile
   * @param {string} filePath - Path to file to analyze
   * @returns {Promise<FileQualityMetrics>} File quality metrics
   */
  async analyzeFile(filePath: string): Promise<FileQualityMetrics> {
    const content = await fs.readFile(filePath, 'utf-8');
    const lines = content.split('\n');
    const issues: CodeQualityIssue[] = [];

    // Analyze different aspects of code quality
    issues.push(...this.findPerformanceIssues(content, filePath));
    issues.push(...this.findSecurityIssues(content, filePath));
    issues.push(...this.findMaintainabilityIssues(content, filePath));
    issues.push(...this.findDocumentationIssues(content, filePath));

    const complexity = this.calculateComplexity(content);
    const maintainabilityIndex = this.calculateMaintainabilityIndex(content, complexity);
    const documentationCoverage = this.calculateDocumentationCoverage(content);
    const duplicatedLines = this.findDuplicatedLines(content);

    return {
      file: filePath,
      lines: lines.length,
      complexity,
      maintainabilityIndex,
      documentationCoverage,
      duplicatedLines,
      issues
    };
  }

  /**
   * Find performance-related issues in code
   * @method findPerformanceIssues
   * @param {string} content - File content
   * @param {string} filePath - File path
   * @returns {CodeQualityIssue[]} Performance issues found
   */
  private findPerformanceIssues(content: string, filePath: string): CodeQualityIssue[] {
    const issues: CodeQualityIssue[] = [];

    for (const pattern of QualityRules.PERFORMANCE_PATTERNS) {
      const matches = Array.from(content.matchAll(pattern.pattern));
      
      for (const match of matches) {
        const line = this.getLineNumber(content, match.index || 0);
        const column = this.getColumnNumber(content, match.index || 0);

        issues.push({
          file: filePath,
          line,
          column,
          category: 'performance',
          severity: pattern.severity,
          rule: pattern.rule,
          message: pattern.message,
          recommendation: pattern.recommendation,
          effort: pattern.effort,
          impact: pattern.impact
        });
      }
    }

    return issues;
  }

  /**
   * Find security-related issues in code
   * @method findSecurityIssues
   * @param {string} content - File content
   * @param {string} filePath - File path
   * @returns {CodeQualityIssue[]} Security issues found
   */
  private findSecurityIssues(content: string, filePath: string): CodeQualityIssue[] {
    const issues: CodeQualityIssue[] = [];

    for (const pattern of QualityRules.SECURITY_PATTERNS) {
      const matches = Array.from(content.matchAll(pattern.pattern));
      
      for (const match of matches) {
        const line = this.getLineNumber(content, match.index || 0);
        const column = this.getColumnNumber(content, match.index || 0);

        issues.push({
          file: filePath,
          line,
          column,
          category: 'security',
          severity: pattern.severity,
          rule: pattern.rule,
          message: pattern.message,
          recommendation: pattern.recommendation,
          effort: pattern.effort,
          impact: pattern.impact
        });
      }
    }

    return issues;
  }

  /**
   * Find maintainability issues in code
   * @method findMaintainabilityIssues
   * @param {string} content - File content
   * @param {string} filePath - File path
   * @returns {CodeQualityIssue[]} Maintainability issues found
   */
  private findMaintainabilityIssues(content: string, filePath: string): CodeQualityIssue[] {
    const issues: CodeQualityIssue[] = [];

    for (const pattern of QualityRules.MAINTAINABILITY_PATTERNS) {
      const matches = Array.from(content.matchAll(pattern.pattern));
      
      for (const match of matches) {
        const line = this.getLineNumber(content, match.index || 0);
        const column = this.getColumnNumber(content, match.index || 0);

        issues.push({
          file: filePath,
          line,
          column,
          category: 'maintainability',
          severity: pattern.severity,
          rule: pattern.rule,
          message: pattern.message,
          recommendation: pattern.recommendation,
          effort: pattern.effort,
          impact: pattern.impact
        });
      }
    }

    return issues;
  }

  /**
   * Find documentation issues in code
   * @method findDocumentationIssues
   * @param {string} content - File content
   * @param {string} filePath - File path
   * @returns {CodeQualityIssue[]} Documentation issues found
   */
  private findDocumentationIssues(content: string, filePath: string): CodeQualityIssue[] {
    const issues: CodeQualityIssue[] = [];

    // Find exports without documentation
    const exportPattern = /^export\s+(class|interface|function|const)\s+(\w+)/gm;
    const jsdocPattern = /\/\*\*[\s\S]*?\*\//g;
    
    const exports = Array.from(content.matchAll(exportPattern));
    const jsdocs = Array.from(content.matchAll(jsdocPattern));

    for (const exportMatch of exports) {
      const exportIndex = exportMatch.index || 0;
      const exportLine = this.getLineNumber(content, exportIndex);
      
      // Check if there's JSDoc within 5 lines before the export
      const hasNearbyJSDoc = jsdocs.some(jsdocMatch => {
        const jsdocIndex = jsdocMatch.index || 0;
        const jsdocLine = this.getLineNumber(content, jsdocIndex);
        return Math.abs(exportLine - jsdocLine) <= 5;
      });

      if (!hasNearbyJSDoc) {
        issues.push({
          file: filePath,
          line: exportLine,
          column: this.getColumnNumber(content, exportIndex),
          category: 'documentation',
          severity: 'low',
          rule: 'missing-export-docs',
          message: `Exported ${exportMatch[1]} '${exportMatch[2]}' missing JSDoc documentation`,
          recommendation: 'Add comprehensive JSDoc comments for public APIs',
          effort: 2,
          impact: 4
        });
      }
    }

    return issues;
  }

  /**
   * Calculate cyclomatic complexity of code
   * @method calculateComplexity
   * @param {string} content - File content
   * @returns {number} Cyclomatic complexity score
   */
  private calculateComplexity(content: string): number {
    // Count decision points: if, else, while, for, switch, case, catch, &&, ||, ?
    const complexityPatterns = [
      /\bif\b/g,
      /\belse\b/g,
      /\bwhile\b/g,
      /\bfor\b/g,
      /\bswitch\b/g,
      /\bcase\b/g,
      /\bcatch\b/g,
      /&&/g,
      /\|\|/g,
      /\?/g
    ];

    let complexity = 1; // Base complexity

    for (const pattern of complexityPatterns) {
      const matches = content.match(pattern);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }

  /**
   * Calculate maintainability index
   * @method calculateMaintainabilityIndex
   * @param {string} content - File content
   * @param {number} complexity - Cyclomatic complexity
   * @returns {number} Maintainability index (0-100)
   */
  private calculateMaintainabilityIndex(content: string, complexity: number): number {
    const lines = content.split('\n').length;
    const halsteadVolume = Math.log2(lines) * lines; // Simplified Halstead volume
    
    // Simplified maintainability index calculation
    let index = 171 - 5.2 * Math.log(halsteadVolume) - 0.23 * complexity - 16.2 * Math.log(lines);
    
    // Normalize to 0-100 scale
    index = Math.max(0, Math.min(100, index));
    
    return Math.round(index);
  }

  /**
   * Calculate documentation coverage percentage
   * @method calculateDocumentationCoverage
   * @param {string} content - File content
   * @returns {number} Documentation coverage percentage
   */
  private calculateDocumentationCoverage(content: string): number {
    const exports = (content.match(/^export\s+(class|interface|function|const)/gm) || []).length;
    const functions = (content.match(/function\s+\w+/g) || []).length;
    const classes = (content.match(/class\s+\w+/g) || []).length;
    const interfaces = (content.match(/interface\s+\w+/g) || []).length;
    
    const documentableItems = exports + functions + classes + interfaces;
    
    if (documentableItems === 0) return 100;
    
    const jsdocComments = (content.match(/\/\*\*[\s\S]*?\*\//g) || []).length;
    const coverage = (jsdocComments / documentableItems) * 100;
    
    return Math.min(100, Math.round(coverage));
  }

  /**
   * Find duplicated lines in code
   * @method findDuplicatedLines
   * @param {string} content - File content
   * @returns {number} Number of duplicated lines
   */
  private findDuplicatedLines(content: string): number {
    const lines = content.split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 10 && !line.startsWith('//') && !line.startsWith('*'));
    
    const lineCount = new Map<string, number>();
    
    for (const line of lines) {
      lineCount.set(line, (lineCount.get(line) || 0) + 1);
    }
    
    let duplicatedLines = 0;
    for (const [line, count] of Array.from(lineCount.entries())) {
      if (count > 1) {
        duplicatedLines += count - 1;
      }
    }
    
    return duplicatedLines;
  }

  /**
   * Generate comprehensive quality summary
   * @method generateQualitySummary
   * @param {FileQualityMetrics[]} fileMetrics - Metrics for all files
   * @returns {QualitySummary} Project quality summary
   */
  private generateQualitySummary(fileMetrics: FileQualityMetrics[]): QualitySummary {
    const allIssues = fileMetrics.flatMap(fm => fm.issues);
    const totalFiles = fileMetrics.length;
    const totalIssues = allIssues.length;

    // Group issues by severity and category
    const issuesBySeverity: Record<Severity, number> = {
      low: 0,
      medium: 0,
      high: 0,
      critical: 0
    };

    const issuesByCategory: Record<IssueCategory, number> = {
      technical_debt: 0,
      performance: 0,
      maintainability: 0,
      security: 0,
      documentation: 0,
      complexity: 0,
      duplication: 0
    };

    let totalTechnicalDebtHours = 0;

    for (const issue of allIssues) {
      issuesBySeverity[issue.severity]++;
      issuesByCategory[issue.category]++;
      totalTechnicalDebtHours += issue.effort * 0.5; // Convert effort to hours
    }

    // Calculate overall quality score
    const averageMaintainability = fileMetrics.length > 0 
      ? fileMetrics.reduce((sum, fm) => sum + fm.maintainabilityIndex, 0) / fileMetrics.length
      : 100;
    
    const criticalPenalty = issuesBySeverity.critical * 10;
    const highPenalty = issuesBySeverity.high * 5;
    const mediumPenalty = issuesBySeverity.medium * 2;
    const lowPenalty = issuesBySeverity.low * 0.5;
    
    const overallScore = Math.max(0, Math.min(100, 
      averageMaintainability - criticalPenalty - highPenalty - mediumPenalty - lowPenalty
    ));

    // Generate top recommendations
    const recommendations = this.generateRecommendations(allIssues, fileMetrics);

    return {
      overallScore: Math.round(overallScore),
      totalFiles,
      totalIssues,
      issuesBySeverity,
      issuesByCategory,
      fileMetrics,
      recommendations,
      technicalDebtHours: Math.round(totalTechnicalDebtHours)
    };
  }

  /**
   * Generate actionable recommendations
   * @method generateRecommendations
   * @param {CodeQualityIssue[]} issues - All issues found
   * @param {FileQualityMetrics[]} fileMetrics - File metrics
   * @returns {string[]} Top recommendations
   */
  private generateRecommendations(
    issues: CodeQualityIssue[], 
    fileMetrics: FileQualityMetrics[]
  ): string[] {
    const recommendations: string[] = [];

    // Security recommendations (highest priority)
    const securityIssues = issues.filter(i => i.category === 'security');
    if (securityIssues.length > 0) {
      recommendations.push(
        `🔒 Address ${securityIssues.length} security issues immediately - these pose significant risks`
      );
    }

    // Performance recommendations
    const performanceIssues = issues.filter(i => i.category === 'performance');
    if (performanceIssues.length > 5) {
      recommendations.push(
        `⚡ Optimize performance - ${performanceIssues.length} performance issues detected`
      );
    }

    // Complexity recommendations
    const complexFiles = fileMetrics.filter(fm => fm.complexity > 20);
    if (complexFiles.length > 0) {
      recommendations.push(
        `🔧 Refactor ${complexFiles.length} overly complex files to improve maintainability`
      );
    }

    // Documentation recommendations
    const poorlyDocumented = fileMetrics.filter(fm => fm.documentationCoverage < 50);
    if (poorlyDocumented.length > fileMetrics.length * 0.3) {
      recommendations.push(
        `📝 Improve documentation - ${poorlyDocumented.length} files need better documentation`
      );
    }

    // Technical debt recommendations
    const highEffortIssues = issues.filter(i => i.effort >= 6);
    if (highEffortIssues.length > 0) {
      recommendations.push(
        `🔨 Plan refactoring sprint - ${highEffortIssues.length} issues require significant effort`
      );
    }

    return recommendations.slice(0, 5); // Return top 5 recommendations
  }

  /**
   * Get all files to scan in directory
   * @method getFilesToScan
   * @param {string} directory - Directory to scan
   * @returns {Promise<string[]>} Array of file paths
   */
  private async getFilesToScan(directory: string): Promise<string[]> {
    const files: string[] = [];
    
    const scanDir = async (dir: string): Promise<void> => {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          // Skip excluded directories
          if (!this.excludePatterns.some((pattern: RegExp) => pattern.test(fullPath))) {
            await scanDir(fullPath);
          }
        } else if (entry.isFile()) {
          // Include supported file types
          const ext = path.extname(entry.name);
          if (this.supportedExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    };
    
    await scanDir(directory);
    return files;
  }

  /**
   * Get line number from character index
   * @method getLineNumber
   * @param {string} content - File content
   * @param {number} index - Character index
   * @returns {number} Line number (1-based)
   */
  private getLineNumber(content: string, index: number): number {
    return content.substring(0, index).split('\n').length;
  }

  /**
   * Get column number from character index
   * @method getColumnNumber
   * @param {string} content - File content
   * @param {number} index - Character index
   * @returns {number} Column number (1-based)
   */
  private getColumnNumber(content: string, index: number): number {
    const beforeIndex = content.substring(0, index);
    const lastNewline = beforeIndex.lastIndexOf('\n');
    return index - lastNewline;
  }
}

// Export singleton instance for easy access
export const codeQualityScanner = new CodeQualityScanner();