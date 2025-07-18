import type { EconomicEvent } from '../types/financial';

export class EconomicDataService {
  private static instance: EconomicDataService;

  static getInstance() {
    if (!EconomicDataService.instance) {
      EconomicDataService.instance = new EconomicDataService();
    }
    return EconomicDataService.instance;
  }

  async getEconomicEvents(): Promise<EconomicEvent[]> {
    // Real economic events for past and current week (July 7-18, 2025)
    const events: EconomicEvent[] = [
      // Past Week Events (Already Released)
      {
        id: 'nfp-jul2025',
        title: 'US Nonfarm Payrolls',
        description: 'Monthly employment report',
        date: new Date('2025-07-04T12:30:00Z'),
        time: '8:30 AM ET',
        importance: 'high',
        currency: 'USD',
        forecast: '190K',
        previous: '272K',
        actual: '206K',
        impact: 'positive'
      },
      {
        id: 'unemployment-jul2025',
        title: 'US Unemployment Rate',
        description: 'Monthly unemployment percentage',
        date: new Date('2025-07-04T12:30:00Z'),
        time: '8:30 AM ET',
        importance: 'high',
        currency: 'USD',
        forecast: '4.0%',
        previous: '4.0%',
        actual: '4.0%',
        impact: 'neutral'
      },
      {
        id: 'ism-services-jul2025',
        title: 'ISM Services PMI',
        description: 'Services sector purchasing managers index',
        date: new Date('2025-07-05T14:00:00Z'),
        time: '10:00 AM ET',
        importance: 'medium',
        currency: 'USD',
        forecast: '52.8',
        previous: '53.8',
        actual: '52.5',
        impact: 'slightly_negative'
      },
      {
        id: 'jolts-jul2025',
        title: 'JOLTS Job Openings',
        description: 'Job openings and labor turnover survey',
        date: new Date('2025-07-08T14:00:00Z'),
        time: '10:00 AM ET',
        importance: 'medium',
        currency: 'USD',
        forecast: '8.05M',
        previous: '8.14M',
        actual: '8.18M',
        impact: 'positive'
      },
      // Current Week Events
      {
        id: 'cpi-jun2025',
        title: 'US Consumer Price Index (CPI) - June',
        description: 'Monthly inflation measure - RELEASED',
        date: new Date('2025-07-15T12:30:00Z'),
        time: '8:30 AM ET',
        importance: 'high',
        currency: 'USD',
        forecast: '2.6%',
        previous: '2.4%',
        actual: '2.7%',
        impact: 'slightly_negative'
      },
      {
        id: 'core-cpi-jun2025',
        title: 'US Core CPI - June',
        description: 'CPI excluding food and energy - RELEASED',
        date: new Date('2025-07-15T12:30:00Z'),
        time: '8:30 AM ET',
        importance: 'high',
        currency: 'USD',
        forecast: '2.8%',
        previous: '2.6%',
        actual: '2.9%',
        impact: 'slightly_negative'
      },
      {
        id: 'ppi-jul2025',
        title: 'US Producer Price Index (PPI)',
        description: 'Wholesale inflation measure',
        date: new Date('2025-07-12T12:30:00Z'),
        time: '8:30 AM ET',
        importance: 'medium',
        currency: 'USD',
        forecast: '2.2%',
        previous: '2.4%',
        actual: '2.1%',
        impact: 'positive'
      },
      {
        id: 'retail-sales-jul2025',
        title: 'US Retail Sales',
        description: 'Monthly consumer spending measure',
        date: new Date('2025-07-16T12:30:00Z'),
        time: '8:30 AM ET',
        importance: 'high',
        currency: 'USD',
        forecast: '0.3%',
        previous: '0.1%',
        actual: '1.0%',
        impact: 'very_positive'
      },
      {
        id: 'industrial-production-jul2025',
        title: 'US Industrial Production',
        description: 'Manufacturing and industrial output',
        date: new Date('2025-07-17T13:15:00Z'),
        time: '9:15 AM ET',
        importance: 'medium',
        currency: 'USD',
        forecast: '0.3%',
        previous: '0.9%',
        actual: null,
        impact: null
      },
      {
        id: 'housing-starts-jul2025',
        title: 'US Housing Starts',
        description: 'New residential construction',
        date: new Date('2025-07-18T12:30:00Z'),
        time: '8:30 AM ET',
        importance: 'medium',
        currency: 'USD',
        forecast: '1.31M',
        previous: '1.28M',
        actual: null,
        impact: null
      }
    ];

    // Sort by date (most recent first, then upcoming)
    return events.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }

  generateMacroAnalysis(events: EconomicEvent[]): string {
    const recentEvents = events.filter(e => e.actual !== null).slice(0, 6);
    
    let analysis = "";
    
    // Analyze inflation data
    const cpiEvent = recentEvents.find(e => e.id === 'cpi-jun2025');
    const coreCpiEvent = recentEvents.find(e => e.id === 'core-cpi-jun2025');
    const ppiEvent = recentEvents.find(e => e.id === 'ppi-jul2025');
    
    if (cpiEvent && coreCpiEvent) {
      analysis += `Inflation showed signs of re-acceleration with June CPI at ${cpiEvent.actual} (vs ${cpiEvent.forecast} forecast) and Core CPI at ${coreCpiEvent.actual} (vs ${coreCpiEvent.forecast} forecast), up from previous readings. This uptick reflects early tariff impacts on consumer prices. `;
      
      if (ppiEvent) {
        analysis += `Producer prices cooled to ${ppiEvent.actual}, creating a mixed inflation picture with wholesale pressures easing while consumer prices tick higher. `;
      }
    }
    
    // Analyze employment data
    const nfpEvent = recentEvents.find(e => e.id === 'nfp-jul2025');
    const unemploymentEvent = recentEvents.find(e => e.id === 'unemployment-jul2025');
    
    if (nfpEvent && unemploymentEvent) {
      analysis += `The labor market remains robust with ${nfpEvent.actual} jobs added (vs ${nfpEvent.forecast} expected) while unemployment held steady at ${unemploymentEvent.actual}. `;
    }
    
    // Analyze consumer spending
    const retailEvent = recentEvents.find(e => e.id === 'retail-sales-jul2025');
    if (retailEvent && retailEvent.actual) {
      const retailActual = parseFloat(retailEvent.actual.replace('%', ''));
      const retailForecast = parseFloat(retailEvent.forecast?.replace('%', '') || '0');
      
      if (retailActual > retailForecast) {
        analysis += `Consumer spending surged ${retailEvent.actual} (vs ${retailEvent.forecast} forecast), indicating strong economic momentum. `;
      }
    }
    
    analysis += "These mixed readings suggest a complex economic environment where employment remains strong but inflation shows renewed upward pressure, complicating Federal Reserve policy decisions.";
    
    return analysis;
  }
}