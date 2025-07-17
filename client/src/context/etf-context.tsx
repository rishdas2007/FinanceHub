import React, { createContext, useContext, useState, ReactNode } from 'react';

interface ETF {
  symbol: string;
  name: string;
}

const ETF_OPTIONS: ETF[] = [
  { symbol: 'SPY', name: 'SPDR S&P 500 ETF' },
  { symbol: 'QQQ', name: 'Invesco QQQ Trust' },
  { symbol: 'IWM', name: 'iShares Russell 2000 ETF' },
  { symbol: 'DIA', name: 'SPDR Dow Jones Industrial Average ETF' },
  { symbol: 'VTI', name: 'Vanguard Total Stock Market ETF' },
  { symbol: 'EFA', name: 'iShares MSCI EAFE ETF' },
  { symbol: 'VWO', name: 'Vanguard Emerging Markets Stock Index Fund' },
  { symbol: 'GLD', name: 'SPDR Gold Shares' },
  { symbol: 'SLV', name: 'iShares Silver Trust' },
  { symbol: 'XLF', name: 'Financial Select Sector SPDR Fund' },
  { symbol: 'XLK', name: 'Technology Select Sector SPDR Fund' },
  { symbol: 'XLE', name: 'Energy Select Sector SPDR Fund' },
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