/**
 * Unified Email Service
 * Consolidates: email-service.ts, rich-email-template.ts, enhanced-email-template.ts, dashboard-email-template.ts
 */

import { MailService } from '@sendgrid/mail';
import { logger } from '../../shared/utils/logger';
import { formatNumber, formatPercentage, formatLargeNumber } from '../../shared/utils/numberFormatting-unified';

interface EmailSubscriber {
  id: number;
  email: string;
  token: string;
  createdAt: Date;
  isActive: boolean;
}

interface EmailTemplateData {
  stockData?: any;
  sentiment?: any;
  technical?: any;
  sectors?: any[];
  economicEvents?: any[];
  analysis?: any;
  timestamp: string;
}

export class EmailService {
  private static instance: EmailService;
  private mailService: MailService;

  private constructor() {
    if (!process.env.SENDGRID_API_KEY) {
      throw new Error("SENDGRID_API_KEY environment variable must be set");
    }
    
    this.mailService = new MailService();
    this.mailService.setApiKey(process.env.SENDGRID_API_KEY);
  }

  static getInstance(): EmailService {
    if (!EmailService.instance) {
      EmailService.instance = new EmailService();
    }
    return EmailService.instance;
  }

  async sendDailyMarketEmail(
    subscribers: EmailSubscriber[], 
    templateData: EmailTemplateData
  ): Promise<{ sent: number; failed: number }> {
    let sent = 0;
    let failed = 0;

    for (const subscriber of subscribers) {
      try {
        const htmlContent = this.generateDashboardEmailTemplate(templateData);
        
        await this.mailService.send({
          to: subscriber.email,
          from: 'rishabh@financehubpro.com', // Replace with your verified sender
          subject: `Market Dashboard - ${new Date().toLocaleDateString('en-US', { 
            weekday: 'long', 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric' 
          })}`,
          html: htmlContent
        });

        sent++;
        logger.info(`Daily email sent to ${subscriber.email}`, 'Email');

      } catch (error) {
        failed++;
        logger.error(`Failed to send email to ${subscriber.email}`, 'Email', error);
      }
    }

    logger.info(`Daily email batch complete: ${sent} sent, ${failed} failed`, 'Email');
    return { sent, failed };
  }

  async sendWelcomeEmail(subscriber: EmailSubscriber): Promise<boolean> {
    try {
      const htmlContent = this.generateWelcomeTemplate(subscriber);
      
      await this.mailService.send({
        to: subscriber.email,
        from: 'rishabh@financehubpro.com',
        subject: 'Welcome to FinanceHub Pro Daily Market Updates',
        html: htmlContent
      });

      logger.info(`Welcome email sent to ${subscriber.email}`, 'Email');
      return true;

    } catch (error) {
      logger.error(`Failed to send welcome email to ${subscriber.email}`, 'Email', error);
      return false;
    }
  }

  async sendTestEmail(
    email: string, 
    templateData: EmailTemplateData
  ): Promise<boolean> {
    try {
      const htmlContent = this.generateDashboardEmailTemplate(templateData);
      
      await this.mailService.send({
        to: email,
        from: 'rishabh@financehubpro.com',
        subject: 'Test - FinanceHub Pro Market Dashboard',
        html: htmlContent
      });

      logger.info(`Test email sent to ${email}`, 'Email');
      return true;

    } catch (error) {
      logger.error(`Failed to send test email to ${email}`, 'Email', error);
      return false;
    }
  }

  private generateDashboardEmailTemplate(data: EmailTemplateData): string {
    const { stockData, sentiment, technical, sectors, economicEvents, analysis, timestamp } = data;

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>FinanceHub Pro - Complete Dashboard</title>
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
            margin-bottom: 30px; 
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
        <h1>FinanceHub Pro Market Dashboard</h1>
        <p>Professional Market Intelligence | Data as of ${timestamp}</p>
        <p><a href="https://rishabhdas.substack.com/" style="color: white; text-decoration: underline;">Visit Substack</a></p>
    </div>

    <div class="market-data">
        <div class="metric-card">
            <h3>S&P 500 (SPY)</h3>
            <div class="value ${(stockData?.changePercent || 0) >= 0 ? 'positive' : 'negative'}">
                $${stockData?.price || 'N/A'}
            </div>
            <div class="${(stockData?.changePercent || 0) >= 0 ? 'positive' : 'negative'}">
                ${(stockData?.changePercent || 0) >= 0 ? '+' : ''}${stockData?.changePercent || '0.00'}%
            </div>
        </div>
        
        <div class="metric-card">
            <h3>VIX (Fear Index)</h3>
            <div class="value">${sentiment?.vix || 'N/A'}</div>
            <div class="${(sentiment?.vixChange || 0) >= 0 ? 'negative' : 'positive'}">
                ${(sentiment?.vixChange || 0) >= 0 ? '+' : ''}${sentiment?.vixChange || '0.00'}%
            </div>
        </div>
        
        <div class="metric-card">
            <h3>RSI (14-day)</h3>
            <div class="value">${technical?.rsi ? parseFloat(technical.rsi).toFixed(1) : 'N/A'}</div>
            <div class="small">Technical Momentum</div>
        </div>
        
        <div class="metric-card">
            <h3>AAII Bullish %</h3>
            <div class="value">${sentiment?.aaiiBullish || 'N/A'}%</div>
            <div class="small">Investor Sentiment</div>
        </div>
    </div>

    ${this.generateAnalysisHTML(analysis)}
    ${this.generateMomentumRiskReturnHTML()}
    ${this.generateMomentumStrategiesHTML()}

    <div class="footer">
        <p>FinanceHub Pro - Professional Market Intelligence</p>
        <p><a href="[UNSUBSCRIBE_LINK]" class="unsubscribe">Unsubscribe</a></p>
    </div>
</body>
</html>`;
  }

  private generateSectorTableHTML(sectors: any[]): string {
    if (!sectors || sectors.length === 0) {
      return '<div class="analysis-section"><h2>📊 Sector Tracker</h2><p>Sector data unavailable</p></div>';
    }

    const sectorRows = sectors.slice(0, 12).map(sector => `
      <tr>
        <td><strong>${sector.name}</strong></td>
        <td>${sector.symbol}</td>
        <td>$${formatNumber(sector.price, 2)}</td>
        <td class="${sector.changePercent >= 0 ? 'positive' : 'negative'}">
          ${sector.changePercent >= 0 ? '+' : ''}${formatNumber(sector.changePercent, 2)}%
        </td>
      </tr>
    `).join('');

    return `
    <div class="analysis-section">
        <h2>📊 Sector Tracker</h2>
        <table class="sector-table">
            <thead>
                <tr>
                    <th>Sector</th>
                    <th>Ticker</th>
                    <th>Price</th>
                    <th>1 Day</th>
                </tr>
            </thead>
            <tbody>
                ${sectorRows}
            </tbody>
        </table>
    </div>`;
  }

  private generateEconomicTableHTML(events: any[]): string {
    if (!events || events.length === 0) {
      return '<div class="analysis-section"><h2>📅 Economic Calendar</h2><p>No recent economic events</p></div>';
    }

    const eventRows = events.slice(0, 10).map(event => `
      <tr>
        <td><strong>${event.title}</strong></td>
        <td>${event.category || 'General'}</td>
        <td>${event.actual || 'N/A'}</td>
        <td>${event.forecast || 'N/A'}</td>
      </tr>
    `).join('');

    return `
    <div class="analysis-section">
        <h2>📅 Economic Calendar</h2>
        <table class="economic-table">
            <thead>
                <tr>
                    <th>Indicator</th>
                    <th>Category</th>
                    <th>Actual</th>
                    <th>Forecast</th>
                </tr>
            </thead>
            <tbody>
                ${eventRows}
            </tbody>
        </table>
    </div>`;
  }

  private generateAnalysisHTML(analysis: any): string {
    if (!analysis) {
      return '<div class="analysis-section"><h2>🤖 AI Market Commentary</h2><p>Analysis unavailable</p></div>';
    }

    return `
    <div class="analysis-section">
        <h2>🤖 AI Market Commentary</h2>
        
        <h3>Bottom Line</h3>
        <p><strong>${analysis.bottomLine || analysis.summary || 'Market analysis unavailable'}</strong></p>
        
        <h3>📊 Market Setup</h3>
        <p>${analysis.setup || analysis.marketSetup || 'Market setup analysis unavailable'}</p>
        
        <h3>🔍 Evidence</h3>
        <p>${analysis.evidence || analysis.technicalAnalysis || 'Supporting evidence unavailable'}</p>
        
        <h3>💡 Implications</h3>
        <p>${analysis.implications || analysis.sectorAnalysis || 'Market implications unavailable'}</p>
        
        <div style="margin-top: 20px; padding: 15px; background-color: #f3f4f6; border-radius: 8px;">
            <small><strong>Confidence:</strong> ${analysis.confidence || 75}% | 
            <strong>Theme:</strong> ${analysis.dominantTheme || 'Mixed signals'}</small>
        </div>
    </div>`;
  }

  private generateMomentumRiskReturnHTML(): string {
    return `
    <div class="analysis-section">
        <h2>📊 Risk-Return: Annual Return vs 1-Day Z-Score</h2>
        <div style="text-align: center; padding: 20px; background-color: #f8fafc; border-radius: 8px; border: 2px solid #e5e7eb;">
            <p style="font-size: 16px; margin: 0; color: #374151;">
                <strong>Interactive Scatter Plot Chart</strong><br>
                <span style="color: #6b7280;">View the full interactive Risk-Return analysis on the dashboard</span>
            </p>
            <p style="margin: 10px 0; font-size: 14px; color: #6b7280;">
                Annual Return (Y-axis) vs Z-Score of Latest 1-Day Move (X-axis)
            </p>
            <a href="https://your-dashboard-url.com" style="display: inline-block; margin-top: 10px; padding: 8px 16px; background-color: #3b82f6; color: white; text-decoration: none; border-radius: 6px; font-size: 14px;">View Live Chart</a>
        </div>
    </div>`;
  }

  private generateMomentumStrategiesHTML(): string {
    return `
    <div class="analysis-section">
        <h2>🚀 Momentum Strategies with Enhanced Metrics</h2>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; border: 2px solid #e5e7eb;">
            <p style="margin: 0 0 10px; font-weight: 600; color: #1f2937;">Top Momentum Sectors (20-day vs 50-day MA Crossover)</p>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin-top: 15px;">
                <div style="background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #10b981;">
                    <strong style="color: #10b981;">XLC - Communication</strong><br>
                    <small>Return: 25.2% | Sharpe: 1.29 | Signal: Strong Bullish</small>
                </div>
                
                <div style="background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #10b981;">
                    <strong style="color: #10b981;">XLF - Financial</strong><br>
                    <small>Return: 21.9% | Sharpe: 1.07 | Signal: Moderate Bullish</small>
                </div>
                
                <div style="background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #10b981;">
                    <strong style="color: #10b981;">XLI - Industrial</strong><br>
                    <small>Return: 19.9% | Sharpe: 1.01 | Signal: Moderate Bullish</small>
                </div>
                
                <div style="background: white; padding: 12px; border-radius: 6px; border-left: 4px solid #ef4444;">
                    <strong style="color: #ef4444;">XLV - Health Care</strong><br>
                    <small>Return: -11.5% | Sharpe: -0.71 | Signal: Strong Bearish</small>
                </div>
            </div>
            
            <p style="margin: 15px 0 0; font-size: 13px; color: #6b7280; text-align: center;">
                <strong>View complete momentum analysis with 12 sectors on the dashboard</strong>
            </p>
        </div>
    </div>`;
  }

  private generateWelcomeTemplate(subscriber: EmailSubscriber): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Welcome to FinanceHub Pro</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; 
            line-height: 1.6; 
            color: #333; 
            max-width: 600px; 
            margin: 0 auto; 
            padding: 20px; 
        }
        .header { 
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
            color: white; 
            padding: 30px; 
            text-align: center; 
            border-radius: 12px; 
            margin-bottom: 30px; 
        }
        .content { 
            background: white; 
            padding: 25px; 
            border-radius: 10px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .footer { 
            text-align: center; 
            padding: 20px; 
            color: #666; 
            font-size: 14px; 
        }
    </style>
</head>
<body>
    <div class="header">
        <h1>Welcome to FinanceHub Pro!</h1>
        <p>Your Daily Market Intelligence Starts Now</p>
    </div>

    <div class="content">
        <h2>Thank you for subscribing!</h2>
        
        <p>You'll now receive daily market intelligence reports featuring:</p>
        
        <ul>
            <li><strong>AI-Powered Market Analysis</strong> - Professional commentary on current market conditions</li>
            <li><strong>Sector Performance Tracking</strong> - Monitor rotation and sector momentum</li>
            <li><strong>Economic Calendar</strong> - Key economic events and their market impact</li>
            <li><strong>Technical Indicators</strong> - RSI, MACD, VIX, and sentiment data</li>
        </ul>
        
        <p>Your daily reports will arrive at <strong>8:00 AM EST</strong> every weekday morning.</p>
        
        <p>Stay informed and make better investment decisions with FinanceHub Pro!</p>
    </div>

    <div class="footer">
        <p>FinanceHub Pro - Professional Market Intelligence</p>
        <p><a href="[UNSUBSCRIBE_LINK]">Unsubscribe</a></p>
    </div>
</body>
</html>`;
  }
}

export const emailService = EmailService.getInstance();