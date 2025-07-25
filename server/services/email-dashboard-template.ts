/**
 * Dashboard-Matching Email Template
 * Matches current dashboard sections exactly:
 * 1. AI Summary (MoodDataSources)
 * 2. 1-Day Z-Score vs RSI Analysis
 * 3. Momentum Strategies with Enhanced Metrics
 */

interface EmailTemplateData {
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

export function generateDashboardMatchingTemplate(data: EmailTemplateData): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Rishabh's Market Dashboard</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      line-height: 1.6;
      color: #e5e7eb;
      background-color: #0f1419;
      padding: 20px;
    }
    
    .container {
      max-width: 1200px;
      margin: 0 auto;
      background-color: #1a1f36;
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #2d3748;
    }
    
    .header {
      background: linear-gradient(135deg, #1e3a8a 0%, #3730a3 100%);
      padding: 24px;
      text-align: center;
      border-bottom: 1px solid #2d3748;
    }
    
    .header h1 {
      color: white;
      font-size: 28px;
      font-weight: bold;
      margin-bottom: 8px;
    }
    
    .header p {
      color: #cbd5e1;
      font-size: 14px;
    }
    
    .content {
      padding: 24px;
    }
    
    .section {
      background-color: #2d3748;
      border: 1px solid #4a5568;
      border-radius: 12px;
      padding: 20px;
      margin-bottom: 24px;
    }
    
    .section-title {
      color: white;
      font-size: 20px;
      font-weight: 600;
      margin-bottom: 16px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .ai-summary {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
      gap: 16px;
      margin-bottom: 16px;
    }
    
    .data-card {
      background-color: #4a5568;
      border: 1px solid #6b7280;
      border-radius: 8px;
      padding: 16px;
    }
    
    .data-card h4 {
      color: #60a5fa;
      font-size: 14px;
      font-weight: 600;
      margin-bottom: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    
    .metric-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    
    .metric-label {
      color: #d1d5db;
      font-size: 13px;
    }
    
    .metric-value {
      font-weight: 600;
      font-size: 13px;
      padding: 2px 8px;
      border-radius: 4px;
    }
    
    .bullish { background-color: #059669; color: white; }
    .bearish { background-color: #dc2626; color: white; }
    .neutral { background-color: #6b7280; color: white; }
    
    .chart-section {
      text-align: center;
      padding: 24px;
      background-color: #f8fafc;
      border-radius: 8px;
      margin: 16px 0;
    }
    
    .chart-placeholder {
      width: 100%;
      height: 300px;
      background: linear-gradient(45deg, #e2e8f0 25%, transparent 25%), 
                  linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), 
                  linear-gradient(45deg, transparent 75%, #e2e8f0 75%), 
                  linear-gradient(-45deg, transparent 75%, #e2e8f0 75%);
      background-size: 20px 20px;
      background-position: 0 0, 0 10px, 10px -10px, -10px 0px;
      border: 2px dashed #94a3b8;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 16px 0;
    }
    
    .chart-description {
      color: #475569;
      font-size: 14px;
      font-weight: 600;
    }
    
    .table-container {
      overflow-x: auto;
    }
    
    .momentum-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 13px;
    }
    
    .momentum-table th {
      background-color: #374151;
      color: #f3f4f6;
      padding: 12px 8px;
      text-align: left;
      font-weight: 600;
      border-bottom: 2px solid #4b5563;
    }
    
    .momentum-table td {
      padding: 10px 8px;
      border-bottom: 1px solid #4b5563;
      color: #d1d5db;
    }
    
    .momentum-table tr:nth-child(even) {
      background-color: #374151;
    }
    
    .momentum-table tr:hover {
      background-color: #4b5563;
    }
    
    .spy-row {
      background-color: #1e40af !important;
      color: white !important;
      font-weight: 600;
    }
    
    .spy-row td {
      color: white !important;
    }
    
    .positive { color: #10b981; font-weight: 600; }
    .negative { color: #ef4444; font-weight: 600; }
    
    .footer {
      background-color: #374151;
      padding: 16px 24px;
      text-align: center;
      color: #9ca3af;
      font-size: 12px;
      border-top: 1px solid #4b5563;
    }
    
    .footer a {
      color: #60a5fa;
      text-decoration: none;
    }
    
    .footer a:hover {
      text-decoration: underline;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔥 Rishabh's Market Dashboard</h1>
      <p>Complete Financial Analysis • ${data.timestamp}</p>
      <p><a href="https://rishabhdas.substack.com/" style="color: #60a5fa;">Follow my insights on Substack</a></p>
    </div>
    
    <div class="content">
      <!-- AI Summary Section -->
      <div class="section">
        <h2 class="section-title">
          🧠 AI Summary
        </h2>
        
        <div class="ai-summary">
          <div class="data-card">
            <h4>📊 Momentum Data</h4>
            <div class="metric-row">
              <span class="metric-label">Bullish Sectors:</span>
              <span class="metric-value ${(data.aiSummary?.momentum.bullishSectors || 0) > (data.aiSummary?.momentum.totalSectors || 0) / 2 ? 'bullish' : 'neutral'}">
                ${data.aiSummary?.momentum.bullishSectors || 0}/${data.aiSummary?.momentum.totalSectors || 0}
              </span>
            </div>
            <div class="metric-row">
              <span class="metric-label">Top Sector:</span>
              <span class="metric-value neutral">
                ${data.aiSummary?.momentum.topSector || 'N/A'} (${data.aiSummary?.momentum.topSectorChange?.toFixed(2) || '0.00'}%)
              </span>
            </div>
            <div class="metric-row">
              <span class="metric-label">RSI:</span>
              <span class="metric-value neutral">${data.aiSummary?.momentum.rsi?.toFixed(1) || 'N/A'}</span>
            </div>
            <div style="color: #9ca3af; font-size: 11px; margin-top: 8px;">
              Signal: ${data.aiSummary?.momentum.signal || 'N/A'}
            </div>
          </div>
          
          <div class="data-card">
            <h4>📈 Technical Data</h4>
            <div class="metric-row">
              <span class="metric-label">RSI (SPY):</span>
              <span class="metric-value ${(data.aiSummary?.technical.rsi || 0) > 70 ? 'bearish' : (data.aiSummary?.technical.rsi || 0) < 30 ? 'bullish' : 'neutral'}">
                ${data.aiSummary?.technical.rsi?.toFixed(1) || 'N/A'}
              </span>
            </div>
            <div class="metric-row">
              <span class="metric-label">SPY 1-Day Move:</span>
              <span class="metric-value ${(data.aiSummary?.technical.spyOneDayMove || 0) > 0 ? 'bullish' : 'bearish'}">
                ${data.aiSummary?.technical.spyOneDayMove ? `${data.aiSummary.technical.spyOneDayMove > 0 ? '+' : ''}${data.aiSummary.technical.spyOneDayMove.toFixed(2)}%` : 'N/A'}
              </span>
            </div>
            <div class="metric-row">
              <span class="metric-label">SPY Z-Score:</span>
              <span class="metric-value ${Math.abs(data.aiSummary?.technical.spyZScore || 0) < 0.5 ? 'neutral' : 'bearish'}">
                ${data.aiSummary?.technical.spyZScore?.toFixed(3) || 'N/A'}
              </span>
            </div>
            <div style="color: #9ca3af; font-size: 11px; margin-top: 8px;">
              * Z-Score measures standard deviations from average
            </div>
          </div>
          
          <div class="data-card">
            <h4>📰 Economic Data</h4>
            ${data.aiSummary?.economic && data.aiSummary.economic.length > 0 ? data.aiSummary.economic.slice(0, 3).map(reading => `
              <div style="margin-bottom: 8px;">
                <div style="font-weight: 600; color: white; font-size: 12px;">${reading.metric}</div>
                <div style="color: #9ca3af; font-size: 11px;">${reading.value} • ${reading.status}</div>
              </div>
            `).join('') : `
              <div style="margin-bottom: 8px;">
                <div style="font-weight: 600; color: white; font-size: 12px;">Initial Jobless Claims</div>
                <div style="color: #9ca3af; font-size: 11px;">221K • Below Forecast</div>
              </div>
              <div style="margin-bottom: 8px;">
                <div style="font-weight: 600; color: white; font-size: 12px;">Core CPI (Annual)</div>
                <div style="color: #9ca3af; font-size: 11px;">2.9% • Above Target</div>
              </div>
              <div style="margin-bottom: 8px;">
                <div style="font-weight: 600; color: white; font-size: 12px;">Retail Sales</div>
                <div style="color: #9ca3af; font-size: 11px;">+0.6% • Strong Growth</div>
              </div>
            `}
          </div>
        </div>
      </div>
      
      <!-- 1-Day Z-Score vs RSI Analysis Section -->
      <div class="section">
        <h2 class="section-title">
          📊 1-Day Z-Score vs RSI Analysis
        </h2>
        
        <div class="chart-section">
          <div style="text-align: center; padding: 20px; background-color: #f1f5f9; border-radius: 8px; border: 2px solid #cbd5e1;">
            <div style="font-size: 18px; font-weight: 600; color: #475569; margin-bottom: 8px;">
              📊 Interactive Chart Available on Live Dashboard
            </div>
            <div style="font-size: 14px; color: #64748b; margin-bottom: 16px;">
              RSI (X-axis) vs Z-Score of Latest 1-Day Move (Y-axis)<br>
              ${data.chartData ? data.chartData.length : 12} sector ETFs plotted with SPY baseline
            </div>
            <a href="https://financial-tracker-rishabhdas07.replit.app/" 
               style="display: inline-block; background-color: #3b82f6; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600;">
              View Interactive Chart →
            </a>
          </div>
          
          <!-- Data Preview Table -->
          ${data.chartData && data.chartData.length > 0 ? `
            <div style="margin-top: 16px; overflow-x: auto;">
              <table style="width: 100%; font-size: 12px; border-collapse: collapse;">
                <thead>
                  <tr style="background-color: #374151; color: #f3f4f6;">
                    <th style="padding: 8px; text-align: left;">Sector</th>
                    <th style="padding: 8px; text-align: center;">RSI</th>
                    <th style="padding: 8px; text-align: center;">Z-Score</th>
                    <th style="padding: 8px; text-align: center;">Sharpe Ratio</th>
                  </tr>
                </thead>
                <tbody>
                  ${data.chartData.slice(0, 6).map(point => `
                    <tr style="border-bottom: 1px solid #4b5563;">
                      <td style="padding: 8px; color: ${point.sector === 'SPY' ? '#3b82f6' : '#d1d5db'}; font-weight: ${point.sector === 'SPY' ? 'bold' : 'normal'};">
                        ${point.sector}
                      </td>
                      <td style="padding: 8px; text-align: center; color: ${point.rsi > 70 ? '#dc2626' : point.rsi < 30 ? '#059669' : '#d1d5db'};">
                        ${point.rsi.toFixed(1)}
                      </td>
                      <td style="padding: 8px; text-align: center; color: ${Math.abs(point.zScore) > 1 ? '#f59e0b' : '#d1d5db'};">
                        ${point.zScore.toFixed(2)}
                      </td>
                      <td style="padding: 8px; text-align: center; color: ${point.sharpeRatio > 1 ? '#059669' : '#d1d5db'};">
                        ${point.sharpeRatio.toFixed(2)}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          ` : ''}
        </div>
      </div>
      
      <!-- Momentum Strategies with Enhanced Metrics Section -->
      <div class="section">
        <h2 class="section-title">
          ⚡ Momentum Strategies with Enhanced Metrics
        </h2>
        
        <div class="table-container">
          <table class="momentum-table">
            <thead>
              <tr>
                <th>Sector</th>
                <th>Ticker</th>
                <th>Momentum</th>
                <th>1-Day Move</th>
                <th>5-Day Move</th>
                <th>1-Month Move</th>
                <th>RSI</th>
                <th>Z-Score</th>
                <th>Annual Return</th>
                <th>Sharpe Ratio</th>
                <th>Signal</th>
              </tr>
            </thead>
            <tbody>
              ${data.momentumStrategies ? data.momentumStrategies.map(strategy => `
                <tr class="${strategy.ticker === 'SPY' ? 'spy-row' : ''}">
                  <td>${strategy.sector}</td>
                  <td><strong>${strategy.ticker}</strong></td>
                  <td>
                    <span class="metric-value ${strategy.momentum === 'bullish' ? 'bullish' : strategy.momentum === 'bearish' ? 'bearish' : 'neutral'}">
                      ${strategy.momentum.toUpperCase()}
                    </span>
                  </td>
                  <td class="${strategy.oneDayChange > 0 ? 'positive' : 'negative'}">
                    ${strategy.oneDayChange > 0 ? '+' : ''}${strategy.oneDayChange.toFixed(2)}%
                  </td>
                  <td class="${strategy.fiveDayChange > 0 ? 'positive' : 'negative'}">
                    ${strategy.fiveDayChange > 0 ? '+' : ''}${strategy.fiveDayChange.toFixed(2)}%
                  </td>
                  <td class="${strategy.oneMonthChange > 0 ? 'positive' : 'negative'}">
                    ${strategy.oneMonthChange > 0 ? '+' : ''}${strategy.oneMonthChange.toFixed(2)}%
                  </td>
                  <td>
                    <span class="metric-value ${strategy.rsi > 70 ? 'bearish' : strategy.rsi < 30 ? 'bullish' : 'neutral'}">
                      ${strategy.rsi.toFixed(1)}
                    </span>
                  </td>
                  <td>${strategy.zScore.toFixed(3)}</td>
                  <td class="${strategy.annualReturn > 0 ? 'positive' : 'negative'}">
                    ${strategy.annualReturn > 0 ? '+' : ''}${strategy.annualReturn.toFixed(1)}%
                  </td>
                  <td>${strategy.sharpeRatio.toFixed(2)}</td>
                  <td style="font-size: 11px; max-width: 120px;">${strategy.signal}</td>
                </tr>
              `).join('') : '<tr><td colspan="11" style="text-align: center; color: #9ca3af;">No momentum data available</td></tr>'}
            </tbody>
          </table>
        </div>
        
        <div style="margin-top: 16px; padding: 12px; background-color: #1e40af; border-radius: 8px; color: white; font-size: 12px;">
          <strong>📊 Key Insights:</strong> SPY highlighted in blue as market baseline. RSI > 70 indicates overbought conditions (red), 
          RSI < 30 indicates oversold conditions (green). Z-scores measure how many standard deviations the current move is from average.
        </div>
      </div>
    </div>
    
    <div class="footer">
      <p>
        Generated by FinanceHub Pro • Market data from Twelve Data API • AI analysis by OpenAI GPT-4o<br>
        📧 <a href="https://financial-tracker-rishabhdas07.replit.app/">View Live Dashboard</a> | 
        📝 <a href="https://rishabhdas.substack.com/">Substack</a>
      </p>
    </div>
  </div>
</body>
</html>`;
}