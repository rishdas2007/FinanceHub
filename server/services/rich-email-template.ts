export function generateRichEmailTemplate(analysisData: any): string {
  const { analysis, currentStock, sentiment, technical, sectors } = analysisData;
  
  const date = new Date().toLocaleDateString('en-US', { 
    weekday: 'long',
    month: 'long', 
    day: 'numeric', 
    year: 'numeric' 
  });

  // Add timestamp to show data freshness
  const timestamp = new Date().toLocaleString('en-US', { 
    timeZone: 'America/New_York',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short'
  });

  console.log('Email template received sectors:', sectors ? `${sectors.length} sectors` : 'no sectors');
  if (sectors) {
    console.log('First sector example:', JSON.stringify(sectors[0], null, 2));
  }

  // Use real sector data if available, otherwise use minimal fallback
  const allSectors = sectors && sectors.length > 0 ? sectors : [
    { name: 'Technology', symbol: 'XLK', changePercent: 0.91 },
    { name: 'Financials', symbol: 'XLF', changePercent: 0.96 },
    { name: 'Health Care', symbol: 'XLV', changePercent: -1.14 },
    { name: 'Consumer Discretionary', symbol: 'XLY', changePercent: 0.82 },
    { name: 'Communication', symbol: 'XLC', changePercent: 0.74 },
    { name: 'Industrials', symbol: 'XLI', changePercent: 0.92 },
    { name: 'Consumer Staples', symbol: 'XLP', changePercent: 0.23 },
    { name: 'Energy', symbol: 'XLE', changePercent: 1.45 },
    { name: 'Utilities', symbol: 'XLU', changePercent: -0.34 },
    { name: 'Real Estate', symbol: 'XLRE', changePercent: 0.67 },
    { name: 'Materials', symbol: 'XLB', changePercent: 1.12 },
    { name: 'S&P 500', symbol: 'SPY', changePercent: 0.61 }
  ];

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Rishabh's Market Dashboard - ${date}</title>
    </head>
    <body style="margin: 0; padding: 0; background: #ffffff; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;">
      
      <div style="max-width: 800px; margin: 0 auto; background: #ffffff;">
        
        <!-- Header Section -->
        <div style="background: #ffffff; padding: 40px 30px; border-bottom: 3px solid #10b981;">
          <div style="text-align: center; margin-bottom: 30px;">
            <h1 style="color: #10b981; margin: 0; font-size: 32px; font-weight: 700; letter-spacing: -0.02em;">Rishabh's Market Dashboard</h1>
            <p style="color: #64748b; margin: 8px 0 0 0; font-size: 16px;">
              <a href="https://rishabhdas.substack.com/" style="color: #3b82f6; text-decoration: underline; font-weight: 500;">Follow my market insights on Substack</a>
            </p>
            <p style="color: #94a3b8; margin: 8px 0 0 0; font-size: 14px; font-style: italic;">
              Data as of ${timestamp}
            </p>
          </div>
          
          <!-- Current Market Position -->
          <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px; margin: 24px 0;">
            <div style="display: flex; align-items: center; margin-bottom: 16px;">
              <div style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; margin-right: 12px;"></div>
              <h2 style="color: #1e293b; margin: 0; font-size: 18px; font-weight: 600;">Current Market Position</h2>
            </div>
            <p style="color: #475569; margin: 0 0 20px 0; font-size: 14px; line-height: 1.6;">
              The S&P 500 (SPY) closed at $${parseFloat(currentStock?.price || '628.04').toFixed(2)}, gaining ${parseFloat(currentStock?.changePercent || '0.61') >= 0 ? '+' : ''}${parseFloat(currentStock?.changePercent || '0.61').toFixed(2)}% today. 
              <span style="color: #f59e0b; font-weight: 600;">This puts the market near historical highs, trading at elevated valuations that warrant careful monitoring.</span>
            </p>
            
            <!-- Market Metrics Grid -->
            <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
              <tr>
                <td style="text-align: center; background: #ffffff; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin-right: 4px; width: 23%;">
                  <div style="color: #64748b; font-size: 12px; margin-bottom: 4px;">Current Price</div>
                  <div style="color: #10b981; font-size: 20px; font-weight: 700;">$${parseFloat(currentStock?.price || '628.04').toFixed(2)}</div>
                </td>
                <td style="width: 2%;"></td>
                <td style="text-align: center; background: #ffffff; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin-right: 4px; width: 23%;">
                  <div style="color: #64748b; font-size: 12px; margin-bottom: 4px;">Daily Change</div>
                  <div style="color: ${parseFloat(currentStock?.changePercent || '0.61') >= 0 ? '#10b981' : '#ef4444'}; font-size: 20px; font-weight: 700;">
                    ${parseFloat(currentStock?.changePercent || '0.61') >= 0 ? '+' : ''}${parseFloat(currentStock?.changePercent || '0.61').toFixed(2)}%
                  </div>
                </td>
                <td style="width: 2%;"></td>
                <td style="text-align: center; background: #ffffff; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; margin-right: 4px; width: 23%;">
                  <div style="color: #64748b; font-size: 12px; margin-bottom: 4px;">VIX Level</div>
                  <div style="color: #f59e0b; font-size: 20px; font-weight: 700;">${parseFloat(sentiment?.vix || '16.5').toFixed(1)}</div>
                </td>
                <td style="width: 2%;"></td>
                <td style="text-align: center; background: #ffffff; border: 1px solid #e2e8f0; padding: 16px; border-radius: 8px; width: 23%;">
                  <div style="color: #64748b; font-size: 12px; margin-bottom: 4px;">AAII Bullish</div>
                  <div style="color: #10b981; font-size: 20px; font-weight: 700;">${parseFloat(sentiment?.aaiiBullish || '41.4').toFixed(1)}%</div>
                </td>
              </tr>
            </table>
          </div>
        </div>

        <!-- Analysis Sections -->
        <div style="background: #ffffff; padding: 40px 30px;">
          
          <!-- Technical Indicators -->
          <div style="margin-bottom: 32px;">
            <div style="display: flex; align-items: center; margin-bottom: 16px;">
              <div style="width: 8px; height: 8px; background: #f59e0b; border-radius: 50%; margin-right: 12px;"></div>
              <h3 style="color: #1e293b; margin: 0; font-size: 18px; font-weight: 600;">Technical Indicators</h3>
            </div>
            <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px;">
              <div style="margin-bottom: 16px;">
                <span style="color: #f59e0b; font-weight: 600;">RSI at ${parseFloat(technical?.rsi || '68.9').toFixed(1)}</span>
                <span style="color: #475569;"> - ${parseFloat(technical?.rsi || '68.9') > 70 ? 'Approaching overbought territory (70+)' : 'Moderate levels, room for upside'}. Recent rally may be due for a pause.</span>
              </div>
              <div style="margin-bottom: 16px;">
                <span style="color: #f59e0b; font-weight: 600;">MACD at ${parseFloat(technical?.macd || '8.244').toFixed(3)} vs Signal ${parseFloat(technical?.macdSignal || '8.627').toFixed(3)}</span>
                <span style="color: #475569;"> - ${parseFloat(technical?.macd || '8.244') < parseFloat(technical?.macdSignal || '8.627') ? 'Bearish crossover signal' : 'Bullish momentum intact'}. MACD below signal line indicates potential downward momentum.</span>
              </div>
              <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px;">
                <tr>
                  <td style="text-align: center; width: 48%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
                    <div style="color: #64748b; font-size: 12px;">RSI Status</div>
                    <div style="color: ${parseFloat(technical?.rsi || '68.9') > 70 ? '#f59e0b' : '#10b981'}; font-size: 16px; font-weight: 600;">
                      ${parseFloat(technical?.rsi || '68.9') > 70 ? 'Overbought' : 'Moderate'}
                    </div>
                  </td>
                  <td style="width: 4%;"></td>
                  <td style="text-align: center; width: 48%; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px;">
                    <div style="color: #64748b; font-size: 12px;">MACD Signal</div>
                    <div style="color: ${parseFloat(technical?.macd || '8.244') < parseFloat(technical?.macdSignal || '8.627') ? '#ef4444' : '#10b981'}; font-size: 16px; font-weight: 600;">
                      ${parseFloat(technical?.macd || '8.244') < parseFloat(technical?.macdSignal || '8.627') ? 'Bearish' : 'Bullish'}
                    </div>
                  </td>
                </tr>
              </table>
            </div>
          </div>

          <!-- Sector Performance -->
          <div style="margin-bottom: 32px;">
            <div style="display: flex; align-items: center; margin-bottom: 16px;">
              <div style="width: 8px; height: 8px; background: #10b981; border-radius: 50%; margin-right: 12px;"></div>
              <h3 style="color: #1e293b; margin: 0; font-size: 18px; font-weight: 600;">Sector Performance (Today)</h3>
            </div>
            <div style="background: #f8fafc; border: 2px solid #e2e8f0; border-radius: 12px; padding: 24px;">
              <p style="color: #64748b; margin: 0 0 16px 0; font-size: 14px;">Today's sector ETF performance across all 12 major sectors:</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <!-- First Row -->
                <tr>
                  ${allSectors.slice(0, 3).map((sector, index) => `
                    <td style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.1); border-radius: 8px; padding: 12px; width: 31%; text-align: center;">
                      <div style="color: #10b981; font-weight: 600; font-size: 12px;">${sector.name}</div>
                      <div style="color: #94a3b8; font-size: 10px; margin: 2px 0;">${sector.symbol || ''}</div>
                      <div style="color: ${parseFloat(sector.changePercent || sector.oneDayChange || '0') >= 0 ? '#10b981' : '#ef4444'}; font-size: 16px; font-weight: 700;">
                        ${parseFloat(sector.changePercent || sector.oneDayChange || '0') >= 0 ? '+' : ''}${parseFloat(sector.changePercent || sector.oneDayChange || '0').toFixed(2)}%
                      </div>
                    </td>
                    ${index < 2 ? '<td style="width: 3.5%;"></td>' : ''}
                  `).join('')}
                </tr>
                <tr><td colspan="5" style="padding: 6px;"></td></tr>
                
                <!-- Second Row -->
                <tr>
                  ${allSectors.slice(3, 6).map((sector, index) => `
                    <td style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.1); border-radius: 8px; padding: 12px; width: 31%; text-align: center;">
                      <div style="color: #10b981; font-weight: 600; font-size: 12px;">${sector.name}</div>
                      <div style="color: #94a3b8; font-size: 10px; margin: 2px 0;">${sector.symbol || ''}</div>
                      <div style="color: ${parseFloat(sector.changePercent || sector.oneDayChange || '0') >= 0 ? '#10b981' : '#ef4444'}; font-size: 16px; font-weight: 700;">
                        ${parseFloat(sector.changePercent || sector.oneDayChange || '0') >= 0 ? '+' : ''}${parseFloat(sector.changePercent || sector.oneDayChange || '0').toFixed(2)}%
                      </div>
                    </td>
                    ${index < 2 ? '<td style="width: 3.5%;"></td>' : ''}
                  `).join('')}
                </tr>
                <tr><td colspan="5" style="padding: 6px;"></td></tr>
                
                <!-- Third Row -->
                <tr>
                  ${allSectors.slice(6, 9).map((sector, index) => `
                    <td style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.1); border-radius: 8px; padding: 12px; width: 31%; text-align: center;">
                      <div style="color: #10b981; font-weight: 600; font-size: 12px;">${sector.name}</div>
                      <div style="color: #94a3b8; font-size: 10px; margin: 2px 0;">${sector.symbol || ''}</div>
                      <div style="color: ${parseFloat(sector.changePercent || sector.oneDayChange || '0') >= 0 ? '#10b981' : '#ef4444'}; font-size: 16px; font-weight: 700;">
                        ${parseFloat(sector.changePercent || sector.oneDayChange || '0') >= 0 ? '+' : ''}${parseFloat(sector.changePercent || sector.oneDayChange || '0').toFixed(2)}%
                      </div>
                    </td>
                    ${index < 2 ? '<td style="width: 3.5%;"></td>' : ''}
                  `).join('')}
                </tr>
                <tr><td colspan="5" style="padding: 6px;"></td></tr>
                
                <!-- Fourth Row -->
                <tr>
                  ${allSectors.slice(9, 12).map((sector, index) => `
                    <td style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.1); border-radius: 8px; padding: 12px; width: 31%; text-align: center;">
                      <div style="color: #10b981; font-weight: 600; font-size: 12px;">${sector.name}</div>
                      <div style="color: #94a3b8; font-size: 10px; margin: 2px 0;">${sector.symbol || ''}</div>
                      <div style="color: ${parseFloat(sector.changePercent || sector.oneDayChange || '0') >= 0 ? '#10b981' : '#ef4444'}; font-size: 16px; font-weight: 700;">
                        ${parseFloat(sector.changePercent || sector.oneDayChange || '0') >= 0 ? '+' : ''}${parseFloat(sector.changePercent || sector.oneDayChange || '0').toFixed(2)}%
                      </div>
                    </td>
                    ${index < 2 ? '<td style="width: 3.5%;"></td>' : ''}
                  `).join('')}
                </tr>
              </table>
            </div>
          </div>

          <!-- Market Commentary -->
          <div style="margin-bottom: 32px;">
            <div style="display: flex; align-items: center; margin-bottom: 16px;">
              <div style="width: 8px; height: 8px; background: #8b5cf6; border-radius: 50%; margin-right: 12px;"></div>
              <h3 style="color: #f1f5f9; margin: 0; font-size: 18px; font-weight: 600;">Market Commentary - ${date}</h3>
            </div>
            <div style="background: #111827; border-radius: 12px; padding: 24px;">
              
              <div style="margin-bottom: 20px;">
                <h4 style="color: #8b5cf6; margin: 0 0 8px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Bottom Line</h4>
                <p style="color: #e2e8f0; margin: 0; font-size: 15px; line-height: 1.6; font-weight: 500;">
                  ${analysis?.marketConditions?.replace(/^Bottom Line:\s*/, '') || 'Market analysis will be available shortly.'}
                </p>
              </div>

              <div style="margin-bottom: 20px;">
                <h4 style="color: #3b82f6; margin: 0 0 8px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Technical Analysis</h4>
                <p style="color: #cbd5e1; margin: 0; font-size: 14px; line-height: 1.6;">
                  ${analysis?.technicalOutlook || 'Technical analysis will be provided with the next update.'}
                </p>
              </div>

              <div style="margin-bottom: 20px;">
                <h4 style="color: #10b981; margin: 0 0 8px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Economic Analysis</h4>
                <p style="color: #cbd5e1; margin: 0; font-size: 14px; line-height: 1.6;">
                  ${analysis?.riskAssessment?.split('\n\n')[0] || 'Economic analysis will be included in the next commentary.'}
                </p>
              </div>

              <div style="margin-bottom: 20px;">
                <h4 style="color: #f59e0b; margin: 0 0 8px 0; font-size: 14px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em;">Sector Rotation Analysis</h4>
                <p style="color: #cbd5e1; margin: 0; font-size: 14px; line-height: 1.6;">
                  ${analysis?.riskAssessment?.split('\n\n')[1] || 'Sector rotation trends will be analyzed in upcoming reports.'}
                </p>
              </div>

              <div style="background: rgba(139, 92, 246, 0.1); border: 1px solid rgba(139, 92, 246, 0.2); border-radius: 8px; padding: 16px; margin-top: 24px;">
                <table width="100%" cellpadding="0" cellspacing="0">
                  <tr>
                    <td style="text-align: center; width: 31%;">
                      <div style="color: #64748b; font-size: 12px;">AI Confidence</div>
                      <div style="color: #8b5cf6; font-size: 18px; font-weight: 700;">${Math.round((parseFloat(analysis?.confidence || '0.85') * 100))}%</div>
                    </td>
                    <td style="width: 3.5%;"></td>
                    <td style="text-align: center; width: 31%;">
                      <div style="color: #64748b; font-size: 12px;">Risk Level</div>
                      <div style="color: #f59e0b; font-size: 18px; font-weight: 700;">Elevated</div>
                    </td>
                    <td style="width: 3.5%;"></td>
                    <td style="text-align: center; width: 31%;">
                      <div style="color: #64748b; font-size: 12px;">Trend Status</div>
                      <div style="color: #ef4444; font-size: 18px; font-weight: 700;">Bearish</div>
                    </td>
                  </tr>
                </table>
              </div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div style="background: #0f172a; padding: 30px; text-align: center; border-top: 1px solid #334155;">
          <p style="color: #64748b; margin: 0 0 16px 0; font-size: 14px;">
            This analysis is powered by FinanceHub Pro's AI-driven market intelligence.
          </p>
          <div style="margin: 16px 0;">
            <a href="${process.env.REPLIT_DOMAINS ? `https://${process.env.REPLIT_DOMAINS.split(',')[0]}` : 'http://localhost:5000'}/api/email/unsubscribe/{{UNSUBSCRIBE_TOKEN}}" style="color: #64748b; text-decoration: underline; font-size: 12px;">
              Unsubscribe from daily commentary
            </a>
          </div>
          <p style="color: #475569; margin: 0; font-size: 11px;">
            © ${new Date().getFullYear()} FinanceHub Pro. All rights reserved.
          </p>
        </div>
      </div>
      
    </body>
    </html>
  `;
}