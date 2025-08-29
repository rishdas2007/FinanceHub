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

interface ServiceReport {
  service: string;
  filePath: string;
  sizeKB: number;
  lines: number;
  status: 'healthy' | 'warning' | 'critical';
  recommendation: string;
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
      
      for (const file of files) {
        if (file.endsWith('.ts') || file.endsWith('')) {
          const filePath = path.join(servicesPath, file);
          const report = await this.analyzeService(filePath, file);
          reports.push(report);
        }
      }
    } catch (error) {
      logger.error(`Service size monitoring failed: ${error instanceof Error ? error.message : String(error)}`);
    }
    
    return reports;
  }

  private async analyzeService(filePath: string, fileName: string): Promise<ServiceReport> {
    try {
      const stats = await fs.stat(filePath);
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').length;
      const sizeKB = Math.round(stats.size / 1024);
      
      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let recommendation = 'Service size is within healthy limits';
      
      if (sizeKB > 100 || lines > 1000) {
        status = 'critical';
        recommendation = 'Service is too large - consider breaking into smaller services';
      } else if (sizeKB > 50 || lines > 500) {
        status = 'warning';
        recommendation = 'Service is getting large - monitor for further growth';
      }
      
      return {
        service: fileName.replace(/\.(ts|js)$/, ''),
        filePath,
        sizeKB,
        lines,
        status,
        recommendation
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

  async generateReport(): Promise<string> {
    const reports = await this.checkAllServices();
    
    let report = '# Service Size Governance Report\n\n';
    report += `Generated: ${new Date().toISOString()}\n\n`;
    
    const critical = reports.filter(r => r.status === 'critical');
    const warning = reports.filter(r => r.status === 'warning');
    const healthy = reports.filter(r => r.status === 'healthy');
    
    report += `## Summary\n`;
    report += `- Total Services: ${reports.length}\n`;
    report += `- Critical: ${critical.length}\n`;
    report += `- Warning: ${warning.length}\n`;
    report += `- Healthy: ${healthy.length}\n\n`;
    
    if (critical.length > 0) {
      report += `## Critical Services (Immediate Action Required)\n\n`;
      for (const service of critical) {
        report += `### ${service.service}\n`;
        report += `- Size: ${service.sizeKB}KB (${service.lines} lines)\n`;
        report += `- Recommendation: ${service.recommendation}\n\n`;
      }
    }
    
    if (warning.length > 0) {
      report += `## Warning Services (Monitor Closely)\n\n`;
      for (const service of warning) {
        report += `### ${service.service}\n`;
        report += `- Size: ${service.sizeKB}KB (${service.lines} lines)\n`;
        report += `- Recommendation: ${service.recommendation}\n\n`;
      }
    }
    
    return report;
  }
}

export const serviceSizeMonitor = ServiceSizeMonitor.getInstance();