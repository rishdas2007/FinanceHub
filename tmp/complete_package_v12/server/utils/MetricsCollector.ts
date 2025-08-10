import { logger } from './logger';

interface CustomMetric {
  name: string;
  value: number;
  tags?: Record<string, string>;
  timestamp: number;
}

interface Counter {
  [key: string]: number;
}

interface Timer {
  [key: string]: {
    total: number;
    count: number;
    min: number;
    max: number;
    avg: number;
  };
}

class MetricsCollector {
  private counters: Counter = {};
  private timers: Timer = {};
  private customMetrics: CustomMetric[] = [];
  private startTimes: Map<string, number> = new Map();

  // Counter operations
  increment(metric: string, value: number = 1, tags?: Record<string, string>) {
    const key = this.buildKey(metric, tags);
    this.counters[key] = (this.counters[key] || 0) + value;
    
    logger.debug('Metric incremented', { metric, value, tags, total: this.counters[key] });
  }

  decrement(metric: string, value: number = 1, tags?: Record<string, string>) {
    this.increment(metric, -value, tags);
  }

  // Timer operations
  startTimer(metric: string, tags?: Record<string, string>): string {
    const key = this.buildKey(metric, tags);
    const timerId = `${key}-${Date.now()}-${Math.random()}`;
    this.startTimes.set(timerId, performance.now());
    return timerId;
  }

  endTimer(timerId: string, metric: string, tags?: Record<string, string>) {
    const startTime = this.startTimes.get(timerId);
    if (!startTime) {
      logger.warn('Timer not found', { timerId, metric });
      return;
    }

    const duration = performance.now() - startTime;
    this.startTimes.delete(timerId);
    
    const key = this.buildKey(metric, tags);
    if (!this.timers[key]) {
      this.timers[key] = { total: 0, count: 0, min: duration, max: duration, avg: 0 };
    }

    const timer = this.timers[key];
    timer.total += duration;
    timer.count++;
    timer.min = Math.min(timer.min, duration);
    timer.max = Math.max(timer.max, duration);
    timer.avg = timer.total / timer.count;

    logger.debug('Timer recorded', { metric, duration, tags });
  }

  // Time a function execution
  async time<T>(metric: string, fn: () => Promise<T>, tags?: Record<string, string>): Promise<T> {
    const timerId = this.startTimer(metric, tags);
    try {
      const result = await fn();
      this.endTimer(timerId, metric, tags);
      return result;
    } catch (error) {
      this.endTimer(timerId, metric, { ...tags, error: 'true' });
      this.increment(`${metric}.error`, 1, tags);
      throw error;
    }
  }

  // Record custom metrics
  recordMetric(name: string, value: number, tags?: Record<string, string>) {
    this.customMetrics.push({
      name,
      value,
      tags,
      timestamp: Date.now()
    });

    // Keep only recent metrics (last 1000)
    if (this.customMetrics.length > 1000) {
      this.customMetrics.splice(0, this.customMetrics.length - 1000);
    }

    logger.debug('Custom metric recorded', { name, value, tags });
  }

  // Business-specific metrics
  recordAPICall(endpoint: string, method: string, statusCode: number, duration: number) {
    this.increment('api.requests.total', 1, { endpoint, method, status: statusCode.toString() });
    this.recordMetric('api.response_time', duration, { endpoint, method });
    
    if (statusCode >= 400) {
      this.increment('api.errors.total', 1, { endpoint, method, status: statusCode.toString() });
    }
  }

  recordDatabaseQuery(operation: string, table: string, duration: number, success: boolean) {
    this.increment('database.queries.total', 1, { operation, table, success: success.toString() });
    this.recordMetric('database.query_time', duration, { operation, table });
    
    if (!success) {
      this.increment('database.errors.total', 1, { operation, table });
    }
  }

  recordCacheOperation(operation: 'hit' | 'miss' | 'set' | 'delete', key: string) {
    this.increment(`cache.${operation}`, 1, { key: this.sanitizeKey(key) });
  }

  recordExternalAPICall(service: string, endpoint: string, duration: number, success: boolean) {
    this.increment('external_api.calls.total', 1, { service, endpoint, success: success.toString() });
    this.recordMetric('external_api.response_time', duration, { service, endpoint });
    
    if (!success) {
      this.increment('external_api.errors.total', 1, { service, endpoint });
    }
  }

  // Get current metrics snapshot
  getMetrics() {
    return {
      counters: { ...this.counters },
      timers: { ...this.timers },
      customMetrics: [...this.customMetrics],
      timestamp: Date.now(),
      uptime: process.uptime(),
      memory: process.memoryUsage()
    };
  }

  // Reset all metrics (useful for testing)
  reset() {
    this.counters = {};
    this.timers = {};
    this.customMetrics = [];
    this.startTimes.clear();
    
    logger.info('Metrics collector reset');
  }

  // Export metrics in Prometheus format
  toPrometheusFormat(): string {
    const lines: string[] = [];
    
    // Export counters
    Object.entries(this.counters).forEach(([key, value]) => {
      lines.push(`# TYPE ${key.split('{')[0]} counter`);
      lines.push(`${key} ${value}`);
    });
    
    // Export timers
    Object.entries(this.timers).forEach(([key, timer]) => {
      const baseKey = key.split('{')[0];
      lines.push(`# TYPE ${baseKey}_total counter`);
      lines.push(`${baseKey}_total${key.includes('{') ? key.substring(key.indexOf('{')) : ''} ${timer.total}`);
      lines.push(`${baseKey}_count${key.includes('{') ? key.substring(key.indexOf('{')) : ''} ${timer.count}`);
    });
    
    return lines.join('\n');
  }

  private buildKey(metric: string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return metric;
    }
    
    const tagString = Object.entries(tags)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}="${value}"`)
      .join(',');
      
    return `${metric}{${tagString}}`;
  }

  private sanitizeKey(key: string): string {
    // Remove sensitive information and limit length
    return key.replace(/[^a-zA-Z0-9_-]/g, '_').substring(0, 50);
  }
}

// Singleton instance
export const metricsCollector = new MetricsCollector();

// Express middleware to automatically record API metrics
export function metricsMiddleware() {
  return (req: any, res: any, next: any) => {
    const start = Date.now();
    
    res.on('finish', () => {
      const duration = Date.now() - start;
      const endpoint = req.route?.path || req.path;
      
      metricsCollector.recordAPICall(
        endpoint,
        req.method,
        res.statusCode,
        duration
      );
    });
    
    next();
  };
}