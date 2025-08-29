import { logger } from '../../shared/utils/logger';

export interface EnvironmentValidationResult {
  isValid: boolean;
  critical: string[];
  warnings: string[];
  missing: string[];
}

/**
 * ✅ PHASE 2 TASK 6: Comprehensive environment validation
 */
export class EnvironmentValidator {
  
  private static readonly REQUIRED_VARIABLES = [
    'DATABASE_URL',
    'FRED_API_KEY',
    'TWELVE_DATA_API_KEY'
  ];
  
  private static readonly OPTIONAL_VARIABLES = [
    'OPENAI_API_KEY',
    'SENDGRID_API_KEY',
    'JWT_SECRET',
    'REDIS_URL',
    'NODE_ENV'
  ];
  
  private static readonly SECURITY_VARIABLES = [
    'JWT_SECRET'
  ];
  
  /**
   * Validate all environment variables for production readiness
   */
  static validateEnvironment(): EnvironmentValidationResult {
    const result: EnvironmentValidationResult = {
      isValid: true,
      critical: [],
      warnings: [],
      missing: []
    };
    
    // Check required variables
    for (const variable of this.REQUIRED_VARIABLES) {
      const value = process.env[variable];
      if (!value || value.trim() === '') {
        result.critical.push(`${variable} is required but not set`);
        result.missing.push(variable);
        result.isValid = false;
      }
    }
    
    // Check optional but important variables
    for (const variable of this.OPTIONAL_VARIABLES) {
      const value = process.env[variable];
      if (!value || value.trim() === '') {
        result.warnings.push(`${variable} is not set (optional but recommended)`);
        result.missing.push(variable);
      }
    }
    
    // Check security-critical variables
    for (const variable of this.SECURITY_VARIABLES) {
      const value = process.env[variable];
      if (value && value.length < 32) {
        result.warnings.push(`${variable} should be at least 32 characters for security`);
      }
    }
    
    // Additional security checks
    if (process.env.NODE_ENV === 'production') {
      this.validateProductionSecurity(result);
    }
    
    return result;
  }
  
  /**
   * Additional security checks for production environment
   */
  private static validateProductionSecurity(result: EnvironmentValidationResult) {
    // Check for development values in production
    const dangerousValues = ['localhost', 'development', 'test', 'debug'];
    
    for (const [key, value] of Object.entries(process.env)) {
      if (value && dangerousValues.some(dangerous => 
        value.toLowerCase().includes(dangerous))) {
        result.warnings.push(`${key} contains development value in production: ${value}`);
      }
    }
    
    // Check for secure HTTPS URLs
    const urlVariables = ['DATABASE_URL'];
    for (const variable of urlVariables) {
      const value = process.env[variable];
      if (value && !value.startsWith('postgres://') && !value.startsWith('postgresql://')) {
        result.warnings.push(`${variable} should use secure connection string`);
      }
    }
  }
  
  /**
   * Log environment validation results
   */
  static logValidationResults(result: EnvironmentValidationResult) {
    if (result.critical.length > 0) {
      logger.error('❌ Critical environment configuration errors:', `${result.critical.join(', ')} (${result.critical.length + result.warnings.length} total issues)`);
    }
    
    if (result.warnings.length > 0) {
      logger.warn('⚠️ Environment configuration warnings:', `${result.warnings.join(', ')} (${result.warnings.length} warnings)`);
    }
    
    if (result.isValid && result.warnings.length === 0) {
      logger.info('✅ Environment configuration validation passed');
    }
    
    return result;
  }
  
  /**
   * Get sanitized environment summary for logging
   */
  static getEnvironmentSummary() {
    const summary = {
      nodeEnv: process.env.NODE_ENV || 'development',
      hasDatabase: !!process.env.DATABASE_URL,
      hasFredApi: !!process.env.FRED_API_KEY,
      hasTwelveDataApi: !!process.env.TWELVE_DATA_API_KEY,
      hasOpenAI: !!process.env.OPENAI_API_KEY,
      hasSendGrid: !!process.env.SENDGRID_API_KEY,
      hasJwtSecret: !!process.env.JWT_SECRET,
      hasRedis: !!process.env.REDIS_URL
    };
    
    return summary;
  }
}

// Export convenience functions for backward compatibility
export const environmentValidator = {
  validateEnvironment: EnvironmentValidator.validateEnvironment,
  logValidationResults: EnvironmentValidator.logValidationResults,
  getEnvironmentSummary: EnvironmentValidator.getEnvironmentSummary
};