import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { SectorData } from "@/types/financial";

export function MarketHeatMap() {
  const { data: sectors } = useQuery<SectorData[]>({
    queryKey: ['/api/sectors'],
    refetchInterval: 60000,
  });

  const getHeatMapColor = (changePercent: number) => {
    const intensity = Math.min(Math.abs(changePercent) * 20, 100);
    if (changePercent >= 0) {
      return `rgba(16, 185, 129, ${intensity / 100})`;
    } else {
      return `rgba(239, 68, 68, ${intensity / 100})`;
    }
  };

  const sortedSectors = sectors?.filter(s => s.name !== 'S&P 500 INDEX')
    .sort((a, b) => b.changePercent - a.changePercent) || [];

  return (
    <Card className="bg-financial-gray border-financial-border">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white">Sector Performance Heat Map</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="bg-financial-card rounded-lg p-4 h-64">
          <div className="grid grid-cols-3 gap-2 h-full">
            {sortedSectors.slice(0, 6).map((sector, index) => (
              <div
                key={sector.symbol}
                className="rounded p-3 flex flex-col justify-between text-white font-medium"
                style={{ backgroundColor: getHeatMapColor(sector.changePercent) }}
              >
                <span className="text-xs font-medium">{sector.name}</span>
                <span className="text-lg font-bold">
                  {sector.changePercent >= 0 ? '+' : ''}{sector.changePercent.toFixed(2)}%
                </span>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-4 flex justify-between text-xs text-gray-400">
          <span>Worst Performer</span>
          <span>Best Performer</span>
        </div>
        <div className="mt-2 text-xs text-gray-400">
          <p>
            Heat map visualization of sector performance with color intensity representing the magnitude 
            of price changes. Green indicates gains, red shows losses. Use this to quickly identify 
            market leaders and laggards.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
