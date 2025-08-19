// Performance monitoring utility for ETF table rendering
export class PerformanceMonitor {
  private static instance: PerformanceMonitor;
  private metrics: Map<string, number[]> = new Map();

  static getInstance(): PerformanceMonitor {
    if (!PerformanceMonitor.instance) {
      PerformanceMonitor.instance = new PerformanceMonitor();
    }
    return PerformanceMonitor.instance;
  }

  startTiming(key: string): () => void {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const duration = endTime - startTime;
      
      if (!this.metrics.has(key)) {
        this.metrics.set(key, []);
      }
      
      const timings = this.metrics.get(key)!;
      timings.push(duration);
      
      // Keep only the last 10 measurements
      if (timings.length > 10) {
        timings.shift();
      }
      
      // Log performance regression if timing is significantly higher than average
      if (timings.length > 2) {
        const average = timings.reduce((a, b) => a + b, 0) / timings.length;
        if (duration > average * 2) {
          console.warn(`⚠️ Performance regression detected for ${key}: ${duration.toFixed(2)}ms (avg: ${average.toFixed(2)}ms)`);
        }
      }
    };
  }

  getMetrics(): Record<string, { avg: number; last: number; count: number }> {
    const result: Record<string, { avg: number; last: number; count: number }> = {};
    
    this.metrics.forEach((timings, key) => {
      if (timings.length > 0) {
        result[key] = {
          avg: timings.reduce((a, b) => a + b, 0) / timings.length,
          last: timings[timings.length - 1],
          count: timings.length
        };
      }
    });
    
    return result;
  }

  logSummary(): void {
    const metrics = this.getMetrics();
    console.log('🚀 ETF Table Performance Summary:', metrics);
  }
}