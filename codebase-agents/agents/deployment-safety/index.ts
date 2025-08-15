// Deployment Safety Agent - Critical production deployment validation

import { BaseAgent } from '../../core/base-agent.js';
import { AgentConfig, AgentResult, Finding, Suggestion, AgentMetrics } from '../../types/agent-interfaces.js';
import { PreDeploymentValidator } from './validators/pre-deployment-validator.js';
import { DatabaseMigrationValidator } from './validators/database-migration-validator.js';
import { EnvironmentParityValidator } from './validators/environment-parity-validator.js';
import { DependencyValidator } from './validators/dependency-validator.js';
import { ApiCompatibilityChecker } from './checkers/api-compatibility-checker.js';
import { DataPipelineChecker } from './checkers/data-pipeline-checker.js';
import { CriticalPathTester } from './checkers/critical-path-tester.js';
import { PerformanceRegressionDetector } from './checkers/performance-regression-detector.js';
import { BreakingChangeDetector } from './analyzers/breaking-change-detector.js';
import { RiskAssessmentAnalyzer } from './analyzers/risk-assessment-analyzer.js';
import * as fs from 'fs';
import * as path from 'path';

export class DeploymentSafetyAgent extends BaseAgent {
  name = 'deployment-safety-agent';
  version = '1.0.0';
  description = 'Validates deployment safety and prevents production failures for financial applications';
  capabilities = [
    'pre-deployment-validation',
    'migration-safety-analysis',
    'api-compatibility-checking',
    'data-pipeline-validation',
    'performance-regression-detection',
    'critical-path-testing',
    'risk-assessment',
    'rollback-planning',
    'financial-data-integrity'
  ];
  supportedFileTypes = ['.ts', '.tsx', '.js', '.jsx', '.json', '.yml', '.yaml', '.sql', '.md'];
  dependencies = ['semver', 'sql-parser'];

  private preDeploymentValidator = new PreDeploymentValidator();
  private databaseValidator = new DatabaseMigrationValidator();
  private environmentValidator = new EnvironmentParityValidator();
  private dependencyValidator = new DependencyValidator();
  private apiChecker = new ApiCompatibilityChecker();
  private dataPipelineChecker = new DataPipelineChecker();
  private criticalPathTester = new CriticalPathTester();
  private performanceDetector = new PerformanceRegressionDetector();
  private breakingChangeDetector = new BreakingChangeDetector();
  private riskAssessment = new RiskAssessmentAnalyzer();

  async analyze(files: string[], config: AgentConfig): Promise<AgentResult> {
    const startTime = Date.now();
    console.log('🚀 Deployment Safety Agent: Starting comprehensive deployment validation...');

    let findings: Finding[] = [];
    const metrics: AgentMetrics = {
      filesAnalyzed: files.length,
      linesOfCode: 0,
      issues: 0,
      warnings: 0,
      suggestions: 0,
      score: 100
    };

    try {
      // 1. Pre-deployment validation
      console.log('📋 Running pre-deployment validation checks...');
      const preDeploymentFindings = await this.preDeploymentValidator.validate(config);
      findings.push(...preDeploymentFindings);

      // 2. Database migration safety analysis
      console.log('🗄️ Analyzing database migration safety...');
      const migrationFindings = await this.databaseValidator.validateMigrations(files);
      findings.push(...migrationFindings);

      // 3. Environment configuration validation
      console.log('🔧 Validating environment configuration...');
      const environmentFindings = await this.environmentValidator.validate(config);
      findings.push(...environmentFindings);

      // 4. Dependency analysis
      console.log('📦 Analyzing dependency changes and compatibility...');
      const dependencyFindings = await this.dependencyValidator.validate(files);
      findings.push(...dependencyFindings);

      // 5. API compatibility checking
      console.log('🔗 Checking API backward compatibility...');
      const apiFindings = await this.apiChecker.checkCompatibility(files);
      findings.push(...apiFindings);

      // 6. Financial data pipeline validation
      console.log('💰 Validating financial data pipeline integrity...');
      const pipelineFindings = await this.dataPipelineChecker.validate(config);
      findings.push(...pipelineFindings);

      // 7. Critical path testing
      console.log('🛤️ Testing critical user journeys...');
      const criticalPathFindings = await this.criticalPathTester.test(config);
      findings.push(...criticalPathFindings);

      // 8. Performance regression detection
      console.log('⚡ Detecting performance regressions...');
      const performanceFindings = await this.performanceDetector.detect(files);
      findings.push(...performanceFindings);

      // 9. Breaking change detection
      console.log('💥 Detecting breaking changes...');
      const breakingChangeFindings = await this.breakingChangeDetector.detect(files);
      findings.push(...breakingChangeFindings);

      // Calculate metrics
      metrics.linesOfCode = this.calculateLinesOfCode(files);
      metrics.issues = findings.filter(f => f.type === 'error').length;
      metrics.warnings = findings.filter(f => f.type === 'warning').length;

      // 10. Risk assessment and scoring
      console.log('📊 Performing deployment risk assessment...');
      const riskAnalysis = await this.riskAssessment.assess(findings, config);
      metrics.score = riskAnalysis.safetyScore;

      // Generate suggestions
      const suggestions = this.generateDeploymentSuggestions(findings, riskAnalysis);
      metrics.suggestions = suggestions.length;

      const executionTime = Date.now() - startTime;
      console.log(`✅ Deployment Safety Analysis Complete: ${findings.length} findings, Score: ${metrics.score}/100`);

      return {
        success: true,
        agent: this.name,
        version: this.version,
        timestamp: new Date().toISOString(),
        executionTime,
        findings,
        suggestions,
        metrics,
        summary: this.generateSummary(findings, riskAnalysis),
        metadata: {
          riskLevel: riskAnalysis.riskLevel,
          deploymentRecommendation: riskAnalysis.recommendation,
          criticalIssues: findings.filter(f => f.severity === 'critical').length,
          rollbackPlanRequired: riskAnalysis.requiresRollbackPlan
        }
      };

    } catch (error) {
      console.error('❌ Deployment Safety Agent failed:', error);
      findings.push(super.createFinding(
        'error',
        'critical',
        'agent-failure',
        'Deployment Safety Analysis Failed',
        `Agent execution failed: ${error}`,
        'deployment-safety-agent'
      ));

      return {
        success: false,
        agent: this.name,
        version: this.version,
        timestamp: new Date().toISOString(),
        executionTime: Date.now() - startTime,
        findings,
        suggestions: [],
        metrics,
        summary: 'Deployment safety analysis failed - manual review required',
        metadata: { error: String(error) }
      };
    }
  }

  private calculateLinesOfCode(files: string[]): number {
    let totalLines = 0;
    for (const file of files) {
      try {
        if (fs.existsSync(file)) {
          const content = fs.readFileSync(file, 'utf-8');
          totalLines += content.split('\n').length;
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }
    return totalLines;
  }

  private generateDeploymentSuggestions(findings: Finding[], riskAnalysis: any): Suggestion[] {
    const suggestions: Suggestion[] = [];

    // Critical deployment blocking issues
    const criticalFindings = findings.filter(f => f.severity === 'critical');
    if (criticalFindings.length > 0) {
      suggestions.push(super.createSuggestion(
        'Block Deployment - Critical Issues Detected',
        `Found ${criticalFindings.length} critical issues that must be resolved before deployment`,
        'critical',
        'high',
        'reliability',
        undefined,
        'Do not proceed with deployment until all critical issues are resolved. Consider hotfix deployment strategy.'
      ));
    }

    // Database migration safety
    const migrationIssues = findings.filter(f => f.category === 'database-migration');
    if (migrationIssues.length > 0) {
      suggestions.push(super.createSuggestion(
        'Review Database Migration Safety',
        'Database migrations contain potential risks that need careful review',
        'high',
        'medium',
        'data-integrity',
        undefined,
        'Create database backup, test migrations in staging environment, prepare rollback plan.'
      ));
    }

    // API compatibility concerns
    const apiIssues = findings.filter(f => f.category === 'api-compatibility');
    if (apiIssues.length > 0) {
      suggestions.push(super.createSuggestion(
        'Implement API Versioning Strategy',
        'Breaking API changes detected that may affect frontend compatibility',
        'high',
        'medium',
        'compatibility',
        undefined,
        'Consider API versioning, feature flags, or gradual rollout strategy.'
      ));
    }

    // Performance regression warning
    const performanceIssues = findings.filter(f => f.category === 'performance');
    if (performanceIssues.length > 0) {
      suggestions.push(super.createSuggestion(
        'Monitor Performance Post-Deployment',
        'Potential performance regressions detected',
        'medium',
        'low',
        'performance',
        undefined,
        'Enable performance monitoring, set up alerts, prepare rollback if performance degrades significantly.'
      ));
    }

    // Financial data pipeline concerns
    const pipelineIssues = findings.filter(f => f.category === 'data-pipeline');
    if (pipelineIssues.length > 0) {
      suggestions.push(super.createSuggestion(
        'Validate Financial Data Pipeline',
        'Issues detected in financial data processing pipeline',
        'high',
        'high',
        'data-integrity',
        undefined,
        'Test FRED and Twelve Data API connections, validate Z-score calculations, check economic indicator freshness.'
      ));
    }

    return suggestions;
  }

  private generateSummary(findings: Finding[], riskAnalysis: any): string {
    const critical = findings.filter(f => f.severity === 'critical').length;
    const high = findings.filter(f => f.severity === 'high').length;
    const medium = findings.filter(f => f.severity === 'medium').length;

    if (critical > 0) {
      return `🚨 DEPLOYMENT BLOCKED: ${critical} critical issues must be resolved before deployment. Risk Level: ${riskAnalysis.riskLevel}`;
    } else if (high > 0) {
      return `⚠️ HIGH RISK DEPLOYMENT: ${high} high-priority issues detected. Proceed with caution. Risk Level: ${riskAnalysis.riskLevel}`;
    } else if (medium > 0) {
      return `✅ DEPLOYMENT APPROVED: ${medium} medium-priority issues to monitor. Risk Level: ${riskAnalysis.riskLevel}`;
    } else {
      return `✅ SAFE TO DEPLOY: No critical issues detected. Risk Level: ${riskAnalysis.riskLevel}`;
    }
  }
}