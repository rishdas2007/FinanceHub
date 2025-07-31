import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock } from "lucide-react";

interface EconomicEvent {
  id: number;
  title: string;
  description: string;
  importance: string;
  eventDate: string;
  actual: string | null;
  forecast: string | null;
  previous: string | null;
  timestamp: string;
  country?: string;
  category?: string;
  source?: string;
}

export function EconomicCalendar() {
  const { data: events, isLoading } = useQuery<EconomicEvent[]>({
    queryKey: ['/api/economic-events'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  // Filter events to show only those with actual values and sort in descending chronological order
  const eventsWithActual = events ? events.filter(event => event.actual && event.actual.trim() !== '') : [];
  const sortedEvents = eventsWithActual.sort((a, b) => {
    return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
  });

  const isToday = (eventDate: string) => {
    const today = new Date();
    const event = new Date(eventDate);
    return today.toDateString() === event.toDateString();
  };

  const getRelativeTime = (eventDate: Date) => {
    const now = new Date();
    const diffMs = new Date(eventDate).getTime() - now.getTime();
    const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
    
    if (diffDays === 0) return 'Today';
    if (diffDays === 1) return 'Tomorrow';
    if (diffDays < 7) return `${diffDays} days`;
    return 'Next Week';
  };

  const getImportanceColor = (importance: string) => {
    switch (importance.toLowerCase()) {
      case 'high': return 'text-loss-red';
      case 'medium': return 'text-warning-yellow';
      case 'low': return 'text-gray-300';
      default: return 'text-gray-300';
    }
  };

  const getCategoryDisplay = (category: string) => {
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
  };

  const calculateVariance = (actual: string | null, forecast: string | null) => {
    if (!actual || !forecast) return null;
    
    // Handle percentage values
    let actualValue = parseFloat(actual.replace(/[^\d.-]/g, ''));
    let forecastValue = parseFloat(forecast.replace(/[^\d.-]/g, ''));
    
    // Handle values with 'K', 'M' suffixes (like jobless claims)
    if (actual.includes('K') || actual.includes('M')) {
      if (actual.includes('K')) actualValue = actualValue * 1000;
      if (actual.includes('M')) actualValue = actualValue * 1000000;
    }
    if (forecast.includes('K') || forecast.includes('M')) {
      if (forecast.includes('K')) forecastValue = forecastValue * 1000;
      if (forecast.includes('M')) forecastValue = forecastValue * 1000000;
    }
    
    if (isNaN(actualValue) || isNaN(forecastValue)) return null;
    
    const variance = actualValue - forecastValue;
    
    // Format variance to match the format of actual values consistently
    let formattedVariance: string;
    const hasK = actual.includes('K') || forecast.includes('K');
    const hasM = actual.includes('M') || forecast.includes('M');
    const hasPercent = actual.includes('%');
    
    if (hasK) {
      // For K values like "221K" show variance as "-13K" to match the compact format
      const formattedValue = Math.abs(variance / 1000).toFixed(0);
      formattedVariance = variance > 0 ? `+${formattedValue}K` : `-${formattedValue}K`;
    } else if (hasM) {
      // For M values, show variance in M format with 2 decimals to match actual format (e.g., "1.40M")
      formattedVariance = variance > 0 ? `+${(variance/1000000).toFixed(2)}M` : `${(variance/1000000).toFixed(2)}M`;
    } else if (hasPercent) {
      // For percentage values, show variance with 1 decimal to match actual format (e.g., "0.6%")
      formattedVariance = variance > 0 ? `+${variance.toFixed(1)}%` : `${variance.toFixed(1)}%`;
    } else {
      // For regular numbers, match the precision of actual values (usually whole numbers)
      const actualDecimals = actual.includes('.') ? actual.split('.')[1]?.length || 0 : 0;
      formattedVariance = variance > 0 ? `+${variance.toFixed(actualDecimals)}` : `${variance.toFixed(actualDecimals)}`;
    }
    
    return {
      value: variance,
      isPositive: variance > 0,
      formatted: formattedVariance
    };
  };

  if (isLoading) {
    return (
      <Card className="bg-financial-gray border-financial-border">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Economic Calendar
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-financial-card rounded-lg p-4 animate-pulse">
                <div className="h-4 bg-gray-600 rounded mb-2"></div>
                <div className="h-3 bg-gray-600 rounded"></div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-financial-gray border-financial-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white flex items-center justify-between">
          <div className="flex items-center">
            <Calendar className="w-5 h-5 mr-2" />
            Economic Calendar
          </div>
          <div className="text-xs text-gray-400 font-normal">
            Recent Indicators with Actual Values
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-gray-400 mb-3 text-center">
          • Showing only indicators with actual values • Forecasts from MarketWatch • Actual data from Federal Reserve • All times Eastern
        </div>
        
        {/* Table Header */}
        <div className="bg-financial-card rounded-t-lg">
          <div className="grid grid-cols-7 gap-3 px-4 py-3 text-xs font-semibold text-gray-300 border-b border-gray-600">
            <div className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full bg-gray-400"></div>
              <span>INDICATOR</span>
            </div>
            <div>CATEGORY</div>
            <div className="text-center">ACTUAL</div>
            <div className="text-center">FORECAST</div>
            <div className="text-center">VARIANCE</div>
            <div className="text-center">PREVIOUS</div>
            <div className="text-right">DATE</div>
          </div>
        </div>

        {/* Table Body */}
        <div className="bg-financial-card rounded-b-lg max-h-96 overflow-y-auto">
          {sortedEvents?.slice(0, 20).map((event, index) => {
            const todayEvent = isToday(event.eventDate);
            const variance = calculateVariance(event.actual, event.forecast);
            
            return (
              <div 
                key={event.id} 
                className={`grid grid-cols-7 gap-3 px-4 py-3 text-sm border-b border-gray-700/50 last:border-b-0 hover:bg-financial-gray/30 transition-colors ${
                  todayEvent && event.actual ? 'bg-blue-950/20' : ''
                }`}
              >
                {/* Indicator Name with Importance */}
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full flex-shrink-0 ${
                    event.importance === 'high' ? 'bg-loss-red' : 
                    event.importance === 'medium' ? 'bg-warning-yellow' : 'bg-gray-400'
                  }`}></div>
                  <div className="text-white text-xs leading-tight">
                    {event.title}
                    {todayEvent && event.actual && (
                      <div className="text-xs text-blue-400 mt-1">TODAY</div>
                    )}
                  </div>
                </div>

                {/* Category */}
                <div className="text-gray-300 text-xs flex items-center">
                  {getCategoryDisplay(event.category || '')}
                </div>

                {/* Actual */}
                <div className="text-center flex items-center justify-center">
                  {event.actual ? (
                    <span className={`text-xs font-medium ${
                      variance && variance.isPositive ? 'text-gain-green' : 
                      variance && !variance.isPositive ? 'text-loss-red' : 'text-white'
                    }`}>
                      {event.actual}
                    </span>
                  ) : (
                    <span className="text-gray-500 text-xs">-</span>
                  )}
                </div>

                {/* Forecast */}
                <div className="text-center flex items-center justify-center">
                  {event.forecast ? (
                    <span className="text-blue-400 text-xs">{event.forecast}</span>
                  ) : (
                    <span className="text-gray-500 text-xs">-</span>
                  )}
                </div>

                {/* Variance */}
                <div className="text-center flex items-center justify-center">
                  {variance ? (
                    <span className={`text-xs font-semibold ${
                      variance.isPositive ? 'text-gain-green' : 'text-loss-red'
                    }`}>
                      {variance.formatted}
                    </span>
                  ) : (
                    <span className="text-gray-500 text-xs">-</span>
                  )}
                </div>

                {/* Previous */}
                <div className="text-center flex items-center justify-center">
                  {event.previous ? (
                    <span className="text-gray-300 text-xs">{event.previous}</span>
                  ) : (
                    <span className="text-gray-500 text-xs">-</span>
                  )}
                </div>

                {/* Date */}
                <div className="text-right flex items-center justify-end">
                  <div className="text-xs">
                    <div className={`${todayEvent ? 'text-blue-400' : 'text-gray-400'}`}>
                      {new Date(event.eventDate).toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric' 
                      }).toUpperCase()}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

      </CardContent>
    </Card>
  );
}
