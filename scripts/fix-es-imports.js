#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const distDir = path.join(__dirname, '../dist/server');

function fixImports(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  
  // Fix relative imports without .js extension
  const fixedContent = content.replace(
    /import\s+({[^}]*}|\w+|\*\s+as\s+\w+)\s+from\s+['"](\.[^'"]*(?<!\.js))['"];?/g,
    (match, imports, modulePath) => {
      // Don't add .js to paths that already have extensions or are node_modules
      if (modulePath.includes('.') && !modulePath.endsWith('.js')) {
        return match;
      }
      return `import ${imports} from '${modulePath}.js';`;
    }
  );
  
  if (content !== fixedContent) {
    console.log(`Fixed imports in: ${filePath}`);
    fs.writeFileSync(filePath, fixedContent, 'utf8');
  }
}

function processDirectory(dir) {
  const items = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const item of items) {
    const itemPath = path.join(dir, item.name);
    
    if (item.isDirectory()) {
      processDirectory(itemPath);
    } else if (item.name.endsWith('.js')) {
      fixImports(itemPath);
    }
  }
}

// Fix index.js specifically for routes directory import
const indexPath = path.join(distDir, 'index.js');
if (fs.existsSync(indexPath)) {
  const content = fs.readFileSync(indexPath, 'utf8');
  const fixed = content.replace(
    'import { registerRoutes } from "./routes";',
    'import { registerRoutes } from "./routes.js";'
  );
  if (content !== fixed) {
    fs.writeFileSync(indexPath, fixed, 'utf8');
    console.log('Fixed main index.js import');
  }
}

// Process all JS files recursively
if (fs.existsSync(distDir)) {
  processDirectory(distDir);
  console.log('ES module import fix completed!');
} else {
  console.error('Dist directory not found:', distDir);
  process.exit(1);
}