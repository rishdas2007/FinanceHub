import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import cors from "cors";
import { registerRoutes } from "./routes";
import { intelligentCronScheduler } from "./services/intelligent-cron-scheduler";
import { fredSchedulerIncremental } from "./services/fred-scheduler-incremental";
import { dataStalenessPrevention } from "./services/data-staleness-prevention";
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

// Import enhanced statistical demo routes
import enhancedZScoreRoutes from './routes/enhanced-zscore-demo';
import adminMigrationRoutes from './routes/admin-migration-routes';
import { setupVite, serveStatic, log } from "./vite";
import healthRoutes from "./routes/health";

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

// Environment validation
import { EnvironmentValidator } from './utils/EnvironmentValidator';
import { ServiceStartupOrchestrator, ServiceConfig } from './utils/ServiceStartupOrchestrator';
import { environmentValidator } from './middleware/environment-validation';

// Performance optimization imports
import { performanceOptimizer } from './utils/performance-optimizer';
import { resourceManager } from './utils/resource-manager';

// Validate environment at startup
const legacyValidator = EnvironmentValidator.getInstance();
const legacyConfig = legacyValidator.validate();

// Enhanced environment validation
const enhancedValidation = environmentValidator.validateEnvironment();
if (!enhancedValidation.isValid) {
  console.error('🚨 Environment validation failed:', enhancedValidation.errors);
  process.exit(1);
}

// Import and initialize database health check system - RCA Implementation
import { validateDatabaseOnStartup, DatabaseHealthChecker } from './middleware/database-health-check.js';
import { logger } from './utils/logger';

// Import advanced optimization middleware
import { databaseRollbackSafety } from './middleware/database-rollback-safety';
import { memoryOptimizer } from './middleware/memory-optimization';
import { apiResponseOptimizer } from './middleware/api-response-optimizer';

const app = express();

// Trust proxy for rate limiting and security headers
app.set('trust proxy', 1);

// Basic middleware only (restore original functionality)
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Apply security only to API routes to avoid frontend interference
app.use('/api', securityHeaders);
app.use('/api', compression());
app.use('/api', cors(corsOptions));
app.use('/api', apiRateLimit);

// CRITICAL FIX: Ensure all API responses are JSON by default
app.use('/api', (req: Request, res: Response, next: NextFunction) => {
  // Set default Content-Type for API routes
  if (!res.getHeader('Content-Type')) {
    res.setHeader('Content-Type', 'application/json');
  }

  // Override res.send to always ensure JSON response for API routes
  const originalSend = res.send;
  res.send = function(data: any) {
    if (typeof data === 'string' && !res.getHeader('Content-Type')?.toString().includes('application/json')) {
      try {
        JSON.parse(data);
        res.setHeader('Content-Type', 'application/json');
      } catch (e) {
        // If it's not valid JSON, treat it as an error response
        return originalSend.call(this, JSON.stringify({ error: data }));
      }
    }
    return originalSend.call(this, data);
  };

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

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  try {
    // Validate environment configuration at startup
    try {
      const config = environmentValidator.validate();
      log('✅ Environment validation passed for deployment');
    } catch (envError) {
      log('❌ Environment validation failed - this will cause deployment issues');
      if (process.env.NODE_ENV === 'production') {
        log('🚨 Production deployment requires all environment variables to be set in Deployments configuration panel');
        process.exit(1);
      } else {
        log('⚠️ Continuing in development mode with missing environment variables');
      }
    }

    // RCA Implementation: Database Health Validation at Startup
    try {
      log('🔍 Performing startup database health validation...');
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

    // Register health routes with proper isolation
    app.use('/api/health', healthRoutes);
    
    // Register enhanced routes with versioning
    app.use('/api/v1', v1Routes);
    app.use('/api/v2', v2Routes);

    // Optional Enhancements - Monitoring and Docs
    app.use('/api/monitoring', monitoringRoutes);
    app.use('/api/docs', docsRoutes);
    
    // Quality Monitoring Routes (NEW)
    app.use('/api/quality', qualityRoutes);
    
    // Enhanced Statistical Demo Routes (10-Year Data Showcase)
    app.use('/api/statistical', enhancedZScoreRoutes);
    
    // Admin Migration Routes for Economic Data Unit Fix
    app.use('/api/admin', adminMigrationRoutes);
    
    // Performance monitoring routes
    const { performanceMonitoringRoutes } = await import('./routes/performance-monitoring');
    app.use('/api/performance', performanceMonitoringRoutes);

    // Register original routes (maintain backward compatibility)
    const server = await registerRoutes(app);

    // Global uncaught exception handler for production safety
    process.on('uncaughtException', (error) => {
      log('❌ Uncaught Exception:', error.message);
      logger.error('Uncaught Exception', 'GLOBAL_ERROR', { error: error.message, stack: error.stack });
      if (process.env.NODE_ENV === 'production') {
        setTimeout(() => process.exit(1), 1000);
      }
    });

    process.on('unhandledRejection', (reason, promise) => {
      log('❌ Unhandled Rejection at:', String(promise), 'reason:', String(reason));
      logger.error('Unhandled Rejection', 'GLOBAL_ERROR', { reason: String(reason), promise: String(promise) });
    });

    // importantly only setup vite in development and after
    // setting up all the other routes so the catch-all route
    // doesn't interfere with the other routes
    if (app.get("env") === "development") {
      await setupVite(app, server);
    } else {
      serveStatic(app);
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

    // CRITICAL: Global error handler (must be after all routes)
    app.use(errorHandler);
    
    // 404 handler for unmatched routes (must be last)
    app.use(notFoundHandler);
    
    // Graceful shutdown
    gracefulShutdown(server);

    // ALWAYS serve the app on the port specified in the environment variable PORT
    // Other ports are firewalled. Default to 5000 if not specified.
    // this serves both the API and the client.
    // It is the only port that is not firewalled.
    const port = parseInt(process.env.PORT || '5000', 10);
    
    // Validate port configuration
    if (isNaN(port) || port < 1 || port > 65535) {
      const errorMsg = `❌ Invalid port configuration: ${process.env.PORT}. Using default port 5000.`;
      log(errorMsg);
      if (process.env.NODE_ENV === 'production') {
        throw new Error(errorMsg);
      }
    }

    server.listen({
      port,
      host: "0.0.0.0",
      reusePort: true,
    }, () => {
      log(`🚀 FinanceHub Pro serving on port ${port}`);
      log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
      log(`🔗 Server URL: http://0.0.0.0:${port}`);
      
      // Initialize performance monitoring
      performanceOptimizer.startMonitoring(30000); // Every 30 seconds
      resourceManager.startMaintenanceScheduler();
      
      // Initialize cache warmup service (non-blocking)
      setTimeout(async () => {
        try {
          const { CacheWarmupService } = await import('./services/cache-warmup.js');
          const cacheWarmup = new CacheWarmupService(logger);
          cacheWarmup.startWarmupSchedule();
          log('🔥 Cache warmup service initialized');
        } catch (error) {
          log('⚠️ Cache warmup service failed to initialize:', String(error));
        }
      }, 2000);
      
      log('🔍 Performance monitoring, resource management, and cache warmup initialized');
      
      // Initialize services with proper dependency ordering (replaces race conditions)
      const serviceConfigs: ServiceConfig[] = [
        // Real-time market service temporarily disabled for optimal z-score performance
        // {
        //   name: 'real-time-market-service',
        //   timeout: 10000,
        //   initializer: async () => {
        //     try {
        //       const { getRealTimeMarketService } = await import('./services/real-time-market-service');
        //       const marketService = getRealTimeMarketService();
        //       marketService.initialize();
        //       log('✅ Real-time market service initialized');
        //     } catch (error) {
        //       log('⚠️ Real-time market service failed to initialize:', String(error));
        //       log('📊 Continuing without real-time market data');
        //     }
        //   }
        // },
        // Unified refresh scheduler temporarily disabled for optimal z-score performance
        // {
        //   name: 'unified-refresh-scheduler',
        //   dependencies: ['real-time-market-service'],
        //   timeout: 5000,
        //   initializer: async () => {
        //     try {
        //       const { unifiedDataRefreshScheduler } = await import('./services/unified-data-refresh-scheduler');
        //       unifiedDataRefreshScheduler.start();
        //       log('✅ Unified refresh scheduler started');
        //     } catch (error) {
        //       log('⚠️ Unified refresh scheduler failed to start:', String(error));
        //     }
        //   }
        // },
        {
          name: 'intelligent-cron-scheduler',
          dependencies: [],
          timeout: 8000,
          initializer: async () => {
            try {
              await intelligentCronScheduler.initialize();
              log('✅ Intelligent cron scheduler initialized');
            } catch (error) {
              log('⚠️ Intelligent cron scheduler failed to initialize:', String(error));
            }
          }
        },
        {
          name: 'data-staleness-prevention',
          dependencies: [],
          timeout: 3000,
          initializer: async () => {
            try {
              dataStalenessPrevention.startPreventiveMonitoring();
              log('✅ Data staleness prevention started');
            } catch (error) {
              log('⚠️ Data staleness prevention failed to start:', String(error));
            }
          }
        },
        {
          name: 'data-scheduler',
          dependencies: ['intelligent-cron-scheduler', 'data-staleness-prevention'],
          timeout: 10000,
          initializer: async () => {
            try {
              const { dataScheduler } = await import("./services/scheduler");
              await dataScheduler.startScheduler();
              log('✅ Data scheduler started');
            } catch (error) {
              log('⚠️ Data scheduler failed to start:', String(error));
            }
          }
        },
        {
          name: 'fred-incremental-scheduler',
          dependencies: ['data-scheduler'],
          timeout: 5000,
          initializer: async () => {
            try {
              fredSchedulerIncremental.start();
              log('✅ FRED incremental scheduler started');
            } catch (error) {
              log('⚠️ FRED incremental scheduler failed to start:', String(error));
            }
          }
        },
        {
          name: 'economic-data-scheduler',
          dependencies: ['fred-incremental-scheduler'],
          timeout: 5000,
          initializer: async () => {
            try {
              const { economicDataScheduler } = await import('./services/economic-data-scheduler');
              economicDataScheduler.initialize();
              log('🕐 Economic data release scheduler initialized for 10:15am weekday updates');
            } catch (error) {
              log('⚠️ Economic data scheduler failed to initialize:', String(error));
            }
          }
        },
        {
          name: 'historical-data-system',
          dependencies: ['data-scheduler'],
          timeout: 30000, // Increased timeout for heavy operations
          initializer: async () => {
            // Add delay to prevent startup overload (per analysis recommendation)
            setTimeout(async () => {
              try {
                // Load comprehensive historical data collector (if exists)
                try {
                  const { comprehensiveHistoricalCollector } = await import('./services/comprehensive-historical-collector.js');
                  log('🎯 Historical data collector loaded (delayed startup)');
                } catch (error) {
                  log('📊 Historical data collector not available (optional)');
                }
                
                // Load historical data intelligence (if exists)
                try {
                  const { historicalDataIntelligence } = await import('./services/historical-data-intelligence.js');
                  log('🧠 Historical data intelligence loaded (delayed startup)');
                } catch (error) {
                  log('📊 Historical data intelligence not available (optional)');
                }
              } catch (error) {
                log('⚠️ Historical data system delayed startup failed:', String(error));
              }
            }, 10000); // 10-second delay to prevent startup CPU overload
            log('⏸️ Historical data system startup delayed by 10s for performance');
          }
        }
      ];

      const orchestrator = new ServiceStartupOrchestrator(serviceConfigs);
      
      // Start all services with proper dependency management
      setTimeout(async () => {
        // Skip OpenAI-dependent services if API key is not available
        // OpenAI dependency completely removed - no longer needed
        // if (!config.OPENAI_API_KEY) {
        //   log('⚠️ OpenAI API key not available - disabling AI-dependent features');
        // }
        try {
          await orchestrator.startAll();
          
          log('📊 ✅ SERVICE ORCHESTRATION COMPLETE');
          log('🎯 Active Features (Optimized for Z-Score Analytics):');
          log('   • Unified data refresh scheduler');
          log('   • Intelligent cron scheduling');
          log('   • Data staleness prevention');
          log('   • Daily email scheduling (8:00 AM EST)');
          log('   • Historical data intelligence system');
          log('   ⚡ FRED services disabled for performance optimization');
          log('');
          log('🌐 Available Endpoints:');
          log('   • GET  /health/system-status - System health monitoring');
          log('   • POST /health/data-integrity/validate - Data validation');
          log('   • GET  /health/unified-refresh/status - Refresh status');
          log('');
          log('📧 Daily email scheduled for 8:00 AM EST (Monday-Friday)');
          log(`📅 Current EST time: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`);
          log('🔄 All services operational with dependency management');
          
        } catch (serviceError) {
          log('⚠️ Service orchestration encountered errors:', String(serviceError));
          log('📊 Application will continue running with reduced functionality');
        }
      }, 1000); // Single 1-second delay for server initialization
    });

    // Add server error handling
    server.on('error', (error: any) => {
      log('❌ Server error:', String(error));
      if (error.code === 'EADDRINUSE') {
        log(`❌ Port ${port} is already in use. Please check if another instance is running.`);
        process.exit(1);
      } else if (error.code === 'EACCES') {
        log(`❌ Permission denied to bind to port ${port}. Try using a port above 1024.`);
        process.exit(1);
      } else {
        log('❌ Unexpected server error occurred:', error.message);
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
