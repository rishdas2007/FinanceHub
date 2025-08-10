import { promises as fs } from 'fs';
import { join } from 'path';
import { logger } from './logger';

interface DocumentationCheck {
  filename: string;
  totalLines: number;
  commentLines: number;
  commentRatio: number;
  status: 'well-documented' | 'needs-improvement' | 'poorly-documented';
  suggestions: string[];
}

export class CodeDocumentationAnalyzer {
  private readonly MIN_COMMENT_RATIO = 0.1; // 10% comments
  private readonly GOOD_COMMENT_RATIO = 0.15; // 15% comments

  async analyzeProject(): Promise<DocumentationCheck[]> {
    const results: DocumentationCheck[] = [];
    const directories = [
      'server/services',
      'server/middleware',
      'server/utils',
      'client/src/components',
      'client/src/services'
    ];

    for (const dir of directories) {
      try {
        const fullPath = join(process.cwd(), dir);
        const files = await fs.readdir(fullPath);
        
        for (const file of files) {
          if (file.endsWith('.ts') || file.endsWith('.tsx')) {
            const filePath = join(fullPath, file);
            const analysis = await this.analyzeFile(filePath, file);
            results.push(analysis);
          }
        }
      } catch (error) {
        logger.warn(`Could not analyze directory ${dir}`, { 
          error: error instanceof Error ? error.message : String(error) 
        });
      }
    }

    return results.sort((a, b) => a.commentRatio - b.commentRatio);
  }

  private async analyzeFile(filePath: string, filename: string): Promise<DocumentationCheck> {
    try {
      const content = await fs.readFile(filePath, 'utf-8');
      const lines = content.split('\n');
      const totalLines = lines.length;
      
      let commentLines = 0;
      let inBlockComment = false;

      for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines
        if (!trimmed) continue;
        
        // Block comments
        if (trimmed.includes('/*')) {
          inBlockComment = true;
        }
        if (inBlockComment) {
          commentLines++;
        }
        if (trimmed.includes('*/')) {
          inBlockComment = false;
          continue;
        }
        
        // Single line comments
        if (trimmed.startsWith('//') || trimmed.startsWith('*')) {
          commentLines++;
        }
        
        // JSDoc comments
        if (trimmed.startsWith('/**') || trimmed.startsWith('*')) {
          commentLines++;
        }
      }

      const commentRatio = totalLines > 0 ? commentLines / totalLines : 0;
      
      let status: 'well-documented' | 'needs-improvement' | 'poorly-documented';
      const suggestions: string[] = [];

      if (commentRatio >= this.GOOD_COMMENT_RATIO) {
        status = 'well-documented';
      } else if (commentRatio >= this.MIN_COMMENT_RATIO) {
        status = 'needs-improvement';
        suggestions.push('Add JSDoc comments for public methods');
        suggestions.push('Document complex business logic');
      } else {
        status = 'poorly-documented';
        suggestions.push('Add comprehensive JSDoc comments');
        suggestions.push('Document all public methods and interfaces');
        suggestions.push('Add inline comments for complex algorithms');
        suggestions.push('Document API contracts and return types');
      }

      // Specific suggestions based on file type
      if (filename.includes('service')) {
        suggestions.push('Document service responsibilities and dependencies');
      }
      if (filename.includes('component')) {
        suggestions.push('Document component props and state management');
      }
      if (filename.includes('util')) {
        suggestions.push('Document utility function parameters and use cases');
      }

      return {
        filename,
        totalLines,
        commentLines,
        commentRatio: Math.round(commentRatio * 100) / 100,
        status,
        suggestions
      };
    } catch (error) {
      logger.error(`Failed to analyze file ${filename}`, { 
        error: error instanceof Error ? error.message : String(error) 
      });
      
      return {
        filename,
        totalLines: 0,
        commentLines: 0,
        commentRatio: 0,
        status: 'poorly-documented',
        suggestions: ['File could not be analyzed']
      };
    }
  }

  async generateDocumentationReport(): Promise<string> {
    const analyses = await this.analyzeProject();
    const poorlyDocumented = analyses.filter(a => a.status === 'poorly-documented');
    const needsImprovement = analyses.filter(a => a.status === 'needs-improvement');
    const wellDocumented = analyses.filter(a => a.status === 'well-documented');

    let report = `# Code Documentation Analysis Report\n`;
    report += `Generated: ${new Date().toISOString()}\n\n`;

    // Summary
    const totalFiles = analyses.length;
    const avgCommentRatio = analyses.reduce((sum, a) => sum + a.commentRatio, 0) / totalFiles;
    
    report += `## Summary\n`;
    report += `- **Total Files**: ${totalFiles}\n`;
    report += `- **Average Comment Ratio**: ${(avgCommentRatio * 100).toFixed(1)}%\n`;
    report += `- **Well Documented**: ${wellDocumented.length} (${((wellDocumented.length / totalFiles) * 100).toFixed(1)}%)\n`;
    report += `- **Needs Improvement**: ${needsImprovement.length} (${((needsImprovement.length / totalFiles) * 100).toFixed(1)}%)\n`;
    report += `- **Poorly Documented**: ${poorlyDocumented.length} (${((poorlyDocumented.length / totalFiles) * 100).toFixed(1)}%)\n\n`;

    if (poorlyDocumented.length > 0) {
      report += `## 🔴 Poorly Documented Files (${poorlyDocumented.length})\n`;
      for (const file of poorlyDocumented) {
        report += `### ${file.filename}\n`;
        report += `- **Comment Ratio**: ${(file.commentRatio * 100).toFixed(1)}%\n`;
        report += `- **Suggestions**:\n`;
        for (const suggestion of file.suggestions) {
          report += `  - ${suggestion}\n`;
        }
        report += `\n`;
      }
    }

    if (needsImprovement.length > 0) {
      report += `## 🟡 Needs Improvement (${needsImprovement.length})\n`;
      for (const file of needsImprovement.slice(0, 5)) { // Show top 5
        report += `- **${file.filename}**: ${(file.commentRatio * 100).toFixed(1)}% comments\n`;
      }
      report += `\n`;
    }

    report += `## ✅ Well Documented Files (${wellDocumented.length})\n`;
    if (wellDocumented.length > 0) {
      report += `Top examples:\n`;
      for (const file of wellDocumented.slice(0, 3)) {
        report += `- **${file.filename}**: ${(file.commentRatio * 100).toFixed(1)}% comments\n`;
      }
    } else {
      report += `No files meet the "well documented" threshold (${this.GOOD_COMMENT_RATIO * 100}% comments).\n`;
    }

    return report;
  }
}

export const codeDocumentationAnalyzer = new CodeDocumentationAnalyzer();