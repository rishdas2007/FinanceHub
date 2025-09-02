import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure Neon for production with enhanced error handling
neonConfig.webSocketConstructor = ws;
neonConfig.fetchConnectionCache = true;
neonConfig.pipelineConnect = "password";

// Remove malformed wsProxy configuration that causes "wss://wss//" URLs
// The Neon serverless driver handles WebSocket URLs correctly on its own

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

// Add connection error handling
pool.on('error', (err) => {
  console.error('🚨 Database pool error:', err);
  // Don't exit, just log the error
});

pool.on('connect', () => {
  console.log('✅ Database connection established');
});

pool.on('remove', () => {
  console.log('📊 Database connection removed from pool');
});

// Create drizzle instance with error handling
let db: any;
try {
  db = drizzle({ client: pool, schema });
} catch (error) {
  console.error('🚨 Failed to create Drizzle instance:', error);
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