/**
 * Production Environment Validation Service
 * Critical for deployment safety and security
 */

import { logger } from '@shared/utils/logger';

interface EnvironmentValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  summary: {
    critical: number;
    warnings: number;
    total: number;
  };
}

interface RequiredEnvVar {
  name: string;
  required: boolean;
  description: string;
  validator?: (value: string) => boolean;
}

export class EnvironmentValidator {
  private static instance: EnvironmentValidator;
  
  private readonly requiredVars: RequiredEnvVar[] = [
    {
      name: 'DATABASE_URL',
      required: true,
      description: 'PostgreSQL database connection string',
      validator: (value) => value.startsWith('postgresql://') || value.startsWith('postgres://')
    },
    {
      name: 'FRED_API_KEY',
      required: true,
      description: 'Federal Reserve Economic Data API key',
      validator: (value) => value.length >= 32
    },
    {
      name: 'TWELVE_DATA_API_KEY',
      required: true,
      description: 'Twelve Data financial API key',
      validator: (value) => value.length >= 32
    },
    {
      name: 'NODE_ENV',
      required: true,
      description: 'Node.js environment (development/production)',
      validator: (value) => ['development', 'production', 'test'].includes(value)
    },
    {
      name: 'PORT',
      required: false,
      description: 'Server port number',
      validator: (value) => {
        const port = parseInt(value);
        return !isNaN(port) && port > 0 && port <= 65535;
      }
    },
    {
      name: 'OPENAI_API_KEY',
      required: false,
      description: 'OpenAI API key for AI-powered features',
      validator: (value) => value.startsWith('sk-')
    },
    {
      name: 'SENDGRID_API_KEY',
      required: false,
      description: 'SendGrid API key for email notifications',
      validator: (value) => value.startsWith('SG.')
    },
    {
      name: 'REDIS_URL',
      required: false,
      description: 'Redis connection string for caching',
      validator: (value) => value.startsWith('redis://') || value.startsWith('rediss://')
    }
  ];

  static getInstance(): EnvironmentValidator {
    if (!EnvironmentValidator.instance) {
      EnvironmentValidator.instance = new EnvironmentValidator();
    }
    return EnvironmentValidator.instance;
  }

  /**
   * Comprehensive environment validation for production deployment
   */
  validateEnvironment(): EnvironmentValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];

    logger.info('Validating environment configuration', 'ENV_VALIDATION');

    // Check each required environment variable
    for (const envVar of this.requiredVars) {
      const value = process.env[envVar.name];
      
      if (!value) {
        if (envVar.required) {
          errors.push(`Missing required environment variable: ${envVar.name} (${envVar.description})`);
        } else {
          warnings.push(`Optional environment variable not set: ${envVar.name} (${envVar.description})`);
        }
        continue;
      }

      // Validate format if validator provided
      if (envVar.validator && !envVar.validator(value)) {
        if (envVar.required) {
          errors.push(`Invalid format for ${envVar.name}: ${envVar.description}`);
        } else {
          warnings.push(`Invalid format for ${envVar.name}: ${envVar.description}`);
        }
      }
    }

    // Additional security validations
    this.validateSecurity(errors, warnings);
    
    // Database connectivity validation
    this.validateDatabaseConnection(errors, warnings);

    const summary = {
      critical: errors.length,
      warnings: warnings.length,
      total: errors.length + warnings.length
    };

    const isValid = errors.length === 0;

    if (isValid) {
      logger.info('Environment validation successful', 'ENV_VALIDATION', summary);
    } else {
      logger.error('Environment validation failed', 'ENV_VALIDATION', { errors, warnings, summary });
    }

    return {
      isValid,
      errors,
      warnings,
      summary
    };
  }

  /**
   * Security-focused validation checks
   */
  private validateSecurity(errors: string[], warnings: string[]): void {
    // Check for production readiness
    if (process.env.NODE_ENV === 'production') {
      // Ensure no debug flags in production
      if (process.env.DEBUG) {
        warnings.push('DEBUG flag is set in production environment');
      }

      // Ensure secure headers are configured
      if (!process.env.SECURE_HEADERS_ENABLED) {
        warnings.push('Security headers not explicitly enabled');
      }

      // Check for proper CORS configuration
      if (!process.env.ALLOWED_ORIGINS) {
        warnings.push('CORS allowed origins not configured');
      }
    }

    // Validate API key strength
    const criticalKeys = ['FRED_API_KEY', 'TWELVE_DATA_API_KEY'];
    for (const key of criticalKeys) {
      const value = process.env[key];
      if (value && value.length < 32) {
        warnings.push(`${key} appears to be too short for a secure API key`);
      }
    }
  }

  /**
   * Database connection validation
   */
  private validateDatabaseConnection(errors: string[], warnings: string[]): void {
    const dbUrl = process.env.DATABASE_URL;
    if (!dbUrl) {
      errors.push('DATABASE_URL is required for application functionality');
      return;
    }

    try {
      const url = new URL(dbUrl);
      
      // Validate database URL structure
      if (!url.hostname) {
        errors.push('DATABASE_URL missing hostname');
      }
      
      if (!url.pathname || url.pathname === '/') {
        warnings.push('DATABASE_URL missing database name');
      }

      // Production-specific database validation
      if (process.env.NODE_ENV === 'production') {
        if (url.hostname === 'localhost' || url.hostname === '127.0.0.1') {
          warnings.push('Using localhost database in production environment');
        }

        if (!url.protocol.includes('ssl') && !url.searchParams.has('sslmode')) {
          warnings.push('SSL connection not configured for production database');
        }
      }

    } catch (error: any) {
      errors.push(`Invalid DATABASE_URL format: ${error.message}`);
    }
  }

  /**
   * Get environment configuration summary
   */
  getConfigurationSummary(): Record<string, any> {
    const summary: Record<string, any> = {
      nodeEnv: process.env.NODE_ENV || 'unknown',
      port: process.env.PORT || 5000,
      database: process.env.DATABASE_URL ? 'Configured' : 'Missing',
      fredApi: process.env.FRED_API_KEY ? 'Configured' : 'Missing',
      twelveDataApi: process.env.TWELVE_DATA_API_KEY ? 'Configured' : 'Missing',
      openaiApi: process.env.OPENAI_API_KEY ? 'Configured' : 'Missing',
      sendgridApi: process.env.SENDGRID_API_KEY ? 'Configured' : 'Missing',
      redis: process.env.REDIS_URL ? 'Configured' : 'Missing'
    };

    return summary;
  }

  /**
   * Validate specific API key is properly configured
   */
  validateApiKey(keyName: string): boolean {
    const value = process.env[keyName];
    if (!value) return false;

    const envVar = this.requiredVars.find(v => v.name === keyName);
    if (envVar?.validator) {
      return envVar.validator(value);
    }

    return value.length > 0;
  }

  /**
   * Get masked environment variables for logging (security safe)
   */
  getMaskedEnvironment(): Record<string, string> {
    const masked: Record<string, string> = {};
    
    for (const envVar of this.requiredVars) {
      const value = process.env[envVar.name];
      if (value) {
        // Mask sensitive values
        if (envVar.name.includes('KEY') || envVar.name.includes('URL')) {
          masked[envVar.name] = value.substring(0, 8) + '...';
        } else {
          masked[envVar.name] = value;
        }
      } else {
        masked[envVar.name] = 'Not Set';
      }
    }

    return masked;
  }
}

export const environmentValidator = EnvironmentValidator.getInstance();