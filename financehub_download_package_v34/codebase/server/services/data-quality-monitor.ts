import { logger } from '../../shared/utils/logger';

/**
 * ✅ PHASE 4 TASK 1: Advanced Data Quality Monitoring
 * Real-time data quality validation and anomaly detection
 */

export interface DataQualityMetric {
  metric: string;
  value: number;
  threshold: number;
  status: 'healthy' | 'warning' | 'critical';
  lastChecked: Date;
  trend: 'improving' | 'stable' | 'degrading';
}

export interface DataQualityAlert {
  id: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  metric: string;
  message: string;
  value: number;
  threshold: number;
  timestamp: Date;
  resolved: boolean;
}

export class DataQualityMonitor {
  private metrics: Map<string, DataQualityMetric[]> = new Map();
  private alerts: DataQualityAlert[] = [];
  private thresholds: Map<string, { warning: number; critical: number }> = new Map();
  
  constructor() {
    this.initializeThresholds();
  }
  
  /**
   * Initialize default quality thresholds
   */
  private initializeThresholds() {
    this.thresholds.set('data_freshness', { warning: 3600000, critical: 7200000 }); // 1-2 hours
    this.thresholds.set('api_success_rate', { warning: 95, critical: 85 }); // Percentage
    this.thresholds.set('data_completeness', { warning: 95, critical: 90 }); // Percentage
    this.thresholds.set('calculation_accuracy', { warning: 99, critical: 95 }); // Percentage
    this.thresholds.set('response_time', { warning: 1000, critical: 3000 }); // Milliseconds
    this.thresholds.set('cache_hit_rate', { warning: 70, critical: 50 }); // Percentage
  }
  
  /**
   * Record data quality metric
   */
  recordMetric(
    category: string,
    metricName: string,
    value: number,
    unit: string = ''
  ): void {
    const fullMetricName = `${category}.${metricName}`;
    const threshold = this.thresholds.get(fullMetricName);
    
    if (!threshold) {
      logger.warn(`No threshold configured for metric: ${fullMetricName}`);
      return;
    }
    
    const status = this.determineStatus(value, threshold, metricName);
    const metric: DataQualityMetric = {
      metric: fullMetricName,
      value,
      threshold: threshold.critical,
      status,
      lastChecked: new Date(),
      trend: this.calculateTrend(fullMetricName, value)
    };
    
    // Store metric history (keep last 100 entries)
    const history = this.metrics.get(fullMetricName) || [];
    history.push(metric);
    if (history.length > 100) {
      history.splice(0, history.length - 100);
    }
    this.metrics.set(fullMetricName, history);
    
    // Generate alerts if needed
    if (status === 'warning' || status === 'critical') {
      this.generateAlert(metric, threshold);
    }
    
    logger.info(`Data quality metric recorded: ${fullMetricName} = ${value}${unit} (${status})`);
  }
  
  /**
   * Calculate trend based on historical data
   */
  private calculateTrend(metricName: string, currentValue: number): 'improving' | 'stable' | 'degrading' {
    const history = this.metrics.get(metricName) || [];
    if (history.length < 3) return 'stable';
    
    const recent = history.slice(-3);
    const values = recent.map(m => m.value);
    
    const trend = values[2] - values[0];
    const isPercentageMetric = metricName.includes('rate') || metricName.includes('completeness');
    
    if (isPercentageMetric) {
      // For percentage metrics, higher is better
      if (trend > 2) return 'improving';
      if (trend < -2) return 'degrading';
    } else {
      // For time-based metrics, lower is better
      if (trend < -100) return 'improving';
      if (trend > 100) return 'degrading';
    }
    
    return 'stable';
  }
  
  /**
   * Determine metric status based on thresholds
   */
  private determineStatus(
    value: number,
    threshold: { warning: number; critical: number },
    metricName: string
  ): 'healthy' | 'warning' | 'critical' {
    const isPercentageMetric = metricName.includes('rate') || metricName.includes('completeness');
    
    if (isPercentageMetric) {
      // For percentage metrics, lower values are worse
      if (value < threshold.critical) return 'critical';
      if (value < threshold.warning) return 'warning';
      return 'healthy';
    } else {
      // For time-based metrics, higher values are worse
      if (value > threshold.critical) return 'critical';
      if (value > threshold.warning) return 'warning';
      return 'healthy';
    }
  }
  
  /**
   * Generate alert for quality issues
   */
  private generateAlert(
    metric: DataQualityMetric,
    threshold: { warning: number; critical: number }
  ): void {
    const severity = metric.status === 'critical' ? 'critical' : 'medium';
    const alert: DataQualityAlert = {
      id: `${metric.metric}-${Date.now()}`,
      severity,
      metric: metric.metric,
      message: this.generateAlertMessage(metric, threshold),
      value: metric.value,
      threshold: metric.status === 'critical' ? threshold.critical : threshold.warning,
      timestamp: new Date(),
      resolved: false
    };
    
    this.alerts.push(alert);
    
    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts.splice(0, this.alerts.length - 50);
    }
    
    logger.warn(`Data quality alert generated: ${alert.message}`);
  }
  
  /**
   * Generate human-readable alert message
   */
  private generateAlertMessage(
    metric: DataQualityMetric,
    threshold: { warning: number; critical: number }
  ): string {
    const isPercentageMetric = metric.metric.includes('rate') || metric.metric.includes('completeness');
    const unit = isPercentageMetric ? '%' : 'ms';
    
    if (metric.status === 'critical') {
      return `CRITICAL: ${metric.metric} is ${metric.value}${unit}, below critical threshold of ${threshold.critical}${unit}`;
    } else {
      return `WARNING: ${metric.metric} is ${metric.value}${unit}, below warning threshold of ${threshold.warning}${unit}`;
    }
  }
  
  /**
   * Get current data quality overview
   */
  getQualityOverview() {
    const currentMetrics = new Map<string, DataQualityMetric>();
    
    // Get latest metric for each category
    for (const [metricName, history] of this.metrics.entries()) {
      if (history.length > 0) {
        currentMetrics.set(metricName, history[history.length - 1]);
      }
    }
    
    const healthyCount = Array.from(currentMetrics.values()).filter(m => m.status === 'healthy').length;
    const warningCount = Array.from(currentMetrics.values()).filter(m => m.status === 'warning').length;
    const criticalCount = Array.from(currentMetrics.values()).filter(m => m.status === 'critical').length;
    
    const overallHealth = criticalCount > 0 ? 'critical' : warningCount > 0 ? 'warning' : 'healthy';
    
    return {
      overallHealth,
      totalMetrics: currentMetrics.size,
      healthyCount,
      warningCount,
      criticalCount,
      healthScore: healthyCount > 0 ? Math.round((healthyCount / currentMetrics.size) * 100) : 0,
      activeAlerts: this.alerts.filter(a => !a.resolved).length,
      lastUpdated: new Date()
    };
  }
  
  /**
   * Get detailed metrics for a specific category
   */
  getMetricDetails(category?: string) {
    const filtered = category 
      ? Array.from(this.metrics.entries()).filter(([name]) => name.startsWith(category))
      : Array.from(this.metrics.entries());
      
    return filtered.map(([name, history]) => ({
      name,
      current: history[history.length - 1],
      history: history.slice(-10), // Last 10 entries
      trend: history.length > 1 ? history[history.length - 1].trend : 'stable'
    }));
  }
  
  /**
   * Get active alerts
   */
  getActiveAlerts() {
    return this.alerts
      .filter(a => !a.resolved)
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
  }
  
  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert) {
      alert.resolved = true;
      logger.info(`Data quality alert resolved: ${alert.id}`);
      return true;
    }
    return false;
  }
  
  /**
   * Update threshold for a metric
   */
  updateThreshold(
    metricName: string,
    warning: number,
    critical: number
  ): void {
    this.thresholds.set(metricName, { warning, critical });
    logger.info(`Updated thresholds for ${metricName}: warning=${warning}, critical=${critical}`);
  }
}

export const dataQualityMonitor = new DataQualityMonitor();