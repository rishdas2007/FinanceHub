#!/usr/bin/env node

/**
 * Automatic Context.md Updater
 * 
 * This script monitors changes to documentation files and automatically
 * updates the Context.md master document when changes are detected.
 * 
 * Usage:
 *   node scripts/update-context.js        # One-time update
 *   node scripts/update-context.js watch  # Watch mode
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import chokidar from 'chokidar';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

// Files to monitor for changes
const MONITORED_FILES = [
  'README.md',
  'replit.md',
  'TECHNICAL_DESIGN_DOCUMENT.md',
  'package.json',
  'shared/schema.ts',
  'server/routes',
  'client/src/components',
  '.env.example'
];

// Sections that can be auto-updated
const AUTO_UPDATE_SECTIONS = {
  'project-version': () => getProjectVersion(),
  'last-updated': () => new Date().toISOString().split('T')[0],
  'route-count': () => countFiles('server/routes', '.ts'),
  'component-count': () => countFiles('client/src/components', '.tsx'),
  'service-count': () => countFiles('server/services', '.ts'),
  'recent-commits': () => getRecentCommits(5),
  'environment-vars': () => extractEnvVars(),
  'dependencies': () => extractDependencies(),
  'api-endpoints': () => extractAPIEndpoints(),
  'database-tables': () => extractDatabaseTables()
};

/**
 * Get project version from package.json
 */
function getProjectVersion() {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8')
    );
    return packageJson.version || '1.0.0';
  } catch (error) {
    console.error('Error reading package.json:', error);
    return 'Unknown';
  }
}

/**
 * Count files in directory with specific extension
 */
function countFiles(dir, extension) {
  const fullPath = path.join(PROJECT_ROOT, dir);
  if (!fs.existsSync(fullPath)) return 0;
  
  let count = 0;
  const files = fs.readdirSync(fullPath, { withFileTypes: true });
  
  for (const file of files) {
    if (file.isDirectory()) {
      count += countFiles(path.join(dir, file.name), extension);
    } else if (file.name.endsWith(extension)) {
      count++;
    }
  }
  
  return count;
}

/**
 * Get recent git commits
 */
function getRecentCommits(limit = 5) {
  try {
    const { execSync } = require('child_process');
    const commits = execSync(
      `git log --oneline -n ${limit}`,
      { cwd: PROJECT_ROOT, encoding: 'utf8' }
    );
    return commits.trim().split('\n').map(line => `- ${line}`).join('\n');
  } catch (error) {
    return '- Unable to fetch recent commits';
  }
}

/**
 * Extract environment variables from .env.example
 */
function extractEnvVars() {
  const envPath = path.join(PROJECT_ROOT, '.env.example');
  if (!fs.existsSync(envPath)) return 'No .env.example found';
  
  const content = fs.readFileSync(envPath, 'utf8');
  const vars = content
    .split('\n')
    .filter(line => line.includes('=') && !line.startsWith('#'))
    .map(line => {
      const [key, value] = line.split('=');
      const description = value.includes('#') 
        ? value.split('#')[1].trim() 
        : '';
      return `${key}=${value.split('#')[0].trim()} ${description ? `# ${description}` : ''}`;
    });
  
  return vars.join('\n');
}

/**
 * Extract dependencies from package.json
 */
function extractDependencies() {
  try {
    const packageJson = JSON.parse(
      fs.readFileSync(path.join(PROJECT_ROOT, 'package.json'), 'utf8')
    );
    
    const deps = packageJson.dependencies || {};
    const mainDeps = [
      'react', 'express', 'drizzle-orm', 'postgresql', 
      'tailwindcss', 'typescript', 'vite'
    ];
    
    const result = [];
    for (const dep of mainDeps) {
      if (deps[dep]) {
        result.push(`- ${dep}: ${deps[dep]}`);
      }
    }
    
    return result.join('\n');
  } catch (error) {
    return 'Unable to extract dependencies';
  }
}

/**
 * Extract API endpoints from route files
 */
function extractAPIEndpoints() {
  const routesDir = path.join(PROJECT_ROOT, 'server/routes');
  if (!fs.existsSync(routesDir)) return 'Routes directory not found';
  
  const endpoints = [];
  const files = fs.readdirSync(routesDir);
  
  for (const file of files) {
    if (file.endsWith('.ts')) {
      const content = fs.readFileSync(path.join(routesDir, file), 'utf8');
      
      // Extract route patterns (basic regex - can be improved)
      const getRoutes = content.match(/router\.(get|post|put|delete|patch)\(['"`](.*?)['"`]/g) || [];
      const appRoutes = content.match(/app\.(get|post|put|delete|patch)\(['"`](.*?)['"`]/g) || [];
      
      [...getRoutes, ...appRoutes].forEach(route => {
        const match = route.match(/(get|post|put|delete|patch)\(['"`](.*?)['"`]/);
        if (match) {
          endpoints.push(`${match[1].toUpperCase()} ${match[2]}`);
        }
      });
    }
  }
  
  return endpoints.slice(0, 10).map(e => `- ${e}`).join('\n') + 
         (endpoints.length > 10 ? `\n... and ${endpoints.length - 10} more` : '');
}

/**
 * Extract database tables from schema.ts
 */
function extractDatabaseTables() {
  const schemaPath = path.join(PROJECT_ROOT, 'shared/schema.ts');
  if (!fs.existsSync(schemaPath)) return 'Schema file not found';
  
  const content = fs.readFileSync(schemaPath, 'utf8');
  
  // Extract table definitions (basic regex)
  const tables = content.match(/export const (\w+) = pgTable\(['"`](\w+)['"`]/g) || [];
  
  return tables
    .map(table => {
      const match = table.match(/const (\w+) = pgTable\(['"`](\w+)['"`]/);
      return match ? `- ${match[2]} (${match[1]})` : '';
    })
    .filter(Boolean)
    .slice(0, 10)
    .join('\n');
}

/**
 * Calculate file checksum for change detection
 */
function getFileChecksum(filepath) {
  if (!fs.existsSync(filepath)) return null;
  const content = fs.readFileSync(filepath, 'utf8');
  return crypto.createHash('md5').update(content).digest('hex');
}

/**
 * Update Context.md with latest information
 */
function updateContext() {
  console.log('📝 Updating Context.md...');
  
  const contextPath = path.join(PROJECT_ROOT, 'Context.md');
  if (!fs.existsSync(contextPath)) {
    console.error('❌ Context.md not found!');
    return;
  }
  
  let content = fs.readFileSync(contextPath, 'utf8');
  const originalContent = content;
  
  // Update auto-generated sections
  for (const [key, generator] of Object.entries(AUTO_UPDATE_SECTIONS)) {
    try {
      const value = generator();
      
      // Update based on key patterns
      switch(key) {
        case 'last-updated':
          content = content.replace(
            /\*Last Updated: \d{4}-\d{2}-\d{2}\*/,
            `*Last Updated: ${value}*`
          );
          content = content.replace(
            /\*Last automatic update: \d{4}-\d{2}-\d{2}\*/,
            `*Last automatic update: ${value}*`
          );
          break;
        
        case 'project-version':
          content = content.replace(
            /\*Version: [\d.]+.*?\*/,
            `*Version: ${value} (Replit Optimized)*`
          );
          break;
        
        case 'route-count':
          content = content.replace(
            /│   ├── routes\/\s+# \d+\+ API endpoint definitions/,
            `│   ├── routes/               # ${value}+ API endpoint definitions`
          );
          break;
        
        case 'component-count':
          content = content.replace(
            /│   │   ├── components\/\s+# \d+\+ reusable UI components/,
            `│   │   ├── components/        # ${value}+ reusable UI components`
          );
          break;
        
        case 'service-count':
          content = content.replace(
            /│   ├── services\/\s+# \d+\+ business logic services/,
            `│   ├── services/             # ${value}+ business logic services`
          );
          break;
      }
    } catch (error) {
      console.error(`Error updating ${key}:`, error.message);
    }
  }
  
  // Check if content changed
  if (content !== originalContent) {
    fs.writeFileSync(contextPath, content);
    console.log('✅ Context.md updated successfully!');
    
    // Log what was updated
    const updates = [];
    if (content.includes(new Date().toISOString().split('T')[0])) {
      updates.push('timestamp');
    }
    if (updates.length > 0) {
      console.log(`   Updated: ${updates.join(', ')}`);
    }
  } else {
    console.log('ℹ️  No updates needed for Context.md');
  }
}

/**
 * Watch mode for continuous monitoring
 */
function watchMode() {
  console.log('👁️  Starting watch mode for Context.md updates...');
  
  const watcher = chokidar.watch(MONITORED_FILES.map(f => path.join(PROJECT_ROOT, f)), {
    persistent: true,
    ignoreInitial: true,
    ignored: /(^|[\/\\])\../,
    awaitWriteFinish: {
      stabilityThreshold: 2000,
      pollInterval: 100
    }
  });
  
  const checksums = new Map();
  
  // Initialize checksums
  MONITORED_FILES.forEach(file => {
    const filepath = path.join(PROJECT_ROOT, file);
    if (fs.existsSync(filepath) && fs.statSync(filepath).isFile()) {
      checksums.set(file, getFileChecksum(filepath));
    }
  });
  
  // Handle file changes
  watcher
    .on('change', (filepath) => {
      const relativePath = path.relative(PROJECT_ROOT, filepath);
      const oldChecksum = checksums.get(relativePath);
      const newChecksum = getFileChecksum(filepath);
      
      if (oldChecksum !== newChecksum) {
        console.log(`\n📄 Detected change in: ${relativePath}`);
        checksums.set(relativePath, newChecksum);
        updateContext();
      }
    })
    .on('add', (filepath) => {
      const relativePath = path.relative(PROJECT_ROOT, filepath);
      console.log(`\n➕ New file detected: ${relativePath}`);
      checksums.set(relativePath, getFileChecksum(filepath));
      updateContext();
    })
    .on('unlink', (filepath) => {
      const relativePath = path.relative(PROJECT_ROOT, filepath);
      console.log(`\n➖ File removed: ${relativePath}`);
      checksums.delete(relativePath);
      updateContext();
    })
    .on('error', error => console.error('Watcher error:', error));
  
  console.log('✅ Watching for changes in:');
  MONITORED_FILES.forEach(file => console.log(`   - ${file}`));
  console.log('\nPress Ctrl+C to stop watching.\n');
}

/**
 * Main execution
 */
function main() {
  const args = process.argv.slice(2);
  
  if (args.includes('watch')) {
    watchMode();
  } else {
    // One-time update
    updateContext();
    
    // Show usage hint
    console.log('\n💡 Tip: Run with "watch" argument for continuous monitoring:');
    console.log('   node scripts/update-context.js watch\n');
  }
}

// Run if executed directly
if (import.meta.url === `file://${__filename}`) {
  main();
}

export { updateContext, watchMode };