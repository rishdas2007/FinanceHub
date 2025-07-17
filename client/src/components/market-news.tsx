import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell, TrendingUp, AlertTriangle, Activity } from "lucide-react";

const mockNews = [
  {
    id: 1,
    type: 'alert',
    title: 'Market Volatility Alert',
    description: 'VIX increased 15% - elevated fear levels detected',
    time: '5 minutes ago',
    icon: AlertTriangle,
    color: 'text-loss-red',
    bgColor: 'bg-loss-red',
  },
  {
    id: 2,
    type: 'positive',
    title: 'Sector Rotation Detected',
    description: 'Strong inflows into Healthcare sector (+$2.1B)',
    time: '1 hour ago',
    icon: TrendingUp,
    color: 'text-gain-green',
    bgColor: 'bg-gain-green',
  },
  {
    id: 3,
    type: 'warning',
    title: 'Options Activity Spike',
    description: 'Unusual call volume in SPY - 150% above average',
    time: '2 hours ago',
    icon: Activity,
    color: 'text-warning-yellow',
    bgColor: 'bg-warning-yellow',
  },
];

export function MarketNews() {
  return (
    <Card className="bg-financial-gray border-financial-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white flex items-center">
          <Bell className="w-5 h-5 mr-2" />
          Market News & Alerts
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {mockNews.map((news) => (
            <div key={news.id} className="bg-financial-card rounded-lg p-4">
              <div className="flex items-start space-x-3">
                <div className={`w-2 h-2 ${news.bgColor} rounded-full mt-2 flex-shrink-0`}></div>
                <div className="flex-1">
                  <div className="text-white font-medium text-sm">{news.title}</div>
                  <div className="text-xs text-gray-400 mt-1">{news.description}</div>
                  <div className="text-xs text-gray-500 mt-2 flex items-center">
                    <news.icon className="w-3 h-3 mr-1" />
                    {news.time}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-xs text-gray-400">
          <p>
            Real-time market alerts and news updates. Color-coded indicators show alert severity: 
            red for warnings, green for positive developments, yellow for noteworthy events.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
