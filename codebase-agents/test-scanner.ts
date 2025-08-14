// Test script for Code Quality Scanner

import { CodeQualityScanner } from './agents/code-quality-scanner/index.js';
import { AgentConfig } from './types/agent-interfaces.js';
import * as fs from 'fs';

async function testCodeQualityScanner() {
  console.log('🔍 Testing FinanceHub Pro Code Quality Scanner...\n');

  const scanner = new CodeQualityScanner();
  
  // Test configuration
  const config: AgentConfig = {
    enabled: true,
    autoFix: false,
    severity: 'medium',
    rules: {
      'typescript-no-any': true,
      'financial-z-score-accuracy': true,
      'function-complexity-limit': { enabled: true, maxComplexity: 10 }
    },
    excludePatterns: ['node_modules/**', 'dist/**'],
    includePatterns: ['**/*.ts', '**/*.tsx']
  };

  // Test files - analyze some actual FinanceHub files
  const testFiles = [
    'server/services/etf-metrics-service.ts',
    'client/src/components/ETFMetricsTableOptimized.tsx',
    'shared/schema.ts'
  ].filter(file => fs.existsSync(file));

  if (testFiles.length === 0) {
    console.log('❌ No test files found. Using the agent files for testing...');
    testFiles.push(
      'codebase-agents/agents/code-quality-scanner/index.ts',
      'codebase-agents/core/base-agent.ts'
    );
  }

  console.log(`📁 Testing with ${testFiles.length} files:`);
  testFiles.forEach(file => console.log(`   • ${file}`));
  console.log('');

  try {
    const result = await scanner.analyze(testFiles, config);
    
    console.log('🎯 SCANNER TEST RESULTS');
    console.log('='.repeat(40));
    console.log(`✅ Success: ${result.success}`);
    console.log(`📊 Files Analyzed: ${result.metrics.filesAnalyzed}`);
    console.log(`📏 Lines of Code: ${result.metrics.linesOfCode}`);
    console.log(`🔍 Issues Found: ${result.findings.length}`);
    console.log(`📈 Quality Score: ${result.metrics.score}/100`);
    console.log(`⏱️ Execution Time: ${result.executionTime}ms`);
    
    if (result.findings.length > 0) {
      console.log('\n🔍 SAMPLE FINDINGS:');
      console.log('-'.repeat(30));
      
      const severityGroups = result.findings.reduce((acc, finding) => {
        if (!acc[finding.severity]) acc[finding.severity] = [];
        acc[finding.severity].push(finding);
        return acc;
      }, {} as Record<string, any[]>);

      ['critical', 'high', 'medium', 'low'].forEach(severity => {
        if (severityGroups[severity]?.length > 0) {
          console.log(`\n${severity.toUpperCase()}: ${severityGroups[severity].length} issues`);
          severityGroups[severity].slice(0, 3).forEach(finding => {
            console.log(`  • ${finding.title} (${finding.file}:${finding.line || '?'})`);
            console.log(`    ${finding.description}`);
          });
        }
      });
    }

    if (result.suggestions.length > 0) {
      console.log('\n💡 SUGGESTIONS:');
      console.log('-'.repeat(20));
      result.suggestions.slice(0, 3).forEach(suggestion => {
        console.log(`• ${suggestion.title} (${suggestion.impact} impact, ${suggestion.effort} effort)`);
        console.log(`  ${suggestion.description}`);
      });
    }

    console.log('\n✅ Code Quality Scanner test completed successfully!');
    return true;

  } catch (error) {
    console.error('❌ Scanner test failed:', error);
    return false;
  }
}

// Run the test
if (import.meta.url === `file://${process.argv[1]}`) {
  testCodeQualityScanner().then(success => {
    process.exit(success ? 0 : 1);
  });
}

export { testCodeQualityScanner };