/**
 * Service Size Monitor - Service Architecture Governance Tool
 * 
 * @class ServiceSizeMonitor
 * @description Monitors and reports on service file sizes to maintain healthy architecture
 * patterns and prevent monolithic anti-patterns in the unified service architecture.
 * 
 * @author AI Agent Documentation Enhancement
 * @version 1.0.0
 * @since 2025-07-25
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { logger } from '../../shared/utils/logger';
import { serviceConsolidationAnalyzer } from '../services/service-consolidation-analyzer';

interface ServiceReport {
  service: string;
  filePath: string;
  sizeKB: number;
  lines: number;
  status: 'healthy' | 'warning' | 'critical';
  recommendation: string;
  consolidationOpportunity?: {
    domain: string;
    potentialMergeTargets: string[];
    expectedBenefit: string;
  };
}

export class ServiceSizeMonitor {
  private static instance: ServiceSizeMonitor;
  
  static getInstance(): ServiceSizeMonitor {
    if (!ServiceSizeMonitor.instance) {
      ServiceSizeMonitor.instance = new ServiceSizeMonitor();
    }
    return ServiceSizeMonitor.instance;
  }

  async checkAllServices(): Promise<ServiceReport[]> {
    const servicesPath = './server/services';
    const reports: ServiceReport[] = [];
    
    try {
      const files = await fs.readdir(servicesPath);
      
      // Get consolidation analysis for enhanced recommendations
      let architectureReport;
      try {
        architectureReport = await serviceConsolidationAnalyzer.analyzeServiceArchitecture();
      } catch (error) {
        logger.warn('Could not load consolidation analysis, proceeding with basic monitoring');
        architectureReport = null;
      }
      
      for (const file of files) {
        if (file.endsWith('.ts') && !file.endsWith('.d.ts')) {
          const filePath = path.join(servicesPath, file);
          const report = await this.analyzeService(filePath, file, architectureReport);
          reports.push(report);
        }
      }
    } catch (error) {
      logger.error(`Service size monitoring failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return reports;
  }

  private async analyzeService(filePath: string, fileName: string, architectureReport?: any): Promise<ServiceReport> {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').length;
      const sizeKB = Math.round(stats.size / 1024);
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let recommendation = 'Service size is within healthy limits';
      let consolidationOpportunity;
      
      // Enhanced analysis with consolidation insights
      if (sizeKB > 100 || lines > 1000) {
        status = 'critical';
        recommendation = 'Service is too large - consider breaking into smaller services or consolidating with related services';
      } else if (sizeKB > 50 || lines > 500) {
        status = 'warning';
        recommendation = 'Service is getting large - monitor for further growth or consider optimization';
      }
      
      // Add consolidation analysis if available
      if (architectureReport) {
        const serviceName = fileName.replace(/\.(ts|js)$/, '');
        const consolidationRec = this.findConsolidationOpportunity(serviceName, architectureReport);
        if (consolidationRec) {
          consolidationOpportunity = consolidationRec;
          if (status === 'healthy' && consolidationRec.expectedBenefit.includes('merge')) {
            status = 'warning';
            recommendation += ` | Consolidation opportunity: ${consolidationRec.expectedBenefit}`;
          }
        }
      }
      
      return {
        service: fileName.replace(/\.(ts|js)$/, ''),
        filePath,
        sizeKB,
        lines,
        status,
        recommendation,
        consolidationOpportunity
      };
    } catch (error) {
      return {
        service: fileName,
        filePath,
        sizeKB: 0,
        lines: 0,
        status: 'critical',
        recommendation: `Failed to analyze: ${error instanceof Error ? error.message : String(error)}`
      };
    }
  }

  /**
   * Find consolidation opportunities for a specific service
   */
  private findConsolidationOpportunity(serviceName: string, architectureReport: any): { domain: string; potentialMergeTargets: string[]; expectedBenefit: string; } | undefined {
    // Look for merge recommendations that include this service
    const mergeRecommendation = architectureReport.recommendations.find((rec: any) => 
      rec.type === 'merge_services' && rec.services.includes(serviceName)
    );
    
    if (mergeRecommendation) {
      const otherServices = mergeRecommendation.services.filter((s: string) => s !== serviceName);
      return {
        domain: this.identifyServiceDomain(serviceName),
        potentialMergeTargets: otherServices,
        expectedBenefit: `Can be merged with ${otherServices.length} related service(s) to reduce complexity`
      };
    }
    
    return undefined;
  }

  /**
   * Identify service domain based on naming patterns
   */
  private identifyServiceDomain(serviceName: string): string {
    const domainPatterns = {
      'ETF': ['etf', 'technical', 'zscore', 'bollinger', 'rsi'],
      'Economic': ['economic', 'fred', 'macro', 'gdp', 'cpi', 'ppi'],
      'Market': ['market', 'trading', 'sector', 'momentum'],
      'Data': ['data', 'historical', 'backfill', 'validation', 'quality'],
      'Cache': ['cache', 'redis', 'memory', 'unified'],
      'API': ['api', 'batch', 'rate', 'circuit'],
      'Analytics': ['statistical', 'correlation', 'analysis', 'insight'],
      'AI': ['ai', 'openai', 'sentiment', 'mood'],
      'Infrastructure': ['performance', 'monitoring', 'health', 'scheduler']
    };
    
    const lowerName = serviceName.toLowerCase();
    
    for (const [domain, patterns] of Object.entries(domainPatterns)) {
      if (patterns.some(pattern => lowerName.includes(pattern))) {
        return domain;
      }
    }
    
    return 'Miscellaneous';
  }

  async generateReport(): Promise<string> {
    const reports = await this.checkAllServices();
    
    let report = '# Enhanced Service Size Governance Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    
    const critical = reports.filter(r => r.status === 'critical');
    const warning = reports.filter(r => r.status === 'warning');
    const healthy = reports.filter(r => r.status === 'healthy');
    const consolidationOpportunities = reports.filter(r => r.consolidationOpportunity);
    
    report += `## Executive Summary\n`;
    report += `- Total Services: ${reports.length}\n`;
    report += `- Critical: ${critical.length}\n`;
    report += `- Warning: ${warning.length}\n`;
    report += `- Healthy: ${healthy.length}\n`;
    report += `- Consolidation Opportunities: ${consolidationOpportunities.length}\n\n`;
    
    // Add consolidation opportunities section
    if (consolidationOpportunities.length > 0) {
      report += `## Consolidation Opportunities\n\n`;
      const opportunitiesByDomain = new Map<string, typeof reports>();
      
      consolidationOpportunities.forEach(service => {
        const domain = service.consolidationOpportunity!.domain;
        if (!opportunitiesByDomain.has(domain)) {
          opportunitiesByDomain.set(domain, []);
        }
        opportunitiesByDomain.get(domain)!.push(service);
      });
      
      for (const [domain, services] of opportunitiesByDomain) {
        report += `### ${domain} Domain\n`;
        services.forEach(service => {
          report += `- **${service.service}** (${service.sizeKB}KB, ${service.lines} lines)\n`;
          report += `  - Can merge with: ${service.consolidationOpportunity!.potentialMergeTargets.join(', ')}\n`;
          report += `  - Benefit: ${service.consolidationOpportunity!.expectedBenefit}\n`;
        });
        report += '\n';
      }
    }
    
    if (critical.length > 0) {
      report += `## Critical Services (Immediate Action Required)\n\n`;
      for (const service of critical) {
        report += `### ${service.service}\n`;
        report += `- **Size:** ${service.sizeKB}KB (${service.lines} lines)\n`;
        report += `- **Recommendation:** ${service.recommendation}\n`;
        if (service.consolidationOpportunity) {
          report += `- **Consolidation Domain:** ${service.consolidationOpportunity.domain}\n`;
          report += `- **Merge Candidates:** ${service.consolidationOpportunity.potentialMergeTargets.join(', ')}\n`;
        }
        report += '\n';
      }
    }
    
    if (warning.length > 0) {
      report += `## Warning Services (Monitor Closely)\n\n`;
      for (const service of warning) {
        report += `### ${service.service}\n`;
        report += `- **Size:** ${service.sizeKB}KB (${service.lines} lines)\n`;
        report += `- **Recommendation:** ${service.recommendation}\n`;
        if (service.consolidationOpportunity) {
          report += `- **Consolidation Domain:** ${service.consolidationOpportunity.domain}\n`;
          report += `- **Merge Candidates:** ${service.consolidationOpportunity.potentialMergeTargets.join(', ')}\n`;
        }
        report += '\n';
      }
    }
    
    // Add architecture health insights
    try {
      const architectureReport = await serviceConsolidationAnalyzer.analyzeServiceArchitecture();
      report += `## Architecture Health Insights\n\n`;
      report += `- **Architecture Health Score:** ${architectureReport.healthScore}/100\n`;
      report += `- **High Priority Recommendations:** ${architectureReport.recommendations.filter(r => r.priority === 'high').length}\n`;
      report += `- **Services by Domain:**\n`;
      Object.entries(architectureReport.servicesByDomain).forEach(([domain, count]) => {
        report += `  - ${domain}: ${count} services\n`;
      });
      report += '\n';
    } catch (error) {
      report += `## Architecture Health Insights\n\n`;
      report += `*Architecture analysis unavailable - run consolidation analyzer separately for detailed insights*\n\n`;
    }
    
    return report;
  }

  /**
   * Generate JSON summary for API consumption
   */
  async generateJsonSummary(): Promise<any> {
    const reports = await this.checkAllServices();
    const consolidationOpportunities = reports.filter(r => r.consolidationOpportunity);
    
    return {
      timestamp: new Date().toISOString(),
      summary: {
        totalServices: reports.length,
        critical: reports.filter(r => r.status === 'critical').length,
        warning: reports.filter(r => r.status === 'warning').length,
        healthy: reports.filter(r => r.status === 'healthy').length,
        consolidationOpportunities: consolidationOpportunities.length
      },
      servicesByStatus: {
        critical: reports.filter(r => r.status === 'critical').map(r => ({
          name: r.service,
          sizeKB: r.sizeKB,
          lines: r.lines,
          recommendation: r.recommendation
        })),
        warning: reports.filter(r => r.status === 'warning').map(r => ({
          name: r.service,
          sizeKB: r.sizeKB,
          lines: r.lines,
          recommendation: r.recommendation
        }))
      },
      consolidationOpportunities: consolidationOpportunities.map(r => ({
        service: r.service,
        domain: r.consolidationOpportunity!.domain,
        potentialMergeTargets: r.consolidationOpportunity!.potentialMergeTargets,
        expectedBenefit: r.consolidationOpportunity!.expectedBenefit
      }))
    };
  }
}

export const serviceSizeMonitor = ServiceSizeMonitor.getInstance();