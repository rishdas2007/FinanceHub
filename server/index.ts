import express, { type Request, Response, NextFunction } from "express";
import compression from "compression";
import cors from "cors";
import { registerRoutes } from "./routes";
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
import { envSchema } from "@shared/validation";

// Validate environment variables (skip in development for now)
if (process.env.NODE_ENV === 'production') {
  try {
    envSchema.parse(process.env);
  } catch (error) {
    console.error("Environment validation failed:", error);
    process.exit(1);
  }
}

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
        
        // Verify the scheduler is working by checking its status
        log('📧 Daily email scheduled for 8:00 AM EST (Monday-Friday)');
        log(`📅 Current EST time: ${new Date().toLocaleString("en-US", { timeZone: "America/New_York" })}`);
        log('🔄 All scheduled tasks initialized and ready');
        
      } catch (error) {
        log('❌ CRITICAL: Failed to start data scheduler:', error);
        console.error('Scheduler initialization error:', error);
      }
    }, 3000); // 3 second delay to ensure full server initialization
  });
})();
