// FinanceHub Pro Deployment Verification
const fs = require('fs');
const path = require('path');

console.log('🔍 FinanceHub Pro Deployment Verification');
console.log('==========================================');

// Check required files
const requiredFiles = [
    'package.json',
    'server/index.ts',
    'client/src/App.tsx',
    'shared/schema.ts',
    '.env.example'
];

let allFilesPresent = true;
requiredFiles.forEach(file => {
    if (fs.existsSync(file)) {
        console.log(`✅ ${file}`);
    } else {
        console.log(`❌ ${file} - MISSING`);
        allFilesPresent = false;
    }
});

// Check package.json
try {
    const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
    console.log(`\n📦 Package: ${pkg.name} v${pkg.version}`);
    console.log(`📝 Description: ${pkg.description || 'No description'}`);
    console.log(`🔧 Dependencies: ${Object.keys(pkg.dependencies || {}).length}`);
    console.log(`🛠️  Dev Dependencies: ${Object.keys(pkg.devDependencies || {}).length}`);
} catch (error) {
    console.log('❌ Error reading package.json');
}

// Final status
console.log('\n' + '='.repeat(40));
if (allFilesPresent) {
    console.log('✅ Deployment package is complete and ready!');
} else {
    console.log('⚠️  Some files are missing. Please check the package.');
}
