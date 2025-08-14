// FinanceHub Pro v26 - Base Agent Implementation
// Common functionality for all codebase agents

import { BaseAgent as IBaseAgent, AgentResult, AgentConfig, Finding, Suggestion, AgentMetrics } from '../types/agent-interfaces.js';
import * as fs from 'fs';
import * as path from 'path';

export abstract class BaseAgent extends IBaseAgent {
  abstract name: string;
  abstract version: string;
  abstract description: string;
  abstract capabilities: string[];
  abstract supportedFileTypes: string[];
  abstract dependencies: string[];

  abstract analyze(files: string[], config: AgentConfig): Promise<AgentResult>;

  protected async getFilesToAnalyze(patterns: string[]): Promise<string[]> {
    const files: string[] = [];
    
    for (const pattern of patterns) {
      if (pattern.includes('*')) {
        // Handle glob patterns
        const dirPath = pattern.split('*')[0];
        if (fs.existsSync(dirPath)) {
          const dirFiles = await this.getAllFilesInDirectory(dirPath);
          files.push(...dirFiles.filter(file => this.matchesPattern(file, pattern)));
        }
      } else if (fs.existsSync(pattern)) {
        if (fs.statSync(pattern).isDirectory()) {
          const dirFiles = await this.getAllFilesInDirectory(pattern);
          files.push(...dirFiles);
        } else {
          files.push(pattern);
        }
      }
    }

    return files.filter(file => this.isSupportedFileType(file));
  }

  private async getAllFilesInDirectory(dirPath: string): Promise<string[]> {
    const files: string[] = [];
    
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      
      if (entry.isDirectory() && !this.shouldExcludeDirectory(entry.name)) {
        const subFiles = await this.getAllFilesInDirectory(fullPath);
        files.push(...subFiles);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
    
    return files;
  }

  private shouldExcludeDirectory(dirName: string): boolean {
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', '.next', 'coverage'];
    return excludeDirs.includes(dirName);
  }

  private matchesPattern(file: string, pattern: string): boolean {
    // Simple glob matching
    const regex = pattern.replace(/\*/g, '.*').replace(/\?/g, '.');
    return new RegExp(regex).test(file);
  }

  private isSupportedFileType(file: string): boolean {
    const ext = path.extname(file);
    return this.supportedFileTypes.includes(ext);
  }

  protected async readFileContent(filePath: string): Promise<string> {
    try {
      return fs.readFileSync(filePath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read file ${filePath}: ${error}`);
    }
  }

  protected calculateComplexity(code: string): number {
    // Simple cyclomatic complexity calculation
    const controlFlow = [
      'if', 'else if', 'for', 'while', 'do', 'switch', 'case',
      'catch', '&&', '||', '?', 'forEach', 'map', 'filter', 'reduce'
    ];
    
    let complexity = 1; // Base complexity
    
    for (const keyword of controlFlow) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'g');
      const matches = code.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }
    
    return complexity;
  }

  protected countLinesOfCode(code: string): number {
    return code.split('\n').filter(line => {
      const trimmed = line.trim();
      return trimmed.length > 0 && !trimmed.startsWith('//') && !trimmed.startsWith('/*');
    }).length;
  }

  protected findDuplicatedCode(files: { path: string; content: string }[]): Finding[] {
    const findings: Finding[] = [];
    const minLength = 5; // Minimum lines to consider duplication
    
    for (let i = 0; i < files.length; i++) {
      for (let j = i + 1; j < files.length; j++) {
        const duplicates = this.findSimilarBlocks(files[i].content, files[j].content, minLength);
        
        for (const duplicate of duplicates) {
          findings.push(super.createFinding(
            'warning',
            'medium',
            'duplication',
            'Code Duplication Detected',
            `Similar code block found between ${files[i].path} and ${files[j].path}`,
            files[i].path,
            duplicate.line1,
            undefined,
            'no-duplicate-code'
          ));
        }
      }
    }
    
    return findings;
  }

  private findSimilarBlocks(content1: string, content2: string, minLength: number): Array<{line1: number, line2: number}> {
    const lines1 = content1.split('\n');
    const lines2 = content2.split('\n');
    const similarities: Array<{line1: number, line2: number}> = [];
    
    for (let i = 0; i <= lines1.length - minLength; i++) {
      for (let j = 0; j <= lines2.length - minLength; j++) {
        let matchLength = 0;
        
        while (
          i + matchLength < lines1.length &&
          j + matchLength < lines2.length &&
          this.normalizeCode(lines1[i + matchLength]) === this.normalizeCode(lines2[j + matchLength])
        ) {
          matchLength++;
        }
        
        if (matchLength >= minLength) {
          similarities.push({ line1: i + 1, line2: j + 1 });
        }
      }
    }
    
    return similarities;
  }

  private normalizeCode(line: string): string {
    return line.trim().replace(/\s+/g, ' ').replace(/["']/g, '"');
  }

  protected createMetrics(
    filesAnalyzed: number,
    linesOfCode: number,
    findings: Finding[],
    fixesApplied: number = 0
  ): AgentMetrics {
    const issuesFound = findings.length;
    const criticalIssues = findings.filter(f => f.severity === 'critical').length;
    const highIssues = findings.filter(f => f.severity === 'high').length;
    
    // Calculate score based on issues found (0-100 scale)
    const issueWeight = criticalIssues * 10 + highIssues * 5 + (issuesFound - criticalIssues - highIssues) * 1;
    const maxPossibleIssues = linesOfCode * 0.1; // Assume max 10% of lines could have issues
    const score = Math.max(0, Math.min(100, 100 - (issueWeight / maxPossibleIssues) * 100));
    
    return {
      filesAnalyzed,
      linesOfCode,
      issuesFound,
      issuesFixed: fixesApplied,
      coverage: filesAnalyzed > 0 ? 100 : 0,
      score: Math.round(score)
    };
  }
}