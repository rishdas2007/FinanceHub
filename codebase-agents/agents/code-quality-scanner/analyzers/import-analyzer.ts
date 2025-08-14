// Import analysis for unused imports and circular dependencies

import { Finding } from '../../../types/agent-interfaces.js';

export class ImportAnalyzer {
  async analyze(filePath: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = content.split('\n');
    const imports = this.extractImports(content);
    const usage = this.findUsage(content);

    // Check for unused imports
    for (const importItem of imports) {
      if (!this.isUsed(importItem, usage, content)) {
        findings.push({
          id: `import-unused-${importItem.line}`,
          type: 'info',
          severity: 'low',
          category: 'imports',
          title: 'Unused Import',
          description: `Import '${importItem.name}' is not used in this file`,
          file: filePath,
          line: importItem.line,
          rule: 'unused-import',
          fix: {
            type: 'delete',
            description: `Remove unused import '${importItem.name}'`,
            automated: true,
            confidence: 90
          }
        });
      }
    }

    // Check for missing imports
    const missingImports = this.findMissingImports(content);
    for (const missing of missingImports) {
      findings.push({
        id: `import-missing-${missing.line}`,
        type: 'error',
        severity: 'high',
        category: 'imports',
        title: 'Missing Import',
        description: `'${missing.name}' is used but not imported`,
        file: filePath,
        line: missing.line,
        rule: 'missing-import'
      });
    }

    // Check for circular dependencies (simplified detection)
    const circularDeps = this.detectCircularDependencies(filePath, imports);
    for (const circular of circularDeps) {
      findings.push({
        id: `import-circular-${circular.line}`,
        type: 'warning',
        severity: 'medium',
        category: 'imports',
        title: 'Potential Circular Dependency',
        description: `Import from '${circular.module}' may create circular dependency`,
        file: filePath,
        line: circular.line,
        rule: 'no-circular-dependency'
      });
    }

    // Check for relative import depth
    for (const importItem of imports) {
      if (importItem.path.startsWith('../')) {
        const depth = (importItem.path.match(/\.\.\//g) || []).length;
        if (depth > 3) {
          findings.push({
            id: `import-deep-relative-${importItem.line}`,
            type: 'warning',
            severity: 'low',
            category: 'imports',
            title: 'Deep Relative Import',
            description: `Import path has ${depth} levels of relative navigation. Consider using absolute imports.`,
            file: filePath,
            line: importItem.line,
            rule: 'no-deep-relative-imports'
          });
        }
      }
    }

    // Check for duplicate imports
    const duplicates = this.findDuplicateImports(imports);
    for (const duplicate of duplicates) {
      findings.push({
        id: `import-duplicate-${duplicate.line}`,
        type: 'warning',
        severity: 'medium',
        category: 'imports',
        title: 'Duplicate Import',
        description: `'${duplicate.name}' is imported multiple times`,
        file: filePath,
        line: duplicate.line,
        rule: 'no-duplicate-imports',
        fix: {
          type: 'replace',
          description: 'Consolidate imports',
          automated: true,
          confidence: 85
        }
      });
    }

    return findings;
  }

  private extractImports(content: string): Array<{name: string, path: string, line: number, type: 'default' | 'named' | 'namespace'}> {
    const imports: Array<{name: string, path: string, line: number, type: 'default' | 'named' | 'namespace'}> = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Match different import patterns
      const patterns = [
        // import { name } from 'module'
        /import\s+{\s*([^}]+)\s*}\s+from\s+['"]([^'"]+)['"]/g,
        // import name from 'module'
        /import\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s+['"]([^'"]+)['"]/g,
        // import * as name from 'module'
        /import\s+\*\s+as\s+([a-zA-Z_$][a-zA-Z0-9_$]*)\s+from\s+['"]([^'"]+)['"]/g,
        // import 'module'
        /import\s+['"]([^'"]+)['"]/g
      ];

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          if (pattern.source.includes('{\s*([^}]+)')) {
            // Named imports
            const names = match[1].split(',').map(name => name.trim().split(' as ')[0]);
            for (const name of names) {
              imports.push({
                name: name.trim(),
                path: match[2],
                line: lineNumber,
                type: 'named'
              });
            }
          } else if (pattern.source.includes('\\*\\s+as')) {
            // Namespace import
            imports.push({
              name: match[1],
              path: match[2],
              line: lineNumber,
              type: 'namespace'
            });
          } else if (match[2]) {
            // Default import
            imports.push({
              name: match[1],
              path: match[2],
              line: lineNumber,
              type: 'default'
            });
          }
        }
      }
    }

    return imports;
  }

  private findUsage(content: string): Set<string> {
    const usage = new Set<string>();
    
    // Find all identifiers used in the code
    const identifierPattern = /[a-zA-Z_$][a-zA-Z0-9_$]*/g;
    let match;
    
    while ((match = identifierPattern.exec(content)) !== null) {
      usage.add(match[0]);
    }

    return usage;
  }

  private isUsed(importItem: {name: string, path: string, line: number, type: string}, usage: Set<string>, content: string): boolean {
    // Check if the import is used anywhere in the content
    if (usage.has(importItem.name)) {
      // Make sure it's not just the import statement itself
      const importLinePattern = new RegExp(`import.*${importItem.name}.*from.*${importItem.path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`);
      const contentWithoutImport = content.replace(importLinePattern, '');
      return contentWithoutImport.includes(importItem.name);
    }
    
    return false;
  }

  private findMissingImports(content: string): Array<{name: string, line: number}> {
    const missing: Array<{name: string, line: number}> = [];
    const lines = content.split('\n');
    
    // Common patterns that indicate missing imports
    const patterns = [
      // React hooks
      /use[A-Z][a-zA-Z]+/g,
      // Lodash functions
      /_.([a-zA-Z]+)/g,
      // Common utilities that are usually imported
      /(axios|fetch|moment|dayjs|uuid)/g
    ];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      for (const pattern of patterns) {
        let match;
        while ((match = pattern.exec(line)) !== null) {
          const name = match[1] || match[0];
          if (!content.includes(`import`) || !content.includes(name)) {
            missing.push({
              name,
              line: lineNumber
            });
          }
        }
      }
    }

    return missing;
  }

  private detectCircularDependencies(filePath: string, imports: Array<{name: string, path: string, line: number}>): Array<{module: string, line: number}> {
    const circular: Array<{module: string, line: number}> = [];
    
    // Simple heuristic: check if any import path could refer back to current file
    const fileName = filePath.split('/').pop()?.replace(/\.(ts|tsx|js|jsx)$/, '');
    
    for (const importItem of imports) {
      if (importItem.path.includes(fileName || '')) {
        circular.push({
          module: importItem.path,
          line: importItem.line
        });
      }
    }

    return circular;
  }

  private findDuplicateImports(imports: Array<{name: string, path: string, line: number}>): Array<{name: string, line: number}> {
    const seen = new Map<string, number>();
    const duplicates: Array<{name: string, line: number}> = [];

    for (const importItem of imports) {
      const key = `${importItem.name}-${importItem.path}`;
      if (seen.has(key)) {
        duplicates.push({
          name: importItem.name,
          line: importItem.line
        });
      } else {
        seen.set(key, importItem.line);
      }
    }

    return duplicates;
  }
}