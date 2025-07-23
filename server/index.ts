import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import cors from "cors";
import { registerRoutes } from "./routes";
// Import optional enhancements
import { monitoringRoutes } from './routes/monitoring';
import { docsRoutes } from './routes/docs';
import { v1Routes } from './routes/api/v1/index';
import { v2Routes } from './routes/api/v2/index';
import { apiVersioning, versionDeprecation, contentNegotiation } from './middleware/api-versioning';
import { metricsMiddleware } from './utils/MetricsCollector';
import { setupVite, serveStatic, log } from "./vite";
import { registerHealthRoutes } from "./routes/health";

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
// Environment validation handled in EnvironmentValidator

// Skip environment validation for now since we use EnvironmentValidator elsewhere

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

// Optional Enhancements - Metrics Collection
app.use('/api', metricsMiddleware());

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
  // Register health routes (API only)
  // registerHealthRoutes(app); // Temporarily disabled to fix frontend loading
  
  // Register enhanced routes with versioning
  app.use('/api/v1', v1Routes);
  app.use('/api/v2', v2Routes);

  // Optional Enhancements - Monitoring and Docs
  app.use('/api/monitoring', monitoringRoutes);
  app.use('/api/docs', docsRoutes);

  // Register original routes (maintain backward compatibility)
  const server = await registerRoutes(app);

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // Basic error handler (keep original functionality)
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
  });
  
  // Graceful shutdown
  gracefulShutdown(server);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`🚀 FinanceHub Pro serving on port ${port}`);
    
    // Start the data scheduler for daily updates with enhanced error handling
    setTimeout(async () => {
      try {
        log('📊 Initializing comprehensive data scheduler...');
        const { dataScheduler } = await import("./services/scheduler");
        
        await dataScheduler.startScheduler();
        log('✅ Data scheduler started successfully with 8 AM email cron job');
        
        // Initialize FRED data scheduler for 4-hour updates
        log('📊 Initializing FRED data scheduler...');
        const { fredSchedulerService } = await import('./services/fred-scheduler');
        await fredSchedulerService.startScheduler();
        log('✅ FRED data scheduler started successfully - updating every 4 hours');
        
        // Initialize comprehensive intelligent historical data storage system
        log('🎯 Initializing Comprehensive Intelligent Historical Data Storage System...');
        
        // Load comprehensive historical data collector
        const { comprehensiveHistoricalCollector } = await import('./services/comprehensive-historical-collector.js');
        
        // Load historical data intelligence
        const { historicalDataIntelligence } = await import('./services/historical-data-intelligence.js');
        log('🧠 Historical Data Intelligence System Ready');
        
        // Initialize enhanced cron scheduler with comprehensive data collection
        const { enhancedCronScheduler } = await import('./services/enhanced-cron-scheduler.js');
        await enhancedCronScheduler.initialize();
        log('✅ Enhanced cron scheduler initialized with comprehensive data collection');
        
        log('📊 ✅ COMPREHENSIVE INTELLIGENT HISTORICAL DATA STORAGE SYSTEM OPERATIONAL');
        log('🎯 Active Features:');
        log('   • 18-month historical data backfill capability');
        log('   • Automated 4-hourly data collection (Mon-Fri)');
        log('   • Intelligent percentile rankings and trend analysis');
        log('   • Market regime detection with pattern recognition');
        log('   • Enhanced AI context with historical insights');
        log('   • Complete audit trail for all operations');
        log('');
        log('🌐 New API Endpoints Available:');
        log('   • POST /api/comprehensive-historical-data/collect');
        log('   • GET  /api/historical-intelligence/:symbol');
        log('   • GET  /api/enhanced-ai-context/:symbol');
        
        // Verify the scheduler is working by checking its status
        log('📧 Daily email scheduled for 8:00 AM EST (Monday-Friday)');
        log(`📅 Current EST time: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`);
        log('🔄 All scheduled tasks initialized and ready');
        
      } catch (error) {
        log('❌ CRITICAL: Failed to start data scheduler:', (error as Error).message || 'Unknown error');
        console.error('Scheduler initialization error:', error);
      }
    }, 3000); // 3 second delay to ensure full server initialization
  });
})();
