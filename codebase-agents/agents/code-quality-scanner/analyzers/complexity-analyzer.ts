// Complexity analysis for functions and classes

import { Finding } from '../../../types/agent-interfaces.js';

export class ComplexityAnalyzer {
  async analyze(filePath: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Analyze function complexity
      if (this.isFunctionDefinition(line)) {
        const functionContent = this.extractFunctionContent(lines, i);
        const complexity = this.calculateComplexity(functionContent.content);
        
        if (complexity > 10) {
          findings.push({
            id: `complexity-function-${lineNumber}`,
            type: 'warning',
            severity: complexity > 20 ? 'high' : 'medium',
            category: 'complexity',
            title: 'High Function Complexity',
            description: `Function has cyclomatic complexity of ${complexity}. Consider breaking it down into smaller functions.`,
            file: filePath,
            line: lineNumber,
            rule: 'function-complexity-limit',
            fix: {
              type: 'replace',
              description: 'Extract complex logic into separate functions',
              automated: false,
              confidence: 70
            }
          });
        }
      }

      // Analyze class complexity
      if (line.includes('class ') && !line.includes('//')) {
        const classContent = this.extractClassContent(lines, i);
        const methodCount = this.countMethods(classContent.content);
        const classComplexity = this.calculateClassComplexity(classContent.content);
        
        if (methodCount > 15) {
          findings.push({
            id: `complexity-class-methods-${lineNumber}`,
            type: 'warning',
            severity: 'medium',
            category: 'complexity',
            title: 'Class Has Too Many Methods',
            description: `Class has ${methodCount} methods. Consider splitting into smaller classes.`,
            file: filePath,
            line: lineNumber,
            rule: 'class-method-limit'
          });
        }

        if (classComplexity > 50) {
          findings.push({
            id: `complexity-class-${lineNumber}`,
            type: 'warning',
            severity: 'high',
            category: 'complexity',
            title: 'High Class Complexity',
            description: `Class has complexity of ${classComplexity}. Consider refactoring.`,
            file: filePath,
            line: lineNumber,
            rule: 'class-complexity-limit'
          });
        }
      }

      // Detect deeply nested code
      const nestingLevel = this.calculateNestingLevel(line);
      if (nestingLevel > 4) {
        findings.push({
          id: `complexity-nesting-${lineNumber}`,
          type: 'warning',
          severity: 'medium',
          category: 'complexity',
          title: 'Deep Nesting Detected',
          description: `Code is nested ${nestingLevel} levels deep. Consider extracting nested logic.`,
          file: filePath,
          line: lineNumber,
          rule: 'max-nesting-depth'
        });
      }

      // Detect long parameter lists
      if (line.includes('function') || line.includes('=>')) {
        const paramCount = this.countParameters(line);
        if (paramCount > 5) {
          findings.push({
            id: `complexity-params-${lineNumber}`,
            type: 'info',
            severity: 'low',
            category: 'complexity',
            title: 'Too Many Parameters',
            description: `Function has ${paramCount} parameters. Consider using an options object.`,
            file: filePath,
            line: lineNumber,
            rule: 'max-parameters'
          });
        }
      }
    }

    return findings;
  }

  private isFunctionDefinition(line: string): boolean {
    return (
      line.includes('function') ||
      line.includes('=>') ||
      line.match(/^\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(.*\)\s*{/) !== null
    );
  }

  private extractFunctionContent(lines: string[], startIndex: number): { content: string; endIndex: number } {
    const content: string[] = [];
    let braceCount = 0;
    let started = false;
    let endIndex = startIndex;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      content.push(line);
      endIndex = i;

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

    return { content: content.join('\n'), endIndex };
  }

  private extractClassContent(lines: string[], startIndex: number): { content: string; endIndex: number } {
    return this.extractFunctionContent(lines, startIndex);
  }

  private calculateComplexity(code: string): number {
    const controlFlowKeywords = [
      'if', 'else if', 'else', 'for', 'while', 'do', 'switch', 'case',
      'try', 'catch', 'finally', '&&', '||', '?', 'forEach', 'map', 
      'filter', 'reduce', 'some', 'every', 'find'
    ];

    let complexity = 1; // Base complexity

    for (const keyword of controlFlowKeywords) {
      // Escape special regex characters for proper word boundary matching
      const escapedKeyword = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const regex = new RegExp(`\\b${escapedKeyword}\\b`, 'g');
      const matches = code.match(regex);
      if (matches) {
        complexity += matches.length;
      }
    }

    // Add complexity for recursive calls
    const functionNameMatch = code.match(/function\s+(\w+)/);
    if (functionNameMatch) {
      const functionName = functionNameMatch[1];
      const recursiveCallRegex = new RegExp(`\\b${functionName}\\(`, 'g');
      const recursiveCalls = code.match(recursiveCallRegex);
      if (recursiveCalls && recursiveCalls.length > 1) {
        complexity += recursiveCalls.length - 1;
      }
    }

    return complexity;
  }

  private calculateClassComplexity(classCode: string): number {
    const methods = classCode.match(/\w+\s*\([^)]*\)\s*{/g) || [];
    let totalComplexity = 0;

    for (const method of methods) {
      const methodContent = this.extractMethodFromClass(classCode, method);
      totalComplexity += this.calculateComplexity(methodContent);
    }

    return totalComplexity;
  }

  private extractMethodFromClass(classCode: string, methodSignature: string): string {
    const startIndex = classCode.indexOf(methodSignature);
    if (startIndex === -1) return '';

    let braceCount = 0;
    let started = false;
    let content = '';

    for (let i = startIndex; i < classCode.length; i++) {
      const char = classCode[i];
      content += char;

      if (char === '{') {
        braceCount++;
        started = true;
      } else if (char === '}') {
        braceCount--;
      }

      if (started && braceCount === 0) {
        break;
      }
    }

    return content;
  }

  private countMethods(classCode: string): number {
    const methodPattern = /^\s*(?:public|private|protected|static)?\s*(?:async\s+)?[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(/gm;
    const matches = classCode.match(methodPattern);
    return matches ? matches.length : 0;
  }

  private calculateNestingLevel(line: string): number {
    let level = 0;
    let inString = false;
    let stringChar = '';

    for (const char of line) {
      if (!inString && (char === '"' || char === "'" || char === '`')) {
        inString = true;
        stringChar = char;
      } else if (inString && char === stringChar) {
        inString = false;
        stringChar = '';
      } else if (!inString && char === '{') {
        level++;
      }
    }

    return level;
  }

  private countParameters(line: string): number {
    const match = line.match(/\(([^)]*)\)/);
    if (!match || !match[1].trim()) return 0;

    const params = match[1].split(',');
    return params.filter(param => param.trim().length > 0).length;
  }
}