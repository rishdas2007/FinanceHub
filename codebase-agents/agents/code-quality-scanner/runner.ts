// Code Quality Scanner Runner - CLI interface

import { CodeQualityScanner } from './index.js';
import { AgentConfig } from '../../types/agent-interfaces.js';
import * as fs from 'fs';
import * as path from 'path';

export class CodeQualityScannerRunner {
  private scanner = new CodeQualityScanner();

  async runAnalysis(targetPaths: string[], configPath?: string): Promise<void> {
    console.log('🔍 FinanceHub Pro - Code Quality Scanner v1.0.0');
    console.log('📊 Starting comprehensive code analysis...\n');

    // Load configuration
    const config = await this.loadConfig(configPath);
    
    // Get files to analyze
    const files = await this.getFilesToAnalyze(targetPaths, config);
    
    if (files.length === 0) {
      console.log('❌ No files found to analyze');
      return;
    }

    console.log(`📁 Found ${files.length} files to analyze\n`);

    // Run analysis
    const result = await this.scanner.analyze(files, config);

    // Display results
    this.displayResults(result);

    // Generate report
    await this.generateReport(result);
  }

  private async loadConfig(configPath?: string): Promise<AgentConfig> {
    const defaultConfigPath = path.join(__dirname, 'config', 'default-config.json');
    const targetConfigPath = configPath || defaultConfigPath;

    try {
      const configContent = fs.readFileSync(targetConfigPath, 'utf-8');
      return JSON.parse(configContent);
    } catch (error) {
      console.warn(`⚠️ Could not load config from ${targetConfigPath}, using defaults`);
      return {
        enabled: true,
        rules: {},
        autoFix: false,
        severity: 'medium',
        excludePatterns: ['node_modules/**', 'dist/**'],
        includePatterns: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx']
      };
    }
  }

  private async getFilesToAnalyze(targetPaths: string[], config: AgentConfig): Promise<string[]> {
    const files: string[] = [];

    for (const targetPath of targetPaths) {
      if (fs.existsSync(targetPath)) {
        if (fs.statSync(targetPath).isDirectory()) {
          const dirFiles = this.getAllFilesInDirectory(targetPath);
          files.push(...dirFiles);
        } else {
          files.push(targetPath);
        }
      }
    }

    // Filter files based on include/exclude patterns
    return files.filter(file => {
      const isIncluded = config.includePatterns.some(pattern => 
        this.matchesPattern(file, pattern)
      );
      const isExcluded = config.excludePatterns.some(pattern => 
        this.matchesPattern(file, pattern)
      );
      return isIncluded && !isExcluded;
    });
  }

  private getAllFilesInDirectory(dirPath: string): string[] {
    const files: string[] = [];
    
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        
        if (entry.isDirectory() && !this.shouldExcludeDirectory(entry.name)) {
          const subFiles = this.getAllFilesInDirectory(fullPath);
          files.push(...subFiles);
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`⚠️ Could not read directory ${dirPath}:`, error);
    }
    
    return files;
  }

  private shouldExcludeDirectory(dirName: string): boolean {
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
    return excludeDirs.includes(dirName);
  }

  private matchesPattern(file: string, pattern: string): boolean {
    const regex = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(regex).test(file);
  }

  private displayResults(result: any): void {
    console.log('\n🎯 ANALYSIS RESULTS');
    console.log('='.repeat(50));
    console.log(`✅ Files Analyzed: ${result.metrics.filesAnalyzed}`);
    console.log(`📊 Lines of Code: ${result.metrics.linesOfCode.toLocaleString()}`);
    console.log(`🔍 Issues Found: ${result.findings.length}`);
    console.log(`📈 Quality Score: ${result.metrics.score}/100`);
    console.log(`⏱️ Execution Time: ${result.executionTime}ms`);

    // Display findings by severity
    const findingsBySeverity = result.findings.reduce((acc: any, finding: any) => {
      if (!acc[finding.severity]) acc[finding.severity] = [];
      acc[finding.severity].push(finding);
      return acc;
    }, {});

    if (findingsBySeverity.critical?.length > 0) {
      console.log(`\n🚨 Critical Issues: ${findingsBySeverity.critical.length}`);
      this.displayFindings(findingsBySeverity.critical.slice(0, 5));
    }

    if (findingsBySeverity.high?.length > 0) {
      console.log(`\n⚠️ High Priority Issues: ${findingsBySeverity.high.length}`);
      this.displayFindings(findingsBySeverity.high.slice(0, 5));
    }

    if (findingsBySeverity.medium?.length > 0) {
      console.log(`\n📋 Medium Priority Issues: ${findingsBySeverity.medium.length}`);
      this.displayFindings(findingsBySeverity.medium.slice(0, 3));
    }

    // Display suggestions
    if (result.suggestions.length > 0) {
      console.log(`\n💡 SUGGESTIONS (${result.suggestions.length})`);
      console.log('-'.repeat(30));
      for (const suggestion of result.suggestions.slice(0, 3)) {
        console.log(`• ${suggestion.title}`);
        console.log(`  Impact: ${suggestion.impact} | Effort: ${suggestion.effort}`);
        console.log(`  ${suggestion.description}\n`);
      }
    }
  }

  private displayFindings(findings: any[]): void {
    for (const finding of findings) {
      console.log(`  📍 ${finding.file}:${finding.line || '?'}`);
      console.log(`     ${finding.title}`);
      console.log(`     ${finding.description}`);
      if (finding.fix?.automated) {
        console.log(`     🔧 Auto-fix available: ${finding.fix.description}`);
      }
      console.log('');
    }
  }

  private async generateReport(result: any): Promise<void> {
    const reportPath = `code-quality-report-${Date.now()}.json`;
    
    try {
      fs.writeFileSync(reportPath, JSON.stringify(result, null, 2));
      console.log(`📄 Detailed report saved to: ${reportPath}`);
    } catch (error) {
      console.warn('⚠️ Could not save report:', error);
    }
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const runner = new CodeQualityScannerRunner();
  const targetPaths = process.argv.slice(2);
  
  if (targetPaths.length === 0) {
    console.log('Usage: node runner.js <path1> [path2] ...');
    console.log('Example: node runner.js ./src ./server');
    process.exit(1);
  }

  runner.runAnalysis(targetPaths).catch(error => {
    console.error('❌ Analysis failed:', error);
    process.exit(1);
  });
}