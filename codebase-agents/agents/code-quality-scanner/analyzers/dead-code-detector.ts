// Dead code detection analyzer

import { Finding } from '../../../types/agent-interfaces.js';

export class DeadCodeDetector {
  async analyze(filePath: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    // Check for unreachable code
    findings.push(...this.findUnreachableCode(lines, filePath));
    
    // Check for unused variables
    findings.push(...this.findUnusedVariables(content, filePath));
    
    // Check for unused functions
    findings.push(...this.findUnusedFunctions(content, filePath));
    
    // Check for empty functions
    findings.push(...this.findEmptyFunctions(lines, filePath));
    
    // Check for commented out code
    findings.push(...this.findCommentedCode(lines, filePath));

    return findings;
  }

  private findUnreachableCode(lines: string[], filePath: string): Finding[] {
    const findings: Finding[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();
      const lineNumber = i + 1;

      // Check for code after return/throw/break/continue
      if (line.startsWith('return') || line.startsWith('throw') || 
          line.startsWith('break') || line.startsWith('continue')) {
        
        // Look ahead for non-empty, non-comment lines
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          
          if (nextLine === '' || nextLine.startsWith('//') || 
              nextLine.startsWith('/*') || nextLine === '}') {
            continue;
          }

          // Found potentially unreachable code
          findings.push({
            id: `dead-code-unreachable-${j + 1}`,
            type: 'warning',
            severity: 'medium',
            category: 'dead-code',
            title: 'Unreachable Code',
            description: 'Code after return/throw statement is unreachable',
            file: filePath,
            line: j + 1,
            rule: 'no-unreachable-code',
            fix: {
              type: 'delete',
              description: 'Remove unreachable code',
              automated: true,
              confidence: 80
            }
          });
          break;
        }
      }
    }

    return findings;
  }

  private findUnusedVariables(content: string, filePath: string): Finding[] {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    // Extract variable declarations
    const variablePattern = /(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
    let match;

    while ((match = variablePattern.exec(content)) !== null) {
      const variableName = match[1];
      const declarationIndex = content.indexOf(match[0]);
      const lineNumber = content.substring(0, declarationIndex).split('\n').length;

      // Check if variable is used elsewhere
      const usagePattern = new RegExp(`\\b${variableName}\\b`, 'g');
      const usages = content.match(usagePattern) || [];

      // If only found once (the declaration), it's unused
      if (usages.length === 1) {
        findings.push({
          id: `dead-code-unused-var-${lineNumber}`,
          type: 'info',
          severity: 'low',
          category: 'dead-code',
          title: 'Unused Variable',
          description: `Variable '${variableName}' is declared but never used`,
          file: filePath,
          line: lineNumber,
          rule: 'no-unused-variables',
          fix: {
            type: 'delete',
            description: `Remove unused variable '${variableName}'`,
            automated: true,
            confidence: 85
          }
        });
      }
    }

    return findings;
  }

  private findUnusedFunctions(content: string, filePath: string): Finding[] {
    const findings: Finding[] = [];

    // Extract function declarations
    const functionPattern = /function\s+([a-zA-Z_$][a-zA-Z0-9_$]*)|(?:const|let|var)\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s*=\s*(?:async\s+)?(?:\([^)]*\)\s*=>|function)/g;
    let match;

    while ((match = functionPattern.exec(content)) !== null) {
      const functionName = match[1] || match[2];
      if (!functionName) continue;

      const declarationIndex = match.index;
      const lineNumber = content.substring(0, declarationIndex).split('\n').length;

      // Skip if it's an export or if name suggests it's a component
      if (content.includes(`export ${functionName}`) || 
          content.includes(`export { ${functionName}`) ||
          functionName[0] === functionName[0].toUpperCase()) {
        continue;
      }

      // Check if function is called elsewhere
      const callPattern = new RegExp(`\\b${functionName}\\s*\\(`, 'g');
      const calls = content.match(callPattern) || [];

      // If only found once (likely the declaration), it might be unused
      if (calls.length <= 1) {
        findings.push({
          id: `dead-code-unused-function-${lineNumber}`,
          type: 'info',
          severity: 'low',
          category: 'dead-code',
          title: 'Possibly Unused Function',
          description: `Function '${functionName}' appears to be unused`,
          file: filePath,
          line: lineNumber,
          rule: 'no-unused-functions'
        });
      }
    }

    return findings;
  }

  private findEmptyFunctions(lines: string[], filePath: string): Finding[] {
    const findings: Finding[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for function definitions
      if (line.includes('function') || line.includes('=>')) {
        const functionContent = this.extractFunctionBody(lines, i);
        
        if (this.isFunctionEmpty(functionContent.content)) {
          findings.push({
            id: `dead-code-empty-function-${lineNumber}`,
            type: 'info',
            severity: 'low',
            category: 'dead-code',
            title: 'Empty Function',
            description: 'Function has empty body',
            file: filePath,
            line: lineNumber,
            rule: 'no-empty-functions'
          });
        }
      }
    }

    return findings;
  }

  private findCommentedCode(lines: string[], filePath: string): Finding[] {
    const findings: Finding[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;
      const trimmed = line.trim();

      // Check for commented out code (heuristic: contains common code patterns)
      if (trimmed.startsWith('//')) {
        const commentContent = trimmed.substring(2).trim();
        
        if (this.looksLikeCode(commentContent)) {
          findings.push({
            id: `dead-code-commented-${lineNumber}`,
            type: 'info',
            severity: 'low',
            category: 'dead-code',
            title: 'Commented Out Code',
            description: 'Line appears to contain commented out code',
            file: filePath,
            line: lineNumber,
            rule: 'no-commented-code',
            fix: {
              type: 'delete',
              description: 'Remove commented out code',
              automated: false,
              confidence: 60
            }
          });
        }
      }
    }

    return findings;
  }

  private extractFunctionBody(lines: string[], startIndex: number): { content: string; endIndex: number } {
    const content = [];
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

  private isFunctionEmpty(functionContent: string): boolean {
    // Remove comments and whitespace
    const cleaned = functionContent
      .replace(/\/\/.*$/gm, '')
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/\s+/g, ' ')
      .trim();

    // Check if only contains braces or simple return
    return cleaned === '{}' || 
           cleaned === '{ }' || 
           cleaned.match(/^{\s*return\s*;\s*}$/) !== null ||
           cleaned.match(/^{\s*return\s+undefined\s*;\s*}$/) !== null;
  }

  private looksLikeCode(comment: string): boolean {
    const codeIndicators = [
      'function', 'const', 'let', 'var', 'if', 'else', 'for', 'while',
      'return', 'import', 'export', 'class', 'interface', 'type',
      '{', '}', '(', ')', ';', '=', '=>'
    ];

    const indicators = codeIndicators.filter(indicator => 
      comment.includes(indicator)
    );

    // If comment contains multiple code indicators, likely code
    return indicators.length >= 2;
  }
}