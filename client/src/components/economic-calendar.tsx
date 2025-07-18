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
}

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
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {events?.slice(0, 12).map((event) => (
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
                {/* Enhanced date/time display */}
                <div className="text-right">
                  <div className="text-xs text-gray-400">
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
              
              <div className="text-xs text-gray-400 mb-3">{event.description}</div>
              
              {/* Enhanced metrics display */}
              <div className="grid grid-cols-3 gap-3 text-xs mb-3">
                {event.forecast && (
                  <div className="text-center bg-financial-dark rounded-lg p-2">
                    <div className="text-gray-500 mb-1">Forecast</div>
                    <div className="text-white font-medium">{event.forecast}</div>
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
          ))}
        </div>
        
        <div className="mt-6 pt-4 border-t border-financial-border">
          <div className="text-xs text-gray-400 text-center">
            <Clock className="w-3 h-3 inline mr-1" />
            Economic data from real MarketWatch sources • All times Eastern • Updated continuously
          </div>
          <div className="text-xs text-gray-500 text-center mt-1">
            Red: High Impact • Yellow: Medium Impact • Gray: Low Impact
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
