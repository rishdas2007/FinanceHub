#!/usr/bin/env node

/**
 * FinanceHub Pro v26 - Deployment Safety Agent
 * Comprehensive production readiness validation
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class DeploymentSafetyAgent {
  constructor() {
    this.projectRoot = path.resolve(__dirname, '..');
    this.issues = [];
    this.passed = [];
    this.critical = [];
    this.warnings = [];
  }

  async runFullValidation() {
    console.log('🚀 FinanceHub Pro - Deployment Safety Validation');
    console.log('🔒 Comprehensive Production Readiness Check\n');

    // Core safety checks
    await this.validateEnvironmentConfiguration();
    await this.validateDatabaseSecurity();
    await this.validateAPIKeySecurity();
    await this.validateProductionBuilds();
    await this.validateErrorHandling();
    await this.validatePerformanceRequirements();
    await this.validateSecurityHeaders();
    await this.validateLoggingAndMonitoring();
    await this.validateDataValidation();
    await this.validateRateLimiting();

    this.generateDeploymentReport();
  }

  async validateEnvironmentConfiguration() {
    console.log('🔍 Environment Configuration...');
    
    // Check for required environment variables
    const requiredEnvVars = [
      'DATABASE_URL',
      'FRED_API_KEY',
      'TWELVE_DATA_API_KEY',
      'SENDGRID_API_KEY'
    ];

    const envFile = path.join(this.projectRoot, '.env');
    let envContent = '';
    
    try {
      envContent = fs.readFileSync(envFile, 'utf8');
    } catch (error) {
      this.critical.push('Missing .env file - required for deployment');
      return;
    }

    for (const envVar of requiredEnvVars) {
      if (envContent.includes(`${envVar}=`) && !envContent.includes(`${envVar}=your_`)) {
        this.passed.push(`✅ ${envVar} configured`);
      } else {
        this.warnings.push(`⚠️ ${envVar} missing or using placeholder value`);
      }
    }

    // Check for production-specific configurations
    if (envContent.includes('NODE_ENV=production')) {
      this.passed.push('✅ Production environment configured');
    } else {
      this.warnings.push('⚠️ NODE_ENV not set to production');
    }
  }

  async validateDatabaseSecurity() {
    console.log('🔍 Database Security...');
    
    // Check database configuration
    const dbConfigPath = path.join(this.projectRoot, 'drizzle.config.ts');
    
    try {
      const dbConfig = fs.readFileSync(dbConfigPath, 'utf8');
      
      if (dbConfig.includes('ssl:') || dbConfig.includes('sslmode')) {
        this.passed.push('✅ Database SSL configuration present');
      } else {
        this.warnings.push('⚠️ Database SSL configuration not found');
      }

      // Check for connection pooling
      if (dbConfig.includes('pooling') || dbConfig.includes('pool')) {
        this.passed.push('✅ Database connection pooling configured');
      } else {
        this.warnings.push('⚠️ Database connection pooling not configured');
      }

    } catch (error) {
      this.critical.push('❌ Cannot read database configuration');
    }
  }

  async validateAPIKeySecurity() {
    console.log('🔍 API Key Security...');
    
    // Scan for hardcoded API keys in source code
    const sourceFiles = this.getAllSourceFiles();
    const apiKeyPatterns = [
      /api[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/gi,
      /secret[_-]?key\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/gi,
      /token\s*[:=]\s*['"][a-zA-Z0-9]{20,}['"]/gi
    ];

    let hardcodedKeysFound = 0;

    for (const file of sourceFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        
        for (const pattern of apiKeyPatterns) {
          const matches = content.match(pattern);
          if (matches) {
            hardcodedKeysFound += matches.length;
            this.critical.push(`❌ Potential hardcoded API key in ${file}`);
          }
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    if (hardcodedKeysFound === 0) {
      this.passed.push('✅ No hardcoded API keys detected');
    }
  }

  async validateProductionBuilds() {
    console.log('🔍 Production Build Configuration...');
    
    // Check package.json for build scripts
    const packageJsonPath = path.join(this.projectRoot, 'package.json');
    
    try {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      if (packageJson.scripts && packageJson.scripts.build) {
        this.passed.push('✅ Build script configured');
      } else {
        this.warnings.push('⚠️ Build script not found in package.json');
      }

      if (packageJson.scripts && packageJson.scripts.start) {
        this.passed.push('✅ Start script configured');
      } else {
        this.critical.push('❌ Start script missing - required for deployment');
      }

      // Check for production dependencies
      const prodDeps = packageJson.dependencies || {};
      const devDeps = packageJson.devDependencies || {};
      
      if (Object.keys(prodDeps).length > 0) {
        this.passed.push('✅ Production dependencies defined');
      }

      // Check for unnecessary dev dependencies in production
      const unnecessaryInProd = ['nodemon', 'ts-node-dev', 'concurrently'];
      const foundUnnecessary = unnecessaryInProd.filter(dep => prodDeps[dep]);
      
      if (foundUnnecessary.length > 0) {
        this.warnings.push(`⚠️ Development tools in production deps: ${foundUnnecessary.join(', ')}`);
      }

    } catch (error) {
      this.critical.push('❌ Cannot read package.json');
    }
  }

  async validateErrorHandling() {
    console.log('🔍 Error Handling...');
    
    // Check for global error handlers
    const serverFiles = this.getServerFiles();
    let hasGlobalErrorHandler = false;
    let hasUncaughtExceptionHandler = false;

    for (const file of serverFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        
        if (content.includes('process.on(\'uncaughtException\'') || 
            content.includes('process.on("uncaughtException"')) {
          hasUncaughtExceptionHandler = true;
        }

        if (content.includes('app.use(errorHandler)') || 
            (content.includes('app.use(') && content.includes('error') && 
            (content.includes('err, req, res, next') || content.includes('error, req, res, next')))) {
          hasGlobalErrorHandler = true;
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    if (hasGlobalErrorHandler) {
      this.passed.push('✅ Global error handler detected');
    } else {
      this.critical.push('❌ Global error handler missing');
    }

    if (hasUncaughtExceptionHandler) {
      this.passed.push('✅ Uncaught exception handler detected');
    } else {
      this.warnings.push('⚠️ Uncaught exception handler not found');
    }
  }

  async validatePerformanceRequirements() {
    console.log('🔍 Performance Configuration...');
    
    // Check for compression middleware
    const serverFiles = this.getServerFiles();
    let hasCompression = false;
    let hasRateLimit = false;
    let hasCaching = false;

    for (const file of serverFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        
        if (content.includes('compression') || content.includes('gzip')) {
          hasCompression = true;
        }

        if (content.includes('express-rate-limit') || content.includes('rateLimit')) {
          hasRateLimit = true;
        }

        if (content.includes('cache') && content.includes('ttl')) {
          hasCaching = true;
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    if (hasCompression) {
      this.passed.push('✅ Response compression configured');
    } else {
      this.warnings.push('⚠️ Response compression not detected');
    }

    if (hasRateLimit) {
      this.passed.push('✅ Rate limiting configured');
    } else {
      this.warnings.push('⚠️ Rate limiting not detected');
    }

    if (hasCaching) {
      this.passed.push('✅ Caching strategy detected');
    } else {
      this.warnings.push('⚠️ Caching strategy not detected');
    }
  }

  async validateSecurityHeaders() {
    console.log('🔍 Security Headers...');
    
    const serverFiles = this.getServerFiles();
    let hasHelmet = false;
    let hasCors = false;

    for (const file of serverFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        
        if (content.includes('helmet')) {
          hasHelmet = true;
        }

        if (content.includes('cors')) {
          hasCors = true;
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    if (hasHelmet) {
      this.passed.push('✅ Security headers (Helmet) configured');
    } else {
      this.critical.push('❌ Security headers missing - Helmet not detected');
    }

    if (hasCors) {
      this.passed.push('✅ CORS configuration detected');
    } else {
      this.warnings.push('⚠️ CORS configuration not detected');
    }
  }

  async validateLoggingAndMonitoring() {
    console.log('🔍 Logging and Monitoring...');
    
    const serverFiles = this.getServerFiles();
    let hasStructuredLogging = false;
    let hasHealthCheck = false;

    for (const file of serverFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        
        if (content.includes('pino') || content.includes('winston') || 
            content.includes('logger.info') || content.includes('logger.error')) {
          hasStructuredLogging = true;
        }

        if (content.includes('/health') || content.includes('/status') ||
            content.includes('health-check') || content.includes('healthcheck')) {
          hasHealthCheck = true;
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    if (hasStructuredLogging) {
      this.passed.push('✅ Structured logging detected');
    } else {
      this.warnings.push('⚠️ Structured logging not detected');
    }

    if (hasHealthCheck) {
      this.passed.push('✅ Health check endpoint detected');
    } else {
      this.critical.push('❌ Health check endpoint missing');
    }
  }

  async validateDataValidation() {
    console.log('🔍 Data Validation...');
    
    const serverFiles = this.getServerFiles();
    let hasInputValidation = false;
    let hasSqlInjectionProtection = false;

    for (const file of serverFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        
        if (content.includes('zod') || content.includes('joi') || 
            content.includes('validator') || content.includes('validate')) {
          hasInputValidation = true;
        }

        if (content.includes('drizzle') || content.includes('prisma') || 
            content.includes('parameterized') || content.includes('prepared')) {
          hasSqlInjectionProtection = true;
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    if (hasInputValidation) {
      this.passed.push('✅ Input validation detected');
    } else {
      this.critical.push('❌ Input validation missing');
    }

    if (hasSqlInjectionProtection) {
      this.passed.push('✅ SQL injection protection (ORM) detected');
    } else {
      this.warnings.push('⚠️ SQL injection protection not clearly detected');
    }
  }

  async validateRateLimiting() {
    console.log('🔍 Rate Limiting and DDoS Protection...');
    
    // Check for rate limiting configuration
    const serverFiles = this.getServerFiles();
    let hasRateLimit = false;
    let hasRequestSizeLimit = false;

    for (const file of serverFiles) {
      try {
        const content = fs.readFileSync(file, 'utf8');
        
        if (content.includes('rate-limit') || content.includes('rateLimit')) {
          hasRateLimit = true;
        }

        if (content.includes('express.json') && content.includes('limit')) {
          hasRequestSizeLimit = true;
        }
      } catch (error) {
        // Skip files that can't be read
      }
    }

    if (hasRateLimit) {
      this.passed.push('✅ Rate limiting configured');
    } else {
      this.critical.push('❌ Rate limiting missing - critical for production');
    }

    if (hasRequestSizeLimit) {
      this.passed.push('✅ Request size limits configured');
    } else {
      this.warnings.push('⚠️ Request size limits not detected');
    }
  }

  getAllSourceFiles() {
    const sourceExts = ['.ts', '.tsx', '.js', '.jsx'];
    const excludeDirs = ['node_modules', '.git', 'dist', 'build', 'coverage'];
    
    return this.getFilesRecursively(this.projectRoot, sourceExts, excludeDirs);
  }

  getServerFiles() {
    const serverDir = path.join(this.projectRoot, 'server');
    const sourceExts = ['.ts', '.js'];
    
    return this.getFilesRecursively(serverDir, sourceExts, []);
  }

  getFilesRecursively(dir, extensions, excludeDirs) {
    let files = [];
    
    try {
      const items = fs.readdirSync(dir);
      
      for (const item of items) {
        const fullPath = path.join(dir, item);
        const stat = fs.statSync(fullPath);
        
        if (stat.isDirectory() && !excludeDirs.includes(item)) {
          files = files.concat(this.getFilesRecursively(fullPath, extensions, excludeDirs));
        } else if (stat.isFile() && extensions.some(ext => item.endsWith(ext))) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
    
    return files;
  }

  generateDeploymentReport() {
    console.log('\n🚀 DEPLOYMENT SAFETY REPORT');
    console.log('='.repeat(50));
    
    console.log(`\n✅ PASSED CHECKS (${this.passed.length}):`);
    this.passed.forEach(check => console.log(check));
    
    if (this.warnings.length > 0) {
      console.log(`\n⚠️ WARNINGS (${this.warnings.length}):`);
      this.warnings.forEach(warning => console.log(warning));
    }
    
    if (this.critical.length > 0) {
      console.log(`\n❌ CRITICAL ISSUES (${this.critical.length}):`);
      this.critical.forEach(issue => console.log(issue));
    }

    // Overall deployment readiness
    console.log('\n📊 DEPLOYMENT READINESS ASSESSMENT:');
    
    if (this.critical.length === 0) {
      if (this.warnings.length === 0) {
        console.log('🟢 READY FOR DEPLOYMENT - All checks passed!');
      } else if (this.warnings.length <= 3) {
        console.log('🟡 DEPLOYMENT READY - Minor warnings detected');
      } else {
        console.log('🟠 DEPLOYMENT CAUTION - Multiple warnings detected');
      }
    } else {
      console.log('🔴 NOT READY FOR DEPLOYMENT - Critical issues must be resolved');
    }

    // Save detailed report
    const report = {
      timestamp: new Date().toISOString(),
      deploymentReady: this.critical.length === 0,
      summary: {
        passed: this.passed.length,
        warnings: this.warnings.length,
        critical: this.critical.length
      },
      checks: {
        passed: this.passed,
        warnings: this.warnings,
        critical: this.critical
      }
    };

    fs.writeFileSync(
      path.join(this.projectRoot, 'deployment-safety-report.json'),
      JSON.stringify(report, null, 2)
    );

    console.log('\n📋 Detailed report saved to deployment-safety-report.json');
  }
}

// Run the deployment safety validation
const agent = new DeploymentSafetyAgent();
agent.runFullValidation().catch(console.error);