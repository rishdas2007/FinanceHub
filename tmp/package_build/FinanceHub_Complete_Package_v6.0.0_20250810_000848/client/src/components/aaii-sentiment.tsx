import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function AAIISentiment() {
  return (
    <Card className="bg-financial-gray border-financial-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white">AAII Sentiment Survey - 12 Week Trend</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-financial-card rounded-lg p-4 h-64 flex items-center justify-center relative overflow-hidden">
          <div className="absolute inset-0 bg-gradient-to-br from-gain-green/20 via-warning-yellow/20 to-loss-red/20"></div>
          <div className="relative z-10 text-center">
            <div className="text-6xl font-bold text-white mb-2">📊</div>
            <div className="text-gray-300 text-sm">
              AAII Sentiment Chart
            </div>
            <div className="text-xs text-gray-400 mt-2">
              Interactive sentiment trends would appear here
            </div>
          </div>
        </div>
        <div className="mt-4 text-xs text-gray-400">
          <p>
            The AAII Investor Sentiment Survey tracks weekly bullish, neutral, and bearish sentiment 
            among individual investors. Extreme readings often serve as contrarian indicators - very 
            high bullish sentiment may signal market tops, while extremely bearish readings often 
            coincide with market bottoms.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
