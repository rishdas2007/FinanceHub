/**
 * Unified Logger for Production
 * Resolves conflicts between custom logger and Pino
 * Prevents thread-stream blocking issues
 */

// Simple, non-blocking logger that doesn't use thread-stream
class UnifiedLogger {
  private queue: string[] = [];
  private flushing = false;

  private formatLog(level: string, message: string, meta?: any): string {
    const timestamp = new Date().toISOString();
    const logData = { 
      timestamp, 
      level, 
      message, 
      ...(meta && { meta }) 
    };
    return JSON.stringify(logData);
  }

  info(message: string, meta?: any) {
    const log = this.formatLog('INFO', message, meta);
    console.log(log);
  }

  warn(message: string, meta?: any) {
    const log = this.formatLog('WARN', message, meta);
    console.warn(log);
  }

  error(message: string, meta?: any) {
    const log = this.formatLog('ERROR', message, meta);
    console.error(log);
  }

  debug(message: string, meta?: any) {
    if (process.env.NODE_ENV === 'development' || process.env.DEBUG) {
      const log = this.formatLog('DEBUG', message, meta);
      console.debug(log);
    }
  }

  // Non-blocking flush for graceful shutdown
  async flush(): Promise<void> {
    return new Promise((resolve) => {
      // Immediate resolve - console.log is synchronous
      resolve();
    });
  }
}

export const unifiedLogger = new UnifiedLogger();

// Backward compatibility
export const logger = unifiedLogger;
export default unifiedLogger;