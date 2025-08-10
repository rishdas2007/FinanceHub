import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import type { SectorData } from "@/types/financial";

export function SectorTracker() {
  const { data: sectors, isLoading, refetch } = useQuery<SectorData[]>({
    queryKey: ['/api/sectors'],
    refetchInterval: false, // Disabled automatic refetching  
    staleTime: 5 * 60 * 1000, // 5 minutes - standardized
  });

  if (isLoading) {
    return (
      <Card className="bg-financial-gray border-financial-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-white">Sector Tracker</CardTitle>
            <Button variant="outline" size="sm" disabled className="text-xs">
              <RefreshCw className="w-3 h-3 mr-1" />
              Loading...
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse">
            <div className="h-4 bg-gray-600 rounded mb-4"></div>
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="h-12 bg-gray-600 rounded mb-2"></div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-financial-gray border-financial-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white">Sector Tracker</CardTitle>
          <div className="flex items-center space-x-4">
            <span className="text-xs text-gray-400">
              {(() => {
                const now = new Date();
                const utcHour = now.getUTCHours();
                const utcMinutes = now.getUTCMinutes();
                const timeInMinutes = utcHour * 60 + utcMinutes;
                const marketOpen = 13 * 60 + 30; // 13:30 UTC (9:30 AM ET)
                const marketClose = 21 * 60; // 21:00 UTC (4:00 PM ET)
                const dayOfWeek = now.getUTCDay();
                const isWeekday = dayOfWeek >= 1 && dayOfWeek <= 5;
                const isMarketOpen = isWeekday && timeInMinutes >= marketOpen && timeInMinutes <= marketClose;
                
                return isMarketOpen ? "Live Market Data" : "As of 4:00 PM ET (Market Closed)";
              })()}
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              className="bg-financial-card hover:bg-financial-border text-white border-financial-border text-xs"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-financial-border">
                <th className="text-left py-3 px-2 text-gray-400 font-medium">SECTOR</th>
                <th className="text-left py-3 px-2 text-gray-400 font-medium">TICKER</th>
                <th className="text-right py-3 px-2 text-gray-400 font-medium">PRICE</th>
                <th className="text-right py-3 px-2 text-gray-400 font-medium">1 DAY</th>
                <th className="text-right py-3 px-2 text-gray-400 font-medium">5 DAY</th>
                <th className="text-right py-3 px-2 text-gray-400 font-medium">1 MONTH</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-financial-border">
              {sectors?.map((sector, index) => (
                <tr 
                  key={sector.symbol} 
                  className={`hover:bg-financial-card transition-colors ${
                    sector.name === 'S&P 500 INDEX' ? 'font-semibold bg-financial-card bg-opacity-50' : ''
                  }`}
                >
                  <td className={`py-3 px-2 ${sector.name === 'S&P 500 INDEX' ? 'text-white font-semibold' : 'text-gray-300'}`}>
                    {sector.name}
                  </td>
                  <td className="py-3 px-2 text-gray-300">{sector.symbol}</td>
                  <td className="py-3 px-2 text-right text-white font-medium">
                    ${typeof sector.price === 'number' ? sector.price.toFixed(2) : parseFloat(sector.price || '0').toFixed(2)}
                  </td>
                  <td className={`py-3 px-2 text-right font-medium ${
                    (typeof sector.changePercent === 'number' ? sector.changePercent : parseFloat(sector.changePercent || '0')) >= 0 ? 'text-gain-green' : 'text-loss-red'
                  }`}>
                    {(typeof sector.changePercent === 'number' ? sector.changePercent : parseFloat(sector.changePercent || '0')) >= 0 ? '+' : ''}{(typeof sector.changePercent === 'number' ? sector.changePercent : parseFloat(sector.changePercent || '0')).toFixed(2)}%
                  </td>
                  <td className={`py-3 px-2 text-right font-medium ${
                    (typeof sector.fiveDayChange === 'number' ? sector.fiveDayChange : parseFloat(sector.fiveDayChange || '0')) >= 0 ? 'text-gain-green' : 'text-loss-red'
                  }`}>
                    {(typeof sector.fiveDayChange === 'number' ? sector.fiveDayChange : parseFloat(sector.fiveDayChange || '0')) >= 0 ? '+' : ''}{(typeof sector.fiveDayChange === 'number' ? sector.fiveDayChange : parseFloat(sector.fiveDayChange || '0')).toFixed(2)}%
                  </td>
                  <td className={`py-3 px-2 text-right font-medium ${
                    (typeof sector.oneMonthChange === 'number' ? sector.oneMonthChange : parseFloat(sector.oneMonthChange || '0')) >= 0 ? 'text-gain-green' : 'text-loss-red'
                  }`}>
                    {(typeof sector.oneMonthChange === 'number' ? sector.oneMonthChange : parseFloat(sector.oneMonthChange || '0')) >= 0 ? '+' : ''}{(typeof sector.oneMonthChange === 'number' ? sector.oneMonthChange : parseFloat(sector.oneMonthChange || '0')).toFixed(2)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-4 text-xs text-gray-400">
          <p>
            This sector tracker shows the 11 GICS sector SPDR ETFs performance with the S&P 500 INDEX 
            shown for comparison. Green percentages indicate gains, red indicate losses. Use this to 
            identify sector rotation patterns and investment opportunities across different market cycles.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
