import { logger } from '../../shared/utils/logger';
import { db } from '../db';
import { eq, desc, max, sql } from 'drizzle-orm';

interface DataFreshnessCheck {
  seriesId: string;
  label: string;
  lastDataPoint: Date;
  expectedNextRelease: Date;
  isStale: boolean;
  staleDays: number;
  severity: 'OK' | 'WARNING' | 'CRITICAL';
}

export class EconomicDataFreshnessMonitor {
  private readonly ECONOMIC_RELEASE_SCHEDULE = {
    'PPIACO': { frequency: 'monthly', dayOfMonth: 'second_tuesday', time: '08:30' },
    'PPIFIS': { frequency: 'monthly', dayOfMonth: 'second_tuesday', time: '08:30' },
    'PPIFGS': { frequency: 'monthly', dayOfMonth: 'second_tuesday', time: '08:30' },
    'PPIENG': { frequency: 'monthly', dayOfMonth: 'second_tuesday', time: '08:30' },
    'CPIAUCSL': { frequency: 'monthly', dayOfMonth: 'second_wednesday', time: '08:30' },
    'CPILFESL': { frequency: 'monthly', dayOfMonth: 'second_wednesday', time: '08:30' },
    'UNRATE': { frequency: 'monthly', dayOfMonth: 'first_friday', time: '08:30' },
    'PAYEMS': { frequency: 'monthly', dayOfMonth: 'first_friday', time: '08:30' },
    'DGS10': { frequency: 'daily', time: '16:00' },
    'FEDFUNDS': { frequency: 'monthly', dayOfMonth: 'mid_month', time: '14:00' }
  };

  async checkAllSeries(): Promise<DataFreshnessCheck[]> {
    const checks: DataFreshnessCheck[] = [];
    
    for (const [seriesId, schedule] of Object.entries(this.ECONOMIC_RELEASE_SCHEDULE)) {
      const check = await this.checkSeries(seriesId, schedule);
      checks.push(check);
    }
    
    return checks;
  }

  private async checkSeries(seriesId: string, schedule: any): Promise<DataFreshnessCheck> {
    try {
      // Query the correct FRED pipeline tables
      const latestData = await db.execute(sql`
        SELECT 
          esd.label as label,
          MAX(eso.period_end) as latest_date
        FROM econ_series_observation eso
        INNER JOIN econ_series_def esd ON eso.series_id = esd.series_id
        WHERE eso.series_id = ${seriesId}
        GROUP BY esd.label
      `);

      const lastDataPoint = latestData.rows[0]?.latest_date 
        ? new Date(latestData.rows[0].latest_date)
        : new Date('2020-01-01');
      
      const expectedNextRelease = this.calculateNextReleaseDate(schedule);
      const staleDays = Math.floor((Date.now() - lastDataPoint.getTime()) / (1000 * 60 * 60 * 24));
      
      // Determine staleness thresholds based on frequency
      const staleThreshold = schedule.frequency === 'daily' ? 7 : 45; // 7 days for daily, 45 for monthly
      const criticalThreshold = schedule.frequency === 'daily' ? 14 : 60;
      
      return {
        seriesId,
        label: latestData.rows[0]?.label || seriesId,
        lastDataPoint,
        expectedNextRelease,
        isStale: staleDays > staleThreshold,
        staleDays,
        severity: staleDays > criticalThreshold ? 'CRITICAL' : staleDays > staleThreshold ? 'WARNING' : 'OK'
      };
    } catch (error) {
      logger.error(`Failed to check freshness for ${seriesId}:`, error);
      return {
        seriesId,
        label: seriesId,
        lastDataPoint: new Date('2020-01-01'),
        expectedNextRelease: new Date(),
        isStale: true,
        staleDays: 999,
        severity: 'CRITICAL'
      };
    }
  }

  private calculateNextReleaseDate(schedule: any): Date {
    const now = new Date();
    const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    
    // Simplified calculation - would implement full BLS calendar logic in production
    switch (schedule.frequency) {
      case 'daily':
        const tomorrow = new Date(now);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow;
      
      case 'monthly':
        if (schedule.dayOfMonth === 'first_friday') {
          return this.getFirstFridayOfMonth(nextMonth);
        } else if (schedule.dayOfMonth === 'second_tuesday') {
          return this.getSecondTuesdayOfMonth(nextMonth);
        } else if (schedule.dayOfMonth === 'second_wednesday') {
          return this.getSecondWednesdayOfMonth(nextMonth);
        }
        break;
    }
    
    return nextMonth;
  }

  private getFirstFridayOfMonth(date: Date): Date {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfWeek = firstDay.getDay();
    const daysToFriday = (5 - dayOfWeek + 7) % 7;
    return new Date(date.getFullYear(), date.getMonth(), 1 + daysToFriday);
  }

  private getSecondTuesdayOfMonth(date: Date): Date {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfWeek = firstDay.getDay();
    const daysToTuesday = (2 - dayOfWeek + 7) % 7;
    return new Date(date.getFullYear(), date.getMonth(), 1 + daysToTuesday + 7);
  }

  private getSecondWednesdayOfMonth(date: Date): Date {
    const firstDay = new Date(date.getFullYear(), date.getMonth(), 1);
    const dayOfWeek = firstDay.getDay();
    const daysToWednesday = (3 - dayOfWeek + 7) % 7;
    return new Date(date.getFullYear(), date.getMonth(), 1 + daysToWednesday + 7);
  }

  /**
   * Get summary of data freshness status
   */
  async getFreshnessSummary(): Promise<{
    totalSeries: number;
    staleCount: number;
    criticalCount: number;
    lastChecked: Date;
    recommendations: string[];
  }> {
    const checks = await this.checkAllSeries();
    const staleData = checks.filter(check => check.isStale);
    const criticalIssues = checks.filter(check => check.severity === 'CRITICAL');
    
    const recommendations: string[] = [];
    if (criticalIssues.length > 0) {
      recommendations.push('Run manual FRED update immediately');
      recommendations.push('Check FRED API connectivity');
      recommendations.push('Verify scheduler is running');
    } else if (staleData.length > 0) {
      recommendations.push('Monitor data pipeline closely');
      recommendations.push('Consider increasing update frequency');
    } else {
      recommendations.push('All data appears current');
    }
    
    return {
      totalSeries: checks.length,
      staleCount: staleData.length,
      criticalCount: criticalIssues.length,
      lastChecked: new Date(),
      recommendations
    };
  }
}

export const economicDataFreshnessMonitor = new EconomicDataFreshnessMonitor();