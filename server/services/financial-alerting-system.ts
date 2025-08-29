/**
 * Financial Alerting System - Business-Critical Financial Data Monitoring
 * 
 * @class FinancialAlertingSystem
 * @description Extends the base alert system with financial market-specific alerting
 * capabilities including ETF data quality monitoring, Z-score anomaly detection,
 * economic data freshness alerts, and market dependency health monitoring.
 * 
 * @author AI Agent Financial Enhancement
 * @version 1.0.0
 * @since 2025-08-29
 */

import { logger } from '../../shared/utils/logger';
import { alertSystem, AlertRule, Alert } from './alert-system';
import { productionMetricsStorage } from './production-metrics-storage';

export interface FinancialAlert extends Alert {
  symbol?: string;
  indicator?: string;
  marketImpact: 'low' | 'medium' | 'high' | 'critical';
  dataSource: 'TWELVE_DATA' | 'FRED' | 'INTERNAL' | 'CALCULATED';
  businessContext: string;
}

export interface MarketHealthMetrics {
  etfDataFreshness: { [symbol: string]: number }; // minutes since last update
  apiSuccessRates: { [provider: string]: number }; // success rate percentage
  zScoreAnomalies: { symbol: string; indicator: string; value: number; zscore: number }[];
  cachePerformance: { hitRate: number; avgResponseTime: number };
  economicDataAge: { [indicator: string]: number }; // hours since last update
}

export interface FinancialMetricThreshold {
  metric: string;
  symbol?: string;
  indicator?: string;
  warningThreshold: number;
  criticalThreshold: number;
  unit: string;
  businessRule: string;
}

export class FinancialAlertingSystem {
  private static instance: FinancialAlertingSystem;
  private financialAlerts: FinancialAlert[] = [];
  private financialThresholds: Map<string, FinancialMetricThreshold> = new Map();
  private marketHealthCache: MarketHealthMetrics | null = null;
  private lastHealthCheck: Date | null = null;

  private constructor() {
    this.initializeFinancialThresholds();
    this.setupFinancialAlertRules();
    this.startMarketHealthMonitoring();
  }

  static getInstance(): FinancialAlertingSystem {
    if (!FinancialAlertingSystem.instance) {
      FinancialAlertingSystem.instance = new FinancialAlertingSystem();
    }
    return FinancialAlertingSystem.instance;
  }

  /**
   * Initialize financial-specific metric thresholds
   */
  private initializeFinancialThresholds(): void {
    const thresholds: FinancialMetricThreshold[] = [
      {
        metric: 'etf_data_freshness',
        warningThreshold: 10,
        criticalThreshold: 30,
        unit: 'minutes',
        businessRule: 'ETF data must be fresh for accurate trading signals'
      },
      {
        metric: 'zscore_anomaly',
        warningThreshold: 3.0,
        criticalThreshold: 4.0,
        unit: 'standard deviations',
        businessRule: 'Z-scores beyond 3σ indicate potential data quality issues'
      },
      {
        metric: 'api_success_rate',
        warningThreshold: 95,
        criticalThreshold: 85,
        unit: 'percentage',
        businessRule: 'External API reliability critical for real-time data'
      },
      {
        metric: 'cache_hit_rate',
        warningThreshold: 70,
        criticalThreshold: 50,
        unit: 'percentage',
        businessRule: 'Cache performance directly impacts user experience'
      },
      {
        metric: 'economic_data_freshness',
        warningThreshold: 48,
        criticalThreshold: 168,
        unit: 'hours',
        businessRule: 'Economic indicators must be current for accurate analysis'
      },
      {
        metric: 'trading_signal_reliability',
        warningThreshold: 90,
        criticalThreshold: 80,
        unit: 'percentage',
        businessRule: 'Trading signals must be reliable for user trust'
      }
    ];

    thresholds.forEach(threshold => {
      this.financialThresholds.set(threshold.metric, threshold);
    });

    logger.info(`Initialized ${thresholds.length} financial metric thresholds`);
  }

  /**
   * Setup financial-specific alert rules in the base system
   */
  private setupFinancialAlertRules(): void {
    const financialRules: AlertRule[] = [
      {
        id: 'etf-data-stale-critical',
        name: 'ETF Data Critically Stale',
        metric: 'etf_data_freshness_minutes',
        condition: 'above',
        threshold: 30,
        severity: 'critical',
        enabled: true,
        cooldownPeriod: 5,
        escalationDelay: 10,
        notificationChannels: ['email', 'dashboard', 'webhook']
      },
      {
        id: 'zscore-anomaly-high',
        name: 'Z-Score Statistical Anomaly',
        metric: 'zscore_anomaly_value',
        condition: 'above',
        threshold: 3.5,
        severity: 'high',
        enabled: true,
        cooldownPeriod: 15,
        escalationDelay: 30,
        notificationChannels: ['dashboard', 'webhook']
      },
      {
        id: 'twelve-data-api-degraded',
        name: 'Twelve Data API Degraded',
        metric: 'twelve_data_success_rate',
        condition: 'below',
        threshold: 90,
        severity: 'high',
        enabled: true,
        cooldownPeriod: 10,
        escalationDelay: 20,
        notificationChannels: ['email', 'dashboard']
      },
      {
        id: 'fred-api-failure',
        name: 'FRED API Service Failure',
        metric: 'fred_api_success_rate',
        condition: 'below',
        threshold: 80,
        severity: 'critical',
        enabled: true,
        cooldownPeriod: 5,
        escalationDelay: 15,
        notificationChannels: ['email', 'dashboard', 'webhook']
      },
      {
        id: 'cache-performance-degraded',
        name: 'Cache Performance Degraded',
        metric: 'cache_hit_rate',
        condition: 'below',
        threshold: 60,
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 20,
        escalationDelay: 60,
        notificationChannels: ['dashboard']
      },
      {
        id: 'economic-data-outdated',
        name: 'Economic Data Outdated',
        metric: 'economic_data_age_hours',
        condition: 'above',
        threshold: 72,
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 60,
        escalationDelay: 120,
        notificationChannels: ['dashboard', 'email']
      }
    ];

    // Register rules with the base alert system
    financialRules.forEach(rule => {
      alertSystem.updateRule(rule);
    });

    logger.info(`Registered ${financialRules.length} financial alert rules`);
  }

  /**
   * Monitor market health and trigger alerts
   */
  async checkMarketHealth(): Promise<MarketHealthMetrics> {
    try {
      const healthMetrics: MarketHealthMetrics = {
        etfDataFreshness: await this.checkETFDataFreshness(),
        apiSuccessRates: await this.checkAPISuccessRates(),
        zScoreAnomalies: await this.detectZScoreAnomalies(),
        cachePerformance: await this.checkCachePerformance(),
        economicDataAge: await this.checkEconomicDataAge()
      };

      this.marketHealthCache = healthMetrics;
      this.lastHealthCheck = new Date();

      // Evaluate metrics against thresholds
      await this.evaluateHealthMetrics(healthMetrics);

      return healthMetrics;
    } catch (error) {
      logger.error('Market health check failed', { error });
      throw error;
    }
  }

  /**
   * Check freshness of ETF data for all tracked symbols
   */
  private async checkETFDataFreshness(): Promise<{ [symbol: string]: number }> {
    const etfSymbols = ['SPY', 'XLK', 'XLF', 'XLV', 'XLE', 'XLI', 'XLB', 'XLP', 'XLY', 'XLU', 'XLRE', 'XLC'];
    const freshness: { [symbol: string]: number } = {};

    try {
      // Query metrics storage for last ETF data update per symbol
      const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
      
      for (const symbol of etfSymbols) {
        try {
          const metrics = await productionMetricsStorage.queryMetrics({
            metricName: 'etf_data_update',
            startTime: twentyFourHoursAgo,
            endTime: new Date(),
            tags: { symbol },
            limit: 1
          });

          if (metrics.length > 0) {
            const lastUpdate = metrics[0].timestamp;
            const minutesSinceUpdate = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60));
            freshness[symbol] = minutesSinceUpdate;

            // Trigger metric evaluation
            alertSystem.evaluateMetric('etf_data_freshness_minutes', minutesSinceUpdate);
          } else {
            freshness[symbol] = 999; // No data found
            alertSystem.evaluateMetric('etf_data_freshness_minutes', 999);
          }
        } catch (error) {
          freshness[symbol] = 999; // Error retrieving data
        }
      }

      return freshness;
    } catch (error) {
      logger.error('Failed to check ETF data freshness', { error });
      return {};
    }
  }

  /**
   * Check API success rates for external dependencies
   */
  private async checkAPISuccessRates(): Promise<{ [provider: string]: number }> {
    const providers = ['TWELVE_DATA', 'FRED'];
    const successRates: { [provider: string]: number } = {};
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);

    try {
      for (const provider of providers) {
        const successMetrics = await productionMetricsStorage.queryMetrics({
          metricName: 'api_call_success',
          startTime: lastHour,
          endTime: new Date(),
          tags: { provider }
        });

        const failureMetrics = await productionMetricsStorage.queryMetrics({
          metricName: 'api_call_failure',
          startTime: lastHour,
          endTime: new Date(),
          tags: { provider }
        });

        const totalCalls = successMetrics.length + failureMetrics.length;
        const successRate = totalCalls > 0 ? (successMetrics.length / totalCalls) * 100 : 100;
        
        successRates[provider] = Math.round(successRate * 100) / 100;

        // Trigger metric evaluation
        const metricName = provider === 'TWELVE_DATA' ? 'twelve_data_success_rate' : 'fred_api_success_rate';
        alertSystem.evaluateMetric(metricName, successRate);
      }

      return successRates;
    } catch (error) {
      logger.error('Failed to check API success rates', { error });
      return {};
    }
  }

  /**
   * Detect statistical anomalies in Z-score calculations
   */
  private async detectZScoreAnomalies(): Promise<{ symbol: string; indicator: string; value: number; zscore: number }[]> {
    const anomalies: { symbol: string; indicator: string; value: number; zscore: number }[] = [];
    const lastFourHours = new Date(Date.now() - 4 * 60 * 60 * 1000);

    try {
      // Query for recent Z-score calculations
      const zscoreMetrics = await productionMetricsStorage.queryMetrics({
        metricName: 'zscore_calculated',
        startTime: lastFourHours,
        endTime: new Date(),
        limit: 1000
      });

      for (const metric of zscoreMetrics) {
        const { symbol, indicator } = metric.tags;
        const zscoreValue = Math.abs(metric.value);

        // Check for statistical anomalies (|Z-score| > 3.5)
        if (zscoreValue > 3.5) {
          anomalies.push({
            symbol,
            indicator,
            value: metric.value,
            zscore: zscoreValue
          });

          // Trigger alert for extreme anomalies
          if (zscoreValue > 4.0) {
            alertSystem.evaluateMetric('zscore_anomaly_value', zscoreValue);
            
            // Create financial-specific alert
            await this.createFinancialAlert({
              ruleId: 'zscore-extreme-anomaly',
              metric: 'zscore_anomaly_value',
              value: zscoreValue,
              threshold: 4.0,
              severity: 'critical',
              message: `Extreme Z-score anomaly detected: ${symbol} ${indicator} = ${zscoreValue.toFixed(2)}`,
              timestamp: new Date(),
              acknowledged: false,
              escalated: false,
              resolved: false,
              symbol,
              indicator,
              marketImpact: 'high',
              dataSource: 'CALCULATED',
              businessContext: `Z-score of ${zscoreValue.toFixed(2)} indicates potential data quality issue or extreme market condition`
            });
          }
        }
      }

      return anomalies;
    } catch (error) {
      logger.error('Failed to detect Z-score anomalies', { error });
      return [];
    }
  }

  /**
   * Check cache performance metrics
   */
  private async checkCachePerformance(): Promise<{ hitRate: number; avgResponseTime: number }> {
    const lastHour = new Date(Date.now() - 60 * 60 * 1000);

    try {
      const hitMetrics = await productionMetricsStorage.queryMetrics({
        metricName: 'cache_hit',
        startTime: lastHour,
        endTime: new Date()
      });

      const missMetrics = await productionMetricsStorage.queryMetrics({
        metricName: 'cache_miss',
        startTime: lastHour,
        endTime: new Date()
      });

      const responseTimeMetrics = await productionMetricsStorage.queryMetrics({
        metricName: 'cache_response_time',
        startTime: lastHour,
        endTime: new Date()
      });

      const totalRequests = hitMetrics.length + missMetrics.length;
      const hitRate = totalRequests > 0 ? (hitMetrics.length / totalRequests) * 100 : 100;
      
      const avgResponseTime = responseTimeMetrics.length > 0 
        ? responseTimeMetrics.reduce((sum, m) => sum + m.value, 0) / responseTimeMetrics.length
        : 0;

      // Evaluate against thresholds
      alertSystem.evaluateMetric('cache_hit_rate', hitRate);

      return {
        hitRate: Math.round(hitRate * 100) / 100,
        avgResponseTime: Math.round(avgResponseTime * 100) / 100
      };
    } catch (error) {
      logger.error('Failed to check cache performance', { error });
      return { hitRate: 0, avgResponseTime: 0 };
    }
  }

  /**
   * Check age of economic data indicators
   */
  private async checkEconomicDataAge(): Promise<{ [indicator: string]: number }> {
    const indicators = ['GDP', 'CPI', 'PAYEMS', 'UNRATE', 'DGS10', 'DGS3MO'];
    const dataAge: { [indicator: string]: number } = {};
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    try {
      for (const indicator of indicators) {
        const metrics = await productionMetricsStorage.queryMetrics({
          metricName: 'economic_data_update',
          startTime: sevenDaysAgo,
          endTime: new Date(),
          tags: { indicator },
          limit: 1
        });

        if (metrics.length > 0) {
          const lastUpdate = metrics[0].timestamp;
          const hoursSinceUpdate = Math.floor((Date.now() - lastUpdate.getTime()) / (1000 * 60 * 60));
          dataAge[indicator] = hoursSinceUpdate;

          // Evaluate against thresholds
          alertSystem.evaluateMetric('economic_data_age_hours', hoursSinceUpdate);
        } else {
          dataAge[indicator] = 999; // No recent data found
        }
      }

      return dataAge;
    } catch (error) {
      logger.error('Failed to check economic data age', { error });
      return {};
    }
  }

  /**
   * Evaluate health metrics against thresholds
   */
  private async evaluateHealthMetrics(metrics: MarketHealthMetrics): Promise<void> {
    // ETF Data Freshness Evaluation
    Object.entries(metrics.etfDataFreshness).forEach(([symbol, minutes]) => {
      const threshold = this.financialThresholds.get('etf_data_freshness')!;
      if (minutes > threshold.criticalThreshold) {
        this.createFinancialAlert({
          ruleId: 'etf-data-stale',
          metric: 'etf_data_freshness',
          value: minutes,
          threshold: threshold.criticalThreshold,
          severity: 'critical',
          message: `ETF data for ${symbol} is ${minutes} minutes stale`,
          timestamp: new Date(),
          acknowledged: false,
          escalated: false,
          resolved: false,
          symbol,
          marketImpact: 'high',
          dataSource: 'TWELVE_DATA',
          businessContext: 'Stale ETF data affects trading signal accuracy'
        });
      }
    });

    // Cache Performance Evaluation
    if (metrics.cachePerformance.hitRate < this.financialThresholds.get('cache_hit_rate')!.criticalThreshold) {
      this.createFinancialAlert({
        ruleId: 'cache-performance-critical',
        metric: 'cache_hit_rate',
        value: metrics.cachePerformance.hitRate,
        threshold: this.financialThresholds.get('cache_hit_rate')!.criticalThreshold,
        severity: 'high',
        message: `Cache hit rate critically low: ${metrics.cachePerformance.hitRate.toFixed(1)}%`,
        timestamp: new Date(),
        acknowledged: false,
        escalated: false,
        resolved: false,
        marketImpact: 'medium',
        dataSource: 'INTERNAL',
        businessContext: 'Poor cache performance impacts user experience and API costs'
      });
    }
  }

  /**
   * Create financial-specific alert
   */
  private async createFinancialAlert(alert: Partial<FinancialAlert> & {
    ruleId: string;
    metric: string;
    value: number;
    threshold: number;
    severity: 'low' | 'medium' | 'high' | 'critical';
    message: string;
  }): Promise<void> {
    const financialAlert: FinancialAlert = {
      id: `fin-alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: alert.ruleId,
      metric: alert.metric,
      value: alert.value,
      threshold: alert.threshold,
      severity: alert.severity,
      message: alert.message,
      timestamp: alert.timestamp || new Date(),
      acknowledged: false,
      escalated: false,
      resolved: false,
      symbol: alert.symbol,
      indicator: alert.indicator,
      marketImpact: alert.marketImpact || 'medium',
      dataSource: alert.dataSource || 'INTERNAL',
      businessContext: alert.businessContext || 'Financial data quality issue detected'
    };

    this.financialAlerts.push(financialAlert);

    // Store alert metric for tracking
    await productionMetricsStorage.storeMetric({
      timestamp: financialAlert.timestamp,
      metricName: 'financial_alert_created',
      value: 1,
      tags: {
        severity: financialAlert.severity,
        metric: financialAlert.metric,
        symbol: financialAlert.symbol || 'unknown',
        dataSource: financialAlert.dataSource
      },
      metadata: {
        message: financialAlert.message,
        businessContext: financialAlert.businessContext
      }
    });

    logger.warn(`Financial alert created: ${financialAlert.message}`, {
      alertId: financialAlert.id,
      severity: financialAlert.severity,
      symbol: financialAlert.symbol,
      marketImpact: financialAlert.marketImpact
    });
  }

  /**
   * Start market health monitoring background process
   */
  private startMarketHealthMonitoring(): void {
    // Check market health every 5 minutes
    setInterval(() => {
      this.checkMarketHealth().catch(error => {
        logger.error('Market health monitoring failed', { error });
      });
    }, 5 * 60 * 1000); // 5 minutes

    // Initial health check after 30 seconds
    setTimeout(() => {
      this.checkMarketHealth().catch(error => {
        logger.error('Initial market health check failed', { error });
      });
    }, 30000);

    logger.info('Market health monitoring started - checking every 5 minutes');
  }

  /**
   * Get active financial alerts
   */
  getActiveFinancialAlerts(): FinancialAlert[] {
    return this.financialAlerts
      .filter(alert => !alert.resolved)
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
  }

  /**
   * Get financial alert statistics
   */
  getFinancialAlertStats(): any {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const activeAlerts = this.getActiveFinancialAlerts();

    return {
      active: {
        total: activeAlerts.length,
        critical: activeAlerts.filter(a => a.severity === 'critical').length,
        high: activeAlerts.filter(a => a.severity === 'high').length,
        medium: activeAlerts.filter(a => a.severity === 'medium').length
      },
      last24Hours: {
        total: this.financialAlerts.filter(a => a.timestamp >= last24h).length,
        byDataSource: this.financialAlerts
          .filter(a => a.timestamp >= last24h)
          .reduce((acc, alert) => {
            acc[alert.dataSource] = (acc[alert.dataSource] || 0) + 1;
            return acc;
          }, {} as { [source: string]: number })
      },
      marketHealth: this.marketHealthCache,
      lastHealthCheck: this.lastHealthCheck?.toISOString()
    };
  }

  /**
   * Acknowledge financial alert
   */
  acknowledgeFinancialAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.financialAlerts.find(a => a.id === alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      
      // Store acknowledgment metric
      productionMetricsStorage.storeMetric({
        timestamp: new Date(),
        metricName: 'financial_alert_acknowledged',
        value: 1,
        tags: {
          alertId,
          severity: alert.severity,
          acknowledgedBy
        }
      }).catch(error => {
        logger.error('Failed to store alert acknowledgment metric', { error });
      });

      logger.info(`Financial alert acknowledged: ${alertId} by ${acknowledgedBy}`);
      return true;
    }
    return false;
  }

  /**
   * Resolve financial alert
   */
  resolveFinancialAlert(alertId: string): boolean {
    const alert = this.financialAlerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();

      // Store resolution metric
      productionMetricsStorage.storeMetric({
        timestamp: new Date(),
        metricName: 'financial_alert_resolved',
        value: 1,
        tags: {
          alertId,
          severity: alert.severity,
          symbol: alert.symbol || 'unknown'
        }
      }).catch(error => {
        logger.error('Failed to store alert resolution metric', { error });
      });

      logger.info(`Financial alert resolved: ${alertId}`);
      return true;
    }
    return false;
  }
}

// Export singleton instance
export const financialAlertingSystem = FinancialAlertingSystem.getInstance();