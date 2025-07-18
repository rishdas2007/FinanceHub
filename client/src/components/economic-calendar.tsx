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

  // Sort events in descending chronological order (most recent first)
  const sortedEvents = events ? [...events].sort((a, b) => {
    return new Date(b.eventDate).getTime() - new Date(a.eventDate).getTime();
  }) : [];

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

  const calculateVariance = (actual: string | null, forecast: string | null) => {
    if (!actual || !forecast) return null;
    
    const actualValue = parseFloat(actual.replace(/[^\d.-]/g, ''));
    const forecastValue = parseFloat(forecast.replace(/[^\d.-]/g, ''));
    
    if (isNaN(actualValue) || isNaN(forecastValue)) return null;
    
    const variance = actualValue - forecastValue;
    return {
      value: variance,
      isPositive: variance > 0,
      formatted: variance > 0 ? `+${variance.toFixed(2)}` : variance.toFixed(2)
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
            Maximum Historical Data & Next Week Events
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="text-xs text-gray-400 mb-3 text-center">
          • Forecasts from MarketWatch • Actual data from Federal Reserve • All times Eastern
          <br />
          <span className="text-loss-red">Red</span>: High Impact • <span className="text-warning-yellow">Yellow</span>: Medium Impact • <span className="text-gray-300">Gray</span>: Low Impact • <span className="text-blue-400">Blue highlight</span>: Today's releases
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
          {sortedEvents?.slice(0, 20).map((event) => {
            const todayEvent = isToday(event.eventDate);
            const variance = calculateVariance(event.actual, event.forecast);
            
            return (
            <div 
              key={event.id} 
              className={`rounded-lg p-4 ${
                todayEvent && event.actual 
                  ? 'bg-blue-950/30 border border-blue-500/30' 
                  : 'bg-financial-card'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    event.importance === 'high' ? 'bg-loss-red' : 
                    event.importance === 'medium' ? 'bg-warning-yellow' : 'bg-gray-400'
                  }`}></div>
                  <div className="text-white font-medium text-sm">
                    {event.title}
                    {todayEvent && event.actual && (
                      <span className="ml-2 px-2 py-1 text-xs bg-blue-600 text-white rounded-full">
                        TODAY
                      </span>
                    )}
                  </div>
                </div>
                {/* Enhanced date/time display */}
                <div className="text-right">
                  <div className={`text-xs ${todayEvent ? 'text-blue-400' : 'text-gray-400'}`}>
                    {new Date(event.eventDate).toLocaleDateString('en-US', { 
                      weekday: 'short', 
                      month: 'short', 
                      day: 'numeric' 
                    }).toUpperCase()}
                  </div>
                  <div className="text-xs text-warning-yellow">
                    {new Date(event.eventDate).toLocaleTimeString('en-US', {
                      hour: 'numeric',
                      minute: '2-digit',
                      hour12: true
                    })}
                  </div>
                </div>
              </div>
              
              <div className="text-xs text-gray-400 mb-3">
                {event.description}
                {event.source && (
                  <span className="ml-2 text-xs text-blue-400">• {event.source}</span>
                )}
              </div>
              
              {/* Enhanced metrics display with variance */}
              <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                {event.forecast && (
                  <div className="text-center bg-financial-dark rounded-lg p-2">
                    <div className="text-gray-500 mb-1">Forecast</div>
                    <div className="text-blue-300 font-medium">{event.forecast}</div>
                  </div>
                )}
                {event.previous && (
                  <div className="text-center bg-financial-dark rounded-lg p-2">
                    <div className="text-gray-500 mb-1">Previous</div>
                    <div className="text-gray-300 font-medium">{event.previous}</div>
                  </div>
                )}
                {event.actual && (
                  <div className="text-center bg-financial-dark rounded-lg p-2">
                    <div className="text-gray-500 mb-1">Actual</div>
                    <div className="text-white font-bold">
                      {event.actual}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Variance display */}
              {variance && (
                <div className="text-center mb-3">
                  <div className="text-xs text-gray-500 mb-1">Variance (Actual - Forecast)</div>
                  <div className={`text-sm font-bold ${
                    variance.isPositive ? 'text-gain-green' : 'text-loss-red'
                  }`}>
                    {variance.formatted}
                  </div>
                </div>
              )}
              
              {/* Show impact if available */}
              {event.actual && (
                <div className="mt-2 text-xs">
                  <span className="text-gray-500">Released: </span>
                  <span className="text-white font-medium">
                    {new Date(event.eventDate).toLocaleDateString()}
                  </span>
                </div>
              )}
            </div>
            );
          })}
        </div>
        
        <div className="mt-6 pt-4 border-t border-financial-border">
          <div className="text-xs text-gray-400 text-center">
            <Clock className="w-3 h-3 inline mr-1" />
            Forecasts from MarketWatch • Actual data from Federal Reserve • All times Eastern
          </div>
          <div className="text-xs text-gray-500 text-center mt-1">
            Red: High Impact • Yellow: Medium Impact • Gray: Low Impact • Blue highlight: Today's releases
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
