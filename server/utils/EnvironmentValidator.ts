// Environment Validator - Ensures all required environment variables are properly configured
import { z } from 'zod';
import { log } from '../vite';

const environmentSchema = z.object({
  // Required API Keys
  FRED_API_KEY: z.string().min(1, 'FRED_API_KEY is required'),
  TWELVE_DATA_API_KEY: z.string().min(1, 'TWELVE_DATA_API_KEY is required'),
  OPENAI_API_KEY: z.string().min(1, 'OPENAI_API_KEY is required'),
  
  // Database
  DATABASE_URL: z.string().url('DATABASE_URL must be a valid URL'),
  
  // Optional API Keys
  SENDGRID_API_KEY: z.string().optional(),
  
  // Application Configuration
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().transform(val => parseInt(val, 10)).default('5000'),
  
  // Optional Configuration
  REDIS_URL: z.string().url().optional(),
  SESSION_SECRET: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  ENABLE_METRICS: z.string().transform(val => val === 'true').default('true'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info')
});

export type Environment = z.infer<typeof environmentSchema>;

export class EnvironmentValidator {
  private static instance: EnvironmentValidator;
  private config: Environment | null = null;

  private constructor() {}

  static getInstance(): EnvironmentValidator {
    if (!EnvironmentValidator.instance) {
      EnvironmentValidator.instance = new EnvironmentValidator();
    }
    return EnvironmentValidator.instance;
  }

  validate(): Environment {
    if (this.config) {
      return this.config;
    }

    log('🔍 Validating environment configuration...');

    try {
      this.config = environmentSchema.parse(process.env);
      log('✅ Environment validation successful');
      
      // Log configuration summary (without sensitive data)
      log(`📊 Configuration summary:`);
      log(`   • Node Environment: ${this.config.NODE_ENV}`);
      log(`   • Port: ${this.config.PORT}`);
      log(`   • Database: ${this.config.DATABASE_URL ? 'Configured' : 'Missing'}`);
      log(`   • FRED API: ${this.config.FRED_API_KEY ? 'Configured' : 'Missing'}`);
      log(`   • Twelve Data API: ${this.config.TWELVE_DATA_API_KEY ? 'Configured' : 'Missing'}`);
      log(`   • OpenAI API: ${this.config.OPENAI_API_KEY ? 'Configured' : 'Missing'}`);
      log(`   • SendGrid API: ${this.config.SENDGRID_API_KEY ? 'Configured' : 'Optional - Not configured'}`);
      
      return this.config;
      
    } catch (error) {
      if (error instanceof z.ZodError) {
        log('❌ Environment validation failed:');
        error.errors.forEach(err => {
          log(`   • ${err.path.join('.')}: ${err.message}`);
        });
        
        log('\n📋 Required environment variables:');
        log('   • FRED_API_KEY - Get from: https://fred.stlouisfed.org/docs/api/api_key.html');
        log('   • TWELVE_DATA_API_KEY - Get from: https://twelvedata.com/');
        log('   • OPENAI_API_KEY - Get from: https://platform.openai.com/api-keys');
        log('   • DATABASE_URL - PostgreSQL connection string');
        
        process.exit(1);
      }
      
      throw error;
    }
  }

  getConfig(): Environment {
    if (!this.config) {
      throw new Error('Environment not validated. Call validate() first.');
    }
    return this.config;
  }

  isConfigured(key: keyof Environment): boolean {
    const config = this.getConfig();
    return config[key] !== undefined && config[key] !== '';
  }
}