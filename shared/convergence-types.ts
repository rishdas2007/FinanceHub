export type Timeframe = '1m' | '5m' | '1h' | '1d' | '1w' | '1M';

export interface TechnicalIndicatorMultiTimeframe {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  timestamp: Date;
  rsi: number | null;
  macd_line: number | null;
  macd_signal: number | null;
  macd_histogram: number | null;
  bollinger_upper: number | null;
  bollinger_middle: number | null;
  bollinger_lower: number | null;
  bollinger_width: number | null;
  bollinger_position: number | null;
  volume_sma_20: number | null;
  volume_ratio: number | null;
  atr: number | null;
  created_at: Date;
}

export interface ConvergenceSignal {
  id: string;
  symbol: string;
  signal_type: 'bollinger_squeeze' | 'ma_convergence' | 'rsi_divergence' | 'volume_confirmation';
  timeframes: Timeframe[];
  strength: number; // 0-100
  confidence: number; // 0-100 based on historical success
  direction: 'bullish' | 'bearish' | 'neutral';
  detected_at: Date;
  expires_at: Date;
  metadata: Record<string, any>;
  is_active: boolean;
  created_at: Date;
}

export interface SignalQualityScore {
  id: string;
  signal_type: string;
  symbol: string;
  timeframe_combination: string;
  total_occurrences: number;
  successful_occurrences: number;
  success_rate: number;
  avg_return_24h: number;
  avg_return_7d: number;
  last_updated: Date;
  created_at: Date;
}

export interface BollingerSqueezeEvent {
  id: string;
  symbol: string;
  timeframe: Timeframe;
  squeeze_start: Date;
  squeeze_end: Date | null;
  squeeze_duration_hours: number | null;
  breakout_direction: 'up' | 'down' | null;
  breakout_strength: number | null;
  price_at_squeeze: number;
  price_at_breakout: number | null;
  volume_at_squeeze: number;
  volume_at_breakout: number | null;
  return_24h: number | null;
  return_7d: number | null;
  is_active: boolean;
  created_at: Date;
}

export interface MultiTimeframeAnalysis {
  symbol: string;
  timestamp: Date;
  convergence_signals: ConvergenceSignal[];
  signal_summary: {
    total_signals: number;
    bullish_signals: number;
    bearish_signals: number;
    average_confidence: number;
    highest_confidence_signal: ConvergenceSignal | null;
  };
  bollinger_squeeze_status: {
    active_squeezes: BollingerSqueezeEvent[];
    recent_breakouts: BollingerSqueezeEvent[];
  };
  overall_bias: 'bullish' | 'bearish' | 'neutral';
  confidence_score: number;
}

export interface RSIDivergence {
  symbol: string;
  timeframe: Timeframe;
  divergence_type: 'bullish' | 'bearish';
  price_points: Array<{ timestamp: Date; price: number }>;
  rsi_points: Array<{ timestamp: Date; rsi: number }>;
  strength: number;
  confidence: number;
  detected_at: Date;
}

export interface MovingAverageConvergence {
  symbol: string;
  timeframes: Timeframe[];
  convergence_type: 'golden_cross' | 'death_cross' | 'alignment';
  ma_short: number;
  ma_long: number;
  separation_percentage: number;
  volume_confirmation: boolean;
  strength: number;
  detected_at: Date;
}

// API Response Types
export interface ConvergenceAnalysisResponse {
  analysis: MultiTimeframeAnalysis[];
  signal_quality_overview: {
    total_tracked_signals: number;
    avg_success_rate: number;
    best_performing_signal_type: string;
    recent_performance_trend: 'improving' | 'declining' | 'stable';
  };
  active_alerts: ConvergenceSignal[];
  squeeze_monitoring: {
    symbols_in_squeeze: string[];
    potential_breakouts: BollingerSqueezeEvent[];
    recent_successful_breakouts: BollingerSqueezeEvent[];
  };
}