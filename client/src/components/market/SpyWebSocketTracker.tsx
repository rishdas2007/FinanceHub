import { useState, useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { TrendingUp, TrendingDown, Wifi, WifiOff } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';

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
  const wsRef = useRef<WebSocket | null>(null);

  // Fallback to HTTP API data since WebSocket requires Pro plan
  const { data: fallbackData } = useQuery({
    queryKey: ['/api/stocks', 'SPY'],
    queryFn: () => fetch('/api/stocks?symbols=SPY').then(res => res.json()),
    refetchInterval: 30000, // Refresh every 30 seconds
    enabled: connectionStatus === 'error' || !isConnected
  });

  useEffect(() => {
    // Connect to Twelve Data WebSocket (will fallback if subscription fails)
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  // Use fallback data if WebSocket fails
  useEffect(() => {
    if (connectionStatus === 'error' && fallbackData && fallbackData.length > 0) {
      const spyStock = fallbackData[0];
      if (spyStock) {
        setSpyData({
          symbol: 'SPY',
          price: spyStock.price || 0,
          change: spyStock.change || 0,
          changePercent: spyStock.changePercent || 0,
          timestamp: new Date().toISOString()
        });
      }
    }
  }, [connectionStatus, fallbackData]);

  const connectWebSocket = () => {
    try {
      setConnectionStatus('connecting');
      
      // Connect to Twelve Data WebSocket with API key as query parameter
      const wsUrl = 'wss://ws.twelvedata.com/v1/quotes/price?apikey=bdceed179a5d435ba78072dfd05f8619';
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('📡 WebSocket connected, subscribing to SPY');
        setIsConnected(true);
        setConnectionStatus('connected');
        
        // Subscribe directly to SPY (no separate auth needed since API key is in URL)
        if (wsRef.current) {
          wsRef.current.send(JSON.stringify({
            "action": "subscribe",
            "params": {
              "symbols": "SPY"
            }
          }));
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📡 WebSocket message:', data);
          
          // Handle subscription confirmation
          if (data.event === 'subscribe-status') {
            console.log('📡 Subscription status:', data.status);
            if (data.status === 'error') {
              console.error('📡 Subscription failed for SPY:', data.fails);
              console.log('📡 SPY WebSocket subscription failed - likely due to plan limitations or market hours');
              console.log('📡 Falling back to cached data from background jobs');
              setConnectionStatus('error');
              setIsConnected(false);
              
              // Close WebSocket since SPY subscription failed
              if (wsRef.current) {
                wsRef.current.close();
              }
            } else if (data.status === 'ok') {
              console.log('📡 SPY subscription successful!');
              setConnectionStatus('connected');
              setIsConnected(true);
            }
            return;
          }
          
          // Handle real-time price updates
          if (data.event === 'price' && data.symbol === 'SPY') {
            const currentPrice = parseFloat(data.price);
            const change = parseFloat(data.day_change) || 0;
            const changePercent = parseFloat(data.percent_change) || 0;
            
            setSpyData({
              symbol: 'SPY',
              price: currentPrice,
              change: change,
              changePercent: changePercent,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error parsing WebSocket data:', error);
        }
      };

      wsRef.current.onclose = (event) => {
        console.log('📡 WebSocket disconnected:', event.code, event.reason);
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        // Don't reconnect on 1006 errors (likely plan limitations)
        // Only reconnect on clean disconnects during market hours
        if (event.code === 1000 || event.code === 1001) {
          setTimeout(() => {
            connectWebSocket();
          }, 30000); // Wait 30 seconds before reconnecting
        } else {
          console.log('📡 WebSocket connection terminated (likely plan limitations or market closed)');
          setConnectionStatus('error');
        }
      };

      wsRef.current.onerror = (error) => {
        console.error('📡 WebSocket error:', error);
        setConnectionStatus('error');
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Failed to create WebSocket:', error);
      setConnectionStatus('error');
    }
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
            <span>Data Source: {connectionStatus === 'connected' && isConnected ? 'Live WebSocket' : connectionStatus === 'error' ? 'Background Jobs (Cached)' : 'Connecting...'}</span>
          </div>
        </div>
      )}
    </Card>
  );
}