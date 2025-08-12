#!/usr/bin/env node

/**
 * Dead Code Cleanup Script
 * Removes references to old individual sparkline endpoints
 */

import fs from 'fs';
import path from 'path';

const PATTERNS_TO_REMOVE = [
  /\/api\/sparkline\/.*$/gm,
  /useSparklineQuery.*$/gm,
  /sparkline.*individual.*$/gm,
  /\.sparklineCall.*$/gm
];

const DIRECTORIES_TO_SCAN = [
  'client/src',
  'server/routes'
];

function cleanFile(filePath) {
  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let hasChanges = false;
    
    PATTERNS_TO_REMOVE.forEach(pattern => {
      const original = content;
      content = content.replace(pattern, '');
      if (content !== original) {
        hasChanges = true;
      }
    });
    
    if (hasChanges) {
      fs.writeFileSync(filePath, content);
      console.log(`✅ Cleaned: ${filePath}`);
    }
  } catch (error) {
    console.warn(`⚠️  Could not clean ${filePath}: ${error.message}`);
  }
}

function scanDirectory(dir) {
  const items = fs.readdirSync(dir);
  
  items.forEach(item => {
    const fullPath = path.join(dir, item);
    const stat = fs.statSync(fullPath);
    
    if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
      scanDirectory(fullPath);
    } else if (stat.isFile() && (fullPath.endsWith('.ts') || fullPath.endsWith('.tsx'))) {
      cleanFile(fullPath);
    }
  });
}

console.log('🧹 Starting dead code cleanup...');

DIRECTORIES_TO_SCAN.forEach(dir => {
  if (fs.existsSync(dir)) {
    console.log(`📁 Scanning ${dir}...`);
    scanDirectory(dir);
  }
});

console.log('✅ Dead code cleanup completed!');