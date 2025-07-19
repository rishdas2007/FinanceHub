export function generateEnhancedEmailTemplate(analysisData: any): string {
  const { analysis, currentStock, sentiment, technical, sectors, economicEvents } = analysisData;
  
  const date = new Date().toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  // Get last 3 days of economic events
  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000);
  const recentEconomicEvents = (economicEvents || [])
    .filter(event => {
      const eventDate = new Date(event.eventDate);
      return eventDate >= threeDaysAgo && event.actual;
    })
    .sort((a, b) => new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime())
    .slice(0, 10);

  // Generate economic calendar HTML
  const economicCalendarHtml = recentEconomicEvents.length > 0 ? 
    recentEconomicEvents.map(event => {
      const variance = event.forecast ? 
        (parseFloat(event.actual?.replace(/[^\d.-]/g, '')) - parseFloat(event.forecast?.replace(/[^\d.-]/g, ''))).toFixed(2) : null;
      const varianceColor = variance ? (parseFloat(variance) > 0 ? '#4ade80' : '#ef4444') : '#9ca3af';
      const eventDate = new Date(event.eventDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
      
      return `
        <tr style="border-bottom: 1px solid #e5e7eb;">
          <td style="padding: 8px; font-size: 13px; color: #374151;">${event.title}</td>
          <td style="padding: 8px; font-size: 13px; font-weight: bold; color: #1f2937;">${event.actual}</td>
          <td style="padding: 8px; font-size: 13px; color: #6b7280;">${event.forecast || 'N/A'}</td>
          <td style="padding: 8px; font-size: 13px; color: ${varianceColor}; font-weight: bold;">
            ${variance ? (parseFloat(variance) > 0 ? '+' : '') + variance : 'N/A'}
          </td>
          <td style="padding: 8px; font-size: 12px; color: #9ca3af;">${eventDate}</td>
        </tr>
      `;
    }).join('') : 
    '<tr><td colspan="5" style="padding: 20px; text-align: center; color: #9ca3af;">No recent economic data available</td></tr>';

  return `
    <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 700px; margin: 0 auto; padding: 20px; background: #f8f9fa;">
      <!-- Header -->
      <div style="background: linear-gradient(135deg, #1a1a1a 0%, #2d2d2d 100%); color: white; padding: 30px; border-radius: 12px; margin-bottom: 20px; text-align: center;">
        <h1 style="color: #4ade80; margin: 0 0 5px 0; font-size: 32px; font-weight: bold;">Rishabh's Market Dashboard</h1>
        <a href="https://rishabhdas.substack.com/" style="color: #60a5fa; text-decoration: underline; font-size: 16px;">Follow my market insights on Substack</a>
        <p style="color: #e5e7eb; margin: 15px 0 5px 0; font-size: 16px;">Daily Market Commentary - ${date}</p>
        <p style="color: #9ca3af; margin: 0; font-size: 14px;">Data as of ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: 'America/New_York' })} EDT</p>
      </div>

      <!-- Current Market Position -->
      <div style="background: white; padding: 25px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px; border-left: 4px solid #4ade80; padding-left: 15px;">Current Market Position</h2>
        
        <p style="color: #374151; line-height: 1.6; margin: 0 0 20px 0; font-size: 15px;">
          The S&P 500 (SPY) closed at $${parseFloat(currentStock?.price || '0').toFixed(2)}, gaining ${parseFloat(currentStock?.changePercent || '0') >= 0 ? '+' : ''}${parseFloat(currentStock?.changePercent || '0').toFixed(2)}% today. ${parseFloat(currentStock?.price || '0') > 620 ? 'This puts the market near historical highs, trading at elevated valuations that warrant careful monitoring.' : ''}
        </p>

        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 20px; background: #f8fafc; padding: 20px; border-radius: 8px;">
          <div style="text-align: center;">
            <div style="color: #6b7280; font-size: 12px; margin-bottom: 5px;">Current Price</div>
            <div style="color: #1f2937; font-size: 20px; font-weight: bold;">$${parseFloat(currentStock?.price || '0').toFixed(2)}</div>
          </div>
          <div style="text-align: center;">
            <div style="color: #6b7280; font-size: 12px; margin-bottom: 5px;">Daily Change</div>
            <div style="color: ${parseFloat(currentStock?.changePercent || '0') >= 0 ? '#4ade80' : '#ef4444'}; font-size: 20px; font-weight: bold;">
              ${parseFloat(currentStock?.changePercent || '0') >= 0 ? '+' : ''}${parseFloat(currentStock?.changePercent || '0').toFixed(2)}%
            </div>
          </div>
          <div style="text-align: center;">
            <div style="color: #6b7280; font-size: 12px; margin-bottom: 5px;">VIX Level</div>
            <div style="color: #fbbf24; font-size: 20px; font-weight: bold;">${parseFloat(sentiment?.vix || '0').toFixed(1)}</div>
          </div>
          <div style="text-align: center;">
            <div style="color: #6b7280; font-size: 12px; margin-bottom: 5px;">AAII Bullish</div>
            <div style="color: #4ade80; font-size: 20px; font-weight: bold;">${parseFloat(sentiment?.aaiiBullish || '0').toFixed(1)}%</div>
          </div>
        </div>
      </div>

      <!-- Market Commentary -->
      <div style="background: white; padding: 25px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px; border-left: 4px solid #8b5cf6; padding-left: 15px;">Market Commentary</h2>
        
        <div style="border-left: 3px solid #e5e7eb; padding-left: 15px; margin-bottom: 20px;">
          <h3 style="color: #1f2937; margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">BOTTOM LINE</h3>
          <p style="color: #374151; line-height: 1.6; margin: 0; font-size: 15px;">
            ${analysis?.marketConditions?.replace(/^Bottom Line:\s*/, '') || 'Market analysis loading...'}
          </p>
        </div>

        <div style="border-left: 3px solid #3b82f6; padding-left: 15px; margin-bottom: 20px;">
          <h3 style="color: #1f2937; margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">TECHNICAL ANALYSIS</h3>
          <p style="color: #374151; line-height: 1.6; margin: 0; font-size: 14px;">
            ${analysis?.technicalOutlook?.replace(/^TECHNICAL ANALYSIS:\s*/, '').replace(/\*\*/g, '') || 'Technical analysis loading...'}
          </p>
        </div>

        <div style="border-left: 3px solid #10b981; padding-left: 15px;">
          <h3 style="color: #1f2937; margin: 0 0 10px 0; font-size: 16px; font-weight: bold;">ECONOMIC ANALYSIS</h3>
          <p style="color: #374151; line-height: 1.6; margin: 0; font-size: 14px;">
            ${analysis?.riskAssessment?.replace(/\*\*/g, '') || 'Economic analysis loading...'}
          </p>
        </div>
      </div>

      <!-- Technical Indicators -->
      <div style="background: white; padding: 25px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px; border-left: 4px solid #f59e0b; padding-left: 15px;">Technical Indicators</h2>
        
        <p style="color: #374151; line-height: 1.6; margin: 0 0 15px 0; font-size: 14px;">
          <strong>RSI at ${parseFloat(technical?.rsi || '0').toFixed(1)}</strong> - ${parseFloat(technical?.rsi || '0') > 70 ? 'Overbought levels, potential pullback ahead' : parseFloat(technical?.rsi || '0') > 60 ? 'Elevated levels, room for moderate upside' : 'Neutral levels with balanced momentum'}.
        </p>
        
        <p style="color: #374151; line-height: 1.6; margin: 0; font-size: 14px;">
          <strong>MACD at ${parseFloat(technical?.macd || '0').toFixed(3)} vs Signal ${parseFloat(technical?.macdSignal || '0').toFixed(3)}</strong> - ${parseFloat(technical?.macd || '0') > parseFloat(technical?.macdSignal || '0') ? 'Bullish crossover signal. MACD above signal line indicates upward momentum.' : 'Bearish crossover signal. MACD below signal line indicates potential downward momentum.'}
        </p>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; background: #f8fafc; padding: 15px; border-radius: 8px; margin-top: 15px;">
          <div style="text-align: center;">
            <div style="color: #6b7280; font-size: 12px; margin-bottom: 5px;">RSI Status</div>
            <div style="color: ${parseFloat(technical?.rsi || '0') > 70 ? '#fbbf24' : parseFloat(technical?.rsi || '0') < 30 ? '#4ade80' : '#6b7280'}; font-weight: bold;">
              ${parseFloat(technical?.rsi || '0') > 70 ? 'Overbought' : parseFloat(technical?.rsi || '0') < 30 ? 'Oversold' : 'Neutral'}
            </div>
          </div>
          <div style="text-align: center;">
            <div style="color: #6b7280; font-size: 12px; margin-bottom: 5px;">MACD Signal</div>
            <div style="color: ${parseFloat(technical?.macd || '0') > parseFloat(technical?.macdSignal || '0') ? '#4ade80' : '#ef4444'}; font-weight: bold;">
              ${parseFloat(technical?.macd || '0') > parseFloat(technical?.macdSignal || '0') ? 'Bullish' : 'Bearish'}
            </div>
          </div>
        </div>
      </div>

      <!-- Economic Calendar (Past 3 Days) -->
      <div style="background: white; padding: 25px; border-radius: 10px; margin-bottom: 20px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px; border-left: 4px solid #3b82f6; padding-left: 15px;">Economic Calendar (Past 3 Days)</h2>
        
        <div style="overflow-x: auto;">
          <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #e5e7eb;">
                <th style="padding: 12px 8px; text-align: left; color: #374151; font-weight: 600;">Event</th>
                <th style="padding: 12px 8px; text-align: left; color: #374151; font-weight: 600;">Actual</th>
                <th style="padding: 12px 8px; text-align: left; color: #374151; font-weight: 600;">Forecast</th>
                <th style="padding: 12px 8px; text-align: left; color: #374151; font-weight: 600;">Variance</th>
                <th style="padding: 12px 8px; text-align: left; color: #374151; font-weight: 600;">Date</th>
              </tr>
            </thead>
            <tbody>
              ${economicCalendarHtml}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Sector Performance (Today) -->
      <div style="background: white; padding: 25px; border-radius: 10px; margin-bottom: 30px; box-shadow: 0 2px 8px rgba(0,0,0,0.08);">
        <h2 style="color: #1f2937; margin: 0 0 15px 0; font-size: 20px; border-left: 4px solid #10b981; padding-left: 15px;">Sector Performance (Today)</h2>
        
        <p style="color: #374151; margin: 0 0 20px 0; font-size: 14px;">Today's sector ETF performance across all 12 major sectors:</p>
        
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 15px;">
          ${(sectors || []).filter(s => s.symbol !== 'SPY').slice(0, 12).map(sector => `
            <div style="text-align: center; padding: 15px; background: #f8fafc; border-radius: 8px;">
              <div style="color: #6b7280; font-size: 11px; margin-bottom: 3px;">${sector.name?.split(' ')[0] || sector.symbol}</div>
              <div style="color: #1f2937; font-size: 12px; font-weight: 600; margin-bottom: 3px;">${sector.symbol}</div>
              <div style="color: ${parseFloat(sector.changePercent) >= 0 ? '#4ade80' : '#ef4444'}; font-size: 16px; font-weight: bold;">
                ${parseFloat(sector.changePercent) >= 0 ? '+' : ''}${parseFloat(sector.changePercent).toFixed(2)}%
              </div>
            </div>
          `).join('')}
        </div>

        <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin-top: 20px;">
          <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; text-align: center;">
            <div>
              <div style="color: #6b7280; font-size: 12px; margin-bottom: 5px;">AI Confidence</div>
              <div style="color: #fbbf24; font-size: 18px; font-weight: bold;">${Math.round((analysis?.confidence || 0.85) * 100)}%</div>
            </div>
            <div>
              <div style="color: #6b7280; font-size: 12px; margin-bottom: 5px;">Risk Level</div>
              <div style="color: ${parseFloat(technical?.rsi || '0') > 65 ? '#fbbf24' : '#4ade80'}; font-size: 18px; font-weight: bold;">
                ${parseFloat(technical?.rsi || '0') > 65 ? 'Elevated' : 'Moderate'}
              </div>
            </div>
            <div>
              <div style="color: #6b7280; font-size: 12px; margin-bottom: 5px;">Trend Status</div>
              <div style="color: ${parseFloat(technical?.macd || '0') > parseFloat(technical?.macdSignal || '0') ? '#4ade80' : '#ef4444'}; font-size: 18px; font-weight: bold;">
                ${parseFloat(technical?.macd || '0') > parseFloat(technical?.macdSignal || '0') ? 'Bullish' : 'Bearish'}
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div style="text-align: center; padding: 20px; color: #6b7280; font-size: 12px;">
        <p style="margin: 0 0 10px 0;">This analysis is powered by FinanceHub Pro's AI-driven market intelligence.</p>
        <p style="margin: 0 0 15px 0;">
          <a href="{{UNSUBSCRIBE_URL}}" style="color: #6b7280; text-decoration: underline;">Unsubscribe from daily commentary</a>
        </p>
        <p style="margin: 0; color: #9ca3af;">© 2025 FinanceHub Pro. All rights reserved.</p>
      </div>
    </div>
  `;
}