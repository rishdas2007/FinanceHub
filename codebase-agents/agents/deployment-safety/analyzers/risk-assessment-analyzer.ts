// Risk assessment analyzer - evaluates overall deployment risk

import { Finding, AgentConfig } from '../../../types/agent-interfaces.js';

interface RiskAssessment {
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  safetyScore: number; // 0-100
  recommendation: 'proceed' | 'proceed-with-caution' | 'review-required' | 'block-deployment';
  requiresRollbackPlan: boolean;
  estimatedDowntime: number;
  confidenceLevel: number;
  riskFactors: RiskFactor[];
  mitigationStrategies: MitigationStrategy[];
}

interface RiskFactor {
  category: string;
  description: string;
  impact: 'low' | 'medium' | 'high' | 'critical';
  probability: 'low' | 'medium' | 'high';
  riskScore: number;
}

interface MitigationStrategy {
  risk: string;
  strategy: string;
  effort: 'low' | 'medium' | 'high';
  effectiveness: 'low' | 'medium' | 'high';
}

export class RiskAssessmentAnalyzer {
  async assess(findings: Finding[], config: AgentConfig): Promise<RiskAssessment> {
    // Calculate risk factors from findings
    const riskFactors = this.calculateRiskFactors(findings);
    
    // Determine overall risk level
    const riskLevel = this.determineRiskLevel(riskFactors);
    
    // Calculate safety score
    const safetyScore = this.calculateSafetyScore(findings, riskFactors);
    
    // Generate recommendation
    const recommendation = this.generateRecommendation(riskLevel, safetyScore, findings);
    
    // Assess rollback requirements
    const requiresRollbackPlan = this.assessRollbackRequirement(findings);
    
    // Estimate downtime
    const estimatedDowntime = this.estimateDowntime(findings);
    
    // Calculate confidence level
    const confidenceLevel = this.calculateConfidenceLevel(findings);
    
    // Generate mitigation strategies
    const mitigationStrategies = this.generateMitigationStrategies(riskFactors, findings);

    return {
      riskLevel,
      safetyScore,
      recommendation,
      requiresRollbackPlan,
      estimatedDowntime,
      confidenceLevel,
      riskFactors,
      mitigationStrategies
    };
  }

  private calculateRiskFactors(findings: Finding[]): RiskFactor[] {
    const riskFactors: RiskFactor[] = [];

    // Categorize findings by risk type
    const categories = this.categorizeFindingsByRisk(findings);

    for (const [category, categoryFindings] of Object.entries(categories)) {
      if (categoryFindings.length === 0) continue;

      const criticalCount = categoryFindings.filter(f => f.severity === 'critical').length;
      const highCount = categoryFindings.filter(f => f.severity === 'high').length;
      const mediumCount = categoryFindings.filter(f => f.severity === 'medium').length;

      // Calculate impact based on severity distribution
      let impact: 'low' | 'medium' | 'high' | 'critical' = 'low';
      let probability: 'low' | 'medium' | 'high' = 'low';
      let riskScore = 0;

      if (criticalCount > 0) {
        impact = 'critical';
        probability = 'high';
        riskScore = 90 + (criticalCount * 5);
      } else if (highCount > 2) {
        impact = 'high';
        probability = 'high';
        riskScore = 70 + (highCount * 3);
      } else if (highCount > 0) {
        impact = 'high';
        probability = 'medium';
        riskScore = 60 + (highCount * 5);
      } else if (mediumCount > 5) {
        impact = 'medium';
        probability = 'high';
        riskScore = 50 + (mediumCount * 2);
      } else if (mediumCount > 0) {
        impact = 'medium';
        probability = 'medium';
        riskScore = 30 + (mediumCount * 3);
      } else {
        impact = 'low';
        probability = 'low';
        riskScore = 10 + categoryFindings.length;
      }

      riskFactors.push({
        category,
        description: this.generateRiskDescription(category, categoryFindings),
        impact,
        probability,
        riskScore: Math.min(riskScore, 100)
      });
    }

    return riskFactors;
  }

  private categorizeFindingsByRisk(findings: Finding[]): Record<string, Finding[]> {
    const categories: Record<string, Finding[]> = {
      'Database Operations': [],
      'API Compatibility': [],
      'Data Pipeline': [],
      'Security': [],
      'Performance': [],
      'Environment': [],
      'Dependencies': [],
      'Critical Paths': [],
      'Breaking Changes': [],
      'Build Process': []
    };

    for (const finding of findings) {
      switch (finding.category) {
        case 'database-migration':
        case 'database':
          categories['Database Operations'].push(finding);
          break;
        case 'api-compatibility':
          categories['API Compatibility'].push(finding);
          break;
        case 'data-pipeline':
          categories['Data Pipeline'].push(finding);
          break;
        case 'security':
          categories['Security'].push(finding);
          break;
        case 'performance':
          categories['Performance'].push(finding);
          break;
        case 'environment':
        case 'environment-parity':
          categories['Environment'].push(finding);
          break;
        case 'dependencies':
          categories['Dependencies'].push(finding);
          break;
        case 'critical-path':
          categories['Critical Paths'].push(finding);
          break;
        case 'breaking-changes':
          categories['Breaking Changes'].push(finding);
          break;
        case 'build':
          categories['Build Process'].push(finding);
          break;
        default:
          // Add to most relevant category based on finding type
          if (finding.severity === 'critical') {
            categories['Critical Paths'].push(finding);
          } else {
            categories['Environment'].push(finding);
          }
      }
    }

    return categories;
  }

  private generateRiskDescription(category: string, findings: Finding[]): string {
    const severityCounts = {
      critical: findings.filter(f => f.severity === 'critical').length,
      high: findings.filter(f => f.severity === 'high').length,
      medium: findings.filter(f => f.severity === 'medium').length,
      low: findings.filter(f => f.severity === 'low').length
    };

    let description = `${category}: `;
    
    if (severityCounts.critical > 0) {
      description += `${severityCounts.critical} critical issues`;
    } else if (severityCounts.high > 0) {
      description += `${severityCounts.high} high-priority issues`;
    } else if (severityCounts.medium > 0) {
      description += `${severityCounts.medium} medium-priority issues`;
    } else {
      description += `${severityCounts.low} low-priority issues`;
    }

    // Add specific context for financial applications
    if (category === 'Data Pipeline') {
      description += ' affecting financial data integrity';
    } else if (category === 'API Compatibility') {
      description += ' that may break frontend functionality';
    } else if (category === 'Database Operations') {
      description += ' with potential for data loss';
    }

    return description;
  }

  private determineRiskLevel(riskFactors: RiskFactor[]): 'low' | 'medium' | 'high' | 'critical' {
    const maxRiskScore = Math.max(...riskFactors.map(rf => rf.riskScore), 0);
    const hasCriticalImpact = riskFactors.some(rf => rf.impact === 'critical');
    const hasHighImpactWithHighProbability = riskFactors.some(rf => 
      rf.impact === 'high' && rf.probability === 'high'
    );

    if (maxRiskScore >= 90 || hasCriticalImpact) {
      return 'critical';
    } else if (maxRiskScore >= 70 || hasHighImpactWithHighProbability) {
      return 'high';
    } else if (maxRiskScore >= 40) {
      return 'medium';
    } else {
      return 'low';
    }
  }

  private calculateSafetyScore(findings: Finding[], riskFactors: RiskFactor[]): number {
    let score = 100;

    // Deduct points based on finding severity
    for (const finding of findings) {
      switch (finding.severity) {
        case 'critical':
          score -= 15;
          break;
        case 'high':
          score -= 8;
          break;
        case 'medium':
          score -= 3;
          break;
        case 'low':
          score -= 1;
          break;
      }
    }

    // Additional deductions for high-risk factors
    for (const riskFactor of riskFactors) {
      if (riskFactor.impact === 'critical' && riskFactor.probability === 'high') {
        score -= 20;
      } else if (riskFactor.impact === 'high' && riskFactor.probability === 'high') {
        score -= 10;
      }
    }

    // Financial application specific deductions
    const financialRisks = findings.filter(f => 
      f.category === 'data-pipeline' || 
      f.category === 'database-migration' ||
      f.title?.toLowerCase().includes('financial') ||
      f.description?.toLowerCase().includes('financial')
    );

    if (financialRisks.length > 0) {
      score -= financialRisks.length * 2; // Extra penalty for financial risks
    }

    return Math.max(score, 0);
  }

  private generateRecommendation(
    riskLevel: string, 
    safetyScore: number, 
    findings: Finding[]
  ): 'proceed' | 'proceed-with-caution' | 'review-required' | 'block-deployment' {
    const criticalFindings = findings.filter(f => f.severity === 'critical').length;
    const highFindings = findings.filter(f => f.severity === 'high').length;

    // Block deployment for critical issues
    if (criticalFindings > 0 || riskLevel === 'critical') {
      return 'block-deployment';
    }

    // Require review for high risk
    if (riskLevel === 'high' || safetyScore < 60) {
      return 'review-required';
    }

    // Proceed with caution for medium risk
    if (riskLevel === 'medium' || highFindings > 2 || safetyScore < 80) {
      return 'proceed-with-caution';
    }

    // Safe to proceed
    return 'proceed';
  }

  private assessRollbackRequirement(findings: Finding[]): boolean {
    // Require rollback plan for:
    // 1. Database migrations
    // 2. Breaking changes
    // 3. Critical path failures
    // 4. API compatibility issues

    const requiresRollback = findings.some(f => 
      f.category === 'database-migration' ||
      f.category === 'breaking-changes' ||
      f.category === 'api-compatibility' ||
      (f.category === 'critical-path' && f.severity === 'critical') ||
      f.severity === 'critical'
    );

    return requiresRollback;
  }

  private estimateDowntime(findings: Finding[]): number {
    let estimatedDowntime = 0; // in minutes

    // Base downtime for deployment
    estimatedDowntime += 2;

    // Additional downtime for database migrations
    const dbMigrations = findings.filter(f => f.category === 'database-migration');
    estimatedDowntime += dbMigrations.length * 5;

    // Additional downtime for critical issues
    const criticalIssues = findings.filter(f => f.severity === 'critical');
    estimatedDowntime += criticalIssues.length * 3;

    // Additional downtime for data pipeline issues
    const pipelineIssues = findings.filter(f => f.category === 'data-pipeline');
    estimatedDowntime += pipelineIssues.length * 2;

    // Cap at reasonable maximum
    return Math.min(estimatedDowntime, 60);
  }

  private calculateConfidenceLevel(findings: Finding[]): number {
    let confidence = 90; // Start with high confidence

    // Reduce confidence for unanalyzed areas
    const categories = new Set(findings.map(f => f.category));
    const expectedCategories = [
      'build', 'dependencies', 'environment', 'api-compatibility', 
      'data-pipeline', 'critical-path', 'performance'
    ];

    const missingCategories = expectedCategories.filter(cat => !categories.has(cat));
    confidence -= missingCategories.length * 5;

    // Reduce confidence for error findings (analysis failures)
    const errorFindings = findings.filter(f => f.type === 'error' && f.title?.includes('Failed'));
    confidence -= errorFindings.length * 10;

    // Increase confidence for comprehensive analysis
    if (findings.length > 20) {
      confidence += 5;
    }

    return Math.max(Math.min(confidence, 100), 50);
  }

  private generateMitigationStrategies(riskFactors: RiskFactor[], findings: Finding[]): MitigationStrategy[] {
    const strategies: MitigationStrategy[] = [];

    for (const riskFactor of riskFactors) {
      switch (riskFactor.category) {
        case 'Database Operations':
          strategies.push({
            risk: riskFactor.category,
            strategy: 'Create full database backup, test migrations in staging, prepare rollback scripts',
            effort: 'medium',
            effectiveness: 'high'
          });
          break;

        case 'API Compatibility':
          strategies.push({
            risk: riskFactor.category,
            strategy: 'Implement API versioning, use feature flags, coordinate with frontend team',
            effort: 'high',
            effectiveness: 'high'
          });
          break;

        case 'Data Pipeline':
          strategies.push({
            risk: riskFactor.category,
            strategy: 'Test data pipeline connectivity, validate API keys, monitor data freshness',
            effort: 'low',
            effectiveness: 'medium'
          });
          break;

        case 'Critical Paths':
          strategies.push({
            risk: riskFactor.category,
            strategy: 'Run comprehensive integration tests, validate critical user journeys',
            effort: 'medium',
            effectiveness: 'high'
          });
          break;

        case 'Performance':
          strategies.push({
            risk: riskFactor.category,
            strategy: 'Enable performance monitoring, set up alerts, prepare to rollback if degraded',
            effort: 'low',
            effectiveness: 'medium'
          });
          break;

        case 'Breaking Changes':
          strategies.push({
            risk: riskFactor.category,
            strategy: 'Implement gradual rollout, use blue-green deployment, communicate changes',
            effort: 'high',
            effectiveness: 'high'
          });
          break;

        default:
          strategies.push({
            risk: riskFactor.category,
            strategy: 'Monitor closely post-deployment, have rollback plan ready',
            effort: 'low',
            effectiveness: 'medium'
          });
      }
    }

    // Add financial application specific strategies
    const hasFinancialRisks = findings.some(f => 
      f.category === 'data-pipeline' || f.description?.toLowerCase().includes('financial')
    );

    if (hasFinancialRisks) {
      strategies.push({
        risk: 'Financial Data Integrity',
        strategy: 'Validate financial calculations, monitor Z-score accuracy, ensure FRED/Twelve Data connectivity',
        effort: 'medium',
        effectiveness: 'high'
      });
    }

    return strategies;
  }
}