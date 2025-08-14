// Redis cluster configuration for high availability caching
// Implements Redis Cluster with failover and load balancing

import { createCluster, RedisClusterType } from 'redis';

interface RedisClusterConfig {
  rootNodes: Array<{ host: string; port: number }>;
  enableOfflineQueue: boolean;
  retryDelayOnFailover: number;
  maxRetriesPerRequest: number;
  enableReadyCheck: boolean;
  lazyConnect: boolean;
  connectTimeout: number;
  commandTimeout: number;
}

export class RedisClusterService {
  private cluster: RedisClusterType | null = null;
  private config: RedisClusterConfig;
  private isConnected = false;
  private connectionAttempts = 0;
  private maxConnectionAttempts = 5;

  constructor(config: Partial<RedisClusterConfig> = {}) {
    this.config = {
      rootNodes: [
        { host: process.env.REDIS_HOST_1 || 'localhost', port: parseInt(process.env.REDIS_PORT_1 || '6379') },
        { host: process.env.REDIS_HOST_2 || 'localhost', port: parseInt(process.env.REDIS_PORT_2 || '6380') },
        { host: process.env.REDIS_HOST_3 || 'localhost', port: parseInt(process.env.REDIS_PORT_3 || '6381') }
      ],
      enableOfflineQueue: false,
      retryDelayOnFailover: 100,
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 5000,
      commandTimeout: 3000,
      ...config
    };
  }

  async initialize(): Promise<boolean> {
    try {
      console.log('🔄 Initializing Redis Cluster...');

      // Check if Redis clustering is available
      const redisUrl = process.env.REDIS_URL;
      if (!redisUrl && !process.env.REDIS_HOST_1) {
        console.log('⚠️ No Redis cluster configuration found, using fallback cache');
        return false;
      }

      this.cluster = createCluster({
        rootNodes: this.config.rootNodes,
        defaults: {
          socket: {
            connectTimeout: this.config.connectTimeout,
            commandTimeout: this.config.commandTimeout,
            reconnectStrategy: (retries) => Math.min(retries * 50, 500)
          },
          lazyConnect: this.config.lazyConnect
        },
        useReplicas: true, // Enable read from replicas
        enableAutoPipelining: true, // Automatic command pipelining
        enableOfflineQueue: this.config.enableOfflineQueue
      });

      // Event handlers
      this.cluster.on('connect', () => {
        console.log('✅ Redis Cluster connected');
        this.isConnected = true;
        this.connectionAttempts = 0;
      });

      this.cluster.on('error', (error) => {
        console.error('🚨 Redis Cluster error:', error.message);
        this.isConnected = false;
      });

      this.cluster.on('reconnecting', () => {
        this.connectionAttempts++;
        console.log(`🔄 Redis Cluster reconnecting (attempt ${this.connectionAttempts})`);
      });

      this.cluster.on('end', () => {
        console.log('🔌 Redis Cluster connection ended');
        this.isConnected = false;
      });

      // Connect with timeout
      await Promise.race([
        this.cluster.connect(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error('Connection timeout')), this.config.connectTimeout)
        )
      ]);

      return true;

    } catch (error) {
      console.error('❌ Redis Cluster initialization failed:', error);
      this.cluster = null;
      return false;
    }
  }

  // High-level cache operations with cluster-aware logic
  async get(key: string): Promise<string | null> {
    if (!this.cluster || !this.isConnected) {
      return null;
    }

    try {
      // Use readonly replica for read operations when possible
      return await this.cluster.get(key);
    } catch (error) {
      console.warn(`⚠️ Redis cluster GET failed for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    if (!this.cluster || !this.isConnected) {
      return false;
    }

    try {
      if (ttlSeconds) {
        await this.cluster.setEx(key, ttlSeconds, value);
      } else {
        await this.cluster.set(key, value);
      }
      return true;
    } catch (error) {
      console.warn(`⚠️ Redis cluster SET failed for key ${key}:`, error);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    if (!this.cluster || !this.isConnected) {
      return false;
    }

    try {
      await this.cluster.del(key);
      return true;
    } catch (error) {
      console.warn(`⚠️ Redis cluster DEL failed for key ${key}:`, error);
      return false;
    }
  }

  // Batch operations for performance
  async mget(keys: string[]): Promise<(string | null)[]> {
    if (!this.cluster || !this.isConnected || keys.length === 0) {
      return new Array(keys.length).fill(null);
    }

    try {
      return await this.cluster.mGet(keys);
    } catch (error) {
      console.warn('⚠️ Redis cluster MGET failed:', error);
      return new Array(keys.length).fill(null);
    }
  }

  async mset(keyValuePairs: Array<[string, string]>, ttlSeconds?: number): Promise<boolean> {
    if (!this.cluster || !this.isConnected || keyValuePairs.length === 0) {
      return false;
    }

    try {
      // Use pipeline for better performance
      const pipeline = this.cluster.multi();
      
      keyValuePairs.forEach(([key, value]) => {
        if (ttlSeconds) {
          pipeline.setEx(key, ttlSeconds, value);
        } else {
          pipeline.set(key, value);
        }
      });

      await pipeline.exec();
      return true;
    } catch (error) {
      console.warn('⚠️ Redis cluster MSET failed:', error);
      return false;
    }
  }

  // Advanced cluster operations
  async exists(key: string): Promise<boolean> {
    if (!this.cluster || !this.isConnected) {
      return false;
    }

    try {
      const result = await this.cluster.exists(key);
      return result === 1;
    } catch (error) {
      console.warn(`⚠️ Redis cluster EXISTS failed for key ${key}:`, error);
      return false;
    }
  }

  async ttl(key: string): Promise<number> {
    if (!this.cluster || !this.isConnected) {
      return -1;
    }

    try {
      return await this.cluster.ttl(key);
    } catch (error) {
      console.warn(`⚠️ Redis cluster TTL failed for key ${key}:`, error);
      return -1;
    }
  }

  // Pattern-based operations
  async keys(pattern: string): Promise<string[]> {
    if (!this.cluster || !this.isConnected) {
      return [];
    }

    try {
      // Note: KEYS command in cluster mode scans all nodes
      const allKeys: string[] = [];
      const nodes = this.cluster.getNodes();
      
      for (const node of nodes) {
        const nodeKeys = await node.keys(pattern);
        allKeys.push(...nodeKeys);
      }
      
      return [...new Set(allKeys)]; // Remove duplicates
    } catch (error) {
      console.warn(`⚠️ Redis cluster KEYS failed for pattern ${pattern}:`, error);
      return [];
    }
  }

  // Cluster health and statistics
  async getClusterInfo(): Promise<any> {
    if (!this.cluster || !this.isConnected) {
      return null;
    }

    try {
      const nodes = this.cluster.getNodes();
      const nodeInfo = await Promise.all(
        nodes.map(async (node) => ({
          host: node.options.host,
          port: node.options.port,
          status: node.status,
          role: node.options.role,
          memory: await node.memory('usage').catch(() => 'unknown'),
          uptime: await node.info('server').then(info => 
            info.split('\n').find(line => line.startsWith('uptime_in_seconds'))
          ).catch(() => 'unknown')
        }))
      );

      return {
        isConnected: this.isConnected,
        nodeCount: nodes.length,
        nodes: nodeInfo,
        connectionAttempts: this.connectionAttempts
      };
    } catch (error) {
      console.warn('⚠️ Failed to get cluster info:', error);
      return null;
    }
  }

  // Graceful shutdown
  async disconnect(): Promise<void> {
    if (this.cluster) {
      try {
        await this.cluster.quit();
        console.log('✅ Redis Cluster disconnected gracefully');
      } catch (error) {
        console.warn('⚠️ Error during Redis cluster disconnect:', error);
      } finally {
        this.cluster = null;
        this.isConnected = false;
      }
    }
  }

  // Health check
  async healthCheck(): Promise<{ healthy: boolean; latency?: number; error?: string }> {
    if (!this.cluster || !this.isConnected) {
      return { healthy: false, error: 'Not connected' };
    }

    try {
      const start = Date.now();
      await this.cluster.ping();
      const latency = Date.now() - start;
      
      return { healthy: true, latency };
    } catch (error) {
      return { 
        healthy: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  // Connection status
  getStatus() {
    return {
      isConnected: this.isConnected,
      connectionAttempts: this.connectionAttempts,
      hasCluster: !!this.cluster,
      config: {
        nodeCount: this.config.rootNodes.length,
        connectTimeout: this.config.connectTimeout,
        commandTimeout: this.config.commandTimeout
      }
    };
  }
}

// Export singleton instance
export const redisCluster = new RedisClusterService();

// Fallback wrapper that gracefully degrades to memory cache
export class ClusterCacheWrapper {
  private memoryCache = new Map<string, { value: string; expires: number }>();
  private fallbackEnabled = true;

  async get(key: string): Promise<string | null> {
    // Try cluster first
    const clusterResult = await redisCluster.get(key);
    if (clusterResult !== null) {
      return clusterResult;
    }

    // Fallback to memory cache
    if (this.fallbackEnabled) {
      const cached = this.memoryCache.get(key);
      if (cached && cached.expires > Date.now()) {
        return cached.value;
      }
      this.memoryCache.delete(key);
    }

    return null;
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    const clusterSuccess = await redisCluster.set(key, value, ttlSeconds);
    
    // Always update memory cache as backup
    if (this.fallbackEnabled) {
      const expires = ttlSeconds ? Date.now() + (ttlSeconds * 1000) : Infinity;
      this.memoryCache.set(key, { value, expires });
    }

    return clusterSuccess;
  }

  async del(key: string): Promise<boolean> {
    const clusterSuccess = await redisCluster.del(key);
    
    if (this.fallbackEnabled) {
      this.memoryCache.delete(key);
    }

    return clusterSuccess;
  }

  // Clean up expired memory cache entries
  cleanup(): void {
    const now = Date.now();
    for (const [key, cached] of this.memoryCache.entries()) {
      if (cached.expires <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  getStats() {
    return {
      cluster: redisCluster.getStatus(),
      memoryCache: {
        size: this.memoryCache.size,
        fallbackEnabled: this.fallbackEnabled
      }
    };
  }
}

export const clusterCache = new ClusterCacheWrapper();