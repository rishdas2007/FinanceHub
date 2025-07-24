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
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Try WebSocket first, fallback to HTTP polling if needed
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const connectWebSocket = () => {
    try {
      setConnectionStatus('connecting');
      
      // Connect to Twelve Data WebSocket
      const wsUrl = 'wss://ws.twelvedata.com/v1/quotes/price';
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('📡 WebSocket connected');
        
        // First authorize with API key
        if (wsRef.current) {
          wsRef.current.send(JSON.stringify({
            "action": "auth",
            "params": {
              "apikey": "bdceed179a5d435ba78072dfd05f8619"
            }
          }));
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          console.log('📡 WebSocket message:', data);
          
          // Handle authorization response
          if (data.event === 'auth_status') {
            if (data.status === 'authorized') {
              console.log('📡 Authorized, subscribing to SPY');
              setIsConnected(true);
              setConnectionStatus('connected');
              
              // Now subscribe to SPY
              wsRef.current?.send(JSON.stringify({
                "action": "subscribe",
                "params": {
                  "symbols": "SPY"
                }
              }));
            } else {
              console.error('📡 Authorization failed:', data.message);
              setConnectionStatus('error');
              setIsConnected(false);
            }
            return;
          }
          
          // Handle subscription confirmation
          if (data.event === 'subscribe_status') {
            console.log('📡 Subscription status:', data.status);
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
        
        // Attempt to reconnect after 5 seconds
        setTimeout(() => {
          connectWebSocket();
        }, 5000);
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
            <span>Data Source: {connectionStatus === 'connected' && isConnected ? 'Twelve Data WebSocket' : connectionStatus === 'connected' ? 'Twelve Data API (HTTP)' : 'Connecting...'}</span>
          </div>
        </div>
      )}
    </Card>
  );
}