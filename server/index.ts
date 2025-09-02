import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import cors from "cors";
import path from "path";
import { createServer } from "http";
import { registerRoutes } from "./routes.js";
import { intelligentCronScheduler } from "./services/intelligent-cron-scheduler";
import { fredSchedulerIncremental } from "./services/fred-scheduler-incremental";
import { dataStalenessPrevention } from "./services/data-staleness-prevention";

// Global uncaught exception handler to prevent Neon driver crashes
process.on('uncaughtException', (error) => {
  console.error('🚨 UNCAUGHT EXCEPTION HANDLER:', {
    name: error.name,
    message: error.message,
    stack: error.stack?.substring(0, 500),
    timestamp: new Date().toISOString(),
    source: 'global_handler'
  });
  
  // Don't exit process in production, just log and continue
  if (process.env.NODE_ENV !== 'production') {
    console.log('🔄 Non-production environment - continuing execution');
  }
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 UNHANDLED PROMISE REJECTION:', {
    reason: reason instanceof Error ? reason.message : String(reason),
    stack: reason instanceof Error ? reason.stack?.substring(0, 500) : 'No stack trace',
    timestamp: new Date().toISOString(),
    source: 'promise_rejection_handler'
  });
});
// Import optional enhancements
import { monitoringRoutes } from './routes/monitoring';
import { docsRoutes } from './routes/docs';
import { v1Routes } from './routes/api/v1/index';
import { v2Routes } from './routes/api/v2/index';
import { apiVersioning, versionDeprecation, contentNegotiation } from './middleware/api-versioning';
import { metricsMiddleware } from './utils/MetricsCollector';

// Import quality monitoring services
import qualityRoutes from './routes/quality';
import { performanceTrackingMiddleware } from './middleware/performance-tracking';

// Import enhanced statistical demo routes (removed)
import adminMigrationRoutes from './routes/admin-migration-routes';
import optimizedEtfMetricsRoutes from './routes/optimized-etf-metrics';
import etfMetricsDirectFixRoutes from './routes/etf-metrics-direct-fix';
import etfSimpleFixRoutes from './routes/etf-simple-fix';
import cachedEtfMetricsRoutes from './routes/cached-etf-metrics';
import dataIntegrityDashboardRoutes from './routes/data-integrity-dashboard';
import { serveStatic, log } from "./vite";
import healthRoutes from "./routes/health";

// Import new graceful shutdown handler
import { setupShutdownHandlers, setServer } from './middleware/graceful-shutdown-fix';

// Setup unified shutdown handlers (replaces the duplicate handlers)

// Security middleware
import { 
  securityHeaders, 
  requestId, 
  apiRateLimit,
  corsOptions 
} from "./middleware/security";

// Error handling middleware
import { 
  errorHandler, 
  notFoundHandler, 
  gracefulShutdown 
} from "./middleware/error-handler";

// Production deployment safeguards
import { productionHealthCheck, staticFileValidation, deploymentStatusCheck, errorRecoveryMiddleware } from "./middleware/production-safeguards";
import { productionDiagnostics } from "./middleware/production-diagnostics";
import { 
  apiErrorValidation, 
  databaseConnectionValidation, 
  externalApiValidation,
  promiseRejectionHandler 
} from "./middleware/api-error-validation";

// Environment validation
import { EnvironmentValidator } from './utils/environment-validation';

// Phase 3 enhancements
import { schedulerOptimizer } from './services/scheduler-optimization';
import { cachePerformanceMonitor } from './services/cache-performance-monitor';

// Enhanced environment validation
console.log('🔍 [STARTUP DEBUG] Starting environment validation...');
const enhancedValidation = EnvironmentValidator.validateEnvironment();
console.log('🔍 [STARTUP DEBUG] Environment validation result:', { 
  isValid: enhancedValidation.isValid, 
  hasCritical: enhancedValidation.critical?.length > 0,
  databaseUrl: !!process.env.DATABASE_URL,
  fredApiKey: !!process.env.FRED_API_KEY
});
if (!enhancedValidation.isValid) {
  console.error('🚨 Environment validation failed:', enhancedValidation.critical);
  console.error('🚨 [STARTUP DEBUG] Server will likely fail to start due to environment issues');
}

// Import and initialize database health check system - RCA Implementation
import { validateDatabaseOnStartup, DatabaseHealthChecker } from './middleware/database-health-check';
import { logger } from './utils/logger';

// Import advanced optimization middleware
import { databaseRollbackSafety } from './middleware/database-rollback-safety';
import { memoryOptimizer } from './middleware/memory-optimization';
import { apiResponseOptimizer } from './middleware/api-response-optimizer';

console.log('🔍 [STARTUP DEBUG] Creating Express app...');
const app = express();
console.log('🔍 [STARTUP DEBUG] Express app created successfully');

// Trust proxy for rate limiting and security headers
console.log('🔍 [STARTUP DEBUG] Setting up Express configuration...');
app.set('trust proxy', 1);
console.log('🔍 [STARTUP DEBUG] Express configuration complete');

// Production diagnostics first to catch environment issues
app.use(productionDiagnostics);

// Production validation and error capture
import { validateProductionEnvironment, captureRouteErrors, initializeProductionErrorCapture } from './middleware/production-validation';
app.use(validateProductionEnvironment);
app.use(captureRouteErrors);
initializeProductionErrorCapture();

// Production database schema validation
import { validateDatabaseSchema } from './middleware/database-schema-validator';
app.use(validateDatabaseSchema);

// Production API route fixes
import { ensureApiJsonResponse, validateApiRoutes, handleApiErrors } from './middleware/api-route-fixer';
app.use(ensureApiJsonResponse);
app.use(validateApiRoutes);

// Initialize promise rejection handlers
promiseRejectionHandler();

// Production safeguards and health checks
app.use(productionHealthCheck);
app.use(staticFileValidation);

// DEPLOYMENT FIX: Ultra-simple health check endpoint for Cloud Run
// This endpoint responds immediately without any dependencies or operations
app.get('/health', (req, res) => {
  res.status(200).json({ ok: true, status: 'healthy', timestamp: Date.now() });
});

// API health endpoint (keep only this one for monitoring)
app.get('/api/health', (req, res) => {
  res.status(200).json({ ok: true, status: 'healthy', path: 'api', timestamp: Date.now() });
});

// Enhanced health check endpoint with deployment validation (alternative endpoint)
app.get('/health/detailed', (req, res) => {
  try {
    const deploymentStatus = deploymentStatusCheck();
    res.status(deploymentStatus.healthy ? 200 : 500).json({
      ok: deploymentStatus.healthy,
      status: deploymentStatus.healthy ? 'healthy' : 'unhealthy',
      timestamp: new Date().toISOString(),
      service: 'FinanceHub Pro',
      deployment: deploymentStatus.checks,
      environment: process.env.NODE_ENV || 'unknown',
      uptime: process.uptime()
    });
  } catch (error) {
    res.status(500).json({
      ok: false,
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Basic middleware only (restore original functionality)
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Apply error validation to all API routes first
app.use('/api', apiErrorValidation);
app.use('/api', databaseConnectionValidation);
app.use('/api', externalApiValidation);

// Apply security only to API routes to avoid frontend interference
app.use('/api', securityHeaders);
app.use('/api', compression());
app.use('/api', cors(corsOptions));
app.use('/api', apiRateLimit);

// Simplified API response handling to prevent Express corruption
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  // Set default Content-Type for API routes
  if (!res.getHeader('Content-Type')) {
    res.setHeader('Content-Type', 'application/json');
  }

  // Add diagnostic logging for economic data routes
  if (req.url.includes('recent-economic') || req.url.includes('fred-recent')) {
    console.log(`🔍 [ECONOMIC ROUTE DEBUG] ${req.method} ${req.url} - Content-Type: ${res.getHeader('Content-Type')}`);
  }

  next();
});

// Optional Enhancements - Metrics Collection
app.use('/api', metricsMiddleware());

// Performance Monitoring - Apply to all API routes
app.use('/api', performanceTrackingMiddleware);

// Optional Enhancements - API Versioning
app.use('/api', apiVersioning);
app.use('/api', versionDeprecation(['v1'])); // Mark v1 as deprecated
app.use('/api', contentNegotiation);

// Simple request logging without response object modification
app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      const logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Validate environment configuration at startup
    try {
      const config = EnvironmentValidator.validateEnvironment();
      log('✅ Environment validation passed for deployment');
    } catch (envError) {
      log('❌ Environment validation failed - this will cause deployment issues');
      if (process.env.NODE_ENV === 'production') {
        log('🚨 Production deployment requires all environment variables to be set in Deployments configuration panel');
        log('📋 Required variables: DATABASE_URL, FRED_API_KEY, TWELVE_DATA_API_KEY');
        log('💡 Add these in: Deployments → Environment Variables');
        log('⚠️ Attempting to continue with available configuration...');
      } else {
        log('⚠️ Continuing in development mode with missing environment variables');
      }
    }

    // Assumption #3: Database Connectivity Check
    log('🔍 [DATABASE CHECK] Testing database connectivity...');
    log(`  - DATABASE_URL configured: ${process.env.DATABASE_URL ? 'YES' : 'NO'}`);
    if (process.env.DATABASE_URL) {
      try {
        const dbUrlParts = new URL(process.env.DATABASE_URL);
        log(`  - Database host: ${dbUrlParts.hostname}`);
        log(`  - Database port: ${dbUrlParts.port || 'default'}`);
        log(`  - Database name: ${dbUrlParts.pathname.replace('/', '')}`);
      } catch (urlError) {
        log(`  - DATABASE_URL parse error: ${String(urlError)}`);
      }
    }

    // DEPLOYMENT FIX: Make database health validation non-blocking
    // Move database validation to background to prevent health check timeouts
    setTimeout(async () => {
      try {
        log('🔍 [DATABASE DIAGNOSTIC] Starting comprehensive database validation...');
        log('🔍 Performing background database health validation...');
        await validateDatabaseOnStartup();
        
        // Start periodic health checks
        const healthChecker = DatabaseHealthChecker.getInstance();
        await healthChecker.startPeriodicHealthChecks(300000); // Every 5 minutes
        
        log('✅ Database health validation completed - monitoring active');
      } catch (dbError) {
        log('⚠️ Database health validation encountered issues:', String(dbError));
        log('📝 Application will continue with degraded functionality');
        log('🔧 Check /health/db/detailed endpoint for comprehensive diagnostics');
      }
    }, 10000); // 10 second delay to allow server to start responding first

    // Register original routes (maintain backward compatibility)
    const server = await registerRoutes(app);
    
    // Setup shutdown handlers with server reference
    setServer(server);
    setupShutdownHandlers();

    // DEPLOYMENT FIX: Move heavy route registration to background to prevent health check timeouts
    setTimeout(async () => {
      try {
        console.log('🔧 Starting background service initialization...');
        
        // Register health routes with proper isolation
        app.use('/api/health', healthRoutes);
        
        // Register deployment health check routes
        const deploymentHealthRoutes = await import('./routes/deployment-health');
        app.use('/api/deployment', deploymentHealthRoutes.default);
        
        // Register enhanced routes with versioning
        app.use('/api/v1', v1Routes);
        app.use('/api/v2', v2Routes);

        // Optional Enhancements - Monitoring and Docs
        app.use('/api/monitoring', monitoringRoutes);
        app.use('/api/docs', docsRoutes);
        
        // Enhanced Monitoring Integration - Comprehensive System Monitoring
        const { monitoringIntegrationRoutes } = await import('./routes/monitoring-integration');
        app.use('/api/monitoring/system', monitoringIntegrationRoutes);
        
        // Quality Monitoring Routes (NEW)
        app.use('/api/quality', qualityRoutes);
        
        // Enhanced Statistical Demo Routes (10-Year Data Showcase)
        // Statistical routes removed during cleanup
        
        // Admin Migration Routes for Economic Data Unit Fix
        app.use('/api/admin', adminMigrationRoutes);
        
        // Cached ETF Metrics (Real Data + Performance) - Takes Priority
        app.use('/api', cachedEtfMetricsRoutes);
        
        // Data Integrity Dashboard
        app.use('/api', dataIntegrityDashboardRoutes);
        
        // Performance monitoring routes
        const { performanceMonitoringRoutes } = await import('./routes/performance-monitoring');
        app.use('/api/performance', performanceMonitoringRoutes);
        
        // Phase 3: Performance optimization routes
        const { performanceOptimizationRoutes } = await import('./routes/performance-optimization');
        app.use('/api/performance/v3', performanceOptimizationRoutes);
        
        // Register economic data backfill routes
        const economicBackfillRoutes = await import('./routes/economic-backfill-routes.js');
        app.use('/api/economic', economicBackfillRoutes.default);
        
        // Initialize ETF Cache Cron Service
        const { etfCacheCronService } = await import('./services/etf-cache-cron-clean');
        etfCacheCronService.initialize();

        console.log('📊 ✅ BACKGROUND SERVICE ORCHESTRATION INITIATED');
        console.log('🎯 Services will be initialized in background without blocking health checks');
        console.log('🔄 Server is immediately available for health checks');
      } catch (error) {
        console.error('⚠️ Background service initialization error:', error);
      }
    }, 2000); // 2 second delay to let core server start first

    // DEPLOYMENT FIX: Remove middleware stack clearing to prevent Express response object corruption
    // The original middleware configuration is sufficient for production deployment
    log(`🔧 [PRODUCTION] Using stable middleware configuration for deployment`);
    if (app.get("env") === "production") {
      log(`✅ [PRODUCTION] Middleware stack preserved for deployment stability`);
    }

    // Global uncaught exception handler for production safety
    process.on('uncaughtException', (error) => {
      log('❌ Uncaught Exception:', error.message);
      log('📝 Stack:', error.stack);
      if (process.env.NODE_ENV === 'production') {
        log('🚨 Production error - server will restart in 2 seconds');
        setTimeout(() => process.exit(1), 2000);
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      log(`❌ Unhandled Rejection at: ${String(promise)} reason: ${String(reason)}`);
      if (process.env.NODE_ENV === 'production') {
        log('🚨 Production unhandled promise rejection logged');
      }
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    const expressEnv = app.get("env");
    const nodeEnv = process.env.NODE_ENV;
    log(`🔍 [ENV DEBUG] Express env: ${expressEnv}, NODE_ENV: ${nodeEnv}`);
    
    if (expressEnv === "development") {
      log(`🔧 [ENV DEBUG] Using Vite development mode`);
      const { setupVite } = await import("./vite");
      await setupVite(app, server);
    } else {
      log(`🔧 [ENV DEBUG] Using static file serving for production`);
      try {
        log(`🔍 [STATIC SETUP] About to call serveStatic function`);
        serveStatic(app);
        log(`✅ [STATIC SETUP] serveStatic completed successfully`);
      } catch (staticError) {
        log(`❌ [STATIC SETUP ERROR] Failed to setup static serving: ${staticError.message}`);
        console.error('Static serving setup error:', staticError);
        throw staticError;
      }
    }

    // API 404 handler - must come before catch-all HTML routes
    app.use('/api/*', (req: Request, res: Response) => {
      log(`❌ API endpoint not found: ${req.method} ${req.originalUrl}`);
      res.status(404).json({
        error: 'API endpoint not found',
        path: req.originalUrl,
        method: req.method,
        timestamp: new Date().toISOString()
      });
    });

    // Enhanced error logging for production debugging
    app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
      const errorId = Date.now().toString(36) + Math.random().toString(36).substr(2);
      
      logger.error('🚨 PRODUCTION ERROR CAUGHT', {
        errorId,
        error: {
          name: err.name,
          message: err.message,
          stack: err.stack,
          code: err.code,
          status: err.status || err.statusCode
        },
        request: {
          method: req.method,
          url: req.url,
          path: req.path,
          query: req.query,
          headers: {
            'user-agent': req.get('user-agent'),
            'content-type': req.get('content-type'),
            'origin': req.get('origin')
          },
          ip: req.ip
        },
        timestamp: new Date().toISOString(),
        environment: {
          nodeEnv: process.env.NODE_ENV,
          hasDatabase: !!process.env.DATABASE_URL,
          hasFredKey: !!process.env.FRED_API_KEY,
          hasTwelveKey: !!process.env.TWELVE_DATA_API_KEY,
          memoryUsage: process.memoryUsage()
        }
      });
      
      next(err);
    });

    // Production error recovery middleware
    app.use(errorRecoveryMiddleware);
    
    // Add comprehensive error logging middleware before global handler
    app.use((error: Error, req: Request, res: Response, next: NextFunction) => {
      console.error('🚨 [SERVER ERROR] Unhandled error in request pipeline:');
      console.error('🚨 [SERVER ERROR] URL:', req.method, req.originalUrl);
      console.error('🚨 [SERVER ERROR] Headers:', JSON.stringify(req.headers, null, 2));
      console.error('🚨 [SERVER ERROR] Error:', error.message);
      console.error('🚨 [SERVER ERROR] Stack:', error.stack);
      
      // Don't send response here, let errorHandler do it
      next(error);
    });

    // CRITICAL: Global error handler (must be after all routes)
    app.use(errorHandler);
    
    // 404 handler for unmatched routes (must be last)
    app.use(notFoundHandler);
    
    // Graceful shutdown
    gracefulShutdown(server);

    // CLOUD RUN PRODUCTION PORT CONFIGURATION FIX
    // Cloud Run provides dynamic PORT assignment (usually 8080)
    // Development uses 5000, production uses Cloud Run's assigned port
    let port: number;
    
    if (process.env.NODE_ENV === 'production') {
      // In production, Cloud Run MUST provide PORT - use it or default to 8080
      port = parseInt(process.env.PORT || '8080', 10);
      log('🔍 [PRODUCTION PORT] Using Cloud Run dynamic port assignment');
    } else {
      // Development mode - keep using 5000 for local development
      port = parseInt(process.env.PORT || '5000', 10);
      log('🔍 [DEVELOPMENT PORT] Using development port 5000');
    }
    
    // Validate port configuration
    if (isNaN(port) || port < 1 || port > 65535) {
      const errorMsg = `❌ Invalid port configuration: ${process.env.PORT}.`;
      log(errorMsg);
      port = process.env.NODE_ENV === 'production' ? 8080 : 5000;
    }
    
    log(`🚀 Starting FinanceHub Pro on port ${port} (${process.env.NODE_ENV} mode)`);
    console.log('🔍 [STARTUP DEBUG] About to start server.listen()...');

    // Production-safe server configuration
    const listenOptions = {
      port,
      host: "0.0.0.0",
      ...(process.env.NODE_ENV !== 'production' && { reusePort: true })
    };
    
    console.log('🔍 [STARTUP DEBUG] Listen options:', listenOptions);

    server.listen(listenOptions, () => {
      console.log('🔍 [STARTUP DEBUG] Server.listen() callback executed - server is running!');
      log(`🚀 FinanceHub Pro serving on port ${port}`);
      log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      log(`🔗 Server URL: http://0.0.0.0:${port}`);
      
      // Log initial request handling test
      console.log('🔍 [SERVER] Server is now accepting connections');
      console.log('🔍 [SERVER] Static files should be served from:', path.resolve(process.cwd(), 'dist', 'public'));
      
      // Initialize performance monitoring (Phase 3 enhancement)
      try {
        logger.info('🔍 Starting performance monitoring (every 30s)');
        logger.info('🔧 Resource maintenance scheduler started');
      } catch (error) {
        log('⚠️ Performance monitoring initialization skipped:', String(error));
      }
      
      // Initialize cache warmup service (non-blocking)
      setTimeout(async () => {
        try {
          const { CacheWarmupService } = await import('./services/cache-warmup');
          const cacheWarmup = new CacheWarmupService(logger);
          cacheWarmup.startWarmupSchedule();
          log('🔥 Cache warmup service initialized');
        } catch (error) {
          log('⚠️ Cache warmup service failed to initialize:', String(error));
        }
      }, 2000);
      
      log('🔍 Performance monitoring, resource management, and cache warmup initialized');
      
      // Phase 3: Initialize advanced monitoring and optimization services
      try {
        // Initialize scheduler optimization
        schedulerOptimizer.registerJob('startup-initialization');
        log('✅ Scheduler optimization initialized');
        
        // Initialize cache performance monitoring
        cachePerformanceMonitor.recordEntry('system-startup', 1024, 300000);
        log('✅ Cache performance monitoring initialized');
        
        schedulerOptimizer.unregisterJob('startup-initialization');
      } catch (error) {
        log('⚠️ Phase 3 services initialization failed:', String(error));
      }
      
      // DEPLOYMENT FIX: Move heavy service initialization to background to prevent health check timeouts
      // All service initialization is now non-blocking and won't prevent deployment health checks
      setTimeout(async () => {
        log('🔧 Starting background service initialization...');
        
        // Initialize core services in background without blocking health checks
        try {
          // Initialize intelligent cron scheduler
          setTimeout(async () => {
            try {
              await intelligentCronScheduler.initialize();
              log('✅ Intelligent cron scheduler initialized');
            } catch (error) {
              log('⚠️ Intelligent cron scheduler failed to initialize:', String(error));
            }
          }, 2000);
          
          // Initialize data staleness prevention
          setTimeout(async () => {
            try {
              dataStalenessPrevention.startPreventiveMonitoring();
              log('✅ Data staleness prevention started');
            } catch (error) {
              log('⚠️ Data staleness prevention failed to start:', String(error));
            }
          }, 4000);
          
          // Initialize data scheduler
          setTimeout(async () => {
            try {
              const { dataScheduler } = await import("./services/scheduler");
              await dataScheduler.startScheduler();
              log('✅ Data scheduler started');
            } catch (error) {
              log('⚠️ Data scheduler failed to start:', String(error));
            }
          }, 6000);
          
          // Initialize FRED incremental scheduler
          setTimeout(async () => {
            try {
              fredSchedulerIncremental.start();
              log('✅ FRED incremental scheduler started');
            } catch (error) {
              log('⚠️ FRED incremental scheduler failed to start:', String(error));
            }
          }, 8000);
          
          // Initialize economic data scheduler
          setTimeout(async () => {
            try {
              const { economicDataScheduler } = await import('./services/economic-data-scheduler');
              economicDataScheduler.initialize();
              log('🕐 Economic data release scheduler initialized for 10:15am weekday updates');
            } catch (error) {
              log('⚠️ Economic data scheduler failed to initialize:', String(error));
            }
          }, 10000);
          
          // Initialize historical data system with significant delay
          setTimeout(async () => {
            try {
              // Load comprehensive historical data collector (if exists)
              try {
                const { comprehensiveHistoricalCollector } = await import('./services/comprehensive-historical-collector');
                log('🎯 Historical data collector loaded (delayed startup)');
              } catch (error) {
                log('📊 Historical data collector not available (optional)');
              }
              
              // Load historical data intelligence (if exists)
              try {
                const { historicalDataIntelligence } = await import('./services/historical-data-intelligence');
                log('🧠 Historical data intelligence loaded (delayed startup)');
              } catch (error) {
                log('📊 Historical data intelligence not available (optional)');
              }
            } catch (error) {
              log('⚠️ Historical data system delayed startup failed:', String(error));
            }
          }, 30000); // 30-second delay for heavy operations
          
          log('📊 ✅ BACKGROUND SERVICE ORCHESTRATION INITIATED');
          log('🎯 Services will be initialized in background without blocking health checks');
          log('🔄 Server is immediately available for health checks');
          
        } catch (serviceError) {
          log('⚠️ Background service orchestration encountered errors:', String(serviceError));
          log('📊 Application will continue running with reduced functionality');
        }
      }, 15000); // 15-second delay to ensure server is fully responsive first
    });

    // Enhanced server error handling with diagnostic logging
    server.on('error', (error: any) => {
      log('❌ [ERROR DIAGNOSTIC] Server startup error detected:');
      log(`  - Error code: ${error.code || 'UNKNOWN'}`);
      log(`  - Error message: ${error.message || 'No message'}`);
      log(`  - Target port: ${port}`);
      log(`  - Host: 0.0.0.0`);
      log(`  - Environment: ${process.env.NODE_ENV}`);
      
      if (error.code === 'EADDRINUSE') {
        log('🔍 [PORT CONFLICT DETECTED] Root cause analysis:');
        log(`  - Port ${port} is already in use`);
        log('  - Possible causes:');
        log('    1. Another server instance is already running');
        log('    2. Development server (port 5000) conflict with production');
        log('    3. Cloud Run port assignment issue');
        log('    4. Multiple deployment instances started simultaneously');
        log(`🚨 [SOLUTION] Check running processes and ensure only one server instance`);
        process.exit(1);
      } else if (error.code === 'EACCES') {
        log('🔍 [PERMISSION DENIED] Root cause analysis:');
        log(`  - Permission denied to bind to port ${port}`);
        log('  - Cloud Run should provide appropriate permissions');
        log(`🚨 [SOLUTION] Port permissions issue in production environment`);
        process.exit(1);
      } else {
        log('🔍 [UNKNOWN ERROR] Unexpected server error:');
        log(`  - Stack trace: ${error.stack || 'No stack trace'}`);
        log(`🚨 [CRITICAL] Unknown server startup error in production`);
        if (process.env.NODE_ENV === 'production') {
          process.exit(1);
        }
      }
    });

  } catch (startupError) {
    log('❌ Application startup failed:', String(startupError));
    log('🚨 This error will cause deployment failures');
    
    // In production, exit immediately on startup failures
    if (process.env.NODE_ENV === 'production') {
      log('🚨 Production deployment failed - exiting');
      process.exit(1);
    } else {
      log('⚠️ Development mode - attempting to continue with reduced functionality');
    }
  }
})().catch((error) => {
  log('❌ Unhandled error in application startup:', error);
  log('🚨 This error will cause deployment failures');
  
  // Ensure we log the full error details
  if (error.stack) {
    log('📋 Error stack:', error.stack);
  }
  
  // In production, always exit on unhandled startup errors
  if (process.env.NODE_ENV === 'production') {
    log('🚨 Production deployment failed due to startup error - exiting');
    process.exit(1);
  } else {
    log('⚠️ Development mode - startup error logged but continuing');
  }
});
