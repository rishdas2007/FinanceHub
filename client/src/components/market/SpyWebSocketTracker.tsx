import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wifi, WifiOff } from 'lucide-react';

interface SpyData {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  timestamp: string;
}

export function SpyWebSocketTracker() {
  const [spyData, setSpyData] = useState<SpyData | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected' | 'error'>('connecting');
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Use HTTP polling for SPY data
    startHttpPolling();
    
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  const startHttpPolling = () => {
    console.log('📊 Starting HTTP polling for SPY data');
    setConnectionStatus('connecting');
    
    const fetchSpyData = async () => {
      try {
        // Use internal API for consistent data
        const response = await fetch('/api/stocks?symbols=SPY');
        const data = await response.json();
        
        if (data && data.SPY) {
          const spy = data.SPY;
          setSpyData({
            symbol: 'SPY',
            price: spy.price,
            change: spy.change,
            changePercent: spy.changePercent,
            timestamp: new Date().toISOString()
          });
          setConnectionStatus('connected');
          setIsConnected(true);
        }
      } catch (error) {
        console.error('Error fetching SPY data:', error);
        setConnectionStatus('error');
        setIsConnected(false);
      }
    };

    // Initial fetch
    fetchSpyData();
    
    // Poll every 30 seconds to respect API limits and maintain performance
    intervalRef.current = setInterval(fetchSpyData, 30000);
  };

  const formatPrice = (price: number) => price.toFixed(2);
  const formatPercent = (percent: number) => percent.toFixed(2);
  const isPositive = spyData ? spyData.change >= 0 : true;

  return (
    <Card className="bg-financial-card border-financial-border p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <div className={`w-3 h-3 rounded-full ${isConnected ? 'bg-gain-green animate-pulse' : 'bg-loss-red'}`} />
            <h2 className="text-xl font-bold text-white">SPY Real-Time</h2>
            {isConnected ? (
              <Wifi className="h-4 w-4 text-gain-green" />
            ) : (
              <WifiOff className="h-4 w-4 text-loss-red" />
            )}
          </div>
          <div className="text-sm text-gray-400">
            {connectionStatus === 'connecting' && 'Connecting...'}
            {connectionStatus === 'connected' && 'Live Updates'}
            {connectionStatus === 'disconnected' && 'Reconnecting...'}
            {connectionStatus === 'error' && 'Connection Error'}
          </div>
        </div>

        {spyData && (
          <div className="flex items-center space-x-6">
            <div className="text-right">
              <div className="text-3xl font-bold text-white">
                ${formatPrice(spyData.price)}
              </div>
              <div className="text-sm text-gray-400">Current Price</div>
            </div>
            
            <div className="text-right">
              <div className={`text-2xl font-bold flex items-center ${isPositive ? 'text-gain-green' : 'text-loss-red'}`}>
                {isPositive ? <TrendingUp className="h-5 w-5 mr-1" /> : <TrendingDown className="h-5 w-5 mr-1" />}
                {isPositive ? '+' : ''}{formatPrice(spyData.change)}
              </div>
              <div className="text-sm text-gray-400">Change</div>
            </div>
            
            <div className="text-right">
              <div className={`text-2xl font-bold ${isPositive ? 'text-gain-green' : 'text-loss-red'}`}>
                {isPositive ? '+' : ''}{formatPercent(spyData.changePercent)}%
              </div>
              <div className="text-sm text-gray-400">Change %</div>
            </div>
          </div>
        )}

        {!spyData && (
          <div className="flex items-center space-x-6">
            <div className="text-right">
              <div className="text-3xl font-bold text-gray-400 animate-pulse">
                $---.--
              </div>
              <div className="text-sm text-gray-400">Loading...</div>
            </div>
          </div>
        )}
      </div>

      {spyData && (
        <div className="mt-4 pt-4 border-t border-financial-border">
          <div className="flex items-center justify-between text-sm text-gray-400">
            <span>Last Updated: {new Date(spyData.timestamp).toLocaleTimeString()}</span>
            <span>Data Source: {connectionStatus === 'connected' && isConnected ? 'Twelve Data WebSocket' : connectionStatus === 'connected' ? 'Twelve Data API (HTTP)' : 'Fallback Data'}</span>
          </div>
        </div>
      )}
    </Card>
  );
}