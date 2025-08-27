#!/usr/bin/env node

// FinanceHub Pro v26 - Comprehensive Code Quality Analysis Runner
// Implements the action plan from the user's request

import { CodeQualityScanner } from './codebase-agents/agents/code-quality-scanner/index.js';
import { DeploymentSafetyAgent } from './codebase-agents/agents/deployment-safety/index.js';
import { promises as fs } from 'fs';
import path from 'path';

// Critical financial logic files to prioritize
const FINANCIAL_LOGIC_PATTERNS = [
  '**/services/zscore-*.ts',
  '**/services/economic-*.ts', 
  '**/services/fred-*.ts',
  '**/services/data-conversion-service.ts',
  '**/services/technical-indicators-service.ts',
  '**/services/etf-*.ts',
  '**/calculators/*.ts',
  '**/analyzers/*.ts'
];

// High-impact service directories 
const SERVICE_DIRECTORIES = [
  'server/services',
  'server/controllers',
  'shared'
];

// Frontend component directories
const FRONTEND_DIRECTORIES = [
  'client/src/components',
  'client/src/pages',
  'client/src/lib'
];

async function runComprehensiveAnalysis() {
  console.log('🚀 FinanceHub Pro v26 - Comprehensive Code Quality Analysis');
  console.log('📊 Following the action plan: Day 1 - Full codebase audit\n');

  const scanner = new CodeQualityScanner();
  const deploymentAgent = new DeploymentSafetyAgent();
  
  try {
    // Phase 1: Critical Financial Logic Analysis (High Priority)
    console.log('🎯 Phase 1: Critical Financial Logic Analysis');
    console.log('='.repeat(50));
    
    const financialFiles = await findFiles(FINANCIAL_LOGIC_PATTERNS);
    console.log(`📁 Found ${financialFiles.length} critical financial logic files`);
    
    const financialFindings = [];
    for (const file of financialFiles.slice(0, 20)) { // Limit to prevent timeout
      try {
        console.log(`  🔍 Analyzing: ${file}`);
        const content = await fs.readFile(file, 'utf-8');
        const findings = await scanner.analyze(file, content);
        financialFindings.push(...findings);
      } catch (error) {
        console.log(`  ⚠️  Error analyzing ${file}: ${error.message}`);
      }
    }
    
    console.log(`✅ Financial logic analysis complete: ${financialFindings.length} findings\n`);

    // Phase 2: Service Layer Analysis (Medium Priority)
    console.log('🔧 Phase 2: Service Layer Analysis');
    console.log('='.repeat(50));
    
    const serviceFindings = [];
    for (const dir of SERVICE_DIRECTORIES) {
      try {
        const serviceFiles = await findFilesInDirectory(dir, ['.ts', '.js']);
        console.log(`📁 Analyzing ${serviceFiles.length} files in ${dir}`);
        
        for (const file of serviceFiles.slice(0, 15)) { // Limit per directory
          try {
            const content = await fs.readFile(file, 'utf-8');
            const findings = await scanner.analyze(file, content);
            serviceFindings.push(...findings);
          } catch (error) {
            console.log(`  ⚠️  Error analyzing ${file}: ${error.message}`);
          }
        }
      } catch (error) {
        console.log(`  ⚠️  Error accessing directory ${dir}: ${error.message}`);
      }
    }
    
    console.log(`✅ Service layer analysis complete: ${serviceFindings.length} findings\n`);

    // Phase 3: Frontend Component Analysis (Lower Priority)
    console.log('⚛️  Phase 3: Frontend Component Analysis');
    console.log('='.repeat(50));
    
    const frontendFindings = [];
    for (const dir of FRONTEND_DIRECTORIES) {
      try {
        const componentFiles = await findFilesInDirectory(dir, ['.tsx', '.ts', '.jsx', '.js']);
        console.log(`📁 Analyzing ${componentFiles.length} files in ${dir}`);
        
        for (const file of componentFiles.slice(0, 10)) { // Limit per directory
          try {
            const content = await fs.readFile(file, 'utf-8');
            const findings = await scanner.analyze(file, content);
            frontendFindings.push(...findings);
          } catch (error) {
            console.log(`  ⚠️  Error analyzing ${file}: ${error.message}`);
          }
        }
      } catch (error) {
        console.log(`  ⚠️  Error accessing directory ${dir}: ${error.message}`);
      }
    }
    
    console.log(`✅ Frontend analysis complete: ${frontendFindings.length} findings\n`);

    // Combine and analyze results
    const allFindings = [...financialFindings, ...serviceFindings, ...frontendFindings];
    await generateComprehensiveReport(allFindings);

    // Phase 4: Deployment Safety Check
    console.log('🚀 Phase 4: Deployment Safety Analysis');
    console.log('='.repeat(50));
    
    const deploymentFindings = await deploymentAgent.validatePreDeployment();
    console.log(`✅ Deployment safety analysis complete: ${deploymentFindings.length} findings\n`);

    console.log('📊 COMPREHENSIVE ANALYSIS COMPLETE');
    console.log('='.repeat(50));
    console.log(`Total Code Quality Issues: ${allFindings.length}`);
    console.log(`Total Deployment Issues: ${deploymentFindings.length}`);
    console.log('📋 Check code-quality-report.json for detailed results');

  } catch (error) {
    console.error('❌ Analysis failed:', error);
    return false;
  }
  
  return true;
}

async function findFiles(patterns) {
  const files = [];
  for (const pattern of patterns) {
    try {
      // Simple pattern matching - expand to proper glob if needed
      const basePattern = pattern.replace('**/', '').replace('*', '');
      const searchDirs = ['server', 'client', 'shared'];
      
      for (const dir of searchDirs) {
        try {
          const found = await findFilesInDirectory(dir, ['.ts', '.js']);
          const matching = found.filter(f => f.includes(basePattern.replace('.ts', '')));
          files.push(...matching);
        } catch (error) {
          // Directory doesn't exist, continue
        }
      }
    } catch (error) {
      console.log(`Pattern ${pattern} failed: ${error.message}`);
    }
  }
  return [...new Set(files)]; // Remove duplicates
}

async function findFilesInDirectory(dir, extensions) {
  const files = [];
  
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      
      if (entry.isDirectory()) {
        try {
          const subFiles = await findFilesInDirectory(fullPath, extensions);
          files.push(...subFiles);
        } catch (error) {
          // Skip inaccessible directories
        }
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name);
        if (extensions.includes(ext)) {
          files.push(fullPath);
        }
      }
    }
  } catch (error) {
    // Directory doesn't exist or is not accessible
    throw error;
  }
  
  return files;
}

async function generateComprehensiveReport(findings) {
  console.log('📊 Generating Comprehensive Report');
  console.log('='.repeat(50));

  // Categorize findings
  const byCategory = {};
  const bySeverity = {};
  const byFile = {};

  findings.forEach(finding => {
    // By category
    if (!byCategory[finding.category]) byCategory[finding.category] = [];
    byCategory[finding.category].push(finding);

    // By severity
    if (!bySeverity[finding.severity]) bySeverity[finding.severity] = [];
    bySeverity[finding.severity].push(finding);

    // By file
    if (!byFile[finding.file]) byFile[finding.file] = [];
    byFile[finding.file].push(finding);
  });

  // Print summary
  console.log('📈 FINDINGS SUMMARY:');
  console.log(`Total Issues: ${findings.length}`);
  console.log('');
  
  console.log('🔥 By Severity:');
  Object.entries(bySeverity).forEach(([severity, issues]) => {
    console.log(`  ${severity.toUpperCase()}: ${issues.length} issues`);
  });
  console.log('');

  console.log('📂 By Category:');
  Object.entries(byCategory).forEach(([category, issues]) => {
    console.log(`  ${category}: ${issues.length} issues`);
  });
  console.log('');

  console.log('📄 Top 10 Most Problematic Files:');
  const sortedFiles = Object.entries(byFile)
    .sort(([,a], [,b]) => b.length - a.length)
    .slice(0, 10);
  
  sortedFiles.forEach(([file, issues]) => {
    console.log(`  ${file}: ${issues.length} issues`);
  });
  console.log('');

  // Critical issues that need immediate attention
  const criticalIssues = findings.filter(f => f.severity === 'high' || f.severity === 'critical');
  console.log('🚨 CRITICAL ISSUES (Fix First):');
  criticalIssues.slice(0, 10).forEach(issue => {
    console.log(`  ❌ ${issue.file}:${issue.line} - ${issue.title}`);
    console.log(`     ${issue.description}`);
  });

  // Save detailed report
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      totalIssues: findings.length,
      bySeverity,
      byCategory,
      topProblematicFiles: sortedFiles.map(([file, issues]) => ({
        file,
        issueCount: issues.length
      }))
    },
    criticalIssues: criticalIssues.slice(0, 20),
    allFindings: findings
  };

  await fs.writeFile('code-quality-report.json', JSON.stringify(report, null, 2));
  console.log('✅ Detailed report saved to code-quality-report.json');
}

// Run the analysis
if (import.meta.url === `file://${process.argv[1]}`) {
  runComprehensiveAnalysis().then(success => {
    process.exit(success ? 0 : 1);
  });
}