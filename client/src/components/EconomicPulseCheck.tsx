import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Activity, TrendingUp, TrendingDown, Search, Filter } from 'lucide-react';

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
  const [deltaZScoreFilter, setDeltaZScoreFilter] = useState('all');

  const {
    data: economicData,
    isLoading,
    error
  } = useQuery<EconomicDataResponse>({
    queryKey: ['/api/macroeconomic-indicators'],
    staleTime: 0, // Always fetch fresh data to avoid caching issues
    gcTime: 1 * 60 * 1000, // 1 minute
  });

  console.log('📊 EconomicPulseCheck - Data:', economicData);
  console.log('📊 EconomicPulseCheck - Loading:', isLoading);
  console.log('📊 EconomicPulseCheck - Error:', error);
  
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

    // Process indicators that have z-scores exceeding 1.0 standard deviation
    let alertCount = 0;
    filteredIndicators.forEach(indicator => {
      if (indicator.zScore && Math.abs(indicator.zScore) >= 1.0) {
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
          formattedChange: indicator.varianceVsPrior || 'N/A'
        };

        // Categorize by z-score sign
        if (indicator.zScore > 0) {
          if (pulseData[indicator.category]) {
            pulseData[indicator.category].positive.push(pulseMetric);
          }
        } else {
          if (pulseData[indicator.category]) {
            pulseData[indicator.category].negative.push(pulseMetric);
          }
        }
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

  return (
    <Card className="bg-financial-card border-financial-border">
      <CardHeader>
        <div className="flex items-center justify-between mb-4">
          <CardTitle className="text-white flex items-center space-x-2">
            <Activity className="h-5 w-5 text-blue-400" />
            <span>Economic Analysis</span>
          </CardTitle>
          <div className="text-sm text-blue-400 font-medium">
            📊 {filteredIndicators.length} indicators filtered
          </div>
        </div>

        {/* Enhanced Filter Controls */}
        <div className="bg-financial-gray p-4 rounded-lg border border-blue-500/30 mb-4">
          <div className="text-sm font-medium text-blue-400 mb-3 flex items-center">
            <Filter className="h-4 w-4 mr-2" />
            Filter & Search Economic Analysis
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
                setDeltaZScoreFilter('all');
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
        
        <p className="text-gray-400 text-sm mt-4">
          Statistical alerts for indicators exceeding 1.0 standard deviations from historical mean
        </p>
        
        {/* Enhanced Z-Score Definition with Delta Z-Score */}
        <div className="mt-3 p-3 bg-gray-900 border border-gray-700 rounded-lg">
          <p className="text-sm text-gray-400">
            <strong className="text-white">Z-Score Analysis:</strong> Measures how many standard deviations the current value is from its 12-month historical average, with economic directionality applied. 
            <strong className="text-blue-400"> Positive z-scores = Economic Strength, Negative z-scores = Economic Weakness.</strong>
          </p>
          <p className="text-sm text-gray-400 mt-2">
            <strong className="text-yellow-400">Δ Z-Score (Delta Z-Score):</strong> Shows the z-score of period-to-period changes, indicating whether recent changes are statistically unusual compared to historical volatility patterns.
            Indicators marked "(Δ-adjusted)" have been inverted for consistent interpretation (e.g., lower unemployment rates show positive z-scores).
            Values above ±2.0 indicate statistically significant conditions.
          </p>
        </div>
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
                        <div key={idx} className="bg-financial-gray rounded-lg p-3 border-l-2 border-gain-green">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 mr-3">
                              <div className="font-medium text-white text-sm mb-1" title={metric.name}>
                                {metric.name}
                              </div>
                              <div className="text-gain-green font-bold text-lg">
                                {metric.formattedValue}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-400">z-score</div>
                              <div className="text-sm font-bold text-gain-green">
                                +{metric.zScore.toFixed(2)}
                              </div>
                              {metric.deltaZScore && (
                                <>
                                  <div className="text-xs text-gray-400 mt-1">Δ z-score</div>
                                  <div className={`text-xs font-medium ${metric.deltaZScore >= 0 ? 'text-gain-green' : 'text-loss-red'}`}>
                                    {metric.deltaZScore >= 0 ? '+' : ''}{metric.deltaZScore.toFixed(1)}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
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
                        <div key={idx} className="bg-financial-gray rounded-lg p-3 border-l-2 border-loss-red">
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex-1 mr-3">
                              <div className="font-medium text-white text-sm mb-1" title={metric.name}>
                                {metric.name}
                              </div>
                              <div className="text-loss-red font-bold text-lg">
                                {metric.formattedValue}
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="text-xs text-gray-400">z-score</div>
                              <div className="text-sm font-bold text-loss-red">
                                {metric.zScore.toFixed(2)}
                              </div>
                              {metric.deltaZScore && (
                                <>
                                  <div className="text-xs text-gray-400 mt-1">Δ z-score</div>
                                  <div className={`text-xs font-medium ${metric.deltaZScore >= 0 ? 'text-gain-green' : 'text-loss-red'}`}>
                                    {metric.deltaZScore >= 0 ? '+' : ''}{metric.deltaZScore.toFixed(1)}
                                  </div>
                                </>
                              )}
                            </div>
                          </div>
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