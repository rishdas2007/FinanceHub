import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ETF {
  symbol: string;
  name: string;
}

// Harmonized to match sector ETFs used across all dashboard sections for performance
const ETF_OPTIONS: ETF[] = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
  { symbol: 'XLK', name: 'Technology Select Sector SPDR Fund' },
  { symbol: 'XLV', name: 'Health Care Select Sector SPDR Fund' },
  { symbol: 'XLF', name: 'Financial Select Sector SPDR Fund' },
  { symbol: 'XLY', name: 'Consumer Discretionary Select Sector SPDR Fund' },
  { symbol: 'XLI', name: 'Industrial Select Sector SPDR Fund' },
  { symbol: 'XLC', name: 'Communication Services Select Sector SPDR Fund' },
  { symbol: 'XLP', name: 'Consumer Staples Select Sector SPDR Fund' },
  { symbol: 'XLE', name: 'Energy Select Sector SPDR Fund' },
  { symbol: 'XLU', name: 'Utilities Select Sector SPDR Fund' },
  { symbol: 'XLB', name: 'Materials Select Sector SPDR Fund' },
  { symbol: 'XLRE', name: 'Real Estate Select Sector SPDR Fund' },
];

interface ETFContextType {
  selectedETF: ETF;
  setSelectedETF: (etf: ETF) => void;
  etfOptions: ETF[];
}

const ETFContext = createContext<ETFContextType | undefined>(undefined);

export function ETFProvider({ children }: { children: ReactNode }) {
  const [selectedETF, setSelectedETF] = useState<ETF>(ETF_OPTIONS[0]); // Default to SPY

  return (
    <ETFContext.Provider 
      value={{ 
        selectedETF, 
        setSelectedETF, 
        etfOptions: ETF_OPTIONS 
      }}
    >
      {children}
    </ETFContext.Provider>
  );
}

export function useETF() {
  const context = useContext(ETFContext);
  if (context === undefined) {
    throw new Error('useETF must be used within an ETFProvider');
  }
  return context;
}