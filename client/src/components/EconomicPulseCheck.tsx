import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, TrendingUp, TrendingDown, Search, Filter, AlertTriangle } from 'lucide-react';

interface EconomicIndicator {
  metric: string;
  category: string;
  type: string;
  unit: string;
  currentReading: string;
  priorReading: string;
  varianceVsPrior: string;
  zScore?: number;
  deltaZScore?: number;
  frequency?: string;
  period_date?: string;
  releaseDate?: string;
}

interface EconomicDataResponse {
  indicators: EconomicIndicator[];
  aiSummary: string;
  lastUpdated: string;
  source: string;
}

interface EconomicHealthData {
  economicHealthScore: number;
  healthGrade: string;
}

interface EconomicInsightClassification {
  overallSignal: 'positive' | 'negative' | 'mixed' | 'neutral';
  levelSignal: 'positive' | 'negative' | 'neutral';
  trendSignal: 'positive' | 'negative' | 'neutral';
  confidence: 'high' | 'medium' | 'low';
  reasoning: string;
  alertLevel: 'critical' | 'warning' | 'watch' | 'normal';
  displayColor: string;
  displayIcon: string;
}

interface PulseMetric {
  name: string;
  currentValue: number;
  priorValue: number | null;
  zScore: number;
  deltaZScore?: number;
  frequency?: string;
  formattedValue: string;
  formattedPriorValue: string;
  periodDate: string;
  changeFromPrior: number | null;
  formattedChange: string;
  classification?: EconomicInsightClassification;
}

interface PulseData {
  [category: string]: {
    positive: PulseMetric[];
    negative: PulseMetric[];
  };
}

// Comprehensive metric name to unit mapping - same as Economic Indicators Table
const getMetricDisplayUnit = (metricName: string): string => {
  const metricToUnitMap: Record<string, string> = {
    // Growth - millions_dollars
    'Retail Sales': 'millions_dollars',
    'Retail Sales: Food Services': 'millions_dollars',
    'Retail Sales Ex-Auto': 'millions_dollars',
    'E-commerce Retail Sales': 'millions_dollars',
    'Total Construction Spending': 'millions_dollars',
    'Durable Goods Orders': 'millions_dollars',
    'Consumer Durable Goods New Orders': 'millions_dollars',
    
    // Growth - thousands
    'Housing Starts': 'thousands',
    'New Home Sales': 'thousands',
    'Existing Home Sales': 'thousands',
    'Building Permits': 'thousands',
    'Nonfarm Payrolls': 'thousands',
    'Initial Jobless Claims': 'thousands',
    'Continuing Jobless Claims': 'thousands',
    'JOLTS Hires': 'thousands',
    'JOLTS Job Openings': 'thousands',
    
    // Growth - percent
    'GDP Growth Rate (Annualized)': 'percent',
    'Capacity Utilization (Mfg)': 'percent',
    'Personal Savings Rate': 'percent',
    'Industrial Production YoY': 'percent',
    
    // Growth - index
    'Industrial Production': 'index',
    'US Leading Economic Index': 'index',
    'Leading Economic Index': 'index',
    'ISM Manufacturing PMI': 'index',
    'S&P Global Manufacturing PMI': 'index',
    
    // Growth - chained_dollars (trillions)
    'Real Disposable Personal Income': 'chained_dollars',
    
    // Growth - months_supply
    'Months Supply of Homes': 'months_supply',
    
    // Labor - percent
    'Unemployment Rate': 'percent',
    'U-6 Unemployment Rate': 'percent',
    'Employment Population Ratio': 'percent',
    'Labor Force Participation Rate': 'percent',
    'JOLTS Quit Rate': 'percent',
    
    // Labor - dollars_per_hour
    'Average Hourly Earnings': 'dollars_per_hour',
    
    // Labor - hours
    'Average Weekly Hours': 'hours',
    
    // Inflation - percent
    'CPI Year-over-Year': 'percent',
    'Core CPI Year-over-Year': 'percent',
    'Core PCE Price Index YoY': 'percent',
    'Producer Price Index YoY': 'percent',
    'Core PPI': 'percent',
    'CPI Energy': 'percent',
    'CPI Food': 'percent',
    
    // Monetary Policy - percent
    'Federal Funds Rate': 'percent',
    '10-Year Treasury Yield': 'percent',
    '2-Year Treasury Yield': 'percent',
    'Yield Curve (10yr-2yr)': 'basis_points',
    'Mortgage Rates': 'percent',
    
    // Monetary Policy - billions_dollars
    'Commercial & Industrial Loans': 'billions_dollars',
    
    // Sentiment - index
    'Consumer Confidence Index': 'index',
    'University of Michigan Sentiment': 'index'
  };

  return metricToUnitMap[metricName] || 'units';
};

const formatNumber = (value: number, unit: string): string => {
  const numValue = Number(value);
  
  if (isNaN(numValue)) return '0';
  
  switch (unit) {
    case 'millions_dollars':
      return '$' + numValue.toFixed(1) + 'M';
    case 'billions_dollars':
      return '$' + numValue.toFixed(1) + 'B';
    case 'thousands':
      return numValue.toFixed(1) + 'K';
    case 'percent':
      return numValue.toFixed(2) + '%';
    case 'index':
      return numValue.toFixed(1);
    case 'basis_points':
      return numValue.toFixed(0) + ' bps';
    case 'dollars_per_hour':
      return '$' + numValue.toFixed(2);
    case 'hours':
      return numValue.toFixed(1) + ' hrs';
    case 'months_supply':
      return numValue.toFixed(1) + ' months';
    case 'chained_dollars': // For Real Disposable Personal Income (trillions)
      return '$' + numValue.toFixed(2) + 'T';
    case 'dollars_per_gallon':
      return '$' + numValue.toFixed(2) + '/gal';
    case 'units': // Generic units
      return numValue.toLocaleString();
    default:
      return numValue.toFixed(2);
  }
};

const formatValue = (value: number, metricName: string): string => {
  const unit = getMetricDisplayUnit(metricName);
  return formatNumber(value, unit);
};

export function EconomicPulseCheck() {
  // Filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [dateRangeFilter, setDateRangeFilter] = useState('all');
  const [zScoreFilter, setZScoreFilter] = useState('all');
  const [deltaZScoreFilter, setDeltaZScoreFilter] = useState('significant');

  const {
    data: economicData,
    isLoading,
    error
  } = useQuery<EconomicDataResponse>({
    queryKey: ['/api/macroeconomic-indicators'],
    staleTime: 0, // Always fetch fresh data to avoid caching issues
    gcTime: 1 * 60 * 1000, // 1 minute
  });

  const {
    data: healthData,
    isLoading: healthLoading
  } = useQuery<EconomicHealthData>({
    queryKey: ['/api/economic-health/dashboard'],
    staleTime: 0,
    gcTime: 1 * 60 * 1000,
  });

  console.log('📊 EconomicPulseCheck - Data:', economicData);
  console.log('📊 EconomicPulseCheck - Loading:', isLoading);
  console.log('📊 EconomicPulseCheck - Error:', error);

  // Generate data-driven analysis based on actual economic indicators
  const generateDataDrivenAnalysis = (indicators: EconomicIndicator[], score: number) => {
    if (!indicators || indicators.length === 0) {
      return {
        message: "No economic data available for analysis.",
        riskLevel: "UNKNOWN Alert Level",
        alertClass: "text-gray-400"
      };
    }

    const positiveSignals: string[] = [];
    const negativeSignals: string[] = [];
    
    // Analyze indicators by z-score and category
    indicators.forEach(indicator => {
      const zScore = indicator.zScore || 0;
      const metric = indicator.metric;
      
      if (Math.abs(zScore) > 1.2) { // Significant deviation
        if (zScore > 1.2) {
          if (metric.toLowerCase().includes('unemployment')) {
            negativeSignals.push(`${metric} elevated`);
          } else {
            positiveSignals.push(`${metric} strong performance`);
          }
        } else if (zScore < -1.2) {
          if (metric.toLowerCase().includes('unemployment')) {
            positiveSignals.push(`${metric} remains low`);
          } else {
            negativeSignals.push(`${metric} showing weakness`);
          }
        }
      }
    });

    // Count by category for broader insights
    const categoryStrength = ['Growth', 'Labor', 'Inflation', 'Monetary Policy'].map(category => {
      const categoryIndicators = indicators.filter(ind => ind.category === category);
      const avgZScore = categoryIndicators.reduce((sum, ind) => sum + (ind.zScore || 0), 0) / categoryIndicators.length;
      return { category, strength: avgZScore };
    });

    const strongCategories = categoryStrength.filter(c => c.strength > 0.5).map(c => c.category);
    const weakCategories = categoryStrength.filter(c => c.strength < -0.5).map(c => c.category);

    // Generate summary message
    let message = "";
    if (positiveSignals.length > negativeSignals.length) {
      message = `Economic indicators show predominantly positive signals. ${strongCategories.length > 0 ? strongCategories.join(', ') + ' sectors showing strength.' : ''} ${negativeSignals.length > 0 ? 'Areas of concern include ' + negativeSignals.slice(0, 2).join(', ') + '.' : ''}`;
    } else if (negativeSignals.length > positiveSignals.length) {
      message = `Economic data reveals concerning trends across multiple indicators. ${weakCategories.length > 0 ? weakCategories.join(', ') + ' sectors showing weakness.' : ''} ${positiveSignals.length > 0 ? 'Bright spots include ' + positiveSignals.slice(0, 2).join(', ') + '.' : ''}`;
    } else {
      message = `Mixed signals across economic indicators with balanced positive and negative developments. ${strongCategories.length > 0 ? strongCategories.join(', ') + ' showing strength,' : ''} ${weakCategories.length > 0 ? ' while ' + weakCategories.join(', ') + ' showing weakness.' : ''}`;
    }

    // Determine alert level based on score and signal balance
    let riskLevel: string;
    let alertClass: string;
    
    if (score >= 75 || positiveSignals.length >= negativeSignals.length * 2) {
      riskLevel = "LOW Alert Level";
      alertClass = "text-gain-green";
    } else if (score >= 50 || Math.abs(positiveSignals.length - negativeSignals.length) <= 2) {
      riskLevel = "MODERATE Alert Level";
      alertClass = "text-yellow-400";
    } else {
      riskLevel = "HIGH Alert Level";
      alertClass = "text-loss-red";
    }

    return { message, riskLevel, alertClass };
  };

  // Helper function to provide contextual interpretation of Economic Health Score
  const getScoreInterpretation = (score: number): { message: string; riskLevel: string; alertClass: string } => {
    // Use data-driven analysis if indicators are available
    if (economicData?.indicators && economicData.indicators.length > 0) {
      return generateDataDrivenAnalysis(economicData.indicators, score);
    }
    
    // Fallback to basic score interpretation
    if (score >= 75) {
      return {
        message: "Economic health score indicates favorable conditions across measured indicators.",
        riskLevel: "LOW Alert Level",
        alertClass: "text-gain-green"
      };
    } else if (score >= 50) {
      return {
        message: "Economic health score suggests mixed conditions requiring monitoring.",
        riskLevel: "MODERATE Alert Level", 
        alertClass: "text-yellow-400"
      };
    } else {
      return {
        message: "Economic health score indicates elevated risks across multiple indicators.",
        riskLevel: "HIGH Alert Level",
        alertClass: "text-loss-red"
      };
    }
  };
  
  // Log first few indicators to check period_date values
  if (economicData?.indicators && economicData.indicators.length > 0) {
    console.log('📅 Sample indicators with dates:', economicData.indicators.slice(0, 3).map(ind => ({
      metric: ind.metric,
      period_date: ind.period_date,
      releaseDate: ind.releaseDate,
      zScore: ind.zScore,
      deltaZScore: ind.deltaZScore
    })));
  }

  // Filter indicators based on filter criteria
  const filteredIndicators = economicData?.indicators?.filter(indicator => {
    // Search filter
    const matchesSearch = searchTerm === '' || 
      indicator.metric.toLowerCase().includes(searchTerm.toLowerCase());

    // Category filter  
    const matchesCategory = categoryFilter === 'all' || indicator.category === categoryFilter;

    // Type filter
    const matchesType = typeFilter === 'all' || indicator.type === typeFilter;

    // Date range filter
    let matchesDateRange = true;
    if (dateRangeFilter !== 'all' && indicator.period_date) {
      const indicatorDate = new Date(indicator.period_date);
      const now = new Date();
      
      switch (dateRangeFilter) {
        case 'last7days':
          matchesDateRange = indicatorDate >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case 'last30days':
          matchesDateRange = indicatorDate >= new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case 'last90days':
          matchesDateRange = indicatorDate >= new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case 'thismonth':
          matchesDateRange = indicatorDate.getMonth() === now.getMonth() && indicatorDate.getFullYear() === now.getFullYear();
          break;
        case 'lastmonth':
          const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1);
          matchesDateRange = indicatorDate.getMonth() === lastMonth.getMonth() && indicatorDate.getFullYear() === lastMonth.getFullYear();
          break;
      }
    }

    // Delta Z-Score filter
    let matchesDeltaZScore = true;
    if (deltaZScoreFilter !== 'all' && indicator.deltaZScore !== undefined) {
      const deltaZScore = indicator.deltaZScore;
      switch (deltaZScoreFilter) {
        case 'extreme':
          matchesDeltaZScore = Math.abs(deltaZScore) > 2;
          break;
        case 'significant':
          matchesDeltaZScore = Math.abs(deltaZScore) > 1;
          break;
        case 'positive':
          matchesDeltaZScore = deltaZScore > 0;
          break;
        case 'negative':
          matchesDeltaZScore = deltaZScore < 0;
          break;
      }
    }

    // Z-Score filter
    let matchesZScore = true;
    if (zScoreFilter !== 'all' && indicator.zScore !== undefined) {
      const zScore = indicator.zScore;
      switch (zScoreFilter) {
        case 'high':
          matchesZScore = Math.abs(zScore) > 2;
          break;
        case 'significant':
          matchesZScore = Math.abs(zScore) > 1;
          break;
        case 'positive':
          matchesZScore = zScore > 0;
          break;
        case 'negative':
          matchesZScore = zScore < 0;
          break;
      }
    }

    return matchesSearch && matchesCategory && matchesType && matchesDateRange && matchesZScore && matchesDeltaZScore;
  }) || [];

  // Client-side Economic Insight Classifier
  const classifyIndicator = (indicator: any): EconomicInsightClassification => {
    const zScore = indicator.zScore || 0;
    const deltaZScore = indicator.deltaZScore || 0;
    const metricName = indicator.metric.toLowerCase();

    // Get economic directionality
    const isInverse = metricName.includes('unemployment') || 
                      metricName.includes('inflation') || 
                      metricName.includes('cpi') || 
                      metricName.includes('pce') || 
                      metricName.includes('ppi') ||
                      metricName.includes('yield') ||
                      metricName.includes('rate');

    // Classify level and trend signals
    const levelSignal = Math.abs(zScore) < 0.5 ? 'neutral' : 
                       (isInverse ? (zScore > 0 ? 'positive' : 'negative') : (zScore > 0 ? 'positive' : 'negative'));
    
    const trendSignal = Math.abs(deltaZScore) < 0.5 ? 'neutral' : 
                       (isInverse ? (deltaZScore > 0 ? 'negative' : 'positive') : (deltaZScore > 0 ? 'positive' : 'negative'));

    // Determine overall signal with sophisticated logic for inflation
    let overallSignal: 'positive' | 'negative' | 'mixed' | 'neutral' = 'neutral';
    
    if (metricName.includes('inflation') || metricName.includes('cpi') || metricName.includes('pce') || metricName.includes('ppi')) {
      // Rapidly rising inflation (even if low level) = negative
      if (deltaZScore > 1.5 && zScore > -1) {
        overallSignal = 'negative';
      }
      // Low and stable/falling inflation = positive
      else if (zScore > 0.5 && deltaZScore <= 0.5) {
        overallSignal = 'positive';
      }
      // Mixed signals
      else if ((levelSignal === 'positive' && trendSignal === 'negative') ||
               (levelSignal === 'negative' && trendSignal === 'positive')) {
        // Trend takes precedence if significant
        if (Math.abs(deltaZScore) > Math.abs(zScore) && Math.abs(deltaZScore) > 1.0) {
          overallSignal = trendSignal === 'positive' ? 'positive' : 'negative';
        } else {
          overallSignal = 'mixed';
        }
      }
      else {
        overallSignal = levelSignal as any;
      }
    }
    // General classification for other metrics
    else {
      if (levelSignal === trendSignal) {
        overallSignal = levelSignal as any;
      } else if (Math.abs(deltaZScore) > Math.abs(zScore) * 1.5 && Math.abs(deltaZScore) > 1) {
        overallSignal = trendSignal as any;
      } else if (Math.abs(zScore) > Math.abs(deltaZScore) * 1.5 && Math.abs(zScore) > 1) {
        overallSignal = levelSignal as any;
      } else {
        overallSignal = 'mixed';
      }
    }

    // Calculate confidence
    const maxScore = Math.max(Math.abs(zScore), Math.abs(deltaZScore));
    const confidence: 'high' | 'medium' | 'low' = maxScore > 2 ? 'high' : maxScore > 1 ? 'medium' : 'low';

    // Enhanced reasoning with sophisticated economic context
    const levelDesc = Math.abs(zScore) > 2 ? (zScore > 0 ? 'well above historical average' : 'well below historical average') :
                     Math.abs(zScore) > 1 ? (zScore > 0 ? 'modestly above average' : 'modestly below average') : 'near historical average';
    const trendDesc = Math.abs(deltaZScore) > 2 ? (deltaZScore > 0 ? 'trending upward rapidly' : 'trending downward rapidly') :
                     Math.abs(deltaZScore) > 1 ? (deltaZScore > 0 ? 'trending upward' : 'trending downward') : 'stable trend';
    
    let reasoning = '';
    
    // GDP-specific reasoning
    if (metricName.includes('gdp') || metricName.includes('growth')) {
      if (overallSignal === 'mixed' && levelSignal === 'positive' && trendSignal === 'positive') {
        reasoning = `GDP growth ${levelDesc} and ${trendDesc}, but requires assessment of sustainability and potential overheating risks given current economic conditions`;
      } else if (overallSignal === 'positive') {
        reasoning = `GDP growth ${levelDesc} with ${trendDesc}, indicating economic strength and expansion momentum`;
      } else if (overallSignal === 'negative') {
        reasoning = `GDP growth ${levelDesc} with ${trendDesc}, signaling economic weakness and potential contraction risks`;
      } else {
        reasoning = `GDP growth ${levelDesc} with ${trendDesc}`;
      }
    }
    // Inflation-specific reasoning
    else if (metricName.includes('inflation') || metricName.includes('cpi') || metricName.includes('pce') || metricName.includes('ppi')) {
      if (overallSignal === 'mixed') {
        reasoning = `Inflation ${levelDesc} but ${trendDesc} - Fed policy implications and potential acceleration signal require monitoring`;
      } else if (overallSignal === 'positive' && trendDesc.includes('stable')) {
        reasoning = `Inflation ${levelDesc} with ${trendDesc}, supporting Fed's price stability mandate`;
      } else if (overallSignal === 'negative') {
        reasoning = `Inflation ${levelDesc} and ${trendDesc}, indicating price pressures that may constrain economic growth`;
      } else {
        reasoning = `Inflation ${levelDesc} with ${trendDesc}`;
      }
    }
    // Employment-specific reasoning
    else if (metricName.includes('employment') || metricName.includes('unemployment') || metricName.includes('payroll') || metricName.includes('job')) {
      if (overallSignal === 'mixed') {
        reasoning = `Employment ${levelDesc} with ${trendDesc}, creating tension between labor market momentum and foundational strength`;
      } else if (overallSignal === 'positive') {
        reasoning = `Employment ${levelDesc} and ${trendDesc}, indicating robust labor market conditions supporting economic expansion`;
      } else if (overallSignal === 'negative') {
        reasoning = `Employment ${levelDesc} with ${trendDesc}, signaling labor market stress that could impact consumer spending`;
      } else {
        reasoning = `Employment ${levelDesc} with ${trendDesc}`;
      }
    }
    // Interest rate/monetary policy reasoning
    else if (metricName.includes('rate') || metricName.includes('yield') || metricName.includes('funds')) {
      if (overallSignal === 'mixed') {
        reasoning = `Interest rates ${levelDesc} with ${trendDesc}, creating complex monetary policy implications and potential market positioning extremes`;
      } else {
        reasoning = `Interest rates ${levelDesc} and ${trendDesc}, influencing borrowing costs and economic activity`;
      }
    }
    // Default reasoning for other metrics
    else {
      if (overallSignal === 'mixed') {
        reasoning = `Indicator ${levelDesc} but ${trendDesc}, creating conflicting signals across different timeframes that require careful interpretation`;
      } else {
        reasoning = `Indicator ${levelDesc} with ${trendDesc}`;
      }
    }

    // Display properties
    const displayColor = overallSignal === 'positive' ? 'border-green-400' :
                        overallSignal === 'negative' ? 'border-red-400' :
                        overallSignal === 'mixed' ? 'border-yellow-400' : 'border-gray-400';

    const displayIcon = overallSignal === 'mixed' ? 
                       (trendSignal === 'positive' ? '↗️' : trendSignal === 'negative' ? '↘️' : '↔️') :
                       overallSignal === 'positive' ? '✅' :
                       overallSignal === 'negative' ? '🔴' : '⚪';

    const alertLevel: 'critical' | 'warning' | 'watch' | 'normal' = 
      overallSignal === 'negative' && maxScore > 2 ? 'critical' :
      overallSignal === 'negative' && maxScore > 1.5 ? 'warning' :
      overallSignal === 'mixed' && maxScore > 1.5 ? 'watch' : 'normal';

    return {
      overallSignal,
      levelSignal,
      trendSignal,
      confidence,
      reasoning,
      alertLevel,
      displayColor,
      displayIcon
    };
  };

  // Economic rationale explanations for Delta Adjustment
  const getEconomicRationale = (metricName: string): { reason: string; adjustment: string; impact: string } => {
    const metric = metricName.toLowerCase();
    
    // Inflation metrics
    if (metric.includes('cpi') || metric.includes('pce') || metric.includes('ppi') || metric.includes('inflation')) {
      return {
        reason: "Higher inflation reduces purchasing power and economic efficiency",
        adjustment: "Inverted (×-1) so rising inflation shows as negative z-score",
        impact: "Lower inflation = Economic Strength, Higher inflation = Economic Weakness"
      };
    }
    
    // Unemployment metrics
    if (metric.includes('unemployment') || metric.includes('jobless')) {
      return {
        reason: "Higher unemployment indicates economic distress and reduced consumer spending",
        adjustment: "Inverted (×-1) so rising unemployment shows as negative z-score", 
        impact: "Lower unemployment = Economic Strength, Higher unemployment = Economic Weakness"
      };
    }
    
    // Interest rate metrics
    if (metric.includes('federal funds') || metric.includes('treasury yield') || metric.includes('interest rate')) {
      return {
        reason: "Higher rates can restrict economic activity and borrowing",
        adjustment: "Inverted (×-1) as extreme rate changes typically signal economic stress",
        impact: "Moderate rates = Economic Strength, Extreme rates = Economic Weakness"
      };
    }
    
    // Growth metrics (GDP, employment, housing, etc.)
    if (metric.includes('gdp') || metric.includes('payrolls') || metric.includes('housing') || 
        metric.includes('earnings') || metric.includes('employment') || metric.includes('construction')) {
      return {
        reason: "Higher values indicate increased economic activity and prosperity",
        adjustment: "No adjustment (×1) - higher values naturally show as positive z-scores",
        impact: "Higher values = Economic Strength, Lower values = Economic Weakness"
      };
    }
    
    // Default for other metrics
    return {
      reason: "Economic impact varies based on specific metric characteristics",
      adjustment: "Adjusted based on historical economic relationships",
      impact: "Interpretation depends on economic context and historical patterns"
    };
  };

  const processPulseData = (): PulseData => {
    const pulseData: PulseData = {
      Growth: { positive: [], negative: [] },
      Inflation: { positive: [], negative: [] },
      Labor: { positive: [], negative: [] },
      'Monetary Policy': { positive: [], negative: [] },
      Sentiment: { positive: [], negative: [] }
    };

    if (!filteredIndicators || filteredIndicators.length === 0) {
      console.log('📊 No filtered economic data indicators found');
      return pulseData;
    }

    console.log(`📊 Processing ${filteredIndicators.length} filtered indicators for statistical alerts`);

    // Process all indicators (show all z-scores)
    let alertCount = 0;
    filteredIndicators.forEach(indicator => {
      if (indicator.zScore !== undefined && indicator.zScore !== null) {
        alertCount++;
        console.log(`📈 Alert for ${indicator.metric}: z-score ${indicator.zScore}, category ${indicator.category}`);
        // Parse numeric values from formatted strings
        const currentValueStr = indicator.currentReading.replace(/[^\d.\-]/g, '');
        const priorValueStr = indicator.priorReading.replace(/[^\d.\-]/g, '');
        const currentValue = parseFloat(currentValueStr) || 0;
        const priorValue = parseFloat(priorValueStr) || 0;
        
        // Parse variance handling parentheses for negative values
        let varianceValue = 0;
        if (indicator.varianceVsPrior && indicator.varianceVsPrior !== 'N/A') {
          const varianceStr = indicator.varianceVsPrior.replace(/[^\d.\-()]/g, '');
          if (varianceStr.includes('(') && varianceStr.includes(')')) {
            varianceValue = -parseFloat(varianceStr.replace(/[()]/g, ''));
          } else {
            varianceValue = parseFloat(varianceStr) || 0;
          }
        }
        
        // Use the most recent period_date from backend data
        const actualPeriodDate = indicator.period_date || indicator.releaseDate || new Date().toISOString().split('T')[0];
        console.log(`📅 Date for ${indicator.metric}: period_date=${indicator.period_date}, releaseDate=${indicator.releaseDate}, using=${actualPeriodDate}`);
        
        // Apply sophisticated multi-dimensional classification
        const classification = classifyIndicator(indicator);
        
        const pulseMetric: PulseMetric = {
          name: indicator.metric,
          currentValue: currentValue,
          priorValue: priorValue,
          zScore: indicator.zScore,
          deltaZScore: indicator.deltaZScore,
          frequency: indicator.frequency,
          formattedValue: indicator.currentReading,
          formattedPriorValue: indicator.priorReading,
          periodDate: actualPeriodDate, // Use actual period_date from database
          changeFromPrior: varianceValue,
          formattedChange: indicator.varianceVsPrior || 'N/A',
          classification: classification
        };

        // Use sophisticated classification instead of simple z-score sign
        if (classification.overallSignal === 'positive') {
          if (pulseData[indicator.category]) {
            pulseData[indicator.category].positive.push(pulseMetric);
          }
        } else if (classification.overallSignal === 'negative' || classification.overallSignal === 'mixed') {
          if (pulseData[indicator.category]) {
            pulseData[indicator.category].negative.push(pulseMetric);
          }
        }
        // Neutral signals are not displayed in the pulse check
      }
    });

    console.log(`📊 Total statistical alerts found: ${alertCount}`);

    // Sort by z-score descending for each category
    Object.keys(pulseData).forEach(category => {
      pulseData[category].positive.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
      pulseData[category].negative.sort((a, b) => Math.abs(b.zScore) - Math.abs(a.zScore));
    });

    return pulseData;
  };

  if (isLoading) {
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Activity className="h-5 w-5 text-blue-400" />
            <span>Economic Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-3">
            <div className="h-4 bg-gray-700 rounded w-3/4"></div>
            <div className="grid grid-cols-5 gap-4">
              {Array.from({ length: 10 }).map((_, i) => (
                <div key={i} className="h-20 bg-gray-700 rounded"></div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error && !economicData) {
    console.error('📊 Query error and no data available:', error);
    return (
      <Card className="bg-financial-card border-financial-border">
        <CardHeader>
          <CardTitle className="text-white flex items-center space-x-2">
            <Activity className="h-5 w-5 text-blue-400" />
            <span>Economic Analysis</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-400">Failed to load statistical analysis. Please try again.</p>
          <p className="text-gray-400 text-sm mt-2">Error: {String(error)}</p>
        </CardContent>
      </Card>
    );
  }

  // Process the data after all checks  
  const pulseData = processPulseData();
  const categories = ['Growth', 'Inflation', 'Labor', 'Monetary Policy', 'Sentiment'];
  
  // Calculate summary statistics for each category
  const calculateSummaryStats = () => {
    const summaryStats: Record<string, { positive: number; negative: number }> = {};
    categories.forEach(category => {
      summaryStats[category] = {
        positive: pulseData[category]?.positive.length || 0,
        negative: pulseData[category]?.negative.length || 0
      };
    });
    return summaryStats;
  };
  
  const summaryStats = calculateSummaryStats();

  // Generate critical insights based on statistical findings
  const generateCriticalInsights = () => {
    const insights: Array<{text: string, type: 'positive' | 'negative' | 'neutral'}> = [];
    
    if (!filteredIndicators || filteredIndicators.length === 0) {
      return [{text: "No indicators available for analysis", type: 'neutral' as const}];
    }

    // Find extreme z-scores
    const extremePositive = filteredIndicators.filter(ind => (ind.zScore || 0) > 2);
    const extremeNegative = filteredIndicators.filter(ind => (ind.zScore || 0) < -2);
    const strongPositive = filteredIndicators.filter(ind => (ind.zScore || 0) > 1.5 && (ind.zScore || 0) <= 2);
    const strongNegative = filteredIndicators.filter(ind => (ind.zScore || 0) < -1.5 && (ind.zScore || 0) >= -2);

    // Labor market insights
    const unemploymentInd = filteredIndicators.find(ind => ind.metric.toLowerCase().includes('unemployment'));
    const payrollsInd = filteredIndicators.find(ind => ind.metric.toLowerCase().includes('payroll'));
    
    if (unemploymentInd && (unemploymentInd.zScore || 0) < -1) {
      insights.push({
        text: `Unemployment at exceptional low (${(unemploymentInd.zScore || 0).toFixed(1)}σ below average) indicates strong labor market`,
        type: 'positive'
      });
    }

    if (payrollsInd && (payrollsInd.zScore || 0) > 1) {
      insights.push({
        text: `Job creation above historical trend (${(payrollsInd.zScore || 0).toFixed(1)}σ) signals employment strength`,
        type: 'positive'
      });
    }

    // GDP and growth insights
    const gdpInd = filteredIndicators.find(ind => ind.metric.toLowerCase().includes('gdp'));
    if (gdpInd && Math.abs(gdpInd.zScore || 0) > 1) {
      insights.push({
        text: `GDP growth at ${(gdpInd.zScore || 0).toFixed(1)}σ ${(gdpInd.zScore || 0) > 0 ? 'above' : 'below'} long-term average`,
        type: (gdpInd.zScore || 0) > 0 ? 'positive' : 'negative'
      });
    }

    // Inflation insights
    const cpiInd = filteredIndicators.find(ind => ind.metric.toLowerCase().includes('cpi') && !ind.metric.toLowerCase().includes('energy'));
    if (cpiInd && Math.abs(cpiInd.zScore || 0) > 1) {
      const isHigh = (cpiInd.zScore || 0) > 1;
      insights.push({
        text: `Core inflation ${isHigh ? 'elevated' : 'subdued'} at ${(cpiInd.zScore || 0).toFixed(1)}σ ${isHigh ? 'above' : 'below'} historical levels`,
        type: isHigh ? 'negative' : 'positive'
      });
    }

    // Housing market insights
    const housingInd = filteredIndicators.find(ind => ind.metric.toLowerCase().includes('housing') || ind.metric.toLowerCase().includes('home'));
    if (housingInd && Math.abs(housingInd.zScore || 0) > 1) {
      insights.push({
        text: `Housing activity ${(housingInd.zScore || 0) > 0 ? 'robust' : 'weak'} at ${(housingInd.zScore || 0).toFixed(1)}σ from trend`,
        type: (housingInd.zScore || 0) > 0 ? 'positive' : 'negative'
      });
    }

    // Statistical extremes
    if (extremePositive.length > 0) {
      insights.push({
        text: `${extremePositive.length} indicators showing exceptional strength (>2σ above average)`,
        type: 'positive'
      });
    }

    if (extremeNegative.length > 0) {
      insights.push({
        text: `${extremeNegative.length} indicators at critical weakness levels (<-2σ below average)`,
        type: 'negative'
      });
    }

    // Category-specific insights
    const categoryStats = calculateSummaryStats();
    Object.entries(categoryStats).forEach(([category, stats]) => {
      const total = stats.positive + stats.negative;
      if (total > 0) {
        const positiveRatio = stats.positive / total;
        if (positiveRatio >= 0.8) {
          insights.push({
            text: `${category} sector showing broad-based strength (${Math.round(positiveRatio * 100)}% positive signals)`,
            type: 'positive'
          });
        } else if (positiveRatio <= 0.2) {
          insights.push({
            text: `${category} sector under pressure (${Math.round((1-positiveRatio) * 100)}% negative signals)`,
            type: 'negative'
          });
        }
      }
    });

    // Fallback if no insights generated
    if (insights.length === 0) {
      insights.push({
        text: "Economic indicators showing mixed signals with no clear statistical extremes",
        type: 'neutral'
      });
    }

    return insights.slice(0, 5); // Limit to 5 most important insights
  };

  return (
    <Card className="bg-financial-card border-financial-border">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-white flex items-center space-x-2">
            <Activity className="h-5 w-5 text-blue-400" />
            <span>Critical Economic Insights</span>
          </CardTitle>
          <div className="text-sm text-blue-400 font-medium">
            📊 {filteredIndicators.length} indicators filtered
          </div>
        </div>

        {/* Delta Adjustment Methodology Explanation */}
        <div className="mb-6 p-4 bg-gradient-to-r from-blue-900/20 to-purple-900/20 rounded-lg border border-blue-500/30">
          <div className="text-sm font-medium text-blue-400 mb-3 flex items-center">
            <div className="h-4 w-4 mr-2 text-blue-400">📊</div>
            Delta Adjustment Methodology
          </div>
          <div className="text-xs text-gray-300 space-y-2">
            <p>
              <strong className="text-blue-400">How We Interpret Economic Signals:</strong> This system applies "Delta Adjustment" to create consistent interpretation across all indicators.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              <div className="bg-green-900/20 p-3 rounded border-l-2 border-green-400">
                <strong className="text-green-400">Positive Z-Scores = Economic Strength</strong>
                <ul className="text-xs mt-1 space-y-1">
                  <li>• GDP Growth: Higher growth = positive signal</li>
                  <li>• Unemployment (Δ-adjusted): Lower unemployment = positive signal</li>
                  <li>• Inflation (Δ-adjusted): Lower inflation = positive signal</li>
                </ul>
              </div>
              <div className="bg-red-900/20 p-3 rounded border-l-2 border-red-400">
                <strong className="text-red-400">Negative Z-Scores = Economic Weakness</strong>
                <ul className="text-xs mt-1 space-y-1">
                  <li>• GDP Growth: Below-trend growth = negative signal</li>
                  <li>• Unemployment (Δ-adjusted): High unemployment = negative signal</li>
                  <li>• Inflation (Δ-adjusted): High inflation = negative signal</li>
                </ul>
              </div>
            </div>
            <p className="text-xs text-gray-400 mt-2">
              <strong>Note:</strong> Indicators marked "(Δ-adjusted)" have been mathematically inverted so higher values in concerning metrics (like unemployment, inflation) show as negative z-scores for intuitive interpretation.
            </p>
          </div>
        </div>

        {/* Critical Insights Summary */}
        <div className="mb-6 p-4 bg-financial-gray rounded-lg border border-financial-border">
          <div className="text-sm font-medium text-blue-400 mb-3 flex items-center">
            <AlertTriangle className="h-4 w-4 mr-2" />
            Key Statistical Findings
          </div>
          <div className="space-y-2">
            {generateCriticalInsights().map((insight, index) => (
              <div key={index} className={`text-sm ${insight.type === 'positive' ? 'text-green-400' : insight.type === 'negative' ? 'text-red-400' : 'text-yellow-400'}`}>
                • {insight.text}
              </div>
            ))}
          </div>
        </div>



        {/* Enhanced Filter Controls */}
        <div className="bg-financial-gray p-4 rounded-lg border border-blue-500/30 mb-4">
          <div className="text-sm font-medium text-blue-400 mb-3 flex items-center">
            <Filter className="h-4 w-4 mr-2" />
            Filter & Search Critical Insights
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4 items-center">
            <div className="flex items-center space-x-2">
              <Search className="h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search indicators..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-financial-gray border border-financial-border rounded px-3 py-2 text-white placeholder-gray-400 focus:border-blue-400 focus:outline-none w-full"
              />
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-gray-400 text-sm">Category:</span>
              <select
                value={categoryFilter}
                onChange={(e) => setCategoryFilter(e.target.value)}
                className="bg-financial-gray border border-financial-border rounded px-3 py-2 text-white focus:border-blue-400 focus:outline-none w-full"
              >
                <option value="all">All Categories</option>
                <option value="Growth">Growth</option>
                <option value="Inflation">Inflation</option>
                <option value="Labor">Labor</option>
                <option value="Monetary Policy">Monetary Policy</option>
                <option value="Sentiment">Sentiment</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <Filter className="h-4 w-4 text-gray-400" />
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="bg-financial-gray border border-financial-border rounded px-3 py-2 text-white focus:border-blue-400 focus:outline-none w-full"
              >
                <option value="all">All Types</option>
                <option value="Leading">Leading</option>
                <option value="Coincident">Coincident</option>
                <option value="Lagging">Lagging</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-gray-400 text-sm">Date Range:</span>
              <select
                value={dateRangeFilter}
                onChange={(e) => setDateRangeFilter(e.target.value)}
                className="bg-financial-gray border border-financial-border rounded px-3 py-2 text-white focus:border-blue-400 focus:outline-none w-full"
              >
                <option value="all">All Dates</option>
                <option value="last7days">Last 7 Days</option>
                <option value="last30days">Last 30 Days</option>
                <option value="last90days">Last 90 Days</option>
                <option value="thismonth">This Month</option>
                <option value="lastmonth">Last Month</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-gray-400 text-sm">Z-Score:</span>
              <select
                value={zScoreFilter}
                onChange={(e) => setZScoreFilter(e.target.value)}
                className="bg-financial-gray border border-financial-border rounded px-3 py-2 text-white focus:border-blue-400 focus:outline-none w-full"
              >
                <option value="all">All Z-Scores</option>
                <option value="high">High (|z| {'>'} 2)</option>
                <option value="significant">Significant (|z| {'>'} 1)</option>
                <option value="positive">Positive (z {'>'} 0)</option>
                <option value="negative">Negative (z {'<'} 0)</option>
              </select>
            </div>
            
            <div className="flex items-center space-x-2">
              <span className="text-gray-400 text-sm">Δ Z-Score:</span>
              <select
                value={deltaZScoreFilter}
                onChange={(e) => setDeltaZScoreFilter(e.target.value)}
                className="bg-financial-gray border border-financial-border rounded px-3 py-2 text-white focus:border-blue-400 focus:outline-none w-full"
              >
                <option value="all">All Δ Z-Scores</option>
                <option value="extreme">Extreme (|Δz| {'>'} 2)</option>
                <option value="significant">Significant (|Δz| {'>'} 1)</option>
                <option value="positive">Positive (Δz {'>'} 0)</option>
                <option value="negative">Negative (Δz {'<'} 0)</option>
              </select>
            </div>
          </div>
          
          <div className="flex items-center mt-4">
            <button
              onClick={() => {
                setSearchTerm('');
                setCategoryFilter('all');
                setTypeFilter('all');
                setDateRangeFilter('all');
                setZScoreFilter('all');
                setDeltaZScoreFilter('significant');
              }}
              className="bg-red-600 hover:bg-red-700 text-white px-3 py-2 rounded-lg transition-colors text-sm font-medium"
            >
              Clear All Filters
            </button>
          </div>
        </div>
        
        {/* Summary Statistics */}
        <div className="mt-4 grid grid-cols-5 gap-3">
          {categories.map(category => (
            <div key={category} className="bg-financial-gray rounded-lg p-3 border border-financial-border">
              <div className="text-xs font-medium text-gray-400 mb-2">{category}</div>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-1">
                  <TrendingUp className="h-3 w-3 text-gain-green" />
                  <span className="text-sm font-bold text-gain-green">{summaryStats[category]?.positive || 0}</span>
                </div>
                <div className="flex items-center space-x-1">
                  <TrendingDown className="h-3 w-3 text-loss-red" />
                  <span className="text-sm font-bold text-loss-red">{summaryStats[category]?.negative || 0}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
        
        {/* Enhanced Multi-Dimensional Classification Explanation */}
        <div className="mt-3 p-4 bg-gradient-to-r from-gray-900 to-gray-800 border border-gray-700 rounded-lg">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <h4 className="text-sm font-semibold text-blue-400 mb-2">📊 Level Analysis</h4>
              <p className="text-xs text-gray-400">
                Compares current values to 12-month historical averages using z-scores. Values above ±2.0 are statistically significant.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-yellow-400 mb-2">📈 Trend Analysis</h4>
              <p className="text-xs text-gray-400">
                Examines period-to-period changes via Delta Z-scores, detecting unusual acceleration or deceleration patterns.
              </p>
            </div>
            <div>
              <h4 className="text-sm font-semibold text-purple-400 mb-2">🎯 Multi-Signal Classification</h4>
              <p className="text-xs text-gray-400">
                Combines level + trend analysis for sophisticated economic interpretation, including "Mixed" signals for conflicting indicators.
              </p>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-gray-700">
            <div className="flex items-center space-x-6 text-xs">
              <div className="flex items-center space-x-2">
                <span className="text-green-400">✅</span>
                <span className="text-gray-400">Economic Strength</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-red-400">🔴</span>
                <span className="text-gray-400">Economic Weakness</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-yellow-400">⚠️</span>
                <span className="text-gray-400">Mixed Signals</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-blue-400">↗️</span>
                <span className="text-gray-400">Directional Trends</span>
              </div>
            </div>
          </div>
        </div>
        
        <p className="text-gray-400 text-sm mt-4">
          Displaying indicators with significant delta z-scores (|Δz| &gt; 1) showing period-to-period changes exceeding 1.0 standard deviations from historical volatility patterns.
        </p>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-sm font-medium text-gray-400 px-4 py-2 w-32">Category</th>
                <th className="text-left text-sm font-medium text-gain-green px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <TrendingUp className="h-4 w-4" />
                    <span>Positive Z-Scores</span>
                  </div>
                </th>
                <th className="text-left text-sm font-medium text-loss-red px-4 py-2">
                  <div className="flex items-center space-x-2">
                    <TrendingDown className="h-4 w-4" />
                    <span>Negative Z-Scores</span>
                  </div>
                </th>
              </tr>
            </thead>
            <tbody>
              {categories.map(category => (
                <tr key={category} className="border-t border-financial-border">
                  <td className="px-4 py-4 align-top">
                    <div className="text-sm font-medium text-white">
                      {category}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="space-y-2 min-h-[60px]">
                      {pulseData[category]?.positive.slice(0, category === 'Growth' ? 8 : 4).map((metric, idx) => (
                        <div key={idx} className={`bg-financial-gray rounded-lg p-3 border-l-4 ${metric.classification?.displayColor || 'border-gain-green'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 mr-3">
                              <div className="font-medium text-white text-sm mb-1 cursor-help group relative flex items-center" title={metric.name}>
                                <span className="mr-2">{metric.classification?.displayIcon || '✅'}</span>
                                {metric.name}
                                {metric.classification?.overallSignal === 'mixed' && (
                                  <span className="ml-2 text-xs bg-yellow-900 text-yellow-300 px-2 py-1 rounded">
                                    MIXED
                                  </span>
                                )}
                                {/* Economic Rationale Tooltip */}
                                <div className="invisible group-hover:visible absolute z-50 w-80 p-3 mt-2 text-xs text-white bg-gray-900 border border-gray-600 rounded-lg shadow-lg">
                                  <div className="space-y-2">
                                    <div>
                                      <strong className="text-blue-400">Economic Rationale:</strong>
                                      <p className="text-gray-300">{getEconomicRationale(metric.name).reason}</p>
                                    </div>
                                    <div>
                                      <strong className="text-yellow-400">Delta Adjustment:</strong>
                                      <p className="text-gray-300">{getEconomicRationale(metric.name).adjustment}</p>
                                    </div>
                                    <div>
                                      <strong className="text-green-400">Interpretation:</strong>
                                      <p className="text-gray-300">{getEconomicRationale(metric.name).impact}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className={`font-bold text-lg ${metric.classification?.overallSignal === 'positive' ? 'text-gain-green' : 
                                                                   metric.classification?.overallSignal === 'mixed' ? 'text-yellow-400' : 'text-gain-green'}`}>
                                {metric.formattedValue}
                              </div>
                            </div>
                            <div className="text-right">
                              {/* Level Signal */}
                              <div className="text-xs text-gray-400">Level</div>
                              <div className={`text-sm font-bold ${metric.classification?.levelSignal === 'positive' ? 'text-gain-green' : 
                                                                   metric.classification?.levelSignal === 'negative' ? 'text-loss-red' : 'text-gray-400'}`}>
                                {metric.zScore >= 0 ? '+' : ''}{metric.zScore.toFixed(2)}
                              </div>
                              {/* Trend Signal */}
                              {metric.deltaZScore && (
                                <>
                                  <div className="text-xs text-gray-400 mt-1">Trend</div>
                                  <div className={`text-xs font-medium ${metric.classification?.trendSignal === 'positive' ? 'text-gain-green' : 
                                                                         metric.classification?.trendSignal === 'negative' ? 'text-loss-red' : 'text-gray-400'}`}>
                                    {metric.deltaZScore >= 0 ? '+' : ''}{metric.deltaZScore.toFixed(1)}
                                  </div>
                                </>
                              )}
                              {/* Confidence Indicator */}
                              <div className="text-xs text-gray-500 mt-1">
                                {metric.classification?.confidence?.toUpperCase() || 'MED'}
                              </div>
                            </div>
                          </div>
                          {/* Enhanced Reasoning */}
                          {metric.classification?.reasoning && (
                            <div className="text-xs text-gray-400 mb-2">
                              💡 {metric.classification.reasoning}
                            </div>
                          )}
                          <div className="flex justify-between items-center text-xs text-gray-400">
                            <div>
                              <span className="text-gray-500">Prior:</span> <span className="text-white">{metric.formattedPriorValue}</span>
                              <span className="ml-2 text-gray-500">Change:</span> <span className={`ml-1 ${metric.changeFromPrior && metric.changeFromPrior >= 0 ? 'text-gain-green' : 'text-loss-red'}`}>{metric.formattedChange}</span>
                            </div>
                            <div className="text-gray-500">
                              {metric.periodDate !== 'N/A' ? new Date(metric.periodDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                            </div>
                          </div>
                        </div>
                      ))}
                      {pulseData[category]?.positive.length === 0 && (
                        <div className="text-gray-500 text-sm italic py-4">
                          No positive outliers
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-4 align-top">
                    <div className="space-y-2 min-h-[60px]">
                      {pulseData[category]?.negative.slice(0, category === 'Growth' ? 8 : 4).map((metric, idx) => (
                        <div key={idx} className={`bg-financial-gray rounded-lg p-3 border-l-4 ${metric.classification?.displayColor || 'border-loss-red'}`}>
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 mr-3">
                              <div className="font-medium text-white text-sm mb-1 cursor-help group relative flex items-center" title={metric.name}>
                                <span className="mr-2">{metric.classification?.displayIcon || '🔴'}</span>
                                {metric.name}
                                {metric.classification?.overallSignal === 'mixed' && (
                                  <span className="ml-2 text-xs bg-yellow-900 text-yellow-300 px-2 py-1 rounded">
                                    MIXED
                                  </span>
                                )}
                                {metric.classification?.alertLevel === 'critical' && (
                                  <span className="ml-2 text-xs bg-red-900 text-red-300 px-2 py-1 rounded">
                                    CRITICAL
                                  </span>
                                )}
                                {metric.classification?.alertLevel === 'warning' && (
                                  <span className="ml-2 text-xs bg-orange-900 text-orange-300 px-2 py-1 rounded">
                                    WARNING
                                  </span>
                                )}
                                {/* Economic Rationale Tooltip */}
                                <div className="invisible group-hover:visible absolute z-50 w-80 p-3 mt-2 text-xs text-white bg-gray-900 border border-gray-600 rounded-lg shadow-lg">
                                  <div className="space-y-2">
                                    <div>
                                      <strong className="text-blue-400">Economic Rationale:</strong>
                                      <p className="text-gray-300">{getEconomicRationale(metric.name).reason}</p>
                                    </div>
                                    <div>
                                      <strong className="text-yellow-400">Delta Adjustment:</strong>
                                      <p className="text-gray-300">{getEconomicRationale(metric.name).adjustment}</p>
                                    </div>
                                    <div>
                                      <strong className="text-red-400">Interpretation:</strong>
                                      <p className="text-gray-300">{getEconomicRationale(metric.name).impact}</p>
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className={`font-bold text-lg ${metric.classification?.overallSignal === 'negative' ? 'text-loss-red' : 
                                                                   metric.classification?.overallSignal === 'mixed' ? 'text-yellow-400' : 'text-loss-red'}`}>
                                {metric.formattedValue}
                              </div>
                            </div>
                            <div className="text-right">
                              {/* Level Signal */}
                              <div className="text-xs text-gray-400">Level</div>
                              <div className={`text-sm font-bold ${metric.classification?.levelSignal === 'positive' ? 'text-gain-green' : 
                                                                   metric.classification?.levelSignal === 'negative' ? 'text-loss-red' : 'text-gray-400'}`}>
                                {metric.zScore >= 0 ? '+' : ''}{metric.zScore.toFixed(2)}
                              </div>
                              {/* Trend Signal */}
                              {metric.deltaZScore && (
                                <>
                                  <div className="text-xs text-gray-400 mt-1">Trend</div>
                                  <div className={`text-xs font-medium ${metric.classification?.trendSignal === 'positive' ? 'text-gain-green' : 
                                                                         metric.classification?.trendSignal === 'negative' ? 'text-loss-red' : 'text-gray-400'}`}>
                                    {metric.deltaZScore >= 0 ? '+' : ''}{metric.deltaZScore.toFixed(1)}
                                  </div>
                                </>
                              )}
                              {/* Confidence Indicator */}
                              <div className="text-xs text-gray-500 mt-1">
                                {metric.classification?.confidence?.toUpperCase() || 'MED'}
                              </div>
                            </div>
                          </div>
                          {/* Enhanced Reasoning */}
                          {metric.classification?.reasoning && (
                            <div className="text-xs text-gray-400 mb-2">
                              💡 {metric.classification.reasoning}
                            </div>
                          )}
                          <div className="flex justify-between items-center text-xs text-gray-400">
                            <div>
                              <span className="text-gray-500">Prior:</span> <span className="text-white">{metric.formattedPriorValue}</span>
                              <span className="ml-2 text-gray-500">Change:</span> <span className={`ml-1 ${metric.changeFromPrior && metric.changeFromPrior >= 0 ? 'text-gain-green' : 'text-loss-red'}`}>{metric.formattedChange}</span>
                            </div>
                            <div className="text-gray-500">
                              {metric.periodDate !== 'N/A' ? new Date(metric.periodDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) : 'N/A'}
                            </div>
                          </div>
                        </div>
                      ))}
                      {pulseData[category]?.negative.length === 0 && (
                        <div className="text-gray-500 text-sm italic py-4">
                          No negative outliers
                        </div>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}