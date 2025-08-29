#!/usr/bin/env node

// FinanceHub Pro v26 - Direct Code Quality Analysis
// Day 1 Action Plan: Critical Financial Logic Analysis

import { promises as fs } from 'fs';
import path from 'path';

// Critical financial logic patterns and files to prioritize
const CRITICAL_PATTERNS = [
  'zscore', 'economic', 'fred', 'technical-indicators', 'etf', 'macd', 'rsi', 'bollinger'
];

const HIGH_COMPLEXITY_INDICATORS = [
  'if', 'else', 'for', 'while', 'switch', 'case', 'try', 'catch', '&&', '||', '?'
];

async function analyzeFinanceHub() {
  console.log('🚀 FinanceHub Pro v26 - Comprehensive Code Quality Analysis');
  console.log('📊 Day 1 Action Plan: Critical Financial Logic Focus\n');
  
  const findings = {
    critical: [],
    high: [],
    medium: [],
    low: [],
    files: {},
    stats: {
      totalFiles: 0,
      totalLines: 0,
      complexFunctions: 0,
      anyUsage: 0,
      consoleLogs: 0,
      deadCode: 0
    }
  };

  // Phase 1: Critical Financial Logic Analysis
  console.log('🎯 Phase 1: Critical Financial Logic Analysis');
  console.log('='.repeat(50));
  
  const criticalFiles = await findCriticalFiles();
  console.log(`📁 Found ${criticalFiles.length} critical financial logic files\n`);
  
  for (const file of criticalFiles) {
    try {
      console.log(`🔍 Analyzing: ${path.relative('.', file)}`);
      const content = await fs.readFile(file, 'utf-8');
      const fileAnalysis = await analyzeFile(file, content);
      findings.files[file] = fileAnalysis;
      
      // Categorize findings by severity
      fileAnalysis.issues.forEach(issue => {
        findings[issue.severity].push(issue);
      });
      
      // Update stats
      findings.stats.totalFiles++;
      findings.stats.totalLines += content.split('\n').length;
      findings.stats.complexFunctions += fileAnalysis.stats.complexFunctions;
      findings.stats.anyUsage += fileAnalysis.stats.anyUsage;
      findings.stats.consoleLogs += fileAnalysis.stats.consoleLogs;
      findings.stats.deadCode += fileAnalysis.stats.deadCode;
      
    } catch (error) {
      console.log(`  ⚠️  Error analyzing ${file}: ${error.message}`);
    }
  }

  // Generate comprehensive report
  await generateReport(findings);
  return true;
}

async function findCriticalFiles() {
  const files = [];
  const searchDirs = ['server', 'client', 'shared'];
  
  for (const dir of searchDirs) {
    try {
      await findFilesRecursive(dir, files);
    } catch (error) {
      console.log(`⚠️  Directory ${dir} not accessible`);
    }
  }
  
  // Filter for critical files
  return files.filter(file => {
    const filename = path.basename(file).toLowerCase();
    return CRITICAL_PATTERNS.some(pattern => filename.includes(pattern)) &&
           (file.endsWith('.ts') || file.endsWith('.js') || file.endsWith('.tsx'));
  });
}

async function findFilesRecursive(dir, files) {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory() && !entry.name.includes('node_modules')) {
        await findFilesRecursive(fullPath, files);
      } else if (entry.isFile()) {
        files.push(fullPath);
      }
    }
  } catch (error) {
    // Skip inaccessible directories
  }
}

async function analyzeFile(filePath, content) {
  const lines = content.split('\n');
  const issues = [];
  const stats = {
    complexFunctions: 0,
    anyUsage: 0,
    consoleLogs: 0,
    deadCode: 0
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNumber = i + 1;

    // 1. High complexity functions (Priority 1)
    if (isFunctionDefinition(line)) {
      const complexity = calculateLineComplexity(line);
      if (complexity > 5) {
        stats.complexFunctions++;
        issues.push({
          severity: complexity > 10 ? 'critical' : 'high',
          type: 'complexity',
          title: 'High Function Complexity',
          description: `Function has complexity of ${complexity}. Consider breaking it down.`,
          file: filePath,
          line: lineNumber,
          rule: 'function-complexity-limit'
        });
      }
    }

    // 2. Excessive 'any' usage (Critical for financial calculations)
    if (line.includes(': any') || line.includes('as any')) {
      stats.anyUsage++;
      issues.push({
        severity: 'critical',
        type: 'type-safety',
        title: 'Type Safety Issue',
        description: 'Using "any" type defeats TypeScript benefits in financial calculations',
        file: filePath,
        line: lineNumber,
        rule: 'no-any-type'
      });
    }

    // 3. Production console.log statements
    if (line.includes('console.log') && !line.includes('//')) {
      stats.consoleLogs++;
      issues.push({
        severity: 'medium',
        type: 'debug-code',
        title: 'Debug Statement in Production',
        description: 'Remove console.log statements from production code',
        file: filePath,
        line: lineNumber,
        rule: 'no-console-logs'
      });
    }

    // 4. Dead code detection
    if (line.includes('TODO') || line.includes('FIXME') || line.includes('XXX')) {
      stats.deadCode++;
      issues.push({
        severity: 'low',
        type: 'dead-code',
        title: 'Dead Code or TODO',
        description: 'Remove TODO comments or implement the functionality',
        file: filePath,
        line: lineNumber,
        rule: 'no-dead-code'
      });
    }

    // 5. Complex nested conditions
    const nestingLevel = (line.match(/\s{2,}/g) || []).length;
    if (nestingLevel > 6) {
      issues.push({
        severity: 'medium',
        type: 'complexity',
        title: 'Deep Nesting',
        description: `Code is nested ${nestingLevel} levels deep. Consider refactoring.`,
        file: filePath,
        line: lineNumber,
        rule: 'max-nesting-depth'
      });
    }

    // 6. Long lines
    if (line.length > 120) {
      issues.push({
        severity: 'low',
        type: 'formatting',
        title: 'Line Too Long',
        description: `Line is ${line.length} characters. Consider breaking it up.`,
        file: filePath,
        line: lineNumber,
        rule: 'max-line-length'
      });
    }
  }

  return { issues, stats };
}

function isFunctionDefinition(line) {
  return line.includes('function') || 
         line.includes('=>') || 
         line.match(/^\s*[a-zA-Z_$][a-zA-Z0-9_$]*\s*\(.*\)\s*{/) !== null;
}

function calculateLineComplexity(line) {
  let complexity = 0;
  HIGH_COMPLEXITY_INDICATORS.forEach(indicator => {
    // Escape special regex characters and handle word boundaries properly
    const escapedIndicator = indicator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    try {
      const regex = new RegExp('\\b' + escapedIndicator + '\\b', 'g');
      const matches = (line.match(regex) || []);
      complexity += matches.length;
    } catch (error) {
      // Skip indicators that cause regex issues
      const simpleMatches = (line.split(indicator).length - 1);
      complexity += simpleMatches;
    }
  });
  return complexity;
}

async function generateReport(findings) {
  console.log('\n📊 COMPREHENSIVE ANALYSIS RESULTS');
  console.log('='.repeat(50));
  
  console.log('📈 OVERALL STATISTICS:');
  console.log(`Total Files Analyzed: ${findings.stats.totalFiles}`);
  console.log(`Total Lines of Code: ${findings.stats.totalLines}`);
  console.log(`Total Issues Found: ${findings.critical.length + findings.high.length + findings.medium.length + findings.low.length}`);
  console.log('');

  console.log('🔥 SEVERITY BREAKDOWN:');
  console.log(`CRITICAL: ${findings.critical.length} issues`);
  console.log(`HIGH: ${findings.high.length} issues`);
  console.log(`MEDIUM: ${findings.medium.length} issues`);
  console.log(`LOW: ${findings.low.length} issues`);
  console.log('');

  console.log('📊 ISSUE TYPE BREAKDOWN:');
  console.log(`Complex Functions: ${findings.stats.complexFunctions}`);
  console.log(`Type Safety Issues (any usage): ${findings.stats.anyUsage}`);
  console.log(`Debug Statements: ${findings.stats.consoleLogs}`);
  console.log(`Dead Code/TODOs: ${findings.stats.deadCode}`);
  console.log('');

  // Top 10 most problematic files
  console.log('📄 TOP 10 MOST PROBLEMATIC FILES:');
  const fileIssueCount = {};
  Object.keys(findings.files).forEach(file => {
    fileIssueCount[file] = findings.files[file].issues.length;
  });
  
  const sortedFiles = Object.entries(fileIssueCount)
    .sort(([,a], [,b]) => b - a)
    .slice(0, 10);
  
  sortedFiles.forEach(([file, count]) => {
    console.log(`  ${count} issues: ${path.relative('.', file)}`);
  });
  console.log('');

  // Critical issues that need immediate attention
  console.log('🚨 CRITICAL ISSUES (Fix First):');
  const criticalIssues = findings.critical.slice(0, 10);
  criticalIssues.forEach(issue => {
    console.log(`❌ ${path.relative('.', issue.file)}:${issue.line}`);
    console.log(`   ${issue.title}: ${issue.description}`);
  });

  if (findings.critical.length > 10) {
    console.log(`... and ${findings.critical.length - 10} more critical issues`);
  }
  console.log('');

  // High priority issues
  console.log('⚠️  HIGH PRIORITY ISSUES (Fix Next):');
  const highIssues = findings.high.slice(0, 5);
  highIssues.forEach(issue => {
    console.log(`⚠️  ${path.relative('.', issue.file)}:${issue.line}`);
    console.log(`   ${issue.title}: ${issue.description}`);
  });

  if (findings.high.length > 5) {
    console.log(`... and ${findings.high.length - 5} more high priority issues`);
  }
  console.log('');

  // Action plan
  console.log('🎯 IMMEDIATE ACTION PLAN:');
  console.log('1. Fix Critical Issues: Focus on type safety in financial calculations');
  console.log('2. Reduce Function Complexity: Break down complex financial logic');
  console.log('3. Remove Debug Statements: Clean up console.log statements');
  console.log('4. Complete TODOs: Implement or remove dead code');
  console.log('');

  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: findings.stats,
    issues: {
      critical: findings.critical,
      high: findings.high,
      medium: findings.medium,
      low: findings.low
    },
    fileDetails: findings.files
  };

  await fs.writeFile('financehub-code-quality-report.json', JSON.stringify(report, null, 2));
  console.log('✅ Detailed report saved to financehub-code-quality-report.json');
  console.log('📋 Next: Run deployment safety validation');
}

// Run the analysis
if (import.meta.url === `file://${process.argv[1]}`) {
  analyzeFinanceHub().then(success => {
    process.exit(success ? 0 : 1);
  });
}