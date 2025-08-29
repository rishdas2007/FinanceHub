const fs = require('fs');
const path = require('path');

let fixedFiles = 0;
let totalFixes = 0;

function fixJSImports(dir) {
  const files = fs.readdirSync(dir, { withFileTypes: true });
  
  for (const file of files) {
    const fullPath = path.join(dir, file.name);
    
    if (file.isDirectory() && file.name !== 'node_modules') {
      fixJSImports(fullPath);
    } else if (file.name.endsWith('.ts')) {
      let content = fs.readFileSync(fullPath, 'utf8');
      let modified = false;
      let fileFixCount = 0;
      
      // Fix patterns with detailed tracking
      const fixes = [
        // Database imports
        [/from\s+['"`]([^'"`]*\/)?db\.js['"`]/g, "from '$1db'"],
        // Logger imports
        [/from\s+['"`]([^'"`]*\/)?logger\.js['"`]/g, "from '$1logger'"],
        // Cache service imports
        [/from\s+['"`]([^'"`]*\/)?cache-unified\.js['"`]/g, "from '$1cache-unified'"],
        // Financial data service imports
        [/from\s+['"`]([^'"`]*\/)?financial-data\.js['"`]/g, "from '$1financial-data'"],
        // Shared schema imports
        [/from\s+['"`]([^'"`]*\/)?@shared\/schema\.js['"`]/g, "from '$1@shared/schema'"],
        // Shared constants imports
        [/from\s+['"`]([^'"`]*\/)?@shared\/constants\.js['"`]/g, "from '$1@shared/constants'"],
        // Email service imports
        [/from\s+['"`]([^'"`]*\/)?email-unified-enhanced\.js['"`]/g, "from '$1email-unified-enhanced'"],
        [/from\s+['"`]([^'"`]*\/)?email-simplified\.js['"`]/g, "from '$1email-simplified'"],
        // Cache warmup imports
        [/from\s+['"`]([^'"`]*\/)?cache-warmup\.js['"`]/g, "from '$1cache-warmup'"],
        // General .js import pattern (catch-all)
        [/from\s+['"`]([^'"`]+)\.js['"`]/g, "from '$1'"],
        [/import\s+['"`]([^'"`]+)\.js['"`]/g, "import '$1'"],
      ];
      
      for (const [pattern, replacement] of fixes) {
        const matches = content.match(pattern);
        if (matches) {
          content = content.replace(pattern, replacement);
          modified = true;
          fileFixCount += matches.length;
          totalFixes += matches.length;
        }
      }
      
      if (modified) {
        fs.writeFileSync(fullPath, content);
        console.log(`✅ Fixed ${fileFixCount} imports in: ${fullPath}`);
        fixedFiles++;
      }
    }
  }
}

console.log('🔧 Starting comprehensive .js import fix...');
console.log('================================================');

fixJSImports('./server');

console.log('================================================');
console.log(`✅ Fix completed!`);
console.log(`📊 Files fixed: ${fixedFiles}`);
console.log(`📊 Total imports fixed: ${totalFixes}`);

// Verification
console.log('\n🔍 Verifying remaining .js imports...');
const { execSync } = require('child_process');
try {
  const remaining = execSync('find server -name "*.ts" -type f -exec grep -l "\\.js[\'\\"]" {} \\; | wc -l', { encoding: 'utf8' }).trim();
  if (remaining === '0') {
    console.log('✅ All .js imports successfully removed!');
  } else {
    console.log(`⚠️ Found ${remaining} files with remaining .js imports`);
  }
} catch (error) {
  console.log('⚠️ Could not verify remaining imports');
}