/**
 * Service Consolidation Analyzer - Advanced Service Architecture Optimization
 * 
 * @class ServiceConsolidationAnalyzer
 * @description Analyzes service architecture to identify consolidation opportunities,
 * reduces complexity while maintaining functionality, and provides actionable recommendations
 * for service optimization based on dependency analysis, usage patterns, and business domains.
 * 
 * @author AI Agent Architecture Enhancement
 * @version 1.0.0
 * @since 2025-08-29
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../shared/utils/logger';

interface ServiceMetrics {
  name: string;
  filePath: string;
  sizeKB: number;
  lines: number;
  exports: string[];
  imports: string[];
  dependencies: string[];
  complexity: number;
  lastModified: Date;
  usageScore: number;
}

interface ServiceCluster {
  domain: string;
  services: string[];
  consolidationScore: number;
  sharedDependencies: string[];
  recommendedAction: 'merge' | 'split' | 'optimize' | 'maintain';
  reasoning: string;
}

interface ConsolidationRecommendation {
  type: 'merge_services' | 'extract_common' | 'split_service' | 'optimize_imports';
  priority: 'high' | 'medium' | 'low';
  services: string[];
  description: string;
  expectedBenefits: string[];
  estimatedEffort: 'low' | 'medium' | 'high';
  riskLevel: 'low' | 'medium' | 'high';
  implementationSteps: string[];
}

interface ArchitectureHealthReport {
  totalServices: number;
  servicesByDomain: Record<string, number>;
  complexityMetrics: {
    averageServiceSize: number;
    oversizedServices: number;
    undersizedServices: number;
    totalLinesOfCode: number;
  };
  dependencyMetrics: {
    circularDependencies: string[][];
    highCouplingServices: string[];
    orphanedServices: string[];
  };
  recommendations: ConsolidationRecommendation[];
  healthScore: number; // 0-100
}

export class ServiceConsolidationAnalyzer {
  private static instance: ServiceConsolidationAnalyzer;
  private servicesPath: string;
  private serviceMetrics: Map<string, ServiceMetrics> = new Map();

  private constructor() {
    this.servicesPath = path.join(process.cwd(), 'server/services');
  }

  static getInstance(): ServiceConsolidationAnalyzer {
    if (!ServiceConsolidationAnalyzer.instance) {
      ServiceConsolidationAnalyzer.instance = new ServiceConsolidationAnalyzer();
    }
    return ServiceConsolidationAnalyzer.instance;
  }

  /**
   * Perform comprehensive service architecture analysis
   */
  async analyzeServiceArchitecture(): Promise<ArchitectureHealthReport> {
    logger.info('Starting comprehensive service architecture analysis...');
    
    try {
      // Phase 1: Collect service metrics
      await this.collectServiceMetrics();
      
      // Phase 2: Analyze service clusters and domains
      const serviceClusters = this.analyzeServiceClusters();
      
      // Phase 3: Identify consolidation opportunities
      const recommendations = this.generateConsolidationRecommendations(serviceClusters);
      
      // Phase 4: Calculate architecture health
      const healthReport = this.generateHealthReport(serviceClusters, recommendations);
      
      logger.info(`Architecture analysis complete. Health Score: ${healthReport.healthScore}/100`);
      return healthReport;
      
    } catch (error) {
      logger.error('Service architecture analysis failed', { error });
      throw error;
    }
  }

  /**
   * Collect detailed metrics for all services
   */
  private async collectServiceMetrics(): Promise<void> {
    try {
      const files = await fs.readdir(this.servicesPath);
      const serviceFiles = files.filter(file => file.endsWith('.ts') && !file.endsWith('.d.ts'));
      
      for (const file of serviceFiles) {
        const filePath = path.join(this.servicesPath, file);
        const metrics = await this.analyzeServiceFile(filePath, file);
        this.serviceMetrics.set(metrics.name, metrics);
      }
      
      logger.info(`Collected metrics for ${this.serviceMetrics.size} services`);
    } catch (error) {
      logger.error('Failed to collect service metrics', { error });
      throw error;
    }
  }

  /**
   * Analyze individual service file for metrics
   */
  private async analyzeServiceFile(filePath: string, fileName: string): Promise<ServiceMetrics> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const stats = await fs.stat(filePath);
      
      const lines = content.split('\n');
      const sizeKB = Math.round(stats.size / 1024);
      
      // Extract imports and exports
      const imports = this.extractImports(content);
      const exports = this.extractExports(content);
      const dependencies = this.extractDependencies(content);
      
      // Calculate complexity score
      const complexity = this.calculateComplexity(content, lines);
      
      // Calculate usage score based on imports by other services
      const usageScore = await this.calculateUsageScore(fileName);

      return {
        name: fileName.replace('.ts', ''),
        filePath,
        sizeKB,
        lines: lines.length,
        imports,
        exports,
        dependencies,
        complexity,
        lastModified: stats.mtime,
        usageScore
      };
    } catch (error) {
      logger.error(`Failed to analyze service file: ${fileName}`, { error });
      return {
        name: fileName.replace('.ts', ''),
        filePath,
        sizeKB: 0,
        lines: 0,
        imports: [],
        exports: [],
        dependencies: [],
        complexity: 0,
        lastModified: new Date(),
        usageScore: 0
      };
    }
  }

  /**
   * Extract import statements from service content
   */
  private extractImports(content: string): string[] {
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    const imports: string[] = [];
    let match;
    
    while ((match = importRegex.exec(content)) !== null) {
      imports.push(match[1]);
    }
    
    return imports;
  }

  /**
   * Extract export statements from service content
   */
  private extractExports(content: string): string[] {
    const exportRegex = /export\s+(?:class|function|const|interface|type)\s+(\w+)/g;
    const exports: string[] = [];
    let match;
    
    while ((match = exportRegex.exec(content)) !== null) {
      exports.push(match[1]);
    }
    
    return exports;
  }

  /**
   * Extract service dependencies
   */
  private extractDependencies(content: string): string[] {
    const serviceImportRegex = /from\s+['"][^'"]*\/services\/([^'"\/]+)['"]/g;
    const dependencies: string[] = [];
    let match;
    
    while ((match = serviceImportRegex.exec(content)) !== null) {
      dependencies.push(match[1]);
    }
    
    return [...new Set(dependencies)]; // Remove duplicates
  }

  /**
   * Calculate service complexity score
   */
  private calculateComplexity(content: string, lines: string[]): number {
    let complexity = 0;
    
    // Function/method count
    const functionCount = (content.match(/function\s+\w+|=>\s*{|\w+\s*\(/g) || []).length;
    complexity += functionCount * 2;
    
    // Class count
    const classCount = (content.match(/class\s+\w+/g) || []).length;
    complexity += classCount * 5;
    
    // Interface count
    const interfaceCount = (content.match(/interface\s+\w+/g) || []).length;
    complexity += interfaceCount * 2;
    
    // Conditional complexity
    const conditionals = (content.match(/if\s*\(|switch\s*\(|catch\s*\(|while\s*\(|for\s*\(/g) || []).length;
    complexity += conditionals;
    
    // Normalize by file size
    const normalizedComplexity = Math.round((complexity / lines.length) * 100);
    
    return Math.min(normalizedComplexity, 100); // Cap at 100
  }

  /**
   * Calculate usage score based on how often this service is imported
   */
  private async calculateUsageScore(fileName: string): Promise<number> {
    try {
      const serviceName = fileName.replace('.ts', '');
      const allFiles = await fs.readdir(this.servicesPath);
      let usageCount = 0;
      
      for (const file of allFiles) {
        if (file === fileName) continue;
        
        const filePath = path.join(this.servicesPath, file);
        const content = await fs.readFile(filePath, 'utf-8');
        
        if (content.includes(serviceName)) {
          usageCount++;
        }
      }
      
      // Also check routes and other directories
      const routesPath = path.join(process.cwd(), 'server/routes');
      try {
        const routeFiles = await fs.readdir(routesPath);
        for (const file of routeFiles) {
          const filePath = path.join(routesPath, file);
          const content = await fs.readFile(filePath, 'utf-8');
          if (content.includes(serviceName)) {
            usageCount++;
          }
        }
      } catch (error) {
        // Routes directory might not exist or be accessible
      }
      
      return Math.min(usageCount * 10, 100); // Normalize to 0-100
    } catch (error) {
      return 0;
    }
  }

  /**
   * Analyze services into domain-based clusters
   */
  private analyzeServiceClusters(): ServiceCluster[] {
    const clusters: ServiceCluster[] = [];
    const domains = this.identifyServiceDomains();
    
    for (const [domain, serviceNames] of domains.entries()) {
      const domainServices = serviceNames.map(name => this.serviceMetrics.get(name)).filter(Boolean) as ServiceMetrics[];
      
      // Calculate shared dependencies
      const sharedDeps = this.findSharedDependencies(domainServices);
      
      // Calculate consolidation score
      const consolidationScore = this.calculateConsolidationScore(domainServices);
      
      // Determine recommended action
      const recommendedAction = this.determineRecommendedAction(domainServices, consolidationScore);
      
      clusters.push({
        domain,
        services: serviceNames,
        consolidationScore,
        sharedDependencies: sharedDeps,
        recommendedAction,
        reasoning: this.generateClusterReasoning(domainServices, recommendedAction, consolidationScore)
      });
    }
    
    return clusters;
  }

  /**
   * Identify service domains based on naming patterns and functionality
   */
  private identifyServiceDomains(): Map<string, string[]> {
    const domains = new Map<string, string[]>();
    
    // Define domain patterns
    const domainPatterns = {
      'ETF': ['etf-', 'technical-', 'zscore-', 'bollinger-', 'rsi-'],
      'Economic': ['economic-', 'fred-', 'macro-', 'gdp-', 'cpi-', 'ppi-'],
      'Market': ['market-', 'trading-', 'sector-', 'momentum-'],
      'Data': ['data-', 'historical-', 'backfill-', 'validation-', 'quality-'],
      'Cache': ['cache-', 'redis-', 'memory-', 'unified-'],
      'API': ['api-', 'batch-', 'rate-limiting', 'circuit-breaker'],
      'Analytics': ['statistical-', 'correlation-', 'analysis-', 'insight-'],
      'AI': ['ai-', 'openai-', 'sentiment-', 'mood-'],
      'Infrastructure': ['performance-', 'monitoring-', 'health-', 'scheduler-']
    };
    
    // Initialize domains
    Object.keys(domainPatterns).forEach(domain => {
      domains.set(domain, []);
    });
    domains.set('Miscellaneous', []);
    
    // Categorize services
    for (const serviceName of this.serviceMetrics.keys()) {
      let categorized = false;
      
      for (const [domain, patterns] of Object.entries(domainPatterns)) {
        if (patterns.some(pattern => serviceName.toLowerCase().includes(pattern.replace('-', '')))) {
          domains.get(domain)!.push(serviceName);
          categorized = true;
          break;
        }
      }
      
      if (!categorized) {
        domains.get('Miscellaneous')!.push(serviceName);
      }
    }
    
    // Remove empty domains
    for (const [domain, services] of domains.entries()) {
      if (services.length === 0) {
        domains.delete(domain);
      }
    }
    
    return domains;
  }

  /**
   * Find shared dependencies across services in a domain
   */
  private findSharedDependencies(services: ServiceMetrics[]): string[] {
    if (services.length < 2) return [];
    
    const dependencyCount = new Map<string, number>();
    
    services.forEach(service => {
      service.dependencies.forEach(dep => {
        dependencyCount.set(dep, (dependencyCount.get(dep) || 0) + 1);
      });
    });
    
    // Return dependencies shared by at least 50% of services
    const threshold = Math.ceil(services.length * 0.5);
    return Array.from(dependencyCount.entries())
      .filter(([_, count]) => count >= threshold)
      .map(([dep, _]) => dep);
  }

  /**
   * Calculate consolidation score for a group of services
   */
  private calculateConsolidationScore(services: ServiceMetrics[]): number {
    if (services.length < 2) return 0;
    
    let score = 0;
    
    // Factor 1: Shared dependencies (higher = better for consolidation)
    const allDependencies = services.flatMap(s => s.dependencies);
    const uniqueDependencies = new Set(allDependencies);
    const sharedRatio = (allDependencies.length - uniqueDependencies.size) / allDependencies.length;
    score += sharedRatio * 30;
    
    // Factor 2: Similar complexity (similar = better for consolidation)
    const complexities = services.map(s => s.complexity);
    const avgComplexity = complexities.reduce((a, b) => a + b, 0) / complexities.length;
    const complexityVariance = complexities.reduce((sum, c) => sum + Math.pow(c - avgComplexity, 2), 0) / complexities.length;
    score += Math.max(0, (20 - complexityVariance / 10)) * 1.5;
    
    // Factor 3: Size compatibility (smaller services are easier to merge)
    const avgSize = services.reduce((sum, s) => sum + s.sizeKB, 0) / services.length;
    if (avgSize < 30) score += 25; // Small services
    else if (avgSize < 50) score += 15; // Medium services
    else score += 5; // Large services
    
    // Factor 4: Recent activity (recent changes make consolidation riskier)
    const now = Date.now();
    const recentChanges = services.filter(s => now - s.lastModified.getTime() < 30 * 24 * 60 * 60 * 1000); // 30 days
    score -= (recentChanges.length / services.length) * 15;
    
    return Math.max(0, Math.min(100, score));
  }

  /**
   * Determine recommended action for a service cluster
   */
  private determineRecommendedAction(services: ServiceMetrics[], consolidationScore: number): 'merge' | 'split' | 'optimize' | 'maintain' {
    const avgSize = services.reduce((sum, s) => sum + s.sizeKB, 0) / services.length;
    const hasLargeServices = services.some(s => s.sizeKB > 100 || s.lines > 1000);
    
    if (consolidationScore > 70 && avgSize < 40 && services.length >= 2) {
      return 'merge';
    } else if (hasLargeServices) {
      return 'split';
    } else if (consolidationScore > 40) {
      return 'optimize';
    } else {
      return 'maintain';
    }
  }

  /**
   * Generate reasoning for cluster recommendation
   */
  private generateClusterReasoning(services: ServiceMetrics[], action: string, score: number): string {
    const avgSize = services.reduce((sum, s) => sum + s.sizeKB, 0) / services.length;
    const largeServices = services.filter(s => s.sizeKB > 50).length;
    
    switch (action) {
      case 'merge':
        return `High consolidation potential (score: ${score.toFixed(1)}). Services share dependencies and have compatible sizes (avg: ${avgSize.toFixed(1)}KB).`;
      case 'split':
        return `${largeServices} oversized service(s) detected. Breaking down large services will improve maintainability.`;
      case 'optimize':
        return `Moderate optimization potential (score: ${score.toFixed(1)}). Consider extracting common functionality or improving interfaces.`;
      default:
        return `Services are well-structured. Current architecture should be maintained.`;
    }
  }

  /**
   * Generate comprehensive consolidation recommendations
   */
  private generateConsolidationRecommendations(clusters: ServiceCluster[]): ConsolidationRecommendation[] {
    const recommendations: ConsolidationRecommendation[] = [];
    
    clusters.forEach(cluster => {
      switch (cluster.recommendedAction) {
        case 'merge':
          recommendations.push(this.createMergeRecommendation(cluster));
          break;
        case 'split':
          recommendations.push(this.createSplitRecommendation(cluster));
          break;
        case 'optimize':
          recommendations.push(this.createOptimizeRecommendation(cluster));
          break;
      }
    });
    
    // Add cross-domain recommendations
    recommendations.push(...this.generateCrossDomainRecommendations());
    
    // Sort by priority and expected impact
    return recommendations.sort((a, b) => {
      const priorityOrder = { high: 3, medium: 2, low: 1 };
      return priorityOrder[b.priority] - priorityOrder[a.priority];
    });
  }

  /**
   * Create merge recommendation for a service cluster
   */
  private createMergeRecommendation(cluster: ServiceCluster): ConsolidationRecommendation {
    return {
      type: 'merge_services',
      priority: cluster.consolidationScore > 80 ? 'high' : 'medium',
      services: cluster.services,
      description: `Merge ${cluster.services.length} related services in ${cluster.domain} domain`,
      expectedBenefits: [
        'Reduced code duplication',
        'Simplified dependency management',
        'Improved maintainability',
        'Better code organization'
      ],
      estimatedEffort: cluster.services.length > 4 ? 'high' : 'medium',
      riskLevel: cluster.services.some(s => this.serviceMetrics.get(s)?.usageScore! > 50) ? 'medium' : 'low',
      implementationSteps: [
        'Analyze shared interfaces and dependencies',
        'Create unified service structure',
        'Migrate functionality incrementally',
        'Update import statements',
        'Test consolidated service',
        'Remove redundant files'
      ]
    };
  }

  /**
   * Create split recommendation for oversized services
   */
  private createSplitRecommendation(cluster: ServiceCluster): ConsolidationRecommendation {
    const largeServices = cluster.services.filter(s => {
      const metrics = this.serviceMetrics.get(s);
      return metrics && (metrics.sizeKB > 100 || metrics.lines > 1000);
    });
    
    return {
      type: 'split_service',
      priority: 'high',
      services: largeServices,
      description: `Split oversized services in ${cluster.domain} domain`,
      expectedBenefits: [
        'Improved code maintainability',
        'Better separation of concerns',
        'Easier testing and debugging',
        'Reduced cognitive complexity'
      ],
      estimatedEffort: 'high',
      riskLevel: 'medium',
      implementationSteps: [
        'Identify logical boundaries within services',
        'Extract cohesive functionality into separate services',
        'Update dependency injection configuration',
        'Refactor import statements',
        'Comprehensive testing'
      ]
    };
  }

  /**
   * Create optimization recommendation
   */
  private createOptimizeRecommendation(cluster: ServiceCluster): ConsolidationRecommendation {
    return {
      type: 'optimize_imports',
      priority: 'medium',
      services: cluster.services,
      description: `Optimize service interfaces and dependencies in ${cluster.domain} domain`,
      expectedBenefits: [
        'Reduced coupling between services',
        'Improved performance',
        'Better code organization',
        'Enhanced reusability'
      ],
      estimatedEffort: 'low',
      riskLevel: 'low',
      implementationSteps: [
        'Extract common interfaces',
        'Optimize import statements',
        'Implement dependency injection patterns',
        'Add service abstractions',
        'Update documentation'
      ]
    };
  }

  /**
   * Generate cross-domain recommendations
   */
  private generateCrossDomainRecommendations(): ConsolidationRecommendation[] {
    const recommendations: ConsolidationRecommendation[] = [];
    
    // Find commonly imported utilities across all services
    const utilityImports = new Map<string, number>();
    
    for (const service of this.serviceMetrics.values()) {
      service.imports.forEach(imp => {
        if (imp.includes('/utils/') || imp.includes('/shared/')) {
          utilityImports.set(imp, (utilityImports.get(imp) || 0) + 1);
        }
      });
    }
    
    // Recommend common utility extraction for frequently used imports
    const frequentUtils = Array.from(utilityImports.entries())
      .filter(([_, count]) => count > 10)
      .map(([util, _]) => util);
    
    if (frequentUtils.length > 0) {
      recommendations.push({
        type: 'extract_common',
        priority: 'low',
        services: ['shared-utilities'],
        description: 'Extract commonly used utilities into shared modules',
        expectedBenefits: [
          'Reduced code duplication',
          'Consistent utility functions',
          'Easier maintenance',
          'Better code reuse'
        ],
        estimatedEffort: 'medium',
        riskLevel: 'low',
        implementationSteps: [
          'Identify duplicate utility functions',
          'Create shared utility modules',
          'Update import statements across services',
          'Add comprehensive tests',
          'Update documentation'
        ]
      });
    }
    
    return recommendations;
  }

  /**
   * Generate comprehensive architecture health report
   */
  private generateHealthReport(clusters: ServiceCluster[], recommendations: ConsolidationRecommendation[]): ArchitectureHealthReport {
    const services = Array.from(this.serviceMetrics.values());
    const totalServices = services.length;
    const totalLines = services.reduce((sum, s) => sum + s.lines, 0);
    const avgServiceSize = services.reduce((sum, s) => sum + s.sizeKB, 0) / totalServices;
    
    // Calculate service distribution by domain
    const servicesByDomain: Record<string, number> = {};
    clusters.forEach(cluster => {
      servicesByDomain[cluster.domain] = cluster.services.length;
    });
    
    // Identify problem services
    const oversizedServices = services.filter(s => s.sizeKB > 100 || s.lines > 1000).length;
    const undersizedServices = services.filter(s => s.sizeKB < 5 && s.lines < 100).length;
    const highCouplingServices = services.filter(s => s.dependencies.length > 10).map(s => s.name);
    const orphanedServices = services.filter(s => s.usageScore === 0).map(s => s.name);
    
    // Calculate health score (0-100)
    let healthScore = 100;
    
    // Penalize oversized services
    healthScore -= (oversizedServices / totalServices) * 30;
    
    // Penalize high coupling
    healthScore -= (highCouplingServices.length / totalServices) * 20;
    
    // Penalize orphaned services
    healthScore -= (orphanedServices.length / totalServices) * 15;
    
    // Reward good distribution
    const domainBalance = Math.min(...Object.values(servicesByDomain)) / Math.max(...Object.values(servicesByDomain));
    healthScore += domainBalance * 10;
    
    // Penalize high number of recommendations
    healthScore -= Math.min(recommendations.length * 2, 25);
    
    healthScore = Math.max(0, Math.round(healthScore));
    
    return {
      totalServices,
      servicesByDomain,
      complexityMetrics: {
        averageServiceSize: Math.round(avgServiceSize * 100) / 100,
        oversizedServices,
        undersizedServices,
        totalLinesOfCode: totalLines
      },
      dependencyMetrics: {
        circularDependencies: [], // TODO: Implement circular dependency detection
        highCouplingServices,
        orphanedServices
      },
      recommendations,
      healthScore
    };
  }

  /**
   * Generate markdown report of architecture analysis
   */
  async generateMarkdownReport(): Promise<string> {
    const report = await this.analyzeServiceArchitecture();
    
    let markdown = '# Service Architecture Health Report\n\n';
    markdown += `**Generated:** ${new Date().toISOString()}\n`;
    markdown += `**Health Score:** ${report.healthScore}/100\n\n`;
    
    // Executive Summary
    markdown += '## Executive Summary\n\n';
    markdown += `- **Total Services:** ${report.totalServices}\n`;
    markdown += `- **Average Service Size:** ${report.complexityMetrics.averageServiceSize}KB\n`;
    markdown += `- **Total Lines of Code:** ${report.complexityMetrics.totalLinesOfCode.toLocaleString()}\n`;
    markdown += `- **High Priority Recommendations:** ${report.recommendations.filter(r => r.priority === 'high').length}\n\n`;
    
    // Service Distribution
    markdown += '## Service Distribution by Domain\n\n';
    Object.entries(report.servicesByDomain).forEach(([domain, count]) => {
      markdown += `- **${domain}:** ${count} services\n`;
    });
    markdown += '\n';
    
    // Complexity Metrics
    markdown += '## Complexity Analysis\n\n';
    markdown += `- **Oversized Services:** ${report.complexityMetrics.oversizedServices}\n`;
    markdown += `- **Undersized Services:** ${report.complexityMetrics.undersizedServices}\n`;
    markdown += `- **High Coupling Services:** ${report.dependencyMetrics.highCouplingServices.length}\n`;
    markdown += `- **Orphaned Services:** ${report.dependencyMetrics.orphanedServices.length}\n\n`;
    
    // Recommendations
    markdown += '## Consolidation Recommendations\n\n';
    report.recommendations.forEach((rec, index) => {
      markdown += `### ${index + 1}. ${rec.description}\n`;
      markdown += `**Priority:** ${rec.priority.toUpperCase()} | **Effort:** ${rec.estimatedEffort} | **Risk:** ${rec.riskLevel}\n\n`;
      markdown += `**Services:** ${rec.services.join(', ')}\n\n`;
      markdown += '**Expected Benefits:**\n';
      rec.expectedBenefits.forEach(benefit => {
        markdown += `- ${benefit}\n`;
      });
      markdown += '\n**Implementation Steps:**\n';
      rec.implementationSteps.forEach(step => {
        markdown += `1. ${step}\n`;
      });
      markdown += '\n---\n\n';
    });
    
    return markdown;
  }
}

// Export singleton instance
export const serviceConsolidationAnalyzer = ServiceConsolidationAnalyzer.getInstance();