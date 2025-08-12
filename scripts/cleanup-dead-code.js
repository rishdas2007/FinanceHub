#!/usr/bin/env node

/**
 * Dead Code Cleanup Script
 * Removes old sparkline-related code and imports that are no longer needed
 * after the performance optimization changes
 */

const fs = require('fs');
const path = require('path');

const deadCodePatterns = [
  // Old sparkline imports
  /import.*SparklineContainer.*from.*['"].*['"];?\n?/g,
  /import.*Sparkline.*from.*['"].*sparkline.*['"];?\n?/g,
  
  // Old sparkline service imports
  /import.*sparklineService.*from.*['"].*['"];?\n?/g,
  
  // Dead sparkline endpoints in tests
  /\/api\/etf\/sparkline/g,
  /\/api\/sparkline/g,
];

const filesToClean = [
  'client/src/components/ETFMetricsTable.tsx',
  'client/src/hooks/useEtfMetrics.ts',
  'client/src/adapters/etfMetricsAdapter.ts',
  'server/routes/etf-enhanced-routes.ts',
  'tests/etf-metrics.test.ts',
];

console.log('🧹 Starting dead code cleanup...');

filesToClean.forEach(filePath => {
  if (fs.existsSync(filePath)) {
    let content = fs.readFileSync(filePath, 'utf8');
    let originalLength = content.length;
    
    deadCodePatterns.forEach(pattern => {
      content = content.replace(pattern, '');
    });
    
    // Remove empty lines
    content = content.replace(/\n\s*\n\s*\n/g, '\n\n');
    
    if (content.length !== originalLength) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Cleaned ${filePath} (removed ${originalLength - content.length} characters)`);
    } else {
      console.log(`ℹ️  No cleanup needed for ${filePath}`);
    }
  } else {
    console.log(`⚠️  File not found: ${filePath}`);
  }
});

console.log('✅ Dead code cleanup complete!');