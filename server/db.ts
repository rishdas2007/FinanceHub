import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

neonConfig.webSocketConstructor = ws;

if (!process.env.DATABASE_URL) {
  const errorMessage = "DATABASE_URL must be set. Did you forget to provision a database?";
  console.error("❌ Database Configuration Error:", errorMessage);
  
  if (process.env.NODE_ENV === 'production') {
    console.error("🚨 Production deployment requires DATABASE_URL to be set in Deployments → Environment Variables");
    console.error("📝 Please add DATABASE_URL in the Replit Deployments configuration panel");
  }
  
  throw new Error(errorMessage);
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10, // Max connections for Neon serverless
  idleTimeoutMillis: 30000, // Close idle connections after 30s
  connectionTimeoutMillis: 10000, // Timeout connection attempts after 10s
  maxUses: 7500, // Neon specific - max uses per connection
  allowExitOnIdle: true // Allow process to exit when all connections idle
});
export const db = drizzle({ client: pool, schema });