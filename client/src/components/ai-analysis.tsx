import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RefreshCw, TrendingUp, AlertTriangle, Target } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import type { AiAnalysis, StockData, MarketSentiment, TechnicalIndicators, SectorData } from "@/types/financial";

export function AIAnalysisComponent() {
  const queryClient = useQueryClient();

  const { data: analysis, isLoading } = useQuery<AiAnalysis>({
    queryKey: ['/api/analysis'],
    refetchInterval: 300000, // Refresh every 5 minutes
  });

  const { data: currentStock } = useQuery<StockData>({
    queryKey: ['/api/stocks/SPY'],
  });

  const { data: sentiment } = useQuery<MarketSentiment>({
    queryKey: ['/api/sentiment'],
  });

  const { data: technical } = useQuery<TechnicalIndicators>({
    queryKey: ['/api/technical/SPY'],
  });

  const { data: sectors } = useQuery<SectorData[]>({
    queryKey: ['/api/sectors'],
  });

  const refreshMutation = useMutation({
    mutationFn: () => apiRequest('POST', '/api/refresh'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/analysis'] });
    },
  });

  if (isLoading) {
    return (
      <Card className="bg-financial-gray border-financial-border">
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold text-white">AI Market Commentary</CardTitle>
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 bg-warning-yellow rounded-full animate-pulse"></span>
              <span className="text-xs text-gray-400">Powered by GPT-4o</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="bg-financial-card rounded-lg p-4 h-80 flex items-center justify-center">
            <div className="text-gray-400">Loading AI market analysis...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-financial-gray border-financial-border">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold text-white">AI Market Commentary</CardTitle>
          <div className="flex items-center space-x-2">
            <span className="w-2 h-2 bg-warning-yellow rounded-full animate-pulse"></span>
            <span className="text-xs text-gray-400">Powered by GPT-4o</span>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="bg-financial-card rounded-lg p-6 overflow-y-auto">
          {analysis && currentStock && sentiment && technical && sectors ? (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-sm">
              {/* Current Market Position */}
              <div className="lg:col-span-3 border-l-4 border-gain-green pl-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-5 h-5 text-gain-green" />
                  <h4 className="font-semibold text-white text-lg">Current Market Position</h4>
                </div>
                <p className="text-gray-300 leading-relaxed mb-4">
                  The S&P 500 (SPY) closed at ${parseFloat(currentStock.price).toFixed(2)}, gaining {parseFloat(currentStock.changePercent) >= 0 ? '+' : ''}{parseFloat(currentStock.changePercent).toFixed(2)}% today. 
                  {parseFloat(currentStock.price) > 620 && (
                    <span className="text-warning-yellow"> This puts the market near historical highs, trading at elevated valuations that warrant careful monitoring.</span>
                  )}
                </p>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 bg-financial-gray bg-opacity-30 rounded-lg p-4">
                  <div className="text-center">
                    <span className="text-gray-400 text-xs block">Current Price</span>
                    <div className="text-white font-bold text-lg">${parseFloat(currentStock.price).toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-400 text-xs block">Daily Change</span>
                    <div className={`font-bold text-lg ${parseFloat(currentStock.changePercent) >= 0 ? 'text-gain-green' : 'text-loss-red'}`}>
                      {parseFloat(currentStock.changePercent) >= 0 ? '+' : ''}{parseFloat(currentStock.changePercent).toFixed(2)}%
                    </div>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-400 text-xs block">VIX Level</span>
                    <div className="text-warning-yellow font-bold text-lg">{parseFloat(sentiment.vix).toFixed(1)}</div>
                  </div>
                  <div className="text-center">
                    <span className="text-gray-400 text-xs block">AAII Bullish</span>
                    <div className="text-gain-green font-bold text-lg">{parseFloat(sentiment.aaiiBullish).toFixed(1)}%</div>
                  </div>
                </div>
              </div>

              {/* Technical Indicators Analysis */}
              <div className="border-l-4 border-warning-yellow pl-4">
                <div className="flex items-center gap-2 mb-3">
                  <Target className="w-4 h-4 text-warning-yellow" />
                  <h4 className="font-semibold text-white text-base">Technical Indicators</h4>
                </div>
                <div className="space-y-3">
                  <div>
                    <p className="text-gray-300 mb-2">
                      <span className="font-semibold text-white">RSI at {technical.rsi ? parseFloat(technical.rsi).toFixed(1) : 'N/A'}</span> - 
                      {technical.rsi && parseFloat(technical.rsi) > 65 ? (
                        <span className="text-warning-yellow"> Approaching overbought territory (70+). Recent rally may be due for a pause.</span>
                      ) : technical.rsi && parseFloat(technical.rsi) < 35 ? (
                        <span className="text-gain-green"> In oversold territory, potential buying opportunity.</span>
                      ) : (
                        <span className="text-gray-300"> In neutral range, momentum balanced.</span>
                      )}
                    </p>
                  </div>
                  
                  <div>
                    <p className="text-gray-300 mb-2">
                      <span className="font-semibold text-white">MACD at {technical.macd ? parseFloat(technical.macd).toFixed(3) : 'N/A'}</span> vs Signal {technical.macdSignal ? parseFloat(technical.macdSignal).toFixed(3) : 'N/A'} - 
                      {(technical.macdSignal && technical.macd && parseFloat(technical.macd) < parseFloat(technical.macdSignal)) ? (
                        <span className="text-loss-red"> Bearish crossover signal, MACD below signal line indicates potential downward momentum.</span>
                      ) : (technical.macdSignal && technical.macd && parseFloat(technical.macd) > parseFloat(technical.macdSignal)) ? (
                        <span className="text-gain-green"> Bullish crossover signal, MACD above signal line indicates upward momentum.</span>
                      ) : (
                        <span className="text-gray-300"> MACD signal data unavailable for crossover analysis.</span>
                      )}
                    </p>
                  </div>

                  <div className="bg-financial-gray bg-opacity-30 rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="text-center">
                        <span className="text-gray-400">RSI Status</span>
                        <div className={`font-medium ${technical.rsi && parseFloat(technical.rsi) > 65 ? 'text-warning-yellow' : technical.rsi && parseFloat(technical.rsi) < 35 ? 'text-gain-green' : 'text-white'}`}>
                          {technical.rsi && parseFloat(technical.rsi) > 65 ? 'Overbought' : technical.rsi && parseFloat(technical.rsi) < 35 ? 'Oversold' : 'Neutral'}
                        </div>
                      </div>
                      <div className="text-center">
                        <span className="text-gray-400">MACD Signal</span>
                        <div className={`font-medium ${(technical.macdSignal && technical.macd && parseFloat(technical.macd) > parseFloat(technical.macdSignal)) ? 'text-gain-green' : 'text-loss-red'}`}>
                          {(technical.macdSignal && technical.macd && parseFloat(technical.macd) > parseFloat(technical.macdSignal)) ? 'Bullish' : 'Bearish'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Sector Performance Analysis */}
              <div className="border-l-4 border-green-500 pl-4">
                <div className="flex items-center gap-2 mb-3">
                  <TrendingUp className="w-4 h-4 text-green-500" />
                  <h4 className="font-semibold text-white text-base">Sector Performance</h4>
                </div>
                <div className="space-y-3">
                  {(() => {
                    // Calculate sector performance metrics
                    const sectorPerformance = sectors
                      .filter(s => s.symbol !== 'SPY')
                      .sort((a, b) => b.changePercent - a.changePercent);
                    
                    const topSector = sectorPerformance[0];
                    const bottomSector = sectorPerformance[sectorPerformance.length - 1];
                    const upSectors = sectorPerformance.filter(s => s.changePercent > 0).length;
                    const totalSectors = sectorPerformance.length;
                    const advanceRatio = Math.round((upSectors / totalSectors) * 100);

                    return (
                      <>
                        <p className="text-gray-300 leading-relaxed">
                          Today's sector performance reveals interesting underlying trends:
                        </p>
                        <p className="text-gray-300">
                          <span className="font-semibold text-gain-green">{topSector?.name}</span> led the charge with 
                          <span className="font-semibold text-gain-green"> {topSector?.changePercent >= 0 ? '+' : ''}{(topSector?.changePercent || 0).toFixed(2)}%</span> gain, 
                          showing {(topSector?.changePercent || 0) > 1 ? 'strong momentum in growth sectors' : 'modest strength in defensive positioning'}.
                        </p>
                        <p className="text-gray-300">
                          <span className="font-semibold text-loss-red">{bottomSector?.name}</span> was today's laggard at 
                          <span className="font-semibold text-loss-red"> {(bottomSector?.changePercent || 0).toFixed(2)}%</span>, 
                          though sector rotation remains healthy overall.
                        </p>
                        <p className="text-gray-300">
                          The <span className="font-semibold text-white">{advanceRatio}% advance ratio</span> ({upSectors} sectors up, {totalSectors - upSectors} down) 
                          shows {advanceRatio > 70 ? 'broad market participation, a positive sign for market health' : 'mixed sector performance with selective strength'}.
                        </p>
                        
                        <div className="bg-financial-gray bg-opacity-30 rounded-lg p-3">
                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div className="text-center">
                              <span className="text-gray-400">Top Performer</span>
                              <div className="text-gain-green font-medium">{topSector?.name === 'Health Care Select Sector SPDR Fund' ? 'Health Care' : topSector?.name?.split(' ')[0] || 'N/A'}</div>
                            </div>
                            <div className="text-center">
                              <span className="text-gray-400">5 Day Advance Ratio</span>
                              <div className={`font-medium ${(() => {
                                const fiveDayUp = sectorPerformance.filter(s => (s.fiveDayChange || 0) > 0).length;
                                const fiveDayRatio = Math.round((fiveDayUp / totalSectors) * 100);
                                return fiveDayRatio > 70 ? 'text-gain-green' : fiveDayRatio > 50 ? 'text-warning-yellow' : 'text-loss-red';
                              })()}`}>
                                {(() => {
                                  const fiveDayUp = sectorPerformance.filter(s => (s.fiveDayChange || 0) > 0).length;
                                  return Math.round((fiveDayUp / totalSectors) * 100);
                                })()}%
                              </div>
                            </div>
                            <div className="text-center">
                              <span className="text-gray-400">Advance Ratio (1 Day)</span>
                              <div className={`font-medium ${advanceRatio > 70 ? 'text-gain-green' : advanceRatio > 50 ? 'text-warning-yellow' : 'text-loss-red'}`}>
                                {advanceRatio}%
                              </div>
                            </div>
                          </div>
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Market Sentiment Analysis */}
              <div className="border-l-4 border-blue-500 pl-4">
                <div className="flex items-center gap-2 mb-3">
                  <AlertTriangle className="w-4 h-4 text-blue-500" />
                  <h4 className="font-semibold text-white text-base">Market Sentiment Analysis</h4>
                </div>
                <div className="space-y-3">
                  <p className="text-gray-300">
                    <span className="font-semibold text-white">VIX at {parseFloat(sentiment.vix).toFixed(1)}</span> indicates 
                    {parseFloat(sentiment.vix) > 30 ? (
                      <span className="text-loss-red"> high fear and uncertainty in the market.</span>
                    ) : parseFloat(sentiment.vix) > 20 ? (
                      <span className="text-warning-yellow"> moderate concern among investors.</span>
                    ) : (
                      <span className="text-gain-green"> low volatility and market complacency.</span>
                    )}
                  </p>
                  
                  <p className="text-gray-300">
                    AAII sentiment shows <span className="font-semibold text-gain-green">{parseFloat(sentiment.aaiiBullish).toFixed(1)}% bullish</span> vs 
                    <span className="font-semibold text-loss-red"> {parseFloat(sentiment.aaiiBearish).toFixed(1)}% bearish</span> - 
                    {parseFloat(sentiment.aaiiBullish) > parseFloat(sentiment.aaiiBearish) ? (
                      <span className="text-gain-green"> indicating net positive retail sentiment.</span>
                    ) : (
                      <span className="text-loss-red"> showing bearish retail positioning.</span>
                    )}
                  </p>

                  <div className="bg-financial-gray bg-opacity-30 rounded-lg p-3">
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div className="text-center">
                        <span className="text-gray-400">Fear Level</span>
                        <div className={`font-medium ${parseFloat(sentiment.vix) > 30 ? 'text-loss-red' : parseFloat(sentiment.vix) > 20 ? 'text-warning-yellow' : 'text-gain-green'}`}>
                          {parseFloat(sentiment.vix) > 30 ? 'High' : parseFloat(sentiment.vix) > 20 ? 'Moderate' : 'Low'}
                        </div>
                      </div>
                      <div className="text-center">
                        <span className="text-gray-400">Put/Call Ratio</span>
                        <div className="text-white font-medium">{parseFloat(sentiment.putCallRatio).toFixed(2)}</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Bottom Line Assessment - Full Width */}
              <div className="lg:col-span-3 border-l-4 border-purple-500 pl-4">
                <div className="flex items-center gap-2 mb-3">
                  <RefreshCw className="w-4 h-4 text-purple-500" />
                  <h4 className="font-semibold text-white text-base">Bottom Line Assessment</h4>
                </div>
                <div className="space-y-4">
                  <div>
                    <h5 className="font-bold text-blue-400 underline mb-2">TECHNICAL ANALYSIS:</h5>
                    <p className="text-gray-300 leading-relaxed">
                      {analysis.marketConditions}
                    </p>
                  </div>
                  
                  <div 
                    className="text-gray-300 leading-relaxed space-y-3"
                    dangerouslySetInnerHTML={{ 
                      __html: analysis.riskAssessment
                        .replace(/ECONOMIC ANALYSIS:/g, '<h5 class="font-bold text-blue-400 underline mb-2">ECONOMIC ANALYSIS:</h5>')
                        .replace(/SECTOR ROTATION ANALYSIS:/g, '<h5 class="font-bold text-blue-400 underline mb-2 mt-4">SECTOR ROTATION ANALYSIS:</h5>')
                        .replace(/\*\*(.*?)\*\*/g, '<strong class="text-white font-semibold">$1</strong>')
                        .replace(/\n\n/g, '</div><div class="mt-3">')
                        .replace(/\n/g, '<br />') 
                    }} 
                  />

                  <div className="bg-financial-gray bg-opacity-30 rounded-lg p-3">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <span className="text-gray-400">AI Confidence</span>
                        <div className="text-white font-bold">{(parseFloat(analysis.confidence) * 100).toFixed(0)}%</div>
                      </div>
                      <div className="text-center">
                        <span className="text-gray-400">Risk Level</span>
                        <div className={`font-medium ${technical.rsi && parseFloat(technical.rsi) > 65 ? 'text-warning-yellow' : 'text-gain-green'}`}>
                          {technical.rsi && parseFloat(technical.rsi) > 65 ? 'Elevated' : 'Moderate'}
                        </div>
                      </div>
                      <div className="text-center">
                        <span className="text-gray-400">Trend Status</span>
                        <div className={`font-medium ${(technical.macdSignal && technical.macd && parseFloat(technical.macd) > parseFloat(technical.macdSignal)) ? 'text-gain-green' : 'text-loss-red'}`}>
                          {(technical.macdSignal && technical.macd && parseFloat(technical.macd) > parseFloat(technical.macdSignal)) ? 'Bullish' : 'Bearish'}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Update Info */}
              <div className="lg:col-span-3 mt-4 text-xs text-gray-400 border-t border-financial-border pt-4">
                <div className="flex justify-between items-center">
                  <span>Last Updated: {new Date(analysis.timestamp).toLocaleTimeString()}</span>
                  <span>Powered by GPT-4o • Real Market Data</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400">
              No analysis available
            </div>
          )}
        </div>
        <Button
          className="w-full mt-4 bg-gain-green hover:bg-green-600 text-white transition-colors"
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
        >
          {refreshMutation.isPending ? (
            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4 mr-2" />
          )}
          Refresh Analysis
        </Button>
      </CardContent>
    </Card>
  );
}
