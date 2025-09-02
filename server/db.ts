import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon for production with enhanced error handling
neonConfig.webSocketConstructor = ws;
neonConfig.fetchConnectionCache = true;
neonConfig.pipelineConnect = "password";

// Fix WebSocket URL configuration for Neon
// Remove the wsProxy as it's causing malformed URLs

// Enhanced error handling for WebSocket connections
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineTLS = false;

if (!process.env.DATABASE_URL) {
  const errorMessage = "DATABASE_URL must be set. Did you forget to provision a database?";
  console.error("❌ Database Configuration Error:", errorMessage);
  
  if (process.env.NODE_ENV === 'production') {
    console.error("🚨 Production deployment requires DATABASE_URL to be set in Deployments → Environment Variables");
    console.error("📝 Please add DATABASE_URL in the Replit Deployments configuration panel");
  }
  
  throw new Error(errorMessage);
}

// Production-optimized pool configuration
export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5, // Reduced from 10 for production stability
  idleTimeoutMillis: 60000, // Increased from 30s to 60s
  connectionTimeoutMillis: 30000, // Increased from 10s to 30s
  maxUses: 1000, // Reduced from 7500 to prevent connection exhaustion
  allowExitOnIdle: false, // Changed to false to prevent premature exits
  keepAlive: true,
  keepAliveInitialDelayMillis: 10000,
});

// Enhanced connection diagnostics and error handling
pool.on('error', (err) => {
  console.error('🚨 Database pool error:', {
    name: err.name,
    message: err.message,
    stack: err.stack?.substring(0, 500),
    timestamp: new Date().toISOString()
  });
  // Don't exit, just log the error for investigation
});

pool.on('connect', () => {
  console.log('✅ Database connection established', {
    timestamp: new Date().toISOString(),
    event: 'connect'
  });
});

pool.on('remove', () => {
  console.log('📊 Database connection removed from pool', {
    reason: 'Connection lifecycle completed',
    timestamp: new Date().toISOString(),
    event: 'remove'
  });
});

// Add connection acquisition diagnostics with safe property access
pool.on('acquire', () => {
  console.log('🔄 Database connection acquired', {
    poolSize: pool.totalCount,
    idleCount: pool.idleCount,
    waitingCount: pool.waitingCount,
    timestamp: new Date().toISOString(),
    event: 'acquire'
  });
});

// Log initial pool state with safe property access
console.log('🔍 Database Pool Configuration:', {
  databaseUrl: process.env.DATABASE_URL ? '[CONFIGURED]' : '[MISSING]',
  nodeEnv: process.env.NODE_ENV,
  poolConfigured: true,
  timestamp: new Date().toISOString()
});

// Add database health check function
export async function validateDatabaseConnection(): Promise<boolean> {
  try {
    console.log('🔍 Testing database connectivity...');
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    console.log('✅ Database connectivity validated');
    return true;
  } catch (error) {
    console.error('❌ Database connectivity test failed:', {
      name: error instanceof Error ? error.name : 'Unknown',
      message: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    });
    return false;
  }
}

// Create drizzle instance with enhanced error handling
let db: any;
try {
  db = drizzle({ client: pool, schema });
  console.log('✅ Drizzle ORM instance created successfully');
} catch (error) {
  console.error('🚨 Failed to create Drizzle instance:', {
    name: error instanceof Error ? error.name : 'Unknown',
    message: error instanceof Error ? error.message : String(error),
    timestamp: new Date().toISOString()
  });
  // Create a minimal fallback
  db = null;
}

// Export with fallback handling
export { db };

// Graceful shutdown handler
export async function closeDatabase() {
  try {
    console.log('🔄 Closing database connections...');
    await pool.end();
    console.log('✅ Database connections closed');
  } catch (error) {
    console.error('❌ Error closing database:', error);
  }
}