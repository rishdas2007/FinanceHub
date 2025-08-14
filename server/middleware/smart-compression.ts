// Intelligent compression middleware
// Dynamic compression based on content type and size

import compression from 'compression';
import { Request, Response, NextFunction } from 'express';

interface CompressionConfig {
  level: number;
  threshold: number;
  skipPaths: string[];
  preferredFormats: string[];
}

export class SmartCompressionService {
  private config: CompressionConfig;
  private compressionStats = {
    totalRequests: 0,
    compressedRequests: 0,
    bytesOriginal: 0,
    bytesCompressed: 0,
    timeSpent: 0
  };

  constructor(config: Partial<CompressionConfig> = {}) {
    this.config = {
      level: 6, // Balance between speed and compression ratio
      threshold: 1024, // Only compress responses > 1KB
      skipPaths: ['/api/sparkline', '/api/real-time'], // Skip already optimized endpoints
      preferredFormats: ['application/json', 'text/html', 'text/css', 'text/javascript'],
      ...config
    };
  }

  // Main compression middleware
  get middleware() {
    return compression({
      level: this.config.level,
      threshold: this.config.threshold,
      filter: this.shouldCompress.bind(this),
      encodings: ['gzip', 'deflate', 'br'] // Support modern compression
    });
  }

  // Intelligent compression filtering
  private shouldCompress(req: Request, res: Response): boolean {
    const startTime = performance.now();

    // Skip compression for certain paths
    if (this.config.skipPaths.some(path => req.path.includes(path))) {
      return false;
    }

    // Skip compression for small responses (will be checked by threshold)
    const contentLength = res.getHeader('content-length');
    if (contentLength && parseInt(contentLength.toString()) < this.config.threshold) {
      return false;
    }

    // Check content type
    const contentType = res.getHeader('content-type')?.toString() || '';
    const shouldCompress = this.config.preferredFormats.some(format => 
      contentType.includes(format)
    );

    // Skip image, video, and already compressed content
    if (contentType.includes('image/') || 
        contentType.includes('video/') ||
        contentType.includes('application/gzip') ||
        contentType.includes('application/zip')) {
      return false;
    }

    // Track compression decision
    this.trackCompressionDecision(req, shouldCompress, startTime);

    return shouldCompress;
  }

  // Track compression statistics
  private trackCompressionDecision(req: Request, compressed: boolean, startTime: number) {
    this.compressionStats.totalRequests++;
    
    if (compressed) {
      this.compressionStats.compressedRequests++;
    }
    
    this.compressionStats.timeSpent += performance.now() - startTime;
  }

  // Advanced compression for JSON responses
  static jsonCompressionMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const originalJson = res.json;

    res.json = function(obj: any) {
      // For large JSON responses, optimize structure before compression
      if (typeof obj === 'object' && obj !== null) {
        const optimizedObj = SmartCompressionService.optimizeJsonStructure(obj);
        return originalJson.call(this, optimizedObj);
      }
      
      return originalJson.call(this, obj);
    };

    next();
  };

  // Optimize JSON structure for better compression
  private static optimizeJsonStructure(obj: any): any {
    if (Array.isArray(obj)) {
      // For large arrays, check if we can use more compact representation
      if (obj.length > 100) {
        return SmartCompressionService.compactArrayStructure(obj);
      }
    }

    if (typeof obj === 'object' && obj !== null) {
      const optimized: any = {};
      
      // Remove null/undefined values for better compression
      Object.keys(obj).forEach(key => {
        const value = obj[key];
        if (value !== null && value !== undefined) {
          // Recursively optimize nested objects
          if (typeof value === 'object') {
            optimized[key] = SmartCompressionService.optimizeJsonStructure(value);
          } else {
            optimized[key] = value;
          }
        }
      });

      return optimized;
    }

    return obj;
  }

  // Compact array structure for better compression
  private static compactArrayStructure(arr: any[]): any {
    if (arr.length === 0) return arr;

    // Check if all items have the same structure (common keys)
    const firstItem = arr[0];
    if (typeof firstItem !== 'object' || firstItem === null) {
      return arr;
    }

    const commonKeys = Object.keys(firstItem);
    const hasCommonStructure = arr.every(item => 
      typeof item === 'object' && 
      item !== null && 
      commonKeys.every(key => key in item)
    );

    if (hasCommonStructure && commonKeys.length > 3) {
      // Use columnar format for better compression
      const columnar: any = {
        _format: 'columnar',
        _keys: commonKeys,
        _data: commonKeys.map(key => arr.map(item => item[key]))
      };

      // Only use columnar format if it's actually more compact
      const originalSize = JSON.stringify(arr).length;
      const columnarSize = JSON.stringify(columnar).length;
      
      if (columnarSize < originalSize * 0.8) { // 20% savings minimum
        return columnar;
      }
    }

    return arr;
  }

  // Get compression statistics
  getCompressionStats() {
    const compressionRatio = this.compressionStats.bytesOriginal > 0 
      ? (1 - this.compressionStats.bytesCompressed / this.compressionStats.bytesOriginal) * 100
      : 0;

    return {
      ...this.compressionStats,
      compressionRatio: compressionRatio.toFixed(2) + '%',
      compressionRate: this.compressionStats.totalRequests > 0
        ? ((this.compressionStats.compressedRequests / this.compressionStats.totalRequests) * 100).toFixed(2) + '%'
        : '0%',
      avgCompressionTime: this.compressionStats.compressedRequests > 0
        ? (this.compressionStats.timeSpent / this.compressionStats.compressedRequests).toFixed(2) + 'ms'
        : '0ms'
    };
  }

  // Reset compression statistics
  resetStats() {
    this.compressionStats = {
      totalRequests: 0,
      compressedRequests: 0,
      bytesOriginal: 0,
      bytesCompressed: 0,
      timeSpent: 0
    };
  }
}

// Export configured instances
export const smartCompression = new SmartCompressionService({
  level: 6,
  threshold: 1024,
  skipPaths: ['/api/sparkline', '/api/etf-metrics/real-time'],
  preferredFormats: ['application/json', 'text/html', 'text/css', 'application/javascript']
});

export const compressionMiddleware = smartCompression.middleware;
export const jsonOptimizationMiddleware = SmartCompressionService.jsonCompressionMiddleware;