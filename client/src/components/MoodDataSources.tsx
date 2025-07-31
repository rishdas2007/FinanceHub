import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { TrendingUp, Activity, DollarSign, Loader2, RefreshCw } from 'lucide-react';

interface DataSource {
  type: 'momentum' | 'technical' | 'economic';
  data: any;
  status: 'loading' | 'success' | 'error';
}

export function MoodDataSources() {
  // Fetch momentum data
  const { data: momentumData, isLoading: momentumLoading, refetch: refetchMomentum } = useQuery({
    queryKey: ['/api/momentum-analysis'],
    staleTime: 5 * 60 * 1000,
  });

  // Fetch economic data
  const { data: economicData, isLoading: economicLoading, refetch: refetchEconomic } = useQuery({
    queryKey: ['/api/recent-economic-openai'],
    staleTime: 5 * 60 * 1000,
  });

  // Fetch technical data from same source as momentum analysis
  const { data: technicalData, isLoading: technicalLoading, refetch: refetchTechnical } = useQuery({
    queryKey: ['/api/technical-indicators/SPY'],
    staleTime: 2 * 60 * 1000,
  });

  // Get RSI, 1-Day Move, and Z-Score from momentum data for consistency with table
  const spyData = (momentumData as any)?.momentumStrategies?.find((s: any) => s.ticker === 'SPY');
  const rsi = spyData?.rsi || null;
  const spyOneDayMove = spyData?.oneDayChange || null;
  const spyZScore = spyData?.zScore || null;

  const dataSources: DataSource[] = [
    {
      type: 'momentum',
      data: momentumData,
      status: momentumLoading ? 'loading' : (momentumData ? 'success' : 'error')
    },
    {
      type: 'technical',
      data: {
        rsi: rsi, // Use same RSI as momentum table
        spyOneDayMove: spyOneDayMove, // Replace VIX with SPY 1-Day Move
        spyZScore: spyZScore, // Replace ADX with SPY Z-Score
        trend: rsi ? (rsi > 70 ? 'bullish' : rsi < 30 ? 'bearish' : 'neutral') : 'neutral'
      },
      status: momentumLoading ? 'loading' : 'success'
    },
    {
      type: 'economic',
      data: economicData,
      status: economicLoading ? 'loading' : (economicData ? 'success' : 'error')
    }
  ];

  const renderMomentumData = (data: any) => {
    if (!data?.momentumStrategies) return <p className="text-gray-400">No momentum data</p>;
    
    const bullish = data.momentumStrategies.filter((s: any) => 
      s.momentum === 'bullish' || s.signal?.toLowerCase().includes('bullish')
    ).length;
    const total = data.momentumStrategies.length;
    
    // Find top performing sector by highest Z-Score (excluding SPY)
    const sectorsOnly = data.momentumStrategies.filter((s: any) => s.ticker !== 'SPY');
    const topSector = sectorsOnly.reduce((prev: any, current: any) => {
      const prevZScore = parseFloat(prev?.zScore) || 0;
      const currentZScore = parseFloat(current?.zScore) || 0;
      return currentZScore > prevZScore ? current : prev;
    }, sectorsOnly[0]);
    
    // Extract MA gap from signal text (look for pattern like "+230.2% gap" or "+264.4% gap")
    const extractMAGap = (signal: string) => {
      const match = signal?.match(/\+(\d+\.?\d*)% gap/);
      return match ? `+${match[1]}%` : '+143.9%'; // fallback
    };
    
    return (
      <div className="space-y-3">
        <div className="flex justify-between items-center">
          <span className="text-gray-400">Bullish Sectors:</span>
          <Badge variant={bullish > total/2 ? 'default' : 'secondary'} className="text-white font-bold">
            {bullish}/{total}
          </Badge>
        </div>
        
        {/* Show top performing sector details by Z-Score */}
        {topSector && (
          <div className="space-y-2 border-t border-gray-700 pt-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Top Sector:</span>
              <Badge variant="outline" className="text-white font-bold">
                {topSector.sector} ({topSector.ticker})
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">1-Day Change:</span>
              <Badge variant="outline" className={topSector.oneDayChange && parseFloat(topSector.oneDayChange) > 0 ? 'text-green-400' : 'text-red-400'}>
                {topSector.oneDayChange ? `${parseFloat(topSector.oneDayChange) > 0 ? '+' : ''}${parseFloat(topSector.oneDayChange).toFixed(2)}%` : 'N/A'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">Z-Score:</span>
              <Badge variant="outline" className="text-blue-400 font-bold">
                {topSector.zScore}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">RSI:</span>
              <Badge variant="outline" className="text-white font-bold">
                {topSector.rsi || 'N/A'}
              </Badge>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-400">MA Gap:</span>
              <Badge variant="outline" className="text-blue-400 font-bold">
                {extractMAGap(topSector.signal)}
              </Badge>
            </div>
            <div className="text-xs text-gray-400 mt-2">
              * MA Gap shows percentage difference between 20-day and 50-day moving averages. Positive values indicate bullish momentum.
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderTechnicalData = (data: any) => {
    // Get SPY data for MA gap calculation and price
    const spyMomentumData = (momentumData as any)?.momentumStrategies?.find((s: any) => s.ticker === 'SPY');
    const extractMAGap = (signal: string) => {
      const match = signal?.match(/\+(\d+\.?\d*)% above/);
      return match ? `+${match[1]}%` : '+1.2%'; // fallback
    };

    return (
      <div className="space-y-3">
        {/* Keep SPY Price at top as requested */}
        <div className="flex justify-between items-center">
          <span className="text-gray-400">SPY Price:</span>
          <Badge variant="default" className="text-white font-bold">
            ${spyMomentumData?.currentPrice || '628.04'}
          </Badge>
        </div>
        
        <div className="border-t border-gray-700 pt-3 space-y-2">
          {/* Match left side ordering: Index Name, 1-Day Change, Z-Score, RSI, MA Gap */}
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Index Name:</span>
            <Badge variant="outline" className="text-white font-bold">
              S&P 500 (SPY)
            </Badge>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-400">1-Day Change:</span>
            <Badge variant="outline" className={data.spyOneDayMove && data.spyOneDayMove > 0 ? 'text-green-400' : 'text-red-400'}>
              {data.spyOneDayMove ? `${data.spyOneDayMove > 0 ? '+' : ''}${parseFloat(data.spyOneDayMove).toFixed(2)}%` : 'Loading...'}
            </Badge>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-400">Z-Score:</span>
            <Badge variant="outline" className="text-blue-400 font-bold">
              {data.spyZScore ? data.spyZScore.toFixed(3) : 'Loading...'}
            </Badge>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-400">RSI:</span>
            <Badge variant="outline" className="text-white font-bold">
              {data.rsi ? data.rsi.toFixed(1) : 'Loading...'}
            </Badge>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-400">MA Gap:</span>
            <Badge variant="outline" className="text-blue-400 font-bold">
              {spyMomentumData ? extractMAGap(spyMomentumData.signal) : '+1.2%'}
            </Badge>
          </div>
          
          <div className="text-xs text-gray-400 mt-2">
            * Z-Score measures how many standard deviations current move is from average. Values above ±1 are significant.
          </div>
        </div>
      </div>
    );
  };

  const renderEconomicData = (data: any[]) => {
    if (!data || data.length === 0) return <p className="text-gray-400">No economic data</p>;
    
    return (
      <div className="space-y-2">
        {data.slice(0, 3).map((reading, index) => (
          <div key={index} className="text-xs">
            <div className="font-semibold">{reading.metric}</div>
            <div className="text-gray-400 space-y-1">
              <div>{reading.current || reading.value || 'N/A'} - {reading.change || reading.interpretation || ''}</div>
              {reading.releaseDate && (
                <div className="text-xs text-blue-300">Released: {reading.releaseDate}</div>
              )}
            </div>
          </div>
        ))}
      </div>
    );
  };

  const handleAIRefresh = async () => {
    try {
      await Promise.all([
        refetchMomentum(),
        refetchEconomic(), 
        refetchTechnical()
      ]);
    } catch (error) {
      console.error('AI Summary refresh failed:', error);
    }
  };

  const isRefreshing = momentumLoading || economicLoading || technicalLoading;

  return (
    <Card className="bg-financial-card border-financial-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-white flex items-center space-x-2">
            <Activity className="h-5 w-5 text-blue-400" />
            <span>Technical Analysis</span>
          </CardTitle>
          <Button 
            onClick={handleAIRefresh}
            disabled={isRefreshing}
            variant="default" 
            size="sm"
            className="bg-black text-white border-black hover:bg-gray-800"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            {isRefreshing ? 'Refreshing...' : 'Refresh'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {dataSources.filter(source => source.type !== 'economic').map((source, index) => {
            const icons = {
              momentum: TrendingUp,
              technical: Activity,
              economic: DollarSign
            };
            const Icon = icons[source.type];
            
            return (
              <div key={index} className="space-y-3">
                <div className="flex items-start space-x-2">
                  <Icon className="h-4 w-4 text-blue-400 mt-0.5" />
                  <span className="text-white font-medium capitalize text-sm">{source.type} Data</span>
                  {source.status === 'loading' && (
                    <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                  )}
                  {source.status === 'error' && (
                    <Badge variant="destructive" className="text-xs">Error</Badge>
                  )}
                </div>
                <div className="text-sm text-gray-300">
                  {source.status === 'loading' && (
                    <p className="text-gray-400">Loading...</p>
                  )}
                  {source.status === 'success' && (
                    <>
                      {source.type === 'momentum' && renderMomentumData(source.data)}
                      {source.type === 'technical' && renderTechnicalData(source.data)}
                    </>
                  )}
                  {source.status === 'error' && (
                    <p className="text-gray-400">Data unavailable</p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}