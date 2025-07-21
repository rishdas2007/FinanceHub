import sgMail from '@sendgrid/mail';
import { nanoid } from 'nanoid';
import { db } from '../db';
import { emailSubscriptions, type EmailSubscription, type InsertEmailSubscription } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { FinancialDataService } from './financial-data';
import { EnhancedAIAnalysisService } from './enhanced-ai-analysis';
import { generateRichEmailTemplate } from './rich-email-template';
import { generateDashboardMatchingEmailTemplate, EmailAnalysisData } from './dashboard-email-template.js';

const SENDGRID_ENABLED = !!process.env.SENDGRID_API_KEY && process.env.SENDGRID_API_KEY.length > 10;

if (SENDGRID_ENABLED) {
  sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
  console.log('✅ SendGrid email service initialized');
} else {
  console.log('⚠️ SendGrid not configured - email subscription will save to database only');
}

export class EmailService {
  private readonly fromEmail = 'me@rishabhdas.com'; // Using verified sender domain
  private financialService = new FinancialDataService();
  private aiService = new EnhancedAIAnalysisService();

  async subscribeToDaily(email: string): Promise<EmailSubscription> {
    try {
      // Check if email already exists
      const existingSubscription = await db
        .select()
        .from(emailSubscriptions)
        .where(eq(emailSubscriptions.email, email))
        .limit(1);

      if (existingSubscription.length > 0) {
        // Reactivate if previously unsubscribed
        const [updated] = await db
          .update(emailSubscriptions)
          .set({
            isActive: true,
            unsubscribedAt: null,
          })
          .where(eq(emailSubscriptions.email, email))
          .returning();
        
        return updated;
      }

      // Create new subscription
      const [subscription] = await db
        .insert(emailSubscriptions)
        .values({
          email,
          unsubscribeToken: nanoid(32),
          isActive: true,
        })
        .returning();

      // Send welcome email if SendGrid is available (but don't fail subscription if email fails)
      if (SENDGRID_ENABLED) {
        try {
          await this.sendWelcomeEmail(email);
        } catch (sendGridError) {
          console.log(`📧 Welcome email failed to send to ${email} (SendGrid error), but subscription saved`);
          // Don't throw error - subscription should still succeed even if email fails
        }
      } else {
        console.log(`📧 Welcome email would be sent to ${email} (SendGrid not configured)`);
      }
      
      return subscription;
    } catch (error) {
      console.error('Error subscribing to daily emails:', error);
      throw new Error('Failed to subscribe to daily emails');
    }
  }

  async unsubscribe(token: string): Promise<boolean> {
    try {
      const [updated] = await db
        .update(emailSubscriptions)
        .set({
          isActive: false,
          unsubscribedAt: new Date(),
        })
        .where(eq(emailSubscriptions.unsubscribeToken, token))
        .returning();

      return !!updated;
    } catch (error) {
      console.error('Error unsubscribing:', error);
      return false;
    }
  }

  async getActiveSubscriptions(): Promise<EmailSubscription[]> {
    try {
      return await db
        .select()
        .from(emailSubscriptions)
        .where(eq(emailSubscriptions.isActive, true));
    } catch (error) {
      console.error('Error getting active subscriptions:', error);
      return [];
    }
  }

  async sendDailyMarketCommentary(analysisData: any): Promise<void> {
    try {
      const activeSubscriptions = await this.getActiveSubscriptions();
      
      if (activeSubscriptions.length === 0) {
        console.log('No active subscriptions for daily commentary');
        return;
      }

      if (!SENDGRID_ENABLED) {
        console.log(`📧 Daily commentary would be sent to ${activeSubscriptions.length} subscribers (SendGrid not configured)`);
        return;
      }

      const emailTemplate = this.generateComprehensiveEmailTemplate(analysisData);

      // Send emails in batches to avoid rate limits
      const batchSize = 10;
      for (let i = 0; i < activeSubscriptions.length; i += batchSize) {
        const batch = activeSubscriptions.slice(i, i + batchSize);
        
        const emails = batch.map(subscription => ({
          to: subscription.email,
          from: this.fromEmail,
          subject: `Daily Market Commentary - ${new Date().toLocaleDateString('en-US', { 
            month: 'long', 
            day: 'numeric', 
            year: 'numeric' 
          })}`,
          html: emailTemplate.replace('{{UNSUBSCRIBE_URL}}', `https://${process.env.REPLIT_DOMAINS?.split(',')[0] || 'localhost'}/api/email/unsubscribe/${subscription.unsubscribeToken}`),
        }));

        await sgMail.send(emails);
        
        // Rate limiting - wait 1 second between batches
        if (i + batchSize < activeSubscriptions.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`📧 Daily commentary sent to ${activeSubscriptions.length} subscribers`);
    } catch (error) {
      console.error('Error sending daily commentary:', error);
      if (error.code === 401) {
        console.error('❌ SendGrid API key is invalid or expired. Please check your API key.');
      } else if (error.code === 403) {
        console.error('❌ SendGrid API key lacks permissions or sender email not verified. Check SendGrid dashboard.');
        console.error('Response body:', JSON.stringify(error.response?.body, null, 2));
      }
      throw error;
    }
  }

  private async sendWelcomeEmail(email: string): Promise<void> {
    if (!SENDGRID_ENABLED) {
      console.log(`📧 Welcome email would be sent to ${email} (SendGrid not configured)`);
      return;
    }

    const welcomeTemplate = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 30px; border-radius: 10px;">
          <h1 style="color: #4ade80; margin: 0 0 20px 0;">Welcome to FinanceHub Pro!</h1>
          <p style="font-size: 16px; line-height: 1.6; margin: 0 0 20px 0;">
            Thank you for subscribing to our daily AI Market Commentary! You'll receive professional market analysis every weekday morning at 8 AM EST.
          </p>
          <div style="background: rgba(255,255,255,0.1); padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h3 style="color: #4ade80; margin: 0 0 10px 0;">What you'll receive:</h3>
            <ul style="margin: 0; padding-left: 20px;">
              <li>Daily market position analysis</li>
              <li>Technical indicator insights (RSI, MACD, VIX)</li>
              <li>Sector rotation analysis</li>
              <li>Economic event impact assessment</li>
              <li>Professional trader-style commentary</li>
            </ul>
          </div>
          <p style="font-size: 14px; color: #9ca3af; margin: 20px 0 0 0;">
            Your first commentary will arrive tomorrow morning. Welcome aboard!
          </p>
        </div>
      </div>
    `;

    try {
      await sgMail.send({
        to: email,
        from: this.fromEmail,
        subject: 'Welcome to FinanceHub Pro Daily Commentary',
        html: welcomeTemplate,
      });
      console.log(`✅ Welcome email sent successfully to ${email}`);
    } catch (error) {
      console.error(`❌ Failed to send welcome email to ${email}:`, error.message);
      if (error.code === 401) {
        console.error('❌ SendGrid API key is invalid or expired.');
      }
      throw error;
    }
  }

  private generateComprehensiveEmailTemplate(analysisData: any): string {
    const { analysis, currentStock, sentiment, technical, sectors, economicEvents } = analysisData;
    
    // Transform data to match the new template interface
    const emailData: EmailAnalysisData = {
      analysis: {
        bottomLine: analysis?.bottomLine || 'Market analysis in progress...',
        dominantTheme: analysis?.dominantTheme || 'Mixed signals',
        setup: analysis?.setup || 'Current market conditions are developing...',
        evidence: analysis?.evidence || 'Technical indicators show neutral readings...',
        implications: analysis?.implications || 'Continue monitoring key levels...',
        confidence: analysis?.confidence || 0.7,
        timestamp: analysis?.timestamp || new Date().toISOString()
      },
      currentStock: {
        price: parseFloat(currentStock?.price || '0').toFixed(2),
        changePercent: parseFloat(currentStock?.changePercent || '0').toFixed(2)
      },
      sentiment: {
        vix: parseFloat(sentiment?.vix || '0').toFixed(1),
        aaiiBullish: parseFloat(sentiment?.aaiiBullish || '0').toFixed(1)
      },
      sectorData: (sectors || []).map((sector: any) => ({
        name: sector.name || sector.symbol,
        symbol: sector.symbol || 'N/A',
        price: parseFloat(sector.price || '0'),
        changePercent: parseFloat(sector.changePercent || '0'),
        fiveDayChange: parseFloat(sector.fiveDayChange || '0'),
        oneMonthChange: parseFloat(sector.oneMonthChange || '0')
      })),
      economicEvents: (economicEvents || []).slice(0, 10).map((event: any) => ({
        title: event.title || 'Economic Event',
        category: this.getCategoryDisplay(event.category || 'Other'),
        actual: event.actual || 'N/A',
        forecast: event.forecast || '-',
        variance: event.variance || '-',
        previous: event.previous || '-',
        date: new Date(event.eventDate || Date.now()).toLocaleDateString('en-US', { 
          month: 'short', 
          day: 'numeric' 
        }).toUpperCase(),
        importance: event.importance || 'medium'
      }))
    };

    return generateDashboardMatchingEmailTemplate(emailData);
  }

  // Add helper method for category display
  private getCategoryDisplay(category: string): string {
    const categoryMap: Record<string, string> = {
      'employment': 'Labor Market',
      'inflation': 'Inflation',
      'growth': 'Growth',
      'consumer_spending': 'Growth',
      'housing': 'Growth',
      'manufacturing': 'Growth',
      'services': 'Growth',
      'sentiment': 'Sentiment',
      'monetary_policy': 'Monetary Policy'
    };
    return categoryMap[category] || 'Other';
  }

  // Legacy method maintained for compatibility
  private generateDailyEmailTemplate(analysisData: any): string {
    return this.generateComprehensiveEmailTemplate(analysisData);
  }

  private formatMetricsInHTML(text: string): string {
    // Convert metric values to bold blue in HTML format
    return text.replace(/(\d+\.?\d*%?K?M?)/g, '<strong style="color: #3b82f6;">$1</strong>');
  }

  // Public method to generate email template for testing
  public generateTestEmailTemplate(analysisData: any): string {
    return this.generateComprehensiveEmailTemplate(analysisData);
  }
}

export const emailService = new EmailService();