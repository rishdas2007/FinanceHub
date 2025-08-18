/**
 * Database-specific type definitions to replace 'any' types
 * Critical for production type safety in database operations
 */

export interface DatabaseConnectionConfig {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
  ssl?: boolean;
  maxConnections?: number;
  connectionTimeoutMs?: number;
}

export interface DatabaseQueryOptions {
  timeout?: number;
  retries?: number;
  cache?: boolean;
  cacheTtl?: number;
}

export interface DatabaseTransaction {
  id: string;
  startTime: Date;
  queries: string[];
  status: 'active' | 'committed' | 'rolled_back' | 'failed';
}

export interface DatabaseMetrics {
  activeConnections: number;
  totalQueries: number;
  avgQueryTime: number;
  errorRate: number;
  lastError?: string;
  timestamp: Date;
}

export interface DatabaseMigration {
  id: string;
  name: string;
  version: string;
  executedAt: Date;
  rollbackSql?: string;
  checksum: string;
}

export interface DatabaseBackupInfo {
  id: string;
  filename: string;
  size: number;
  createdAt: Date;
  tables: string[];
  checksum: string;
  compressed: boolean;
}

export interface QueryResult<T = any> {
  data: T[];
  rowCount: number;
  executionTime: number;
  cached: boolean;
  timestamp: Date;
}

export interface DatabaseError {
  code: string;
  message: string;
  query?: string;
  parameters?: any[];
  timestamp: Date;
  stack?: string;
}