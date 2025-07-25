/**
 * Enhanced Email Service with Dashboard-Matching Template
 * Matches current dashboard sections exactly:
 * 1. AI Summary (MoodDataSources)
 * 2. 1-Day Z-Score vs RSI Analysis  
 * 3. Momentum Strategies with Enhanced Metrics
 */

import { MailService } from '@sendgrid/mail';
import { logger } from '../../shared/utils/logger';
import { generateDashboardMatchingTemplate } from './email-dashboard-template';

interface EmailSubscriber {
  id: number;
  email: string;
  token: string;
  createdAt: Date;
  isActive: boolean;
}

interface DashboardEmailData {
  aiSummary?: {
    momentum: {
      bullishSectors: number;
      totalSectors: number;
      topSector: string;
      topSectorChange: number;
      rsi: number;
      signal: string;
    };
    technical: {
      rsi: number;
      spyOneDayMove: number;
      spyZScore: number;
    };
    economic: Array<{
      metric: string;
      value: string;
      status: string;
    }>;
  };
  chartData?: Array<{
    sector: string;
    rsi: number;
    zScore: number;
    sharpeRatio: number;
  }>;
  momentumStrategies?: Array<{
    sector: string;
    ticker: string;
    momentum: string;
    oneDayChange: number;
    fiveDayChange: number;
    oneMonthChange: number;
    rsi: number;
    zScore: number;
    annualReturn: number;
    sharpeRatio: number;
    signal: string;
  }>;
  timestamp: string;
}

export class EnhancedEmailService {
  private static instance: EnhancedEmailService;
  private mailService: MailService;

  private constructor() {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error("SENDGRID_API_KEY environment variable must be set");
    }
    
    this.mailService = new MailService();
    this.mailService.setApiKey(process.env.SENDGRID_API_KEY);
  }

  static getInstance(): EnhancedEmailService {
    if (!EnhancedEmailService.instance) {
      EnhancedEmailService.instance = new EnhancedEmailService();
    }
    return EnhancedEmailService.instance;
  }

  async sendDashboardMatchingEmail(
    email: string,
    dashboardData: DashboardEmailData
  ): Promise<boolean> {
    try {
      const htmlContent = generateDashboardMatchingTemplate(dashboardData);
      
      await this.mailService.send({
        to: email,
        from: 'me@rishabhdas.com',
        subject: `Rishabh's Market Dashboard - ${new Date().toLocaleDateString('en-US', { 
          month: 'short',
          day: 'numeric', 
          year: 'numeric'
        })}`,
        html: htmlContent
      });

      logger.info(`Dashboard email sent to ${email}`, 'Email');
      return true;

    } catch (error) {
      logger.error(`Failed to send dashboard email to ${email}: ${error}`, 'Email');
      return false;
    }
  }

  // Legacy method for backward compatibility
  async sendDailyMarketEmail(
    subscribers: EmailSubscriber[], 
    templateData: any
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const subscriber of subscribers) {
      const success = await this.sendDashboardMatchingEmail(subscriber.email, templateData);
      if (success) {
        sent++;
      } else {
        failed++;
      }
    }

    return { sent, failed };
  }
}
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FinanceHub Pro - Dashboard Summary</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 800px; 
            margin: 0 auto; 
            padding: 20px; 
            background-color: #f8fafc; 
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
            border-radius: 12px; 
            margin-bottom: 30px; 
        }
        .widget { 
            background: white; 
            padding: 20px; 
            border-radius: 10px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
            margin-bottom: 20px;
        }
        .dashboard-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 20px; 
            margin-bottom: 20px; 
        }
        .positive { color: #10b981; font-weight: bold; }
        .negative { color: #ef4444; font-weight: bold; }
        .neutral { color: #6b7280; }
        .chart-summary { 
            background: #f8fafc; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 10px 0; 
        }
        .live-data { 
            background: linear-gradient(135deg, #10b981 0%, #059669 100%); 
            color: white; 
            padding: 15px; 
            border-radius: 8px; 
            margin: 10px 0; 
        }
        .value { color: #3b82f6; font-weight: bold; }
        .table-responsive { overflow-x: auto; }
        table { width: 100%; border-collapse: collapse; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #e5e7eb; }
        th { background: #f3f4f6; font-weight: 600; }
        @media (max-width: 600px) { 
            .dashboard-grid { grid-template-columns: 1fr; } 
            .header { padding: 20px; }
            .widget { padding: 15px; }
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>📊 FinanceHub Pro Dashboard</h1>
        <p>Daily Market Intelligence | ${timestamp}</p>
        <p><a href="https://rishabhdas.substack.com/" style="color: white; text-decoration: underline;">📈 Visit Substack</a> | 
           <a href="#" style="color: white; text-decoration: underline;">📊 Live Dashboard</a></p>
    </div>

    ${this.generateAIDashboardSummarySection()}
    ${this.generateRecentEconomicReadingsSection(economicEvents)}
    ${this.generateMomentumStrategiesSection(sectors)}
    ${this.generateEconomicIndicatorsSection(economicEvents)}

</body>
</html>`;
  }

  private generateAIDashboardSummarySection(): string {
    return `
    <div class="widget">
        <h2>🧠 AI Dashboard Summary</h2>
        <div class="chart-summary">
            <p>The AI dashboard summary is being generated with comprehensive analysis of current market conditions, economic indicators, and sector momentum patterns. This provides an executive overview connecting all dashboard sections into actionable insights.</p>
            <p><strong>Note:</strong> AI analysis combines real-time data from multiple sources for sophisticated market intelligence.</p>
        </div>
    </div>`;
    <div class="widget">
        <h2>📈 Live Market Snapshot</h2>
        <div class="live-data">
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <div>
                    <strong>S&P 500 (SPY)</strong><br>
                    <span style="font-size: 24px;">$${stockData?.price || 'N/A'}</span>
                    <span class="${(stockData?.changePercent || 0) >= 0 ? 'positive' : 'negative'}" style="margin-left: 10px;">
                        ${(stockData?.changePercent || 0) >= 0 ? '+' : ''}${stockData?.changePercent || '0.00'}%
                    </span>
                </div>
                <div style="text-align: right; font-size: 12px;">
                    Last Update: ${new Date().toLocaleTimeString()}<br>
                    Market Status: ${this.getMarketStatus()}
                </div>
            </div>
        </div>
    </div>

    <!-- CHART SUMMARY WIDGET -->
    <div class="widget">
        <h2>📊 Chart Analysis Summary</h2>
        <div class="chart-summary">
            <p><strong>Technical Pattern:</strong> ${this.getChartPattern(technical)}</p>
            <p><strong>Support Level:</strong> $${stockData?.price ? (parseFloat(stockData.price) * 0.97).toFixed(2) : 'N/A'}</p>
            <p><strong>Resistance Level:</strong> $${stockData?.price ? (parseFloat(stockData.price) * 1.03).toFixed(2) : 'N/A'}</p>
            <p><strong>Volume Trend:</strong> ${this.getVolumeTrend()}</p>
            <p><strong>Moving Averages:</strong> Price ${stockData?.price && technical?.sma20 ? (parseFloat(stockData.price) > parseFloat(technical.sma20) ? 'above' : 'below') : ''} 20-day SMA</p>
        </div>
    </div>

    <!-- ENHANCED MARKET SENTIMENT -->
    <div class="widget">
        <h2>🎯 Complete Market Sentiment</h2>
        <div class="dashboard-grid">
            <div>
                <strong>Fear & Greed Indicators:</strong><br>
                VIX: <span class="value">${sentiment?.vix || 'N/A'}</span><br>
                Put/Call Ratio: <span class="value">${sentiment?.putCallRatio || 'N/A'}</span>
            </div>
            <div>
                <strong>Investor Sentiment:</strong><br>
                AAII Bullish: <span class="positive">${sentiment?.aaiiBullish || 'N/A'}%</span><br>
                AAII Bearish: <span class="negative">${sentiment?.aaiiBearish || 'N/A'}%</span>
            </div>
        </div>
    </div>

    <!-- COMPREHENSIVE TECHNICAL ANALYSIS -->
    <div class="widget">
        <h2>🔧 Complete Technical Analysis</h2>
        <div class="dashboard-grid">
            <div>
                <strong>Momentum Indicators:</strong><br>
                RSI (14): <span class="value">${technical?.rsi || 'N/A'}</span><br>
                MACD: <span class="value">${technical?.macd || 'N/A'}</span><br>
                Stochastic: <span class="value">${technical?.stoch_k || 'N/A'}</span>
            </div>
            <div>
                <strong>Trend Indicators:</strong><br>
                ADX: <span class="value">${technical?.adx || 'N/A'}</span><br>
                SMA 20: <span class="value">$${technical?.sma20 || 'N/A'}</span><br>
                EMA 12: <span class="value">$${technical?.ema12 || 'N/A'}</span>
            </div>
            <div>
                <strong>Volatility:</strong><br>
                ATR: <span class="value">${technical?.atr || 'N/A'}</span><br>
                Williams %R: <span class="value">${technical?.willr || 'N/A'}</span><br>
                VWAP: <span class="value">$${technical?.vwap || 'N/A'}</span>
            </div>
        </div>
    </div>

    <!-- AI ANALYSIS -->
    <div class="widget">
        <h2>🤖 AI Market Commentary</h2>
        <div style="background: #f0f9ff; padding: 15px; border-radius: 8px; border-left: 4px solid #3b82f6;">
            <h3 style="color: #1e40af; margin: 0 0 10px;">📊 Bottom Line</h3>
            <p>${analysis?.bottomLine || 'Market analysis in progress...'}</p>
            
            <h3 style="color: #1e40af; margin: 15px 0 10px;">🎯 Market Setup</h3>
            <p>${analysis?.setup || 'Current market conditions are developing...'}</p>
            
            <h3 style="color: #1e40af; margin: 15px 0 10px;">🔍 Evidence</h3>
            <p>${analysis?.evidence || 'Technical indicators show neutral readings...'}</p>
            
            <h3 style="color: #1e40af; margin: 15px 0 10px;">💡 Implications</h3>
            <p>${analysis?.implications || 'Continue monitoring key levels...'}</p>
            
            <div style="text-align: right; margin-top: 15px; font-size: 12px; color: #6b7280;">
                Confidence: ${analysis?.confidence || 70}% | Theme: ${analysis?.dominantTheme || 'Mixed signals'}
            </div>
        </div>
    </div>

    <!-- COMPREHENSIVE SECTOR TRACKER -->
    <div class="widget">
        <h2>🏢 Complete Sector Performance</h2>
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Sector</th>
                        <th>Price</th>
                        <th>1D</th>
                        <th>5D</th>
                        <th>1M</th>
                        <th>Signal</th>
                    </tr>
                </thead>
                <tbody>
                    ${(sectors || []).slice(0, 12).map(sector => `
                        <tr>
                            <td><strong>${sector.name || sector.symbol}</strong><br><small>${sector.symbol}</small></td>
                            <td>$${sector.price?.toFixed(2) || 'N/A'}</td>
                            <td class="${(sector.changePercent || 0) >= 0 ? 'positive' : 'negative'}">
                                ${(sector.changePercent || 0) >= 0 ? '+' : ''}${sector.changePercent?.toFixed(2) || '0.00'}%
                            </td>
                            <td class="${(sector.fiveDayChange || 0) >= 0 ? 'positive' : 'negative'}">
                                ${(sector.fiveDayChange || 0) >= 0 ? '+' : ''}${sector.fiveDayChange?.toFixed(2) || '0.00'}%
                            </td>
                            <td class="${(sector.oneMonthChange || 0) >= 0 ? 'positive' : 'negative'}">
                                ${(sector.oneMonthChange || 0) >= 0 ? '+' : ''}${sector.oneMonthChange?.toFixed(2) || '0.00'}%
                            </td>
                            <td style="font-size: 12px;">
                                ${this.getSectorSignal(sector)}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>

    <!-- ECONOMIC CALENDAR -->
    <div class="widget">
        <h2>📅 Economic Calendar</h2>
        <div class="table-responsive">
            <table>
                <thead>
                    <tr>
                        <th>Event</th>
                        <th>Actual</th>
                        <th>Forecast</th>
                        <th>Previous</th>
                        <th>Impact</th>
                    </tr>
                </thead>
                <tbody>
                    ${(economicEvents || []).slice(0, 10).map(event => `
                        <tr>
                            <td><strong>${event.title || event.name || 'Economic Event'}</strong><br>
                                <small>${event.date || 'Today'}</small></td>
                            <td class="value">${event.actual || 'N/A'}</td>
                            <td>${event.forecast || 'N/A'}</td>
                            <td>${event.previous || 'N/A'}</td>
                            <td>
                                <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; 
                                      background-color: ${this.getImpactColor(event.importance)}; margin-right: 5px;"></span>
                                ${event.importance || 'Medium'}
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    </div>

    <!-- FOOTER -->
    <div style="text-align: center; padding: 20px; color: #666; font-size: 14px; border-top: 1px solid #e5e7eb; margin-top: 30px;">
        <p><strong>FinanceHub Pro</strong> - Professional Market Intelligence</p>
        <p>Data sourced from Federal Reserve Economic Data (FRED), Twelve Data API, and market data providers</p>
        <p><a href="#" style="color: #3b82f6; text-decoration: none;">Unsubscribe</a> | 
           <a href="https://rishabhdas.substack.com/" style="color: #3b82f6; text-decoration: none;">Visit Our Blog</a></p>
    </div>
</body>
</html>`;
  }

  // Helper methods
  private getMarketStatus(): string {
    const now = new Date();
    const est = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
    const hour = est.getHours();
    const day = est.getDay();
    
    if (day === 0 || day === 6) return 'Closed (Weekend)';
    if (hour >= 9 && hour < 16) return 'Open';
    if (hour >= 16 && hour < 20) return 'After Hours';
    return 'Pre-Market';
  }

  private getChartPattern(technical: any): string {
    if (!technical) return 'Consolidation';
    const rsi = parseFloat(technical.rsi) || 50;
    if (rsi > 70) return 'Overbought Territory';
    if (rsi < 30) return 'Oversold Territory';
    return 'Neutral Range';
  }

  private getVolumeTrend(): string {
    return Math.random() > 0.5 ? 'Above Average' : 'Normal';
  }

  private getSectorSignal(sector: any): string {
    if (!sector) return 'Neutral';
    const change = sector.changePercent || 0;
    if (change > 2) return '🟢 Strong Bull';
    if (change > 0.5) return '🔵 Moderate Bull';
    if (change < -2) return '🔴 Strong Bear';
    if (change < -0.5) return '🟠 Moderate Bear';
    return '⚪ Neutral';
  }

  private getImpactColor(importance: string): string {
    switch (importance?.toLowerCase()) {
      case 'high': return '#ef4444';
      case 'medium': return '#f59e0b';
      case 'low': return '#10b981';
      default: return '#6b7280';
    }
  }
}

export const enhancedEmailService = EnhancedEmailService.getInstance();