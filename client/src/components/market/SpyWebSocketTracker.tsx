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
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    connectWebSocket();
    
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
    };
  }, []);

  const connectWebSocket = () => {
    try {
      setConnectionStatus('connecting');
      
      // Use Twelve Data WebSocket API for real-time SPY data
      const wsUrl = 'wss://ws.twelvedata.com/v1/quotes/price';
      wsRef.current = new WebSocket(wsUrl);

      wsRef.current.onopen = () => {
        console.log('📡 SPY WebSocket connected');
        setIsConnected(true);
        setConnectionStatus('connected');
        
        // Subscribe to SPY real-time data
        if (wsRef.current) {
          wsRef.current.send(JSON.stringify({
            action: 'subscribe',
            params: {
              symbols: 'SPY',
              apikey: import.meta.env.VITE_TWELVE_DATA_API_KEY || 'bdceed179a5d435ba78072dfd05f8619'
            }
          }));
        }
      };

      wsRef.current.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.symbol === 'SPY' && data.price) {
            const change = data.price - (data.previous_close || 0);
            const changePercent = data.previous_close ? ((change / data.previous_close) * 100) : 0;
            
            setSpyData({
              symbol: 'SPY',
              price: parseFloat(data.price),
              change: change,
              changePercent: changePercent,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Error parsing WebSocket data:', error);
        }
      };

      wsRef.current.onclose = () => {
        console.log('📡 SPY WebSocket disconnected');
        setIsConnected(false);
        setConnectionStatus('disconnected');
        
        // Attempt reconnection after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      };

      wsRef.current.onerror = (error) => {
        console.error('SPY WebSocket error:', error);
        setConnectionStatus('error');
        setIsConnected(false);
      };

    } catch (error) {
      console.error('Failed to create WebSocket connection:', error);
      setConnectionStatus('error');
      
      // Use fallback HTTP polling for SPY data
      fallbackToHttpPolling();
    }
  };

  const fallbackToHttpPolling = () => {
    console.log('📊 Falling back to HTTP polling for SPY data');
    
    const fetchSpyData = async () => {
      try {
        const response = await fetch('/api/stocks?symbols=SPY');
        const data = await response.json();
        
        if (data.SPY) {
          const spy = data.SPY;
          setSpyData({
            symbol: 'SPY',
            price: spy.price,
            change: spy.change,
            changePercent: spy.changePercent,
            timestamp: new Date().toISOString()
          });
          setConnectionStatus('connected');
        }
      } catch (error) {
        console.error('Error fetching SPY data via HTTP:', error);
        setConnectionStatus('error');
      }
    };

    // Initial fetch
    fetchSpyData();
    
    // Poll every 10 seconds
    const interval = setInterval(fetchSpyData, 10000);
    
    return () => clearInterval(interval);
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
            {connectionStatus === 'connected' && 'Live Data'}
            {connectionStatus === 'disconnected' && 'Reconnecting...'}
            {connectionStatus === 'error' && 'HTTP Fallback'}
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
            <span>Data Source: {connectionStatus === 'connected' && isConnected ? 'Twelve Data WebSocket' : 'Twelve Data API'}</span>
          </div>
        </div>
      )}
    </Card>
  );
}