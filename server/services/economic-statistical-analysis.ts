import { db } from '../db';
import { sql } from 'drizzle-orm';
import { economicStatisticalAlerts } from '../../shared/schema';

interface StatisticalData {
  metric: string;
  category: string;
  value_numeric: number;
  period_date_desc: string;
  release_date_desc: string;
}

interface MetricStatistics {
  mean: number | null;
  median: number | null;
  std: number | null;
  min: number | null;
  max: number | null;
  start_value: number | null;
  end_value: number | null;
  period_start_date: string;
  period_end_date: string;
  z_score: number | null;
}

interface MetricAnalysis {
  statistics: MetricStatistics;
  trend: 'increasing' | 'decreasing' | 'stable' | 'not enough data';
  data_points_12_months: Array<{
    period_date_desc: string;
    value_numeric: number;
  }>;
}

interface CategoryAnalysis {
  [metric: string]: MetricAnalysis;
}

interface AnalysisResults {
  [category: string]: CategoryAnalysis;
}

interface AlertMetric {
  metric: string;
  category: string;
  currentValue: number;
  mean: number;
  std: number;
  zScore: number;
  trend: string;
  alertType: string;
  periodStartDate: string;
  periodEndDate: string;
}

const log = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args)
};

export class EconomicStatisticalAnalysisService {
  private categoriesToAnalyze = [
    'Growth', 'Labor', 'Inflation', 'Sentiment', 'Monetary Policy'
  ];

  async performStatisticalAnalysis(): Promise<AnalysisResults> {
    try {
      log.info('📊 Starting statistical analysis on economic indicators history...');
      
      // Fetch data from database
      const economicData = await this.fetchEconomicData();
      
      if (economicData.length === 0) {
        log.error('❌ No economic data found in database');
        return {};
      }

      log.info(`✅ Fetched ${economicData.length} economic data points from database`);

      // Perform statistical analysis on all data
      const fullAnalysisResults = this.analyzeEconomicData(economicData);
      
      // Store all statistics to database and filter for alerts (>1 std dev)
      const alertResults = await this.processAlertsAndFilter(fullAnalysisResults);
      
      log.info(`✅ Statistical analysis completed for ${Object.keys(fullAnalysisResults).length} categories, showing ${Object.keys(alertResults).reduce((count, cat) => count + Object.keys(alertResults[cat]).length, 0)} alert metrics`);
      
      return alertResults;
    } catch (error) {
      log.error('❌ Error performing statistical analysis:', error);
      return {};
    }
  }

  private async fetchEconomicData(): Promise<StatisticalData[]> {
    try {
      const query = sql`
        SELECT 
          metric_name as metric,
          category,
          value::numeric as value_numeric,
          TO_CHAR(period_date, 'Mon DD, YYYY') as period_date_desc,
          TO_CHAR(release_date, 'Mon DD, YYYY') as release_date_desc
        FROM economic_indicators_history
        WHERE period_date >= CURRENT_DATE - INTERVAL '18 months'
          AND value IS NOT NULL
          AND value::numeric > 0
        ORDER BY category, metric_name, period_date DESC
      `;
      
      const results = await db.execute(query);
      log.info(`📊 Raw query results type: ${typeof results}`);
      
      // Handle Drizzle query result format
      const rows = (results as any).rows || (results as any) || [];
      
      if (!Array.isArray(rows)) {
        log.error('❌ Query results not in expected array format');
        return [];
      }

      log.info(`📊 Processing ${rows.length} rows from database`);

      return rows.map((row: any) => ({
        metric: row.metric,
        category: row.category,
        value_numeric: parseFloat(row.value_numeric?.toString() || '0'),
        period_date_desc: row.period_date_desc || '',
        release_date_desc: row.release_date_desc || '',
      }));
    } catch (error) {
      log.error('❌ Error fetching economic data from database:', error);
      return [];
    }
  }

  private async processAlertsAndFilter(fullResults: AnalysisResults): Promise<AnalysisResults> {
    try {
      // Clear existing alerts
      await db.execute(sql`DELETE FROM economic_statistical_alerts WHERE is_active = true`);
      
      const alertResults: AnalysisResults = {};
      const alertsToInsert: AlertMetric[] = [];

      // Process each category and metric
      for (const [category, categoryAnalysis] of Object.entries(fullResults)) {
        for (const [metric, analysis] of Object.entries(categoryAnalysis)) {
          const stats = analysis.statistics;
          
          if (stats.mean !== null && stats.std !== null && stats.end_value !== null) {
            // Calculate z-score for current (end) value
            const zScore = (stats.end_value - stats.mean) / stats.std;
            const absZScore = Math.abs(zScore);
            
            // Store all metrics to database
            const alertMetric: AlertMetric = {
              metric,
              category,
              currentValue: stats.end_value,
              mean: stats.mean,
              std: stats.std,
              zScore,
              trend: analysis.trend,
              alertType: this.getAlertType(zScore),
              periodStartDate: stats.period_start_date,
              periodEndDate: stats.period_end_date
            };
            
            alertsToInsert.push(alertMetric);
            
            // Only include in results if >1 standard deviation from mean
            if (absZScore > 1.0) {
              if (!alertResults[category]) {
                alertResults[category] = {};
              }
              alertResults[category][metric] = analysis;
              log.info(`🚨 Alert: ${metric} (${category}) - Z-Score: ${zScore.toFixed(2)} (${absZScore > 2 ? 'EXTREME' : 'MODERATE'} deviation)`);
            }
          }
        }
      }

      // Insert all alerts to database
      if (alertsToInsert.length > 0) {
        for (const alert of alertsToInsert) {
          await db.execute(sql`
            INSERT INTO economic_statistical_alerts 
            (metric_name, category, current_value, mean, std, z_score, trend, alert_type, period_start_date, period_end_date)
            VALUES (${alert.metric}, ${alert.category}, ${alert.currentValue}, ${alert.mean}, ${alert.std}, ${alert.zScore}, ${alert.trend}, ${alert.alertType}, ${alert.periodStartDate}, ${alert.periodEndDate})
          `);
        }
        log.info(`💾 Stored ${alertsToInsert.length} statistical analyses to database`);
      }

      return alertResults;
    } catch (error) {
      log.error('❌ Error processing alerts and filtering:', error);
      return fullResults; // Return all results if alert processing fails
    }
  }

  private getAlertType(zScore: number): string {
    const abs = Math.abs(zScore);
    if (abs > 2) {
      return zScore > 0 ? 'above_2std' : 'below_2std';
    } else if (abs > 1) {
      return zScore > 0 ? 'above_1std' : 'below_1std';
    }
    return 'normal';
  }

  private analyzeEconomicData(economicData: StatisticalData[]): AnalysisResults {
    const scriptAnalysisResults: AnalysisResults = {};

    // Process each category
    for (const category of this.categoriesToAnalyze) {
      const categoryData = economicData.filter(row => row.category === category);
      scriptAnalysisResults[category] = {};

      // Get unique metrics for this category
      const uniqueMetrics = Array.from(new Set(categoryData.map(row => row.metric)));

      for (const metric of uniqueMetrics) {
        const metricData = categoryData
          .filter(row => row.metric === metric)
          .sort((a, b) => new Date(b.release_date_desc).getTime() - new Date(a.release_date_desc).getTime());

        if (metricData.length === 0) {
          continue;
        }

        // Find latest release date and corresponding period date
        const latestReleaseDate = metricData[0].release_date_desc;
        const latestReadings = metricData.filter(row => row.release_date_desc === latestReleaseDate);
        const latestPeriodDate = latestReadings
          .sort((a, b) => new Date(b.period_date_desc).getTime() - new Date(a.period_date_desc).getTime())[0]
          .period_date_desc;

        // Calculate 12-month trailing window
        const endDate = new Date(latestPeriodDate);
        const startDate = new Date(endDate);
        startDate.setMonth(startDate.getMonth() - 11);

        // Filter data for trailing 12 months
        const trailing12MonthsData = metricData
          .filter(row => {
            const periodDate = new Date(row.period_date_desc);
            return periodDate >= startDate && periodDate <= endDate;
          })
          .sort((a, b) => new Date(a.period_date_desc).getTime() - new Date(b.period_date_desc).getTime());

        const values = trailing12MonthsData.map(row => row.value_numeric);

        let statistics: MetricStatistics;
        let trend: 'increasing' | 'decreasing' | 'stable' | 'not enough data';

        if (values.length === 0) {
          statistics = {
            mean: null,
            median: null,
            std: null,
            min: null,
            max: null,
            start_value: null,
            end_value: null,
            period_start_date: startDate.toISOString().split('T')[0],
            period_end_date: endDate.toISOString().split('T')[0],
            z_score: null
          };
          trend = 'not enough data';
        } else {
          const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
          const sortedValues = [...values].sort((a, b) => a - b);
          const median = sortedValues.length % 2 === 0
            ? (sortedValues[sortedValues.length / 2 - 1] + sortedValues[sortedValues.length / 2]) / 2
            : sortedValues[Math.floor(sortedValues.length / 2)];
          
          const variance = values.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / values.length;
          const std = Math.sqrt(variance);
          
          const currentValue = values[values.length - 1];
          let zScore: number | null = null;
          
          // Calculate Z-score
          if (std !== null && std !== 0) {
            zScore = (currentValue - mean) / std;
          } else if (std === 0 && currentValue === mean) {
            zScore = 0.0; // If std is 0 and value is the mean, z-score is 0
          }
          // If std is 0 and value is not the mean, z-score remains null (undefined)

          statistics = {
            mean,
            median,
            std,
            min: Math.min(...values),
            max: Math.max(...values),
            start_value: values[0],
            end_value: values[values.length - 1],
            period_start_date: new Date(trailing12MonthsData[0].period_date_desc).toISOString().split('T')[0],
            period_end_date: new Date(trailing12MonthsData[trailing12MonthsData.length - 1].period_date_desc).toISOString().split('T')[0],
            z_score: zScore
          };

          // Determine trend
          if (statistics.end_value! > statistics.start_value!) {
            trend = 'increasing';
          } else if (statistics.end_value! < statistics.start_value!) {
            trend = 'decreasing';
          } else {
            trend = 'stable';
          }
        }

        scriptAnalysisResults[category][metric] = {
          statistics,
          trend,
          data_points_12_months: trailing12MonthsData.map(row => ({
            period_date_desc: row.period_date_desc,
            value_numeric: row.value_numeric
          }))
        };
      }
    }

    return scriptAnalysisResults;
  }
}

export const economicStatisticalAnalysisService = new EconomicStatisticalAnalysisService();