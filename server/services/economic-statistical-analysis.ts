import { db } from '../db';
import { sql } from 'drizzle-orm';

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

const log = {
  info: (msg: string, ...args: any[]) => console.log(`[INFO] ${msg}`, ...args),
  error: (msg: string, ...args: any[]) => console.error(`[ERROR] ${msg}`, ...args)
};

export class EconomicStatisticalAnalysisService {
  private categoriesToAnalyze = [
    'Growth', 'Labor', 'Inflation', 'Monetary Policy', 'Sentiment'
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

      // Perform statistical analysis
      const analysisResults = this.analyzeEconomicData(economicData);
      
      log.info(`✅ Statistical analysis completed for ${Object.keys(analysisResults).length} categories`);
      
      return analysisResults;
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
      log.info(`📊 Raw query results type: ${typeof results}, length: ${results?.length}`);
      
      // Handle different result formats from Drizzle
      let rows;
      if (Array.isArray(results)) {
        rows = results;
      } else if (results && results.rows) {
        rows = results.rows;
      } else if (results && Array.isArray(results.data)) {
        rows = results.data;
      } else {
        log.error('❌ Unexpected result format:', results);
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

  private analyzeEconomicData(economicData: StatisticalData[]): AnalysisResults {
    const scriptAnalysisResults: AnalysisResults = {};

    // Process each category
    for (const category of this.categoriesToAnalyze) {
      const categoryData = economicData.filter(row => row.category === category);
      scriptAnalysisResults[category] = {};

      // Get unique metrics for this category
      const uniqueMetrics = [...new Set(categoryData.map(row => row.metric))];

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
            period_end_date: endDate.toISOString().split('T')[0]
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

          statistics = {
            mean,
            median,
            std,
            min: Math.min(...values),
            max: Math.max(...values),
            start_value: values[0],
            end_value: values[values.length - 1],
            period_start_date: new Date(trailing12MonthsData[0].period_date_desc).toISOString().split('T')[0],
            period_end_date: new Date(trailing12MonthsData[trailing12MonthsData.length - 1].period_date_desc).toISOString().split('T')[0]
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