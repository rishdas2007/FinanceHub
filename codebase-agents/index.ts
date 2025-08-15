// FinanceHub Pro v26 - Codebase Agent Framework Entry Point

import { CodeQualityScanner } from './agents/code-quality-scanner/index.js';
import { DeploymentSafetyAgent } from './agents/deployment-safety/index.js';
import { CodeQualityScannerRunner } from './agents/code-quality-scanner/runner.js';
import { testCodeQualityScanner } from './test-scanner.js';

// Export all agents and utilities
export {
  CodeQualityScanner,
  CodeQualityScannerRunner,
  testCodeQualityScanner
};

// Agent registry for future expansion
export const AVAILABLE_AGENTS = {
  'code-quality-scanner': {
    name: 'Code Quality Scanner',
    description: 'Analyzes TypeScript/JavaScript code for quality issues, complexity, and maintainability',
    version: '1.0.0',
    class: CodeQualityScanner,
    runner: CodeQualityScannerRunner
  },
  'deployment-safety-agent': {
    name: 'Deployment Safety Agent',
    description: 'Validates deployment safety and prevents production failures for financial applications',
    version: '1.0.0',
    class: DeploymentSafetyAgent,
    runner: null
  }
  // Future agents will be added here:
  // 'security-audit': SecurityAuditAgent,
  // 'performance-optimizer': PerformanceOptimizerAgent,
  // 'database-schema-validator': DatabaseSchemaValidatorAgent,
  // 'data-quality-assurance': DataQualityAssuranceAgent,
  // 'api-integration-health': ApiIntegrationHealthAgent,
  // 'architecture-compliance': ArchitectureComplianceAgent
};

// Main CLI interface
export async function runAgent(agentName: string, targetPaths: string[], configPath?: string) {
  const agent = AVAILABLE_AGENTS[agentName as keyof typeof AVAILABLE_AGENTS];
  
  if (!agent) {
    console.error(`❌ Unknown agent: ${agentName}`);
    console.log('Available agents:');
    Object.keys(AVAILABLE_AGENTS).forEach(name => {
      const agentInfo = AVAILABLE_AGENTS[name as keyof typeof AVAILABLE_AGENTS];
      console.log(`  • ${name}: ${agentInfo.description}`);
    });
    return false;
  }

  console.log(`🚀 Running ${agent.name} v${agent.version}`);
  console.log(`📝 ${agent.description}\n`);

  try {
    const runner = new agent.runner();
    await runner.runAnalysis(targetPaths, configPath);
    return true;
  } catch (error) {
    console.error(`❌ Agent execution failed:`, error);
    return false;
  }
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  const args = process.argv.slice(2);
  
  if (args.length === 0) {
    console.log('🔍 FinanceHub Pro - Codebase Agent Framework v1.0.0');
    console.log('📊 Comprehensive code analysis and quality monitoring\n');
    console.log('Usage:');
    console.log('  npm run agents <agent-name> <path1> [path2] ...');
    console.log('  npm run agents test');
    console.log('');
    console.log('Available agents:');
    Object.keys(AVAILABLE_AGENTS).forEach(name => {
      const agent = AVAILABLE_AGENTS[name as keyof typeof AVAILABLE_AGENTS];
      console.log(`  • ${name}: ${agent.description}`);
    });
    console.log('');
    console.log('Examples:');
    console.log('  npm run agents code-quality-scanner ./src ./server');
    console.log('  npm run agents test');
    process.exit(1);
  }

  const [command, ...paths] = args;
  
  if (command === 'test') {
    console.log('🧪 Running Code Quality Scanner test...\n');
    testCodeQualityScanner().then(success => {
      process.exit(success ? 0 : 1);
    });
  } else {
    runAgent(command, paths).then(success => {
      process.exit(success ? 0 : 1);
    });
  }
}