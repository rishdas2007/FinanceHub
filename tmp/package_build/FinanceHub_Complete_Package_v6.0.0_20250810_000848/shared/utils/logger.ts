/**
 * Production-ready logging utility
 * Replaces scattered console.log statements with proper logging levels
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: string;
  data?: any;
}

class Logger {
  private isDevelopment = process.env.NODE_ENV === 'development';
  
  private log(level: LogLevel, message: string, context?: string, data?: any) {
    if (!this.isDevelopment && level === 'debug') {
      return; // Skip debug logs in production
    }
    
    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      context,
      data
    };
    
    // Use appropriate console method
    const consoleMethods = {
      debug: console.debug,
      info: console.info,
      warn: console.warn,
      error: console.error
    };
    
    if (this.isDevelopment) {
      // Pretty print in development
      const prefix = `[${level.toUpperCase()}]`;
      const contextStr = context ? ` [${context}]` : '';
      consoleMethods[level](`${prefix}${contextStr} ${message}`, data || '');
    } else {
      // Structured logging for production
      consoleMethods[level](JSON.stringify(entry));
    }
  }
  
  debug(message: string, context?: string, data?: any) {
    this.log('debug', message, context, data);
  }
  
  info(message: string, context?: string, data?: any) {
    this.log('info', message, context, data);
  }
  
  warn(message: string, context?: string, data?: any) {
    this.log('warn', message, context, data);
  }
  
  error(message: string, context?: string, data?: any) {
    this.log('error', message, context, data);
  }
  
  // API specific helpers
  apiRequest(method: string, path: string, duration?: number) {
    this.info(`${method} ${path}${duration ? ` (${duration}ms)` : ''}`, 'API');
  }
  
  apiError(method: string, path: string, error: string) {
    this.error(`${method} ${path} failed: ${error}`, 'API');
  }
  
  // Service specific helpers
  serviceInfo(service: string, message: string, data?: any) {
    this.info(message, service, data);
  }
  
  serviceError(service: string, message: string, error?: any) {
    this.error(message, service, error);
  }
}

export const logger = new Logger();

// Legacy console replacement helpers for gradual migration
export const logInfo = (message: string, data?: any) => logger.info(message, undefined, data);
export const logError = (message: string, error?: any) => logger.error(message, undefined, error);
export const logDebug = (message: string, data?: any) => logger.debug(message, undefined, data);
export const logWarn = (message: string, data?: any) => logger.warn(message, undefined, data);