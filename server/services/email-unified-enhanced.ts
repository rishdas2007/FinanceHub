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