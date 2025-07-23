import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from './logger';

interface ServiceSizeReport {
  filename: string;
  lines: number;
  size: string;
  status: 'healthy' | 'warning' | 'critical';
  recommendation?: string;
}

export class ServiceSizeMonitor {
  private readonly MAX_LINES_WARNING = 400;
  private readonly MAX_LINES_CRITICAL = 500;
  private readonly SERVICE_DIRECTORIES = [
    'server/services',
    'server/middleware', 
    'server/routes'
  ];

  async checkAllServices(): Promise<ServiceSizeReport[]> {
    const reports: ServiceSizeReport[] = [];

    for (const dir of this.SERVICE_DIRECTORIES) {
      try {
        const fullPath = join(process.cwd(), dir);
        const files = await fs.readdir(fullPath);
        
        for (const file of files) {
          if (file.endsWith('.ts') || file.endsWith('.js')) {
            const filePath = join(fullPath, file);
            const report = await this.analyzeFile(filePath, file);
            reports.push(report);
          }
        }
      } catch (error) {
        logger.warn(`Could not analyze directory ${dir}`, { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    return reports.sort((a, b) => b.lines - a.lines);
  }

  private async analyzeFile(filePath: string, filename: string): Promise<ServiceSizeReport> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n').length;
      const stats = await fs.stat(filePath);
      const sizeKB = (stats.size / 1024).toFixed(1);

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      let recommendation: string | undefined;

      if (lines > this.MAX_LINES_CRITICAL) {
        status = 'critical';
        recommendation = `Split into smaller modules. Consider extracting interfaces, utilities, or domain-specific logic.`;
      } else if (lines > this.MAX_LINES_WARNING) {
        status = 'warning';
        recommendation = `Monitor for growth. Consider refactoring if adding more functionality.`;
      }

      return {
        filename,
        lines,
        size: `${sizeKB} KB`,
        status,
        recommendation
      };
    } catch (error) {
      logger.error(`Failed to analyze file ${filename}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return {
        filename,
        lines: 0,
        size: 'Unknown',
        status: 'critical',
        recommendation: 'File could not be analyzed'
      };
    }
  }

  async generateReport(): Promise<string> {
    const reports = await this.checkAllServices();
    const criticalFiles = reports.filter(r => r.status === 'critical');
    const warningFiles = reports.filter(r => r.status === 'warning');

    let report = `# Service Size Governance Report\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    if (criticalFiles.length > 0) {
      report += `## 🔴 Critical Issues (${criticalFiles.length})\n`;
      for (const file of criticalFiles) {
        report += `- **${file.filename}**: ${file.lines} lines (${file.size})\n`;
        report += `  ${file.recommendation}\n\n`;
      }
    }

    if (warningFiles.length > 0) {
      report += `## 🟡 Warnings (${warningFiles.length})\n`;
      for (const file of warningFiles) {
        report += `- **${file.filename}**: ${file.lines} lines (${file.size})\n`;
        report += `  ${file.recommendation}\n\n`;
      }
    }

    const healthyFiles = reports.filter(r => r.status === 'healthy');
    report += `## ✅ Healthy Files (${healthyFiles.length})\n`;
    report += `Files under ${this.MAX_LINES_WARNING} lines are in good shape.\n\n`;

    report += `## Top 5 Largest Services\n`;
    for (const file of reports.slice(0, 5)) {
      report += `1. ${file.filename}: ${file.lines} lines (${file.size})\n`;
    }

    return report;
  }
}

export const serviceSizeMonitor = new ServiceSizeMonitor();