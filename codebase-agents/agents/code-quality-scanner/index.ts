// FinanceHub Pro v26 - Code Quality Scanner Agent
// Static code analysis and quality metrics for TypeScript/JavaScript

import { BaseAgent } from '../../core/base-agent.js';
import { AgentResult, AgentConfig, Finding, Suggestion } from '../../types/agent-interfaces.js';
import { TypeScriptRules } from './rules/typescript-rules.js';
import { ReactRules } from './rules/react-rules.js';
import { NodeRules } from './rules/node-rules.js';
import { ComplexityAnalyzer } from './analyzers/complexity-analyzer.js';
import { ImportAnalyzer } from './analyzers/import-analyzer.js';
import { DeadCodeDetector } from './analyzers/dead-code-detector.js';
import * as path from 'path';

export class CodeQualityScanner extends BaseAgent {
  name = 'code-quality-scanner';
  version = '1.0.0';
  description = 'Analyzes TypeScript/JavaScript code for quality issues, complexity, and maintainability';
  capabilities = [
    'complexity-analysis',
    'dead-code-detection', 
    'duplication-detection',
    'import-analysis',
    'naming-conventions',
    'financial-code-validation'
  ];
  supportedFileTypes = ['.ts', '.tsx', '.js', '.jsx'];
  dependencies = ['@typescript-eslint/parser', '@typescript-eslint/eslint-plugin', 'typescript'];

  private typeScriptRules = new TypeScriptRules();
  private reactRules = new ReactRules();
  private nodeRules = new NodeRules();
  private complexityAnalyzer = new ComplexityAnalyzer();
  private importAnalyzer = new ImportAnalyzer();
  private deadCodeDetector = new DeadCodeDetector();

  async analyze(files: string[], config: AgentConfig): Promise<AgentResult> {
    const startTime = Date.now();
    const findings: Finding[] = [];
    const suggestions: Suggestion[] = [];
    let totalLinesOfCode = 0;
    
    console.log(`🔍 Code Quality Scanner: Analyzing ${files.length} files...`);

    for (const filePath of files) {
      try {
        const content = await this.readFileContent(filePath);
        const fileExtension = path.extname(filePath);
        const linesOfCode = this.countLinesOfCode(content);
        totalLinesOfCode += linesOfCode;

        console.log(`📄 Analyzing: ${filePath} (${linesOfCode} LOC)`);

        // Run different analyzers based on file type
        if (['.ts', '.tsx'].includes(fileExtension)) {
          findings.push(...await this.analyzeTypeScript(filePath, content));
        }
        
        if (['.tsx', '.jsx'].includes(fileExtension)) {
          findings.push(...await this.analyzeReact(filePath, content));
        }
        
        if (filePath.includes('server/') || filePath.includes('scripts/')) {
          findings.push(...await this.analyzeNode(filePath, content));
        }

        // Universal analyzers
        findings.push(...await this.complexityAnalyzer.analyze(filePath, content));
        findings.push(...await this.importAnalyzer.analyze(filePath, content));
        findings.push(...await this.deadCodeDetector.analyze(filePath, content));
        
        // FinanceHub specific analysis
        findings.push(...await this.analyzeFinancialCode(filePath, content));

      } catch (error) {
        console.error(`❌ Error analyzing ${filePath}:`, error);
        findings.push(super.createFinding(
          'error',
          'high',
          'analysis-error',
          'Analysis Failed',
          `Failed to analyze file: ${error}`,
          filePath
        ));
      }
    }

    // Generate suggestions based on findings
    suggestions.push(...this.generateSuggestions(findings, files));

    // Create metrics
    const metrics = this.createMetrics(files.length, totalLinesOfCode, findings);
    
    const executionTime = Date.now() - startTime;
    
    console.log(`✅ Code Quality Analysis Complete:`);
    console.log(`   Files: ${files.length}`);
    console.log(`   Lines of Code: ${totalLinesOfCode}`);
    console.log(`   Issues Found: ${findings.length}`);
    console.log(`   Quality Score: ${metrics.score}/100`);
    console.log(`   Execution Time: ${executionTime}ms`);

    return {
      success: true,
      findings,
      metrics,
      suggestions,
      timestamp: new Date().toISOString(),
      executionTime
    };
  }

  private async analyzeTypeScript(filePath: string, content: string): Promise<Finding[]> {
    return this.typeScriptRules.analyze(filePath, content);
  }

  private async analyzeReact(filePath: string, content: string): Promise<Finding[]> {
    return this.reactRules.analyze(filePath, content);
  }

  private async analyzeNode(filePath: string, content: string): Promise<Finding[]> {
    return this.nodeRules.analyze(filePath, content);
  }

  private async analyzeFinancialCode(filePath: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];

    // Check for financial calculation accuracy
    if (content.includes('z-score') || content.includes('zScore') || content.includes('Z-Score')) {
      if (!content.includes('Math.sqrt') && !content.includes('variance')) {
        findings.push(super.createFinding(
          'warning',
          'medium',
          'financial-accuracy',
          'Z-Score Calculation Missing Variance',
          'Z-Score calculations should include proper variance calculation for accuracy',
          filePath,
          undefined,
          undefined,
          'financial-z-score-accuracy'
        ));
      }
    }

    // Check for proper decimal precision in financial calculations
    const decimalRegex = /(\d+\.\d{3,})/g;
    const matches = content.match(decimalRegex);
    if (matches) {
      findings.push(super.createFinding(
        'info',
        'low',
        'financial-precision',
        'High Precision Decimal Detected',
        'Consider using proper financial decimal handling for accuracy',
        filePath,
        undefined,
        undefined,
        'financial-decimal-precision'
      ));
    }

    // Check for API error handling in financial services
    if (filePath.includes('service') && content.includes('API')) {
      if (!content.includes('try') || !content.includes('catch')) {
        findings.push(super.createFinding(
          'warning',
          'high',
          'error-handling',
          'Missing Error Handling in Financial Service',
          'Financial API services must have comprehensive error handling',
          filePath,
          undefined,
          undefined,
          'financial-error-handling'
        ));
      }
    }

    // Check for proper TypeScript strict mode usage
    if (content.includes('any') && !content.includes('// @ts-ignore')) {
      const anyMatches = content.match(/:\s*any\b/g);
      if (anyMatches && anyMatches.length > 2) {
        findings.push(super.createFinding(
          'warning',
          'medium',
          'type-safety',
          'Excessive Use of Any Type',
          'Replace any types with specific interfaces for better type safety',
          filePath,
          undefined,
          undefined,
          'typescript-no-any'
        ));
      }
    }

    return findings;
  }

  private generateSuggestions(findings: Finding[], files: string[]): Suggestion[] {
    const suggestions: Suggestion[] = [];
    
    // Group findings by category for targeted suggestions
    const findingsByCategory = findings.reduce((acc, finding) => {
      if (!acc[finding.category]) acc[finding.category] = [];
      acc[finding.category].push(finding);
      return acc;
    }, {} as Record<string, Finding[]>);

    // Complexity suggestions
    if (findingsByCategory['complexity']?.length > 5) {
      suggestions.push(super.createSuggestion(
        'Reduce Code Complexity',
        'Multiple files have high complexity. Consider breaking down large functions and classes.',
        'high',
        'medium',
        'maintainability',
        files.filter(f => f.includes('.ts') || f.includes('.js')),
        'Extract complex logic into smaller, focused functions. Use composition over inheritance.'
      ));
    }

    // Import optimization
    if (findingsByCategory['imports']?.length > 10) {
      suggestions.push(super.createSuggestion(
        'Optimize Import Structure',
        'Many unused imports detected. Clean up imports to improve bundle size.',
        'medium',
        'low',
        'performance',
        undefined,
        'Run automated import cleanup and consider barrel exports for better organization.'
      ));
    }

    // TypeScript strict mode
    if (findingsByCategory['type-safety']?.length > 3) {
      suggestions.push(super.createSuggestion(
        'Improve Type Safety',
        'Enable stricter TypeScript settings and replace any types with specific interfaces.',
        'high',
        'medium',
        'reliability',
        undefined,
        'Update tsconfig.json with strict: true and noImplicitAny: true. Create proper interfaces.'
      ));
    }

    // Financial code accuracy
    if (findingsByCategory['financial-accuracy']?.length > 0) {
      suggestions.push(super.createSuggestion(
        'Enhance Financial Calculation Accuracy',
        'Financial calculations need improved precision and error handling.',
        'high',
        'high',
        'accuracy',
        files.filter(f => f.includes('service') || f.includes('calculate')),
        'Implement proper statistical libraries and add comprehensive validation for financial data.'
      ));
    }

    return suggestions;
  }
}