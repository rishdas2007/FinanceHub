import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Calculator, 
  TrendingUp, 
  Activity, 
  BarChart3, 
  HelpCircle,
  CheckCircle,
  AlertTriangle,
  Target
} from 'lucide-react';

interface TechnicalIndicatorLegendProps {
  className?: string;
}

export function TechnicalIndicatorLegend({ className = '' }: TechnicalIndicatorLegendProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Dialog open={isOpen} onOpenChange={setIsOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className={`text-blue-400 hover:text-blue-300 hover:bg-blue-400/10 ${className}`}>
          <Calculator className="h-4 w-4 mr-1" />
          Technical Indicators Guide
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto bg-gray-900 border-gray-700">
        <DialogHeader>
          <DialogTitle className="text-xl text-white flex items-center gap-2">
            <Calculator className="h-5 w-5 text-blue-400" />
            Technical Indicators - Calculation Fixes & Methodology
          </DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="fixes" className="w-full">
          <TabsList className="grid w-full grid-cols-3 bg-gray-800">
            <TabsTrigger value="fixes" className="text-gray-300 data-[state=active]:text-white">Recent Fixes</TabsTrigger>
            <TabsTrigger value="indicators" className="text-gray-300 data-[state=active]:text-white">Indicators</TabsTrigger>
            <TabsTrigger value="signals" className="text-gray-300 data-[state=active]:text-white">Signal Logic</TabsTrigger>
          </TabsList>

          <TabsContent value="fixes" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium text-gray-200 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  Moving Average Calculation Accuracy Fixes (August 5, 2025)
                </h4>
                <div className="space-y-3 text-sm text-gray-300">
                  <div className="bg-green-900/20 p-3 rounded border border-green-700">
                    <p><strong className="text-green-400">✅ EMA Seeding Bug Fixed:</strong> EMA now properly seeds with SMA of first period values instead of first data point</p>
                  </div>
                  <div className="bg-green-900/20 p-3 rounded border border-green-700">
                    <p><strong className="text-green-400">✅ MACD Accuracy Improved:</strong> Requires 52 data points minimum for proper EMA calculation (26×2 for seeding)</p>
                  </div>
                  <div className="bg-green-900/20 p-3 rounded border border-green-700">
                    <p><strong className="text-green-400">✅ Dynamic Period Adjustments Removed:</strong> No more Math.min() compromises that alter indicator characteristics</p>
                  </div>
                  <div className="bg-green-900/20 p-3 rounded border border-green-700">
                    <p><strong className="text-green-400">✅ Standardized Data Requirements:</strong> SMA20 (20 pts), SMA50 (50 pts), EMA12 (24 pts), EMA26 (52 pts)</p>
                  </div>
                  <div className="bg-green-900/20 p-3 rounded border border-green-700">
                    <p><strong className="text-green-400">✅ Industry Standard Compliance:</strong> EMA calculations now match financial industry mathematical standards</p>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium text-gray-200 mb-3 flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-400" />
                  Z-Score Weighted System Methodology Fixes (August 5, 2025)
                </h4>
                <div className="space-y-3 text-sm text-gray-300">
                  <div className="bg-blue-900/20 p-3 rounded border border-blue-700">
                    <p><strong className="text-blue-400">✅ Bollinger %B Direction Corrected:</strong> High %B now properly identified as bearish (overbought) signal</p>
                  </div>
                  <div className="bg-blue-900/20 p-3 rounded border border-blue-700">
                    <p><strong className="text-blue-400">✅ Signal Thresholds Adjusted:</strong> Current thresholds ±0.25 for practical trading signals (BUY ≥0.25, SELL ≤-0.25)</p>
                  </div>
                  <div className="bg-blue-900/20 p-3 rounded border border-blue-700">
                    <p><strong className="text-blue-400">✅ Z-score to Signal Conversion Improved:</strong> From stepped thresholds to smooth scaling (zscore/2)</p>
                  </div>
                  <div className="bg-blue-900/20 p-3 rounded border border-blue-700">
                    <p><strong className="text-blue-400">✅ ATR Usage Optimized:</strong> Removed from directional signals, implemented as volatility signal strength modifier</p>
                  </div>
                  <div className="bg-blue-900/20 p-3 rounded border border-blue-700">
                    <p><strong className="text-blue-400">✅ Weight Rebalancing:</strong> Increased RSI (35%), MACD (30%), MA Trend (15%) focus for better momentum detection</p>
                  </div>
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="indicators" className="space-y-4 mt-4">
            <div className="grid gap-4">
              <div className="border border-gray-700 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Activity className="h-5 w-5 text-blue-400" />
                  <h4 className="font-medium text-gray-200">RSI (Relative Strength Index)</h4>
                  <Badge variant="outline" className="bg-green-400/10 text-green-400 border-green-600">Fixed</Badge>
                </div>
                <p className="text-sm text-gray-300">14-period momentum oscillator. Fixed calculation ensures proper sample size validation.</p>
                <div className="text-xs text-gray-400">
                  <strong>Interpretation:</strong> &gt;70 overbought (sell), &lt;30 oversold (buy), 30-70 neutral
                </div>
              </div>

              <div className="border border-gray-700 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-blue-400" />
                  <h4 className="font-medium text-gray-200">MACD (Moving Average Convergence Divergence)</h4>
                  <Badge variant="outline" className="bg-green-400/10 text-green-400 border-green-600">Fixed</Badge>
                </div>
                <p className="text-sm text-gray-300">Now requires 52 data points minimum for proper EMA calculation. Fixed EMA seeding bug.</p>
                <div className="text-xs text-gray-400">
                  <strong>Calculation:</strong> EMA12 - EMA26, properly seeded with SMA values
                </div>
              </div>

              <div className="border border-gray-700 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5 text-blue-400" />
                  <h4 className="font-medium text-gray-200">Bollinger Bands %B</h4>
                  <Badge variant="outline" className="bg-green-400/10 text-green-400 border-green-600">Fixed</Badge>
                </div>
                <p className="text-sm text-gray-300">Fixed signal direction: High %B (&gt;0.8) now properly identified as bearish (overbought).</p>
                <div className="text-xs text-gray-400">
                  <strong>Range:</strong> 0-1, where &gt;0.8 = overbought, &lt;0.2 = oversold
                </div>
              </div>

              <div className="border border-gray-700 rounded-lg p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Target className="h-5 w-5 text-blue-400" />
                  <h4 className="font-medium text-gray-200">Moving Averages (SMA/EMA)</h4>
                  <Badge variant="outline" className="bg-green-400/10 text-green-400 border-green-600">Fixed</Badge>
                </div>
                <p className="text-sm text-gray-300">Standardized data requirements. No dynamic period adjustments that compromise integrity.</p>
                <div className="text-xs text-gray-400">
                  <strong>Requirements:</strong> SMA20 (20 pts), SMA50 (50 pts), EMA12 (24 pts), EMA26 (52 pts)
                </div>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="signals" className="space-y-4 mt-4">
            <div className="space-y-4">
              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium text-gray-200 mb-3">Weighted Signal Composition</h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex justify-between">
                    <span>RSI (Primary momentum)</span>
                    <Badge variant="outline" className="text-green-400 border-green-600">35%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>MACD (Trend confirmation)</span>
                    <Badge variant="outline" className="text-blue-400 border-blue-600">30%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Bollinger Bands (Volatility/reversal)</span>
                    <Badge variant="outline" className="text-yellow-400 border-yellow-600">20%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>MA Trend (Direction)</span>
                    <Badge variant="outline" className="text-purple-400 border-purple-600">15%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>Price Momentum (Statistical)</span>
                    <Badge variant="outline" className="text-gray-400 border-gray-600">10%</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span>ATR (Volatility modifier only)</span>
                    <Badge variant="outline" className="text-red-400 border-red-600">0%</Badge>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium text-gray-200 mb-3">Signal Thresholds</h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <div className="flex justify-between">
                    <span>BUY Signal</span>
                    <span className="text-green-400">Composite Score ≥ +0.6</span>
                  </div>
                  <div className="flex justify-between">
                    <span>SELL Signal</span>
                    <span className="text-red-400">Composite Score ≤ -0.6</span>
                  </div>
                  <div className="flex justify-between">
                    <span>HOLD Signal</span>
                    <span className="text-yellow-400">-0.6 &lt; Score &lt; +0.6</span>
                  </div>
                </div>
              </div>

              <div className="bg-gray-800 p-4 rounded-lg">
                <h4 className="font-medium text-gray-200 mb-3">Z-Score Statistical Analysis</h4>
                <div className="space-y-2 text-sm text-gray-300">
                  <p><strong>Window:</strong> 20-day rolling window (standardized across ETF metrics)</p>
                  <p><strong>Scaling:</strong> Smooth scaling (zscore/2) instead of stepped thresholds</p>
                  <p><strong>Extreme Values:</strong> ±5 statistical threshold with unprecedented event flagging</p>
                  <p><strong>Sample Variance:</strong> Corrected from population (N) to sample (N-1) calculation</p>
                </div>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}