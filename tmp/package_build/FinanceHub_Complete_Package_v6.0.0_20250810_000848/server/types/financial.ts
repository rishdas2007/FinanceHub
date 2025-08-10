export interface EconomicEvent {
  id: string;
  title: string;
  description: string;
  date: Date;
  time?: string;
  country: string;
  category: string;
  importance: 'high' | 'medium' | 'low';
  currency: string;
  forecast?: string | null;
  previous?: string | null;
  actual?: string | null;
  impact?: 'very_positive' | 'positive' | 'neutral' | 'slightly_negative' | 'negative' | null;
  source: string;
}