import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Clock } from "lucide-react";
import type { EconomicEvent } from "@/types/financial";

export function EconomicCalendar() {
  const { data: events, isLoading } = useQuery<EconomicEvent[]>({
    queryKey: ['/api/economic-events'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

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
        <CardTitle className="text-lg font-semibold text-white flex items-center">
          <Calendar className="w-5 h-5 mr-2" />
          Economic Calendar
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {events?.slice(0, 5).map((event) => (
            <div key={event.id} className="bg-financial-card rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    event.importance === 'high' ? 'bg-loss-red' : 
                    event.importance === 'medium' ? 'bg-warning-yellow' : 'bg-gray-400'
                  }`}></div>
                  <div className="text-white font-medium text-sm">
                    {event.title}
                  </div>
                </div>
                <div className="text-xs text-gray-400">
                  {event.time || new Date(event.date).toLocaleDateString()}
                </div>
              </div>
              
              <div className="text-xs text-gray-400 mb-2">{event.description}</div>
              
              <div className="grid grid-cols-3 gap-2 text-xs">
                {event.forecast && (
                  <div className="text-center">
                    <div className="text-gray-500">Forecast</div>
                    <div className="text-white font-medium">{event.forecast}</div>
                  </div>
                )}
                {event.previous && (
                  <div className="text-center">
                    <div className="text-gray-500">Previous</div>
                    <div className="text-gray-300">{event.previous}</div>
                  </div>
                )}
                {event.actual && (
                  <div className="text-center">
                    <div className="text-gray-500">Actual</div>
                    <div className={`font-medium ${
                      event.impact === 'positive' || event.impact === 'very_positive' ? 'text-gain-green' :
                      event.impact === 'negative' ? 'text-loss-red' :
                      event.impact === 'slightly_negative' ? 'text-warning-yellow' :
                      'text-white'
                    }`}>
                      {event.actual}
                    </div>
                  </div>
                )}
              </div>
              
              {/* Show impact if available */}
              {event.actual && event.impact && (
                <div className="mt-2 text-xs">
                  <span className="text-gray-500">Impact: </span>
                  <span className={`font-medium ${
                    event.impact === 'positive' || event.impact === 'very_positive' ? 'text-gain-green' :
                    event.impact === 'negative' ? 'text-loss-red' :
                    event.impact === 'slightly_negative' ? 'text-warning-yellow' :
                    'text-gray-300'
                  }`}>
                    {event.impact === 'very_positive' ? 'Very Positive' :
                     event.impact === 'positive' ? 'Positive' :
                     event.impact === 'slightly_negative' ? 'Slightly Negative' :
                     event.impact === 'negative' ? 'Negative' : 'Neutral'}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
        
        <div className="mt-4 text-xs text-gray-400 text-center">
          <Clock className="w-3 h-3 inline mr-1" />
          Economic data from real MarketWatch events • Results vs forecasts
        </div>
      </CardContent>
    </Card>
  );
}
