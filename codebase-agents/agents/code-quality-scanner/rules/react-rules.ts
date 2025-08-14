// React-specific code quality rules

import { Finding } from '../../../types/agent-interfaces.js';

export class ReactRules {
  async analyze(filePath: string, content: string): Promise<Finding[]> {
    const findings: Finding[] = [];
    const lines = content.split('\n');

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const lineNumber = i + 1;

      // Check for missing key prop in lists
      if (line.includes('.map(') && !line.includes('key=')) {
        const nextLine = lines[i + 1] || '';
        const nextNextLine = lines[i + 2] || '';
        
        if (!nextLine.includes('key=') && !nextNextLine.includes('key=')) {
          findings.push({
            id: `react-key-${lineNumber}`,
            type: 'warning',
            severity: 'medium',
            category: 'react-best-practices',
            title: 'Missing Key Prop',
            description: 'Elements in lists should have a unique key prop',
            file: filePath,
            line: lineNumber,
            rule: 'react-key-prop'
          });
        }
      }

      // Check for inline styles (should use CSS classes)
      if (line.includes('style={{')) {
        findings.push({
          id: `react-inline-style-${lineNumber}`,
          type: 'info',
          severity: 'low',
          category: 'performance',
          title: 'Inline Styles',
          description: 'Consider using CSS classes instead of inline styles for better performance',
          file: filePath,
          line: lineNumber,
          rule: 'react-no-inline-styles'
        });
      }

      // Check for useState without dependency array in useEffect
      if (line.includes('useEffect(') && !line.includes(', []') && !line.includes(', [')) {
        findings.push({
          id: `react-effect-deps-${lineNumber}`,
          type: 'warning',
          severity: 'medium',
          category: 'react-hooks',
          title: 'Missing useEffect Dependencies',
          description: 'useEffect should include dependency array to prevent infinite loops',
          file: filePath,
          line: lineNumber,
          rule: 'react-hooks-exhaustive-deps'
        });
      }

      // Check for direct DOM manipulation
      if (line.includes('document.getElementById') || line.includes('document.querySelector')) {
        findings.push({
          id: `react-dom-${lineNumber}`,
          type: 'warning',
          severity: 'high',
          category: 'react-anti-patterns',
          title: 'Direct DOM Manipulation',
          description: 'Avoid direct DOM manipulation in React. Use refs or state instead.',
          file: filePath,
          line: lineNumber,
          rule: 'react-no-direct-dom'
        });
      }

      // Check for component naming convention
      const componentMatch = line.match(/const\s+([a-z][a-zA-Z0-9]*)\s*=\s*\(/);
      if (componentMatch && (line.includes('return') || content.includes('JSX'))) {
        findings.push({
          id: `react-component-naming-${lineNumber}`,
          type: 'warning',
          severity: 'low',
          category: 'naming-conventions',
          title: 'Component Naming Convention',
          description: 'React components should start with uppercase letter',
          file: filePath,
          line: lineNumber,
          rule: 'react-component-naming',
          fix: {
            type: 'rename',
            description: `Rename to ${componentMatch[1].charAt(0).toUpperCase() + componentMatch[1].slice(1)}`,
            automated: true,
            confidence: 90
          }
        });
      }

      // Check for missing displayName on components
      if (line.includes('export default') && (line.includes('function') || content.includes('const'))) {
        if (!content.includes('.displayName')) {
          findings.push({
            id: `react-display-name-${lineNumber}`,
            type: 'info',
            severity: 'low',
            category: 'debugging',
            title: 'Missing Component displayName',
            description: 'Consider adding displayName for better debugging experience',
            file: filePath,
            line: lineNumber,
            rule: 'react-display-name'
          });
        }
      }

      // Check for prop destructuring
      if (line.includes('props.') && line.split('props.').length > 3) {
        findings.push({
          id: `react-prop-destructure-${lineNumber}`,
          type: 'info',
          severity: 'low',
          category: 'code-style',
          title: 'Consider Prop Destructuring',
          description: 'Consider destructuring props for cleaner code',
          file: filePath,
          line: lineNumber,
          rule: 'react-prop-destructuring'
        });
      }

      // Check for large components (indication of needing split)
      if (line.includes('return (') || line.includes('return<')) {
        const componentLines = this.getComponentJSXLineCount(lines, i);
        if (componentLines > 50) {
          findings.push({
            id: `react-large-component-${lineNumber}`,
            type: 'warning',
            severity: 'medium',
            category: 'maintainability',
            title: 'Large Component',
            description: `Component has ${componentLines} lines of JSX. Consider breaking it into smaller components.`,
            file: filePath,
            line: lineNumber,
            rule: 'react-component-size'
          });
        }
      }

      // FinanceHub specific: Check for proper data-testid attributes
      if (line.includes('<button') || line.includes('<input') || line.includes('<select')) {
        if (!line.includes('data-testid') && !line.includes('data-cy')) {
          findings.push({
            id: `react-testid-${lineNumber}`,
            type: 'info',
            severity: 'low',
            category: 'testing',
            title: 'Missing Test ID',
            description: 'Interactive elements should have data-testid for testing',
            file: filePath,
            line: lineNumber,
            rule: 'react-test-id'
          });
        }
      }
    }

    return findings;
  }

  private getComponentJSXLineCount(lines: string[], startIndex: number): number {
    let jsxLines = 0;
    let parenCount = 0;
    let started = false;

    for (let i = startIndex; i < lines.length; i++) {
      const line = lines[i];
      
      if (line.includes('return (') || line.includes('return<')) {
        started = true;
      }

      if (started) {
        jsxLines++;
        
        for (const char of line) {
          if (char === '(') parenCount++;
          else if (char === ')') parenCount--;
        }

        if (started && parenCount === 0 && line.includes(')')) {
          break;
        }
      }
    }

    return jsxLines;
  }
}