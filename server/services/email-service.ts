import sgMail from '@sendgrid/mail';
import { nanoid } from 'nanoid';
import { db } from '../db';
import { emailSubscriptions, type EmailSubscription, type InsertEmailSubscription } from '@shared/schema';
import { eq } from 'drizzle-orm';

if (!process.env.SENDGRID_API_KEY) {
  throw new Error("SENDGRID_API_KEY environment variable must be set");
}

sgMail.setApiKey(process.env.SENDGRID_API_KEY);

export class EmailService {
  private readonly fromEmail = 'noreply@financehub.com'; // Update with your verified sender

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

      // Send welcome email
      await this.sendWelcomeEmail(email);
      
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

      const emailTemplate = this.generateDailyEmailTemplate(analysisData);

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
          html: emailTemplate.replace('{{UNSUBSCRIBE_TOKEN}}', subscription.unsubscribeToken),
        }));

        await sgMail.send(emails);
        
        // Rate limiting - wait 1 second between batches
        if (i + batchSize < activeSubscriptions.length) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      console.log(`Daily commentary sent to ${activeSubscriptions.length} subscribers`);
    } catch (error) {
      console.error('Error sending daily commentary:', error);
      throw error;
    }
  }

  private async sendWelcomeEmail(email: string): Promise<void> {
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

    await sgMail.send({
      to: email,
      from: this.fromEmail,
      subject: 'Welcome to FinanceHub Pro Daily Commentary',
      html: welcomeTemplate,
    });
  }

  private generateDailyEmailTemplate(analysisData: any): string {
    const { analysis, currentStock, sentiment, technical, sectors } = analysisData;
    
    const date = new Date().toLocaleDateString('en-US', { 
      weekday: 'long',
      month: 'long', 
      day: 'numeric', 
      year: 'numeric' 
    });

    return `
      <div style="font-family: Arial, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
        <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 30px; border-radius: 10px; margin-bottom: 20px;">
          <h1 style="color: #4ade80; margin: 0 0 10px 0; font-size: 28px;">FinanceHub Pro</h1>
          <h2 style="color: #e5e7eb; margin: 0 0 20px 0; font-size: 18px; font-weight: normal;">Daily Market Commentary - ${date}</h2>
          
          <!-- Market Overview -->
          <div style="background: rgba(255,255,255,0.05); padding: 20px; border-radius: 8px; margin: 20px 0;">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 15px; text-align: center;">
              <div>
                <div style="color: #9ca3af; font-size: 12px;">S&P 500</div>
                <div style="color: ${parseFloat(currentStock?.changePercent || '0') >= 0 ? '#4ade80' : '#ef4444'}; font-size: 18px; font-weight: bold;">
                  $${parseFloat(currentStock?.price || '0').toFixed(2)}
                </div>
                <div style="color: ${parseFloat(currentStock?.changePercent || '0') >= 0 ? '#4ade80' : '#ef4444'}; font-size: 14px;">
                  ${parseFloat(currentStock?.changePercent || '0') >= 0 ? '+' : ''}${parseFloat(currentStock?.changePercent || '0').toFixed(2)}%
                </div>
              </div>
              <div>
                <div style="color: #9ca3af; font-size: 12px;">VIX</div>
                <div style="color: #fbbf24; font-size: 18px; font-weight: bold;">
                  ${parseFloat(sentiment?.vix || '0').toFixed(1)}
                </div>
              </div>
              <div>
                <div style="color: #9ca3af; font-size: 12px;">RSI</div>
                <div style="color: ${parseFloat(technical?.rsi || '0') > 70 ? '#fbbf24' : '#4ade80'}; font-size: 18px; font-weight: bold;">
                  ${parseFloat(technical?.rsi || '0').toFixed(1)}
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Analysis Content -->
        <div style="background: white; padding: 30px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1);">
          <!-- Bottom Line -->
          <div style="border-left: 4px solid #4ade80; padding-left: 20px; margin-bottom: 25px;">
            <h3 style="color: #1f2937; margin: 0 0 10px 0; font-size: 16px;">Bottom Line</h3>
            <p style="color: #374151; line-height: 1.6; margin: 0; font-size: 15px;">
              ${analysis?.marketConditions?.replace(/^Bottom Line:\s*/, '') || 'Market analysis unavailable'}
            </p>
          </div>

          <!-- Technical Analysis -->
          <div style="border-left: 4px solid #3b82f6; padding-left: 20px; margin-bottom: 25px;">
            <h3 style="color: #1f2937; margin: 0 0 10px 0; font-size: 16px;">Technical Analysis</h3>
            <p style="color: #374151; line-height: 1.6; margin: 0; font-size: 14px;">
              ${analysis?.technicalOutlook || 'Technical analysis unavailable'}
            </p>
          </div>

          <!-- Economic & Sector Analysis -->
          <div style="border-left: 4px solid #8b5cf6; padding-left: 20px; margin-bottom: 25px;">
            <h3 style="color: #1f2937; margin: 0 0 10px 0; font-size: 16px;">Economic & Sector Analysis</h3>
            <p style="color: #374151; line-height: 1.6; margin: 0; font-size: 14px;">
              ${analysis?.riskAssessment || 'Economic analysis unavailable'}
            </p>
          </div>

          <!-- Key Metrics -->
          <div style="background: #f9fafb; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <h4 style="color: #1f2937; margin: 0 0 15px 0; font-size: 14px;">Key Market Metrics</h4>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; font-size: 12px;">
              <div style="text-align: center;">
                <div style="color: #6b7280;">MACD</div>
                <div style="color: #1f2937; font-weight: bold;">${parseFloat(technical?.macd || '0').toFixed(3)}</div>
              </div>
              <div style="text-align: center;">
                <div style="color: #6b7280;">Put/Call</div>
                <div style="color: #1f2937; font-weight: bold;">${parseFloat(sentiment?.putCallRatio || '0').toFixed(2)}</div>
              </div>
              <div style="text-align: center;">
                <div style="color: #6b7280;">AAII Bull%</div>
                <div style="color: #1f2937; font-weight: bold;">${parseFloat(sentiment?.aaiiBullish || '0').toFixed(1)}%</div>
              </div>
              <div style="text-align: center;">
                <div style="color: #6b7280;">Confidence</div>
                <div style="color: #1f2937; font-weight: bold;">${Math.round((parseFloat(analysis?.confidence || '0') * 100))}%</div>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
          <p style="margin: 0 0 10px 0;">Powered by GPT-4o • Real Market Data • Professional Analysis</p>
          <p style="margin: 0;">
            <a href="${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000'}/api/email/unsubscribe/{{UNSUBSCRIBE_TOKEN}}" style="color: #6b7280; text-decoration: underline;">
              Unsubscribe from daily emails
            </a>
          </p>
        </div>
      </div>
    `;
  }
}

export const emailService = new EmailService();