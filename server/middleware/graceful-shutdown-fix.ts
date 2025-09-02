import { Server } from 'http';
import { unifiedLogger as logger } from '../utils/unified-logger';
import { closeDatabase } from '../db';

/**
 * Fixed Graceful Shutdown Handler
 * Prevents cascading failures and race conditions
 */

let isShuttingDown = false;
let server: Server | null = null;

export function setServer(httpServer: Server) {
  server = httpServer;
}

export async function gracefulShutdown(signal: string) {
  if (isShuttingDown) {
    logger.info('🔄 Shutdown already in progress, ignoring duplicate signal');
    return;
  }

  isShuttingDown = true;
  logger.info(`📴 Received ${signal}, starting graceful shutdown...`);

  const shutdownTimeout = setTimeout(() => {
    logger.error('⏱️ Graceful shutdown timeout (30s), forcing exit');
    process.exit(1);
  }, 30000); // 30 second timeout

  try {
    // Step 1: Stop accepting new connections
    if (server) {
      logger.info('🚫 Stopping new connections...');
      await new Promise<void>((resolve) => {
        server!.close(() => {
          logger.info('✅ Server closed to new connections');
          resolve();
        });
      });
    }

    // Step 2: Close database connections
    logger.info('🗄️ Closing database connections...');
    await closeDatabase().catch(err => {
      logger.error('❌ Error closing database:', err);
    });

    // Step 3: Flush logger
    logger.info('📝 Flushing logs...');
    await logger.flush().catch(err => {
      logger.error('❌ Error flushing logs:', err);
    });

    // Step 4: Clean exit
    clearTimeout(shutdownTimeout);
    logger.info('👋 Graceful shutdown complete');
    process.exit(0);

  } catch (error) {
    logger.error('💥 Error during graceful shutdown:', error);
    clearTimeout(shutdownTimeout);
    process.exit(1);
  }
}

// Single unified handler for all shutdown signals
export function setupShutdownHandlers() {
  // Remove all existing handlers first
  process.removeAllListeners('SIGTERM');
  process.removeAllListeners('SIGINT');
  process.removeAllListeners('uncaughtException');
  process.removeAllListeners('unhandledRejection');

  // Handle termination signals
  process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  process.on('SIGINT', () => gracefulShutdown('SIGINT'));

  // Handle uncaught exceptions
  process.on('uncaughtException', (error: Error) => {
    logger.error('🚨 UNCAUGHT EXCEPTION:', {
      name: error.name,
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    if (process.env.NODE_ENV === 'production') {
      gracefulShutdown('uncaughtException');
    } else {
      process.exit(1);
    }
  });

  // Handle unhandled promise rejections
  process.on('unhandledRejection', (reason: any, promise: Promise<any>) => {
    logger.error('🚨 UNHANDLED REJECTION:', {
      reason: reason?.message || String(reason),
      stack: reason?.stack,
      timestamp: new Date().toISOString()
    });

    // In production, log but don't exit
    if (process.env.NODE_ENV !== 'production') {
      process.exit(1);
    }
  });

  logger.info('✅ Shutdown handlers configured');
}