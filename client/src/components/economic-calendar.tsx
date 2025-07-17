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
          {events?.slice(0, 3).map((event) => (
            <div key={event.id} className="bg-financial-card rounded-lg p-4 flex items-center justify-between">
              <div className="flex-1">
                <div className={`text-white font-medium ${getImportanceColor(event.importance)}`}>
                  {event.title}
                </div>
                <div className="text-xs text-gray-400">{event.description}</div>
                {event.forecast && (
                  <div className="text-xs text-gray-500 mt-1">
                    Forecast: {event.forecast}
                  </div>
                )}
              </div>
              <div className="text-right ml-4">
                <div className={`text-sm font-medium ${getImportanceColor(event.importance)}`}>
                  {getRelativeTime(event.eventDate)}
                </div>
                <div className="text-xs text-gray-400 flex items-center">
                  <Clock className="w-3 h-3 mr-1" />
                  {new Date(event.eventDate).toLocaleTimeString([], { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-gray-400">
          <p>
            Economic calendar shows upcoming high-impact events that may affect market volatility. 
            Red indicates high importance, yellow medium, and gray low importance events.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
