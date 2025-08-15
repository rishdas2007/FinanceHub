// Test script for Deployment Safety Agent

import { DeploymentSafetyAgent } from './agents/deployment-safety/index.js';
import { AgentConfig } from './types/agent-interfaces.js';
import * as fs from 'fs';
import * as path from 'path';

async function testDeploymentSafetyAgent() {
  console.log('🚀 Testing Deployment Safety Agent...\n');

  // Sample files for testing (FinanceHub Pro files)
  const testFiles = [
    'package.json',
    'server/routes/api-routes.ts',
    'shared/schema.ts',
    'server/services/fred-service.ts',
    'server/services/twelve-data-service.ts',
    'client/src/components/Dashboard.tsx',
    '.env.example',
    'migrations/001_create_tables.sql'
  ];

  // Filter to only existing files
  const existingFiles = testFiles.filter(file => {
    try {
      return fs.existsSync(file);
    } catch {
      return false;
    }
  });

  console.log(`📁 Testing with ${existingFiles.length} files:`);
  existingFiles.forEach(file => console.log(`   • ${file}`));
  console.log('');

  // Configure deployment safety analysis
  const config: AgentConfig = {
    rules: {
      'pre-deployment-validation': { enabled: true, severity: 'critical' },
      'database-migration-safety': { enabled: true, severity: 'critical' },
      'api-compatibility-check': { enabled: true, severity: 'high' },
      'data-pipeline-validation': { enabled: true, severity: 'high' },
      'critical-path-testing': { enabled: true, severity: 'high' },
      'performance-regression-detection': { enabled: true, severity: 'medium' },
      'breaking-change-detection': { enabled: true, severity: 'high' },
      'environment-parity-validation': { enabled: true, severity: 'medium' }
    },
    filePatterns: {
      include: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx', '**/*.json', '**/*.sql'],
      exclude: ['node_modules/**', 'dist/**', '**/*.test.ts']
    },
    thresholds: {
      critical: 0,     // Block deployment for any critical issues
      high: 3,         // Review required for more than 3 high issues
      medium: 10,      // Proceed with caution for more than 10 medium issues
      low: 50          // No action for low issues
    }
  };

  try {
    // Initialize the Deployment Safety Agent
    const agent = new DeploymentSafetyAgent();
    console.log(`🔍 ${agent.name} v${agent.version}: ${agent.description}\n`);

    // Run the deployment safety analysis
    const startTime = Date.now();
    console.log('🔍 Deployment Safety Agent: Starting comprehensive deployment validation...');
    
    const result = await agent.analyze(existingFiles, config);
    const endTime = Date.now();

    // Display results
    console.log(`\n✅ Deployment Safety Analysis Complete:\n`);
    console.log(`📊 Files Analyzed: ${result.metrics.filesAnalyzed}`);
    console.log(`📏 Lines of Code: ${result.metrics.linesOfCode}`);
    console.log(`🔍 Issues Found: ${result.findings.length}`);
    console.log(`📈 Safety Score: ${result.metrics.score}/100`);
    console.log(`⏱️ Execution Time: ${endTime - startTime}ms`);
    console.log(`📊 Risk Level: ${result.metadata?.riskLevel || 'unknown'}`);
    console.log(`💡 Recommendation: ${result.metadata?.deploymentRecommendation || 'unknown'}`);

    if (result.summary) {
      console.log(`\n📋 Summary: ${result.summary}`);
    }

    // Show findings by severity
    if (result.findings.length > 0) {
      console.log(`\n🔍 DEPLOYMENT SAFETY FINDINGS:`);
      console.log(`------------------------------\n`);

      const severityOrder = ['critical', 'high', 'medium', 'low', 'info'];
      const severityEmojis = {
        critical: '🚨',
        high: '⚠️', 
        medium: '📋',
        low: '💡',
        info: 'ℹ️'
      };

      for (const severity of severityOrder) {
        const severityFindings = result.findings.filter(f => f.severity === severity);
        if (severityFindings.length > 0) {
          console.log(`${severityEmojis[severity as keyof typeof severityEmojis]} ${severity.toUpperCase()}: ${severityFindings.length} findings`);
          
          // Show first few findings for each severity
          const displayCount = Math.min(severityFindings.length, 3);
          for (let i = 0; i < displayCount; i++) {
            const finding = severityFindings[i];
            console.log(`  • ${finding.title}${finding.file ? ` (${finding.file})` : ''}`);
            console.log(`    ${finding.description}`);
          }
          
          if (severityFindings.length > displayCount) {
            console.log(`    ... and ${severityFindings.length - displayCount} more ${severity} findings`);
          }
          console.log('');
        }
      }
    }

    // Show deployment recommendations
    if (result.suggestions && result.suggestions.length > 0) {
      console.log(`💡 DEPLOYMENT RECOMMENDATIONS:`);
      console.log(`--------------------\n`);
      
      for (const suggestion of result.suggestions.slice(0, 5)) {
        console.log(`• ${suggestion.title}`);
        console.log(`  ${suggestion.description}`);
        if (suggestion.recommendation) {
          console.log(`  → ${suggestion.recommendation}`);
        }
        console.log('');
      }
    }

    // Risk assessment details
    if (result.metadata) {
      console.log(`🎯 DEPLOYMENT ASSESSMENT:`);
      console.log(`========================================`);
      console.log(`✅ Success: ${result.success}`);
      console.log(`📊 Safety Score: ${result.metrics.score}/100`);
      console.log(`🔍 Risk Level: ${result.metadata.riskLevel}`);
      console.log(`📋 Recommendation: ${result.metadata.deploymentRecommendation}`);
      console.log(`🔄 Rollback Plan Required: ${result.metadata.rollbackPlanRequired ? 'Yes' : 'No'}`);
      console.log(`⏱️ Execution Time: ${result.executionTime}ms`);
      
      if (result.metadata.criticalIssues > 0) {
        console.log(`🚨 CRITICAL ISSUES: ${result.metadata.criticalIssues} (BLOCKS DEPLOYMENT)`);
      }
    }

    console.log('\n✅ Deployment Safety Agent test completed successfully!');
    return result.success;

  } catch (error) {
    console.error('❌ Deployment Safety Agent test failed:', error);
    return false;
  }
}

// Run the test if this file is executed directly
if (import.meta.url.endsWith(process.argv[1])) {
  testDeploymentSafetyAgent()
    .then(success => {
      process.exit(success ? 0 : 1);
    })
    .catch(error => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

export { testDeploymentSafetyAgent };