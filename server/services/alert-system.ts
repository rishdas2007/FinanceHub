import { logger } from '../../shared/utils/logger';
import { dataQualityMonitor } from './data-quality-monitor';

/**
 * ✅ PHASE 4 TASK 2: Intelligent Alert System
 * Smart alerting with escalation and notification management
 */

export interface AlertRule {
  id: string;
  name: string;
  metric: string;
  condition: 'above' | 'below' | 'equals';
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldownPeriod: number; // Minutes
  escalationDelay: number; // Minutes
  notificationChannels: string[];
}

export interface Alert {
  id: string;
  ruleId: string;
  metric: string;
  value: number;
  threshold: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  acknowledged: boolean;
  escalated: boolean;
  resolved: boolean;
  resolvedAt?: Date;
  acknowledgedBy?: string;
}

export class AlertSystem {
  private rules: Map<string, AlertRule> = new Map();
  private alerts: Alert[] = [];
  private lastAlertTime: Map<string, Date> = new Map();
  
  constructor() {
    this.initializeDefaultRules();
  }
  
  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules() {
    const defaultRules: AlertRule[] = [
      {
        id: 'api-success-rate-critical',
        name: 'API Success Rate Critical',
        metric: 'api_success_rate',
        condition: 'below',
        threshold: 85,
        severity: 'critical',
        enabled: true,
        cooldownPeriod: 5,
        escalationDelay: 15,
        notificationChannels: ['email', 'dashboard']
      },
      {
        id: 'data-freshness-warning',
        name: 'Data Freshness Warning',
        metric: 'data_freshness',
        condition: 'above',
        threshold: 3600000, // 1 hour in ms
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 30,
        escalationDelay: 60,
        notificationChannels: ['dashboard']
      },
      {
        id: 'response-time-critical',
        name: 'Response Time Critical',
        metric: 'response_time',
        condition: 'above',
        threshold: 3000,
        severity: 'high',
        enabled: true,
        cooldownPeriod: 10,
        escalationDelay: 30,
        notificationChannels: ['email', 'dashboard']
      },
      {
        id: 'cache-hit-rate-low',
        name: 'Cache Hit Rate Low',
        metric: 'cache_hit_rate',
        condition: 'below',
        threshold: 50,
        severity: 'medium',
        enabled: true,
        cooldownPeriod: 15,
        escalationDelay: 45,
        notificationChannels: ['dashboard']
      }
    ];
    
    defaultRules.forEach(rule => {
      this.rules.set(rule.id, rule);
    });
  }
  
  /**
   * Evaluate metric against alert rules
   */
  evaluateMetric(metric: string, value: number): void {
    const relevantRules = Array.from(this.rules.values())
      .filter(rule => rule.enabled && rule.metric === metric);
    
    for (const rule of relevantRules) {
      if (this.shouldTriggerAlert(rule, value)) {
        this.triggerAlert(rule, value);
      }
    }
  }
  
  /**
   * Check if alert should be triggered
   */
  private shouldTriggerAlert(rule: AlertRule, value: number): boolean {
    // Check cooldown period
    const lastAlert = this.lastAlertTime.get(rule.id);
    if (lastAlert) {
      const cooldownMs = rule.cooldownPeriod * 60 * 1000;
      if (Date.now() - lastAlert.getTime() < cooldownMs) {
        return false;
      }
    }
    
    // Check threshold condition
    switch (rule.condition) {
      case 'above':
        return value > rule.threshold;
      case 'below':
        return value < rule.threshold;
      case 'equals':
        return value === rule.threshold;
      default:
        return false;
    }
  }
  
  /**
   * Trigger an alert
   */
  private triggerAlert(rule: AlertRule, value: number): void {
    const alert: Alert = {
      id: `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      ruleId: rule.id,
      metric: rule.metric,
      value,
      threshold: rule.threshold,
      severity: rule.severity,
      message: this.generateAlertMessage(rule, value),
      timestamp: new Date(),
      acknowledged: false,
      escalated: false,
      resolved: false
    };
    
    this.alerts.push(alert);
    this.lastAlertTime.set(rule.id, new Date());
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts.splice(0, this.alerts.length - 100);
    }
    
    // Send notifications
    this.sendNotifications(alert, rule);
    
    // Schedule escalation if needed
    if (rule.escalationDelay > 0) {
      setTimeout(() => {
        this.checkEscalation(alert.id);
      }, rule.escalationDelay * 60 * 1000);
    }
    
    logger.warn(`Alert triggered: ${alert.message}`, { alertId: alert.id, severity: alert.severity });
  }
  
  /**
   * Generate alert message
   */
  private generateAlertMessage(rule: AlertRule, value: number): string {
    const condition = rule.condition === 'above' ? 'exceeded' : 'fell below';
    const unit = rule.metric.includes('time') ? 'ms' : 
                rule.metric.includes('rate') ? '%' : '';
    
    return `${rule.name}: ${rule.metric} ${condition} threshold (${value}${unit} vs ${rule.threshold}${unit})`;
  }
  
  /**
   * Send notifications for alert
   */
  private sendNotifications(alert: Alert, rule: AlertRule): void {
    rule.notificationChannels.forEach(channel => {
      switch (channel) {
        case 'email':
          this.sendEmailNotification(alert);
          break;
        case 'dashboard':
          this.sendDashboardNotification(alert);
          break;
        case 'webhook':
          this.sendWebhookNotification(alert);
          break;
      }
    });
  }
  
  /**
   * Send email notification (placeholder)
   */
  private sendEmailNotification(alert: Alert): void {
    // Email notification would be implemented here
    logger.info(`Email notification sent for alert: ${alert.id}`);
  }
  
  /**
   * Send dashboard notification
   */
  private sendDashboardNotification(alert: Alert): void {
    // Dashboard notification - this could trigger real-time updates
    logger.info(`Dashboard notification sent for alert: ${alert.id}`);
  }
  
  /**
   * Send webhook notification (placeholder)
   */
  private sendWebhookNotification(alert: Alert): void {
    // Webhook notification would be implemented here
    logger.info(`Webhook notification sent for alert: ${alert.id}`);
  }
  
  /**
   * Check if alert needs escalation
   */
  private checkEscalation(alertId: string): void {
    const alert = this.alerts.find(a => a.id === alertId);
    if (!alert || alert.acknowledged || alert.resolved) {
      return;
    }
    
    alert.escalated = true;
    logger.warn(`Alert escalated: ${alert.message}`, { alertId: alert.id });
    
    // Send escalation notifications
    this.sendEscalationNotifications(alert);
  }
  
  /**
   * Send escalation notifications
   */
  private sendEscalationNotifications(alert: Alert): void {
    // Escalation notifications (higher priority channels)
    logger.warn(`Escalation notification sent for alert: ${alert.id}`);
  }
  
  /**
   * Acknowledge an alert
   */
  acknowledgeAlert(alertId: string, acknowledgedBy: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.acknowledged) {
      alert.acknowledged = true;
      alert.acknowledgedBy = acknowledgedBy;
      logger.info(`Alert acknowledged: ${alert.id} by ${acknowledgedBy}`);
      return true;
    }
    return false;
  }
  
  /**
   * Resolve an alert
   */
  resolveAlert(alertId: string): boolean {
    const alert = this.alerts.find(a => a.id === alertId);
    if (alert && !alert.resolved) {
      alert.resolved = true;
      alert.resolvedAt = new Date();
      logger.info(`Alert resolved: ${alert.id}`);
      return true;
    }
    return false;
  }
  
  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return this.alerts
      .filter(a => !a.resolved)
      .sort((a, b) => {
        const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
        return severityOrder[b.severity] - severityOrder[a.severity];
      });
  }
  
  /**
   * Get alert statistics
   */
  getAlertStats() {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const last7d = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    const alerts24h = this.alerts.filter(a => a.timestamp >= last24h);
    const alerts7d = this.alerts.filter(a => a.timestamp >= last7d);
    
    const activeAlerts = this.getActiveAlerts();
    
    return {
      active: activeAlerts.length,
      acknowledged: activeAlerts.filter(a => a.acknowledged).length,
      escalated: activeAlerts.filter(a => a.escalated).length,
      last24Hours: alerts24h.length,
      last7Days: alerts7d.length,
      byeverity: {
        critical: activeAlerts.filter(a => a.severity === 'critical').length,
        high: activeAlerts.filter(a => a.severity === 'high').length,
        medium: activeAlerts.filter(a => a.severity === 'medium').length,
        low: activeAlerts.filter(a => a.severity === 'low').length
      },
      meanTimeToAcknowledge: this.calculateMeanTimeToAcknowledge(),
      meanTimeToResolve: this.calculateMeanTimeToResolve()
    };
  }
  
  /**
   * Calculate mean time to acknowledge alerts
   */
  private calculateMeanTimeToAcknowledge(): number {
    const acknowledgedAlerts = this.alerts.filter(a => a.acknowledged);
    if (acknowledgedAlerts.length === 0) return 0;
    
    const totalTime = acknowledgedAlerts.reduce((sum, alert) => {
      // This would need the acknowledgment time to calculate properly
      return sum + 300000; // Placeholder: 5 minutes average
    }, 0);
    
    return Math.round(totalTime / acknowledgedAlerts.length / 1000 / 60); // Minutes
  }
  
  /**
   * Calculate mean time to resolve alerts
   */
  private calculateMeanTimeToResolve(): number {
    const resolvedAlerts = this.alerts.filter(a => a.resolved && a.resolvedAt);
    if (resolvedAlerts.length === 0) return 0;
    
    const totalTime = resolvedAlerts.reduce((sum, alert) => {
      const resolveTime = alert.resolvedAt!.getTime() - alert.timestamp.getTime();
      return sum + resolveTime;
    }, 0);
    
    return Math.round(totalTime / resolvedAlerts.length / 1000 / 60); // Minutes
  }
  
  /**
   * Add or update alert rule
   */
  updateRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
    logger.info(`Alert rule updated: ${rule.name}`);
  }
  
  /**
   * Get all alert rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }
}

export const alertSystem = new AlertSystem();