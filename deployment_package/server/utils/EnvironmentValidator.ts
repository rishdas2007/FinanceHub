import { logger } from './logger';

interface EnvironmentConfig {
  DATABASE_URL: string;
  OPENAI_API_KEY: string;
  TWELVE_DATA_API_KEY: string;
  NODE_ENV: string;
  PORT?: string;
}

export class EnvironmentValidator {
  private static requiredKeys: (keyof EnvironmentConfig)[] = [
    'DATABASE_URL',
    'OPENAI_API_KEY', 
    'TWELVE_DATA_API_KEY',
    'NODE_ENV'
  ];

  static validate(): EnvironmentConfig {
    const errors: string[] = [];
    const config: Partial<EnvironmentConfig> = {};

    // Check required environment variables
    for (const key of this.requiredKeys) {
      const value = process.env[key];
      if (!value || value.trim() === '') {
        errors.push(`${key} is required but not set`);
      } else {
        config[key] = value;
      }
    }

    // Validate specific formats
    if (config.DATABASE_URL && !this.isValidDatabaseUrl(config.DATABASE_URL)) {
      errors.push('DATABASE_URL format is invalid');
    }

    if (config.OPENAI_API_KEY && !this.isValidOpenAIKey(config.OPENAI_API_KEY)) {
      errors.push('OPENAI_API_KEY format is invalid');
    }

    if (config.NODE_ENV && !['development', 'production', 'test'].includes(config.NODE_ENV)) {
      errors.push('NODE_ENV must be one of: development, production, test');
    }

    // Optional variables with defaults
    config.PORT = process.env.PORT || '5000';

    if (errors.length > 0) {
      logger.error('Environment validation failed', { errors });
      throw new Error(`Environment validation failed:\n${errors.join('\n')}`);
    }

    logger.info('Environment validation passed', {
      NODE_ENV: config.NODE_ENV,
      PORT: config.PORT,
      hasDatabase: !!config.DATABASE_URL,
      hasOpenAI: !!config.OPENAI_API_KEY,
      hasTwelveData: !!config.TWELVE_DATA_API_KEY
    });

    return config as EnvironmentConfig;
  }

  private static isValidDatabaseUrl(url: string): boolean {
    try {
      const parsed = new URL(url);
      return parsed.protocol === 'postgres:' || parsed.protocol === 'postgresql:';
    } catch {
      return false;
    }
  }

  private static isValidOpenAIKey(key: string): boolean {
    return key.startsWith('sk-') && key.length > 20;
  }

  static getConfig(): EnvironmentConfig {
    return {
      DATABASE_URL: process.env.DATABASE_URL!,
      OPENAI_API_KEY: process.env.OPENAI_API_KEY!,
      TWELVE_DATA_API_KEY: process.env.TWELVE_DATA_API_KEY!,
      NODE_ENV: process.env.NODE_ENV!,
      PORT: process.env.PORT || '5000'
    };
  }
}