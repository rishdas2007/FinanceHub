// Test the enhanced economic insight classifier with real GDP data
const { EconomicInsightClassifier } = require('./server/services/economic-insight-classifier.js');

const classifier = new EconomicInsightClassifier();

// Test with the actual GDP data from the system
const gdpIndicator = {
  metric: "GDP Growth Rate",
  zScore: 1.2242326204776057,        // Above historical average
  deltaZScore: 1.6444434500722884,   // Rising trend
  category: "Growth",
  currentReading: "3.0%",
  priorReading: "2.8%",
  varianceVsPrior: "+0.2%",
  frequency: "Quarterly"
};

console.log("=== Enhanced Economic Insight Classification Test ===");
console.log("\nGDP Input:");
console.log(`Metric: ${gdpIndicator.metric}`);
console.log(`Z-Score: ${gdpIndicator.zScore.toFixed(2)} (above average)`);
console.log(`Delta Z-Score: ${gdpIndicator.deltaZScore.toFixed(2)} (rising)`);
console.log(`Current Reading: ${gdpIndicator.currentReading}`);

const result = classifier.classifyIndicator(gdpIndicator);

console.log("\n=== ENHANCED CLASSIFICATION RESULT ===");
console.log(`Overall Signal: ${result.overallSignal.toUpperCase()}`);
console.log(`Level Signal: ${result.levelSignal}`);
console.log(`Trend Signal: ${result.trendSignal}`);
console.log(`Confidence: ${result.confidence}`);
console.log(`Alert Level: ${result.alertLevel}`);
console.log(`\nDetailed Reasoning:`);
console.log(`"${result.reasoning}"`);
console.log(`\nDisplay: ${result.displayIcon} ${result.displayColor}`);

// Test inflation example
const inflationIndicator = {
  metric: "Core CPI (Δ-adjusted)",
  zScore: 0.83,        // Modestly above average  
  deltaZScore: 0.24,   // Trending upward slightly
  category: "Inflation",
  currentReading: "2.9%",
  priorReading: "2.8%",
  varianceVsPrior: "+0.1%",
  frequency: "Monthly"
};

console.log("\n\n=== INFLATION CLASSIFICATION TEST ===");
const inflationResult = classifier.classifyIndicator(inflationIndicator);
console.log(`Overall Signal: ${inflationResult.overallSignal.toUpperCase()}`);
console.log(`Detailed Reasoning:`);
console.log(`"${inflationResult.reasoning}"`);