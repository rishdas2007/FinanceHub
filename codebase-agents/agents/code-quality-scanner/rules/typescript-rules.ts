// TypeScript-specific code quality rules

import { Finding } from '../../../types/agent-interfaces.js';

export class TypeScriptRules {
  async analyze(filePath: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for any types
      if (line.includes(': any') && !line.includes('// @ts-ignore')) {
        findings.push({
          id: `ts-any-${lineNumber}`,
          type: 'warning',
          severity: 'medium',
          category: 'type-safety',
          title: 'Avoid Any Type',
          description: 'Using any type reduces type safety. Consider using specific types.',
          file: filePath,
          line: lineNumber,
          rule: 'typescript-no-any',
          fix: {
            type: 'replace',
            description: 'Replace any with specific type',
            automated: false,
            confidence: 60
          }
        });
      }

      // Check for console.log in production code
      if (line.includes('console.log') && !filePath.includes('test') && !filePath.includes('dev')) {
        findings.push({
          id: `ts-console-${lineNumber}`,
          type: 'warning',
          severity: 'low',
          category: 'production-code',
          title: 'Console.log in Production Code',
          description: 'Remove console.log statements from production code',
          file: filePath,
          line: lineNumber,
          rule: 'no-console-log',
          fix: {
            type: 'delete',
            description: 'Remove console.log statement',
            automated: true,
            confidence: 90
          }
        });
      }

      // Check for non-null assertion
      if (line.includes('!.') || line.includes('! ')) {
        findings.push({
          id: `ts-non-null-${lineNumber}`,
          type: 'info',
          severity: 'low',
          category: 'type-safety',
          title: 'Non-null Assertion',
          description: 'Non-null assertion operator should be used carefully',
          file: filePath,
          line: lineNumber,
          rule: 'typescript-no-non-null-assertion'
        });
      }

      // Check for proper interface naming (PascalCase)
      const interfaceMatch = line.match(/interface\s+([a-z][a-zA-Z0-9]*)/);
      if (interfaceMatch) {
        findings.push({
          id: `ts-interface-naming-${lineNumber}`,
          type: 'warning',
          severity: 'low',
          category: 'naming-conventions',
          title: 'Interface Naming Convention',
          description: 'Interface names should use PascalCase',
          file: filePath,
          line: lineNumber,
          rule: 'typescript-interface-naming',
          fix: {
            type: 'rename',
            description: `Rename to ${interfaceMatch[1].charAt(0).toUpperCase() + interfaceMatch[1].slice(1)}`,
            automated: true,
            confidence: 95
          }
        });
      }

      // Check for unused imports
      if (line.includes('import') && line.includes('from')) {
        const importMatch = line.match(/import\s+{([^}]+)}/);
        if (importMatch) {
          const imports = importMatch[1].split(',').map(imp => imp.trim());
          for (const imp of imports) {
            const importName = imp.replace(/\s+as\s+\w+/, '').trim();
            if (!content.includes(importName) || content.indexOf(importName) === content.indexOf(line)) {
              findings.push({
                id: `ts-unused-import-${lineNumber}-${importName}`,
                type: 'info',
                severity: 'low',
                category: 'imports',
                title: 'Unused Import',
                description: `Import '${importName}' is not used`,
                file: filePath,
                line: lineNumber,
                rule: 'typescript-unused-import',
                fix: {
                  type: 'delete',
                  description: `Remove unused import '${importName}'`,
                  automated: true,
                  confidence: 85
                }
              });
            }
          }
        }
      }

      // Check for function complexity indicators
      if (line.includes('function') || line.includes('=>')) {
        const functionContent = this.extractFunctionContent(lines, i);
        const complexity = this.calculateFunctionComplexity(functionContent);
        
        if (complexity > 10) {
          findings.push({
            id: `ts-complexity-${lineNumber}`,
            type: 'warning',
            severity: complexity > 20 ? 'high' : 'medium',
            category: 'complexity',
            title: 'High Function Complexity',
            description: `Function has complexity of ${complexity}. Consider breaking it down.`,
            file: filePath,
            line: lineNumber,
            rule: 'typescript-function-complexity'
          });
        }
      }
    }

    return findings;
  }

  private extractFunctionContent(lines: string[], startIndex: number): string {
    const content = [];
    let braceCount = 0;
    let started = false;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      content.push(line);

      for (const char of line) {
        if (char === '{') {
          braceCount++;
          started = true;
        } else if (char === '}') {
          braceCount--;
        }
      }

      if (started && braceCount === 0) {
        break;
      }
    }

    return content.join('\n');
  }

  private calculateFunctionComplexity(functionContent: string): number {
    const controlFlowKeywords = [
      'if', 'else if', 'else', 'for', 'while', 'do', 'switch', 'case',
      'try', 'catch', 'finally', '&&', '||', '?', 'forEach', 'map', 'filter'
    ];

    let complexity = 1; // Base complexity

    for (const keyword of controlFlowKeywords) {
      // Escape special regex characters and ensure proper word boundaries
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'g');
      const matches = functionContent.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }

    return complexity;
  }
}