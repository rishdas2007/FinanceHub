/**
 * Performance Budget Monitoring for FinanceHub Pro
 * Sets and enforces performance budgets for component render times
 */

import { logger } from '../utils/logger.js';

interface PerformanceBudget {
  name: string;
  maxResponseTime: number; // milliseconds
  maxMemoryUsage: number; // MB
  alertThreshold: number; // percentage of budget (0-1)
}

interface PerformanceMetric {
  timestamp: number;
  responseTime: number;
  memoryUsage: number;
  status: 'ok' | 'warning' | 'critical';
}

export class PerformanceBudgetMonitor {
  private budgets = new Map<string, PerformanceBudget>();
  private metrics = new Map<string, PerformanceMetric[]>();
  private readonly MAX_METRICS_HISTORY = 100;

  constructor() {
    this.initializeDefaultBudgets();
  }

  private initializeDefaultBudgets(): void {
    // ETF Metrics Performance Budget
    this.addBudget({
      name: 'etf-metrics',
      maxResponseTime: 500, // 500ms
      maxMemoryUsage: 50, // 50MB
      alertThreshold: 0.8 // Alert at 80% of budget
    });

    // Dashboard Load Performance Budget
    this.addBudget({
      name: 'dashboard-load',
      maxResponseTime: 2000, // 2 seconds
      maxMemoryUsage: 100, // 100MB
      alertThreshold: 0.75
    });

    // API Response Performance Budget
    this.addBudget({
      name: 'api-response',
      maxResponseTime: 300, // 300ms
      maxMemoryUsage: 25, // 25MB
      alertThreshold: 0.85
    });
  }

  addBudget(budget: PerformanceBudget): void {
    this.budgets.set(budget.name, budget);
    this.metrics.set(budget.name, []);
  }

  recordMetric(budgetName: string, responseTime: number, memoryUsage: number): void {
    const budget = this.budgets.get(budgetName);
    if (!budget) {
      logger.warn(`📊 Performance budget not found: ${budgetName}`);
      return;
    }

    const metric: PerformanceMetric = {
      timestamp: Date.now(),
      responseTime,
      memoryUsage,
      status: this.calculateStatus(budget, responseTime, memoryUsage)
    };

    const metrics = this.metrics.get(budgetName)!;
    metrics.push(metric);

    // Keep only recent metrics
    if (metrics.length > this.MAX_METRICS_HISTORY) {
      metrics.shift();
    }

    // Check for budget violations
    this.checkBudgetViolation(budget, metric);
  }

  private calculateStatus(budget: PerformanceBudget, responseTime: number, memoryUsage: number): 'ok' | 'warning' | 'critical' {
    const responseTimeRatio = responseTime / budget.maxResponseTime;
    const memoryRatio = memoryUsage / budget.maxMemoryUsage;
    const maxRatio = Math.max(responseTimeRatio, memoryRatio);

    if (maxRatio >= 1.0) return 'critical';
    if (maxRatio >= budget.alertThreshold) return 'warning';
    return 'ok';
  }

  private checkBudgetViolation(budget: PerformanceBudget, metric: PerformanceMetric): void {
    if (metric.status === 'critical') {
      logger.error(`🚨 Performance budget EXCEEDED for ${budget.name}:`, {
        responseTime: `${metric.responseTime}ms (budget: ${budget.maxResponseTime}ms)`,
        memoryUsage: `${metric.memoryUsage}MB (budget: ${budget.maxMemoryUsage}MB)`
      });
    } else if (metric.status === 'warning') {
      logger.warn(`⚠️ Performance budget WARNING for ${budget.name}:`, {
        responseTime: `${metric.responseTime}ms (${Math.round((metric.responseTime / budget.maxResponseTime) * 100)}% of budget)`,
        memoryUsage: `${metric.memoryUsage}MB (${Math.round((metric.memoryUsage / budget.maxMemoryUsage) * 100)}% of budget)`
      });
    }
  }

  getBudgetStatus(budgetName: string) {
    const budget = this.budgets.get(budgetName);
    const metrics = this.metrics.get(budgetName) || [];
    
    if (!budget) return null;

    const recentMetrics = metrics.slice(-10); // Last 10 measurements
    const averageResponseTime = recentMetrics.length > 0 
      ? recentMetrics.reduce((sum, m) => sum + m.responseTime, 0) / recentMetrics.length 
      : 0;
    const averageMemoryUsage = recentMetrics.length > 0
      ? recentMetrics.reduce((sum, m) => sum + m.memoryUsage, 0) / recentMetrics.length
      : 0;

    return {
      name: budget.name,
      budget,
      current: {
        averageResponseTime,
        averageMemoryUsage,
        status: this.calculateStatus(budget, averageResponseTime, averageMemoryUsage)
      },
      recentMetrics: recentMetrics.slice(-5) // Last 5 metrics
    };
  }

  getAllBudgetStatuses() {
    return Array.from(this.budgets.keys()).map(name => this.getBudgetStatus(name));
  }
}

// Global performance budget monitor
export const performanceBudgetMonitor = new PerformanceBudgetMonitor();