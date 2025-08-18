// Test the Z-score methodology with sample data to verify fixes
const fetch = require('node-fetch');

async function testZScoreImplementation() {
  console.log('🧪 Testing Z-score methodology fixes...');
  
  try {
    const response = await fetch('http://localhost:5000/api/etf/technical-clean');
    const data = await response.json();
    
    console.log('API Response:', {
      success: data.success,
      dataCount: data.data?.length || 0,
      timestamp: data.timestamp,
      source: data.source
    });
    
    if (data.data && data.data.length > 0) {
      const spy = data.data.find(etf => etf.symbol === 'SPY');
      if (spy) {
        console.log('SPY Z-score Analysis:', {
          symbol: spy.symbol,
          macd: spy.macd,
          macdZScore: spy.macdZScore,
          rsi: spy.rsi, 
          rsiZScore: spy.rsiZScore,
          compositeZScore: spy.zScore,
          signal: spy.signal
        });
        
        // Check if Z-scores are in reasonable range
        const reasonableRange = Math.abs(spy.macdZScore) <= 3;
        console.log(`Z-score in reasonable range (±3): ${reasonableRange ? '✅' : '❌'}`);
      }
    } else {
      console.log('❌ No ETF data available - likely API rate limits');
    }
    
  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testZScoreImplementation();