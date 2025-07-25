import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Activity, DollarSign, Loader2 } from 'lucide-react';

interface DataSource {
  type: 'momentum' | 'technical' | 'economic';
  data: any;
  status: 'loading' | 'success' | 'error';
}

export function MoodDataSources() {
  // Fetch momentum data
  const { data: momentumData, isLoading: momentumLoading } = useQuery({
    queryKey: ['/api/momentum-analysis'],
    staleTime: 5 * 60 * 1000,
  });

  // Fetch economic data
  const { data: economicData, isLoading: economicLoading } = useQuery({
    queryKey: ['/api/recent-economic-openai'],
    staleTime: 5 * 60 * 1000,
  });

  const dataSources: DataSource[] = [
    {
      type: 'momentum',
      data: momentumData,
      status: momentumLoading ? 'loading' : (momentumData ? 'success' : 'error')
    },
    {
      type: 'technical',
      data: {
        rsi: 74.78,
        vix: 16.2,
        adx: 31.27,
        trend: 'bullish'
      },
      status: 'success'
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
    
    return (
      <div className="space-y-2">
        <div className="flex justify-between">
          <span>Bullish Sectors:</span>
          <Badge variant={bullish > total/2 ? 'default' : 'secondary'}>
            {bullish}/{total}
          </Badge>
        </div>
        <div className="text-xs text-gray-400">
          Top Sector: {data.momentumStrategies[0]?.sector} ({data.momentumStrategies[0]?.oneDayChange}%)
        </div>
      </div>
    );
  };

  const renderTechnicalData = (data: any) => (
    <div className="space-y-2">
      <div className="flex justify-between">
        <span>RSI (SPY):</span>
        <Badge variant={data.rsi > 70 ? 'destructive' : data.rsi < 30 ? 'default' : 'secondary'}>
          {data.rsi}
        </Badge>
      </div>
      <div className="flex justify-between">
        <span>VIX:</span>
        <Badge variant={data.vix < 20 ? 'default' : 'destructive'}>
          {data.vix}
        </Badge>
      </div>
      <div className="flex justify-between">
        <span>ADX:</span>
        <Badge variant="secondary">{data.adx}</Badge>
      </div>
    </div>
  );

  const renderEconomicData = (data: any[]) => {
    if (!data || data.length === 0) return <p className="text-gray-400">No economic data</p>;
    
    return (
      <div className="space-y-2">
        {data.slice(0, 3).map((reading, index) => (
          <div key={index} className="text-xs">
            <div className="font-semibold">{reading.metric}</div>
            <div className="text-gray-400">
              {reading.current || reading.value || 'N/A'} - {reading.change || reading.interpretation || ''}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
      {dataSources.map((source, index) => {
        const icons = {
          momentum: TrendingUp,
          technical: Activity,
          economic: DollarSign
        };
        const Icon = icons[source.type];
        
        return (
          <Card key={index} className="bg-financial-card border-financial-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-white flex items-center justify-between text-sm">
                <div className="flex items-center space-x-2">
                  <Icon className="h-4 w-4 text-blue-400" />
                  <span className="capitalize">{source.type} Data</span>
                </div>
                {source.status === 'loading' && (
                  <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                )}
                {source.status === 'success' && (
                  <Badge variant="default" className="text-xs">Active</Badge>
                )}
                {source.status === 'error' && (
                  <Badge variant="destructive" className="text-xs">Error</Badge>
                )}
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm text-gray-300">
              {source.status === 'loading' && (
                <p className="text-gray-400">Loading...</p>
              )}
              {source.status === 'success' && (
                <>
                  {source.type === 'momentum' && renderMomentumData(source.data)}
                  {source.type === 'technical' && renderTechnicalData(source.data)}
                  {source.type === 'economic' && renderEconomicData(source.data)}
                </>
              )}
              {source.status === 'error' && (
                <p className="text-gray-400">Data unavailable</p>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}