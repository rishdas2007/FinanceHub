/**
 * Performance Monitor Service Test Suite
 * Comprehensive tests for performance tracking, analytics, and recommendations
 * 
 * @author AI Agent Test Enhancement
 * @version 1.0.0
 * @since 2025-07-25
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PerformanceMonitor } from '../../server/services/performance-monitor';

describe('PerformanceMonitor', () => {
  let monitor: PerformanceMonitor;

  beforeEach(() => {
    // Reset singleton instance for clean testing
    (PerformanceMonitor as any).instance = undefined;
    monitor = PerformanceMonitor.getInstance();
    
    // Mock timers for consistent testing
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('Singleton Implementation', () => {
    it('should return the same instance on multiple calls', () => {
      const instance1 = PerformanceMonitor.getInstance();
      const instance2 = PerformanceMonitor.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should maintain state across getInstance calls', () => {
      const instance1 = PerformanceMonitor.getInstance();
      instance1.trackEndpoint('/test', 100, 200, 1.0);
      
      const instance2 = PerformanceMonitor.getInstance();
      const summary = instance2.getPerformanceSummary();
      
      expect(summary.totalRequests).toBe(1);
    });
  });

  describe('Endpoint Tracking', () => {
    it('should track basic endpoint metrics correctly', () => {
      monitor.trackEndpoint('/api/test', 250, 200, 0.5, 'GET', 2);
      
      const summary = monitor.getPerformanceSummary();
      
      expect(summary.totalRequests).toBe(1);
      expect(summary.averageResponseTime).toBe(250);
      expect(summary.errorRate).toBe(0);
    });

    it('should track multiple endpoints and calculate aggregates', () => {
      monitor.trackEndpoint('/api/fast', 100, 200, 0.2);
      monitor.trackEndpoint('/api/slow', 800, 200, 1.5);
      monitor.trackEndpoint('/api/error', 300, 500, 0.8);
      
      const summary = monitor.getPerformanceSummary();
      
      expect(summary.totalRequests).toBe(3);
      expect(summary.averageResponseTime).toBe(400); // (100 + 800 + 300) / 3
      expect(summary.errorRate).toBe(33.33); // 1 error out of 3 requests
    });

    it('should identify slow requests and log warnings', () => {
      const loggerSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      
      monitor.trackEndpoint('/api/very-slow', 2500, 200, 0.5);
      
      // Note: In a real test, you'd mock the logger properly
      // This is a simplified test for demonstration
      expect(loggerSpy).toHaveBeenCalled();
      loggerSpy.mockRestore();
    });

    it('should track error rates by status code', () => {
      // Success requests
      monitor.trackEndpoint('/api/test', 100, 200, 0.1);
      monitor.trackEndpoint('/api/test', 120, 201, 0.1);
      
      // Client errors
      monitor.trackEndpoint('/api/test', 80, 400, 0.1);
      monitor.trackEndpoint('/api/test', 90, 404, 0.1);
      
      // Server errors
      monitor.trackEndpoint('/api/test', 200, 500, 0.2);
      
      const summary = monitor.getPerformanceSummary();
      
      expect(summary.totalRequests).toBe(5);
      expect(summary.errorRate).toBe(60); // 3 errors out of 5 requests
    });
  });

  describe('Performance Analytics', () => {
    beforeEach(() => {
      // Create a dataset for testing analytics
      const testData = [
        { endpoint: '/api/fast', duration: 50, status: 200 },
        { endpoint: '/api/fast', duration: 60, status: 200 },
        { endpoint: '/api/medium', duration: 300, status: 200 },
        { endpoint: '/api/medium', duration: 350, status: 200 },
        { endpoint: '/api/slow', duration: 1500, status: 200 },
        { endpoint: '/api/slow', duration: 1800, status: 500 },
        { endpoint: '/api/error', duration: 100, status: 404 },
        { endpoint: '/api/error', duration: 120, status: 500 }
      ];

      testData.forEach(data => {
        monitor.trackEndpoint(data.endpoint, data.duration, data.status, 0.1);
      });
    });

    it('should calculate percentile response times correctly', () => {
      const summary = monitor.getPerformanceSummary();
      
      // Sorted durations: [50, 60, 100, 120, 300, 350, 1500, 1800]
      // P95 (95% of 8 = 7.6, so index 7): 1800
      // P99 (99% of 8 = 7.92, so index 7): 1800
      
      expect(summary.p95ResponseTime).toBe(1800);
      expect(summary.p99ResponseTime).toBe(1800);
    });

    it('should identify slowest endpoints correctly', () => {
      const summary = monitor.getPerformanceSummary();
      
      expect(summary.slowestEndpoints).toHaveLength(4);
      expect(summary.slowestEndpoints[0].endpoint).toBe('/api/slow');
      expect(summary.slowestEndpoints[0].averageTime).toBe(1650); // (1500 + 1800) / 2
      expect(summary.slowestEndpoints[0].errorRate).toBe(50); // 1 error out of 2 requests
    });

    it('should filter metrics by time range', () => {
      // Advance time by 2 hours
      vi.advanceTimersByTime(2 * 60 * 60 * 1000);
      
      // Add new metric
      monitor.trackEndpoint('/api/new', 100, 200, 0.1);
      
      // Get summary for last hour (should only include new metric)
      const summary = monitor.getPerformanceSummary(60 * 60 * 1000);
      
      expect(summary.totalRequests).toBe(1);
      expect(summary.slowestEndpoints[0].endpoint).toBe('/api/new');
    });
  });

  describe('Performance Recommendations', () => {
    it('should recommend action for high error rates', () => {
      // Create high error rate scenario
      for (let i = 0; i < 10; i++) {
        monitor.trackEndpoint('/api/failing', 100, 500, 0.1);
      }
      
      const summary = monitor.getPerformanceSummary();
      const recommendations = monitor.generateRecommendations(summary);
      
      const errorRateRec = recommendations.find(r => r.type === 'error_rate');
      expect(errorRateRec).toBeDefined();
      expect(errorRateRec?.severity).toBe('critical');
      expect(errorRateRec?.impact).toBeGreaterThan(80);
    });

    it('should recommend optimization for slow responses', () => {
      // Create slow response scenario
      for (let i = 0; i < 5; i++) {
        monitor.trackEndpoint('/api/slow', 3000, 200, 0.2);
      }
      
      const summary = monitor.getPerformanceSummary();
      const recommendations = monitor.generateRecommendations(summary);
      
      const responseTimeRec = recommendations.find(r => r.type === 'response_time');
      expect(responseTimeRec).toBeDefined();
      expect(responseTimeRec?.severity).toBe('critical');
    });

    it('should sort recommendations by impact', () => {
      // Create multiple issues
      monitor.trackEndpoint('/api/slow', 2500, 200, 0.1); // Slow response
      monitor.trackEndpoint('/api/error', 100, 500, 0.1); // High error rate
      
      const summary = monitor.getPerformanceSummary();
      const recommendations = monitor.generateRecommendations(summary);
      
      // Should be sorted by impact (descending)
      for (let i = 1; i < recommendations.length; i++) {
        expect(recommendations[i-1].impact).toBeGreaterThanOrEqual(recommendations[i].impact);
      }
    });
  });

  describe('Health Status', () => {
    it('should report healthy status with no issues', () => {
      monitor.trackEndpoint('/api/good', 200, 200, 0.5);
      
      const health = monitor.getHealthStatus();
      
      expect(health.status).toBe('healthy');
      expect(health.issues).toHaveLength(0);
      expect(health.uptime).toBeGreaterThan(0);
      expect(health.memoryUsage).toBeGreaterThan(0);
    });

    it('should report degraded status with minor issues', () => {
      // Create moderate issues
      monitor.trackEndpoint('/api/slowish', 1200, 200, 0.5);
      monitor.trackEndpoint('/api/error', 100, 400, 0.1);
      
      const health = monitor.getHealthStatus();
      
      expect(health.status).toBe('degraded');
      expect(health.issues.length).toBeGreaterThan(0);
    });

    it('should report unhealthy status with severe issues', () => {
      // Create severe issues
      for (let i = 0; i < 5; i++) {
        monitor.trackEndpoint('/api/broken', 5000, 500, 2.0);
      }
      
      const health = monitor.getHealthStatus();
      
      expect(health.status).toBe('unhealthy');
      expect(health.issues.length).toBeGreaterThan(0);
    });
  });

  describe('Memory Management', () => {
    it('should limit metrics per endpoint to prevent memory leaks', () => {
      const MAX_METRICS = 1000;
      
      // Add more than MAX_METRICS for one endpoint
      for (let i = 0; i < MAX_METRICS + 100; i++) {
        monitor.trackEndpoint('/api/test', 100, 200, 0.1);
      }
      
      const summary = monitor.getPerformanceSummary();
      
      // Should have processed all requests but only kept MAX_METRICS
      expect(summary.totalRequests).toBeLessThanOrEqual(MAX_METRICS);
    });

    it('should cleanup old metrics periodically', () => {
      // Add some metrics
      monitor.trackEndpoint('/api/old', 100, 200, 0.1);
      
      // Advance time by 3 hours (cleanup threshold is 2 hours)
      vi.advanceTimersByTime(3 * 60 * 60 * 1000);
      
      // Trigger cleanup (normally done by setInterval)
      (monitor as any).cleanupOldMetrics();
      
      const summary = monitor.getPerformanceSummary();
      expect(summary.totalRequests).toBe(0);
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty metrics gracefully', () => {
      const summary = monitor.getPerformanceSummary();
      
      expect(summary.totalRequests).toBe(0);
      expect(summary.averageResponseTime).toBe(0);
      expect(summary.errorRate).toBe(0);
      expect(summary.slowestEndpoints).toHaveLength(0);
    });

    it('should handle division by zero in calculations', () => {
      // This should not throw any errors
      const summary = monitor.getPerformanceSummary();
      const recommendations = monitor.generateRecommendations(summary);
      
      expect(summary).toBeDefined();
      expect(recommendations).toBeDefined();
      expect(Array.isArray(recommendations)).toBe(true);
    });

    it('should handle negative time ranges', () => {
      monitor.trackEndpoint('/api/test', 100, 200, 0.1);
      
      const summary = monitor.getPerformanceSummary(-1000);
      
      // Should still return valid summary
      expect(summary).toBeDefined();
      expect(summary.totalRequests).toBeGreaterThanOrEqual(0);
    });
  });
});