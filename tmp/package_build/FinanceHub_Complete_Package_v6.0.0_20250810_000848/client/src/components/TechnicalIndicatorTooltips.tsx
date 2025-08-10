import { 
  Tooltip, 
  TooltipContent, 
  TooltipProvider, 
  TooltipTrigger 
} from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface TooltipProps {
  children: React.ReactNode;
  content: string;
  title?: string;
}

export function TechnicalTooltip({ children, content, title }: TooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className="flex items-center gap-1 cursor-help">
            {children}
            <HelpCircle className="h-3 w-3 text-gray-500" />
          </div>
        </TooltipTrigger>
        <TooltipContent className="max-w-sm p-3 bg-gray-900 border border-gray-700">
          {title && <div className="font-medium text-white mb-1">{title}</div>}
          <div className="text-sm text-gray-300">{content}</div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

// Specific technical indicator tooltips with updated calculation explanations
export const RSI_TOOLTIP = "Relative Strength Index (14-period). Measures momentum. Fixed calculation ensures proper sample size validation.";

export const MACD_TOOLTIP = "Moving Average Convergence Divergence. Now requires 52 data points minimum for proper EMA calculation (26×2 for seeding). Fixed EMA seeding bug - EMA now properly seeds with SMA of first period values instead of first data point.";

export const EMA_TOOLTIP = "Exponential Moving Average. Fixed critical bug: EMA now properly seeds with SMA of first period values instead of first data point. No more dynamic period adjustments that compromise indicator integrity.";

export const SMA_TOOLTIP = "Simple Moving Average. Standardized data requirements: SMA20 requires 20 data points, SMA50 requires 50 data points. No fallback compromised calculations.";

export const BOLLINGER_TOOLTIP = "Bollinger Bands %B position. Fixed signal direction: High %B (>0.8) now properly identified as bearish (overbought) signal. Current signal thresholds: ±0.25 for practical trading signals.";

export const ZSCORE_TOOLTIP = "Z-Score statistical analysis using 20-day rolling window. Improved scaling from stepped thresholds to smooth scaling (zscore/2). Enhanced extreme value handling from arbitrary ±50 capping to ±5 statistical threshold.";

export const ATR_TOOLTIP = "Average True Range. Removed from directional signals, now implemented as volatility signal strength modifier only. No longer contributes to directional buy/sell signals.";

export const ECONOMIC_PULSE_TOOLTIP = "Revolutionary 3-layer validation-driven methodology. Core Economic Momentum (60%), Inflation & Policy Balance (25%), Forward-Looking Confidence (15%). Focuses on 6 core components: Growth Momentum, Financial Stress, Labor Health, Inflation Trajectory, Policy Effectiveness, Economic Expectations.";

export const MOMENTUM_ANALYSIS_TOOLTIP = "Enhanced momentum strategy analysis with fixed RSI calculations, corrected Z-score scaling, and industry-standard moving average calculations. No dynamic period adjustments compromise indicator integrity.";

export const SIGNAL_STRENGTH_TOOLTIP = "Composite signal strength from weighted technical indicators. Rebalanced weights: RSI (35%), MACD (30%), Bollinger (20%), MA Trend (15%), Price Momentum (10%). ATR used as volatility modifier only.";