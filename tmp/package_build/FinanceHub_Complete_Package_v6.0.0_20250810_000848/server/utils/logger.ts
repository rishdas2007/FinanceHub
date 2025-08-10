// Enhanced logger with structured logging
export const logger = {
  info: (message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    const logData = { timestamp, level: 'INFO', message, ...(meta && { meta }) };
    console.log(JSON.stringify(logData));
  },
  warn: (message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    const logData = { timestamp, level: 'WARN', message, ...(meta && { meta }) };
    console.warn(JSON.stringify(logData));
  },
  error: (message: string, meta?: any) => {
    const timestamp = new Date().toISOString();
    const logData = { timestamp, level: 'ERROR', message, ...(meta && { meta }) };
    console.error(JSON.stringify(logData));
  },
  debug: (message: string, meta?: any) => {
    if (process.env.NODE_ENV === 'development') {
      const timestamp = new Date().toISOString();
      const logData = { timestamp, level: 'DEBUG', message, ...(meta && { meta }) };
      console.debug(JSON.stringify(logData));
    }
  }
};

// Backwards compatibility
export default logger;