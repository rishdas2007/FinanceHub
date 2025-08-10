import { Container } from 'inversify';
import { TYPES } from './types';
import { IFinancialDataService, FinancialDataService } from '../services/financial-data';
import { ICacheService, CacheUnifiedService } from '../services/cache-unified';
import { IAIAnalysisService, AIAnalysisService } from '../services/ai-analysis-unified';
import { IEconomicDataService, EconomicDataEnhancedService } from '../services/economic-data-enhanced';
import { ISectorAnalysisService, SimplifiedSectorAnalysisService } from '../services/simplified-sector-analysis';

const container = new Container();

// Bind services to container
container.bind<IFinancialDataService>(TYPES.FinancialDataService).to(FinancialDataService).inSingletonScope();
container.bind<ICacheService>(TYPES.CacheService).to(CacheUnifiedService).inSingletonScope();
container.bind<IAIAnalysisService>(TYPES.AIAnalysisService).to(AIAnalysisService).inSingletonScope();
container.bind<IEconomicDataService>(TYPES.EconomicDataService).to(EconomicDataEnhancedService).inSingletonScope();
container.bind<ISectorAnalysisService>(TYPES.SectorAnalysisService).to(SimplifiedSectorAnalysisService).inSingletonScope();

export { container };