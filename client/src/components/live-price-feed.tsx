import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useWebSocket } from "@/hooks/use-websocket";
import { useETF } from "@/context/etf-context";
import { useEffect, useState } from "react";
import type { StockData } from "@/types/financial";

export function LivePriceFeed() {
  const { selectedETF, setSelectedETF, etfOptions } = useETF();
  const [currentData, setCurrentData] = useState<StockData | null>(null);
  const { lastMessage, connectionStatus } = useWebSocket();

  const { data: initialData } = useQuery<StockData>({
    queryKey: ['/api/stocks', selectedETF.symbol],
    refetchInterval: 120000, // Refresh every 2 minutes
    staleTime: 60000, // Data is fresh for 1 minute
  });

  useEffect(() => {
    if (initialData && (!currentData || currentData.symbol !== selectedETF.symbol)) {
      setCurrentData(initialData);
    }
  }, [initialData, currentData, selectedETF.symbol]);

  useEffect(() => {
    if (lastMessage?.type === 'price_update' || lastMessage?.type === 'initial_data') {
      const stockData = lastMessage.data.stock;
      if (stockData && stockData.symbol === selectedETF.symbol) {
        setCurrentData(stockData);
      }
    }
  }, [lastMessage, selectedETF.symbol]);

  const isPositive = currentData ? parseFloat(currentData.changePercent) >= 0 : false;
  const connectionColor = connectionStatus === 'connected' ? 'bg-gain-green' : 
                         connectionStatus === 'connecting' ? 'bg-warning-yellow' : 'bg-loss-red';

  return (
    <Card className="bg-financial-gray border-financial-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white">Live Price Feed</CardTitle>
          <span className={`w-2 h-2 rounded-full animate-pulse ${connectionColor}`}></span>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="mb-4">
          <Select 
            value={selectedETF.symbol} 
            onValueChange={(value) => {
              const etf = etfOptions.find(option => option.symbol === value);
              if (etf) {
                setSelectedETF(etf);
                setCurrentData(null); // Reset current data when changing ETF
              }
            }}
          >
            <SelectTrigger className="bg-financial-card border-financial-border text-white">
              <SelectValue placeholder="Select ETF" />
            </SelectTrigger>
            <SelectContent className="bg-financial-card border-financial-border">
              {etfOptions.map((etf) => (
                <SelectItem 
                  key={etf.symbol} 
                  value={etf.symbol}
                  className="text-white hover:bg-financial-border focus:bg-financial-border"
                >
                  <div className="flex flex-col">
                    <span className="font-medium">{etf.symbol}</span>
                    <span className="text-xs text-gray-400">{etf.name}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        
        <div className="bg-financial-card p-4 rounded-lg">
          <div className="flex justify-between items-center">
            <span className="text-xl font-bold text-white">
              {currentData?.symbol || selectedETF.symbol}
            </span>
            <span className={`text-sm font-medium ${isPositive ? 'text-gain-green' : 'text-loss-red'}`}>
              {currentData ? `${isPositive ? '+' : ''}${parseFloat(currentData.changePercent).toFixed(2)}%` : '--'}
            </span>
          </div>
          <div className="text-2xl font-bold text-white mt-1">
            {currentData ? `$${parseFloat(currentData.price).toFixed(2)}` : '--'}
          </div>
          <div className="text-xs text-gray-400 mt-2">
            Updated: {currentData ? new Date(currentData.timestamp).toLocaleTimeString() : '--'}
          </div>
        </div>
        <div className="text-xs text-gray-400 flex items-center">
          <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
            <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" />
          </svg>
          WebSocket Live Feed - {connectionStatus}
        </div>
      </CardContent>
    </Card>
  );
}
