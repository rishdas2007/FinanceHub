# Standard Unit Implementation Plan

## Overview
This plan addresses the inconsistent usage of the `standard_unit` column in economic data transformations and establishes a centralized formatting system for all economic indicators.

## Current Issues

### 1. Scattered Formatting Logic
- Multiple components have hardcoded unit formatting
- `standard_unit` column exists but isn't consistently used
- Frontend components bypass the standardized unit system

### 2. Affected Files
- `/client/src/components/MacroeconomicIndicators.tsx` - Lines 240+ hardcoded formatting
- `/client/src/components/movers/EconMovers.tsx` - Lines 23+ custom formatValue function
- `/client/src/components/RecentEconomicReadings.tsx` - Custom formatValue function
- `/client/src/components/EconomicPulseCheck.tsx` - Custom formatNumber function

### 3. Working Implementation
- `/server/services/enhanced-economic-data-service.ts:61` - Correct `formatIndicatorValue` usage
- Database schema properly defines standard units in `econ_series_def` table

## Implementation Plan

### Phase 1: Create Centralized Formatting Service

#### Task 1.1: Create Shared Economic Formatter
**File**: `/shared/formatters/economic-unit-formatter.ts`

```typescript
interface EconomicFormatterParams {
  value: number;
  standardUnit: string;
  scaleHint: string;
  displayPrecision: number;
  transformCode?: string;
  yoyChange?: number | null;
}

export class EconomicUnitFormatter {
  static formatValue(params: EconomicFormatterParams): string;
  static getDisplayUnit(standardUnit: string, scaleHint: string): string;
  static formatPercentage(value: number, precision: number): string;
  static formatCount(value: number, scaleHint: string, precision: number): string;
  static formatIndex(value: number, precision: number, yoyChange?: number): string;
}
```

**Implementation Requirements:**
- Handle all 6 standard unit types: PCT_DECIMAL, USD, COUNT, INDEX_PT, HOURS, RATIO_DECIMAL
- Respect scale hints: NONE, K, M, B
- Apply display precision from database
- Support YoY transformation display for INDEX_PT types

### Phase 2: Update Backend Services

#### Task 2.1: Enhance Enhanced Economic Data Service
**File**: `/server/services/enhanced-economic-data-service.ts`

**Changes Required:**
- Import and use the new `EconomicUnitFormatter`
- Update `formatIndicatorValue` function (line 61) to use centralized formatter
- Ensure all economic indicator responses use standardized formatting

#### Task 2.2: Update Economic Data Routes
**File**: `/server/routes/economic-data-routes.ts`

**Changes Required:**
- Replace hardcoded unit handling (lines 43, 54, 181, 199)
- Use `observation.standardUnit` consistently
- Apply centralized formatting for all API responses

### Phase 3: Update Frontend Components

#### Task 3.1: Update MacroeconomicIndicators Component
**File**: `/client/src/components/MacroeconomicIndicators.tsx`

**Changes Required:**
- Replace `MacroFormatUtils.formatIndicatorValue` (lines 240+) with API-provided formatted values
- Remove hardcoded unit logic
- Ensure backend provides pre-formatted strings using `standard_unit`

**Code Changes:**
```typescript
// BEFORE (lines 240+)
{MacroFormatUtils.formatIndicatorValue(indicator.currentReading, indicator.metric)}

// AFTER 
{indicator.currentReading} // Backend provides formatted string
```

#### Task 3.2: Update EconMovers Component  
**File**: `/client/src/components/movers/EconMovers.tsx`

**Changes Required:**
- Remove custom `formatValue` function (line 23+)
- Use API-provided formatted values
- Ensure backend applies standard_unit formatting

#### Task 3.3: Update RecentEconomicReadings Component
**File**: `/client/src/components/RecentEconomicReadings.tsx`

**Changes Required:**
- Remove custom `formatValue` function
- Use backend-formatted values
- Ensure consistent display across all economic components

#### Task 3.4: Update EconomicPulseCheck Component
**File**: `/client/src/components/EconomicPulseCheck.tsx`

**Changes Required:**
- Remove custom `formatNumber` function
- Use standardized formatting from backend
- Maintain existing UI layout and styling

### Phase 4: Database Consistency Validation

#### Task 4.1: Validate Standard Unit Consistency
**File**: `/scripts/validate-standard-units.ts`

**Create Script to:**
- Check `econ_series_observation.standard_unit` matches `econ_series_def.standard_unit`
- Identify any mismatched records
- Generate report of inconsistencies
- Provide data cleanup recommendations

#### Task 4.2: Update Economic Data Migration
**File**: `/server/services/economic-data-migration.ts`

**Changes Required:**
- Ensure all series definitions use correct standard_unit values (lines 39, 52, 67, etc.)
- Validate unit consistency during data loading
- Add data quality checks for unit mismatches

### Phase 5: Testing & Validation

#### Task 5.1: Update Component Tests
**Files**: 
- `/tests/components/ETFMetricsTable.test.tsx`
- Create new tests for economic formatting

**Test Requirements:**
- Verify formatted values match expected standard_unit output
- Test all 6 standard unit types
- Validate scale hint applications
- Test edge cases (null values, invalid data)

#### Task 5.2: Integration Testing
**File**: `/tests/integration/economic-formatting.test.ts`

**Test Coverage:**
- End-to-end formatting from database to frontend
- API response format validation
- Component rendering with formatted values
- Data consistency across components

### Phase 6: Performance Optimization

#### Task 6.1: Caching Formatted Values
**Implementation:**
- Cache formatted strings in economic data service
- Reduce frontend formatting overhead
- Maintain cache invalidation on data updates

#### Task 6.2: Bundle Size Optimization
- Remove duplicate formatting functions from frontend
- Centralize logic in shared formatters
- Reduce client-side bundle size

## Migration Strategy

### Step 1: Backend First (Days 1-2)
1. Create centralized formatter
2. Update backend services to use standard_unit
3. Ensure all APIs return pre-formatted values

### Step 2: Frontend Updates (Days 3-4)  
1. Update components to use API-provided formatted values
2. Remove custom formatting functions
3. Maintain existing UI/UX

### Step 3: Testing & Validation (Day 5)
1. Run validation scripts
2. Execute test suites
3. Verify data consistency

### Step 4: Cleanup (Day 6)
1. Remove unused formatting code
2. Update documentation
3. Performance verification

## Success Criteria

### Technical Metrics
- [ ] All economic components use `standard_unit` column
- [ ] Zero hardcoded unit formatting in frontend
- [ ] Consistent formatting across all economic displays
- [ ] Database unit consistency validated
- [ ] Test coverage > 90% for formatting logic

### User Experience
- [ ] No visual changes to existing displays
- [ ] Improved loading performance
- [ ] Consistent unit display across components
- [ ] Proper handling of all economic indicator types

## Risk Mitigation

### Data Quality Risks
- **Risk**: Inconsistent standard_unit values in database
- **Mitigation**: Run validation script before implementation
- **Rollback**: Keep existing formatting as backup

### Performance Risks  
- **Risk**: Increased backend processing for formatting
- **Mitigation**: Implement caching strategy
- **Monitoring**: Track API response times

### UI/UX Risks
- **Risk**: Accidental display changes
- **Mitigation**: Component-level testing with visual regression
- **Validation**: Manual QA of all economic displays

## Implementation Notes

### Database Schema Reference
```sql
-- Standard unit enum values (from economic-data-model.ts:9)
standard_unit: 'PCT_DECIMAL' | 'USD' | 'COUNT' | 'INDEX_PT' | 'HOURS' | 'RATIO_DECIMAL'

-- Scale hint enum values  
scale_hint: 'NONE' | 'K' | 'M' | 'B'

-- Transform code enum values
transform_code: 'LEVEL' | 'YOY' | 'MOM' | 'QOQ_ANN' | 'LOG_LEVEL' | 'LOG_DIFF_MOM' | 'LOG_DIFF_YOY'
```

### Key Files to Modify
1. **NEW**: `/shared/formatters/economic-unit-formatter.ts`
2. **UPDATE**: `/server/services/enhanced-economic-data-service.ts`
3. **UPDATE**: `/client/src/components/MacroeconomicIndicators.tsx`
4. **UPDATE**: `/client/src/components/movers/EconMovers.tsx` 
5. **UPDATE**: `/client/src/components/RecentEconomicReadings.tsx`
6. **UPDATE**: `/client/src/components/EconomicPulseCheck.tsx`
7. **NEW**: `/scripts/validate-standard-units.ts`

### Validation Commands
```bash
# Run after implementation
npm run test -- --testPathPattern=economic
npm run lint
npm run typecheck
node scripts/validate-standard-units.ts
```

## Expected Outcomes

1. **Centralized Logic**: All economic unit formatting handled by single service
2. **Database Consistency**: `standard_unit` column used throughout application  
3. **Reduced Maintenance**: Single place to update unit formatting logic
4. **Better Performance**: Pre-formatted values from backend reduce frontend processing
5. **Improved Reliability**: Consistent unit display across all economic components

## Post-Implementation Tasks

1. **Documentation Update**: Update API documentation with new formatting approach
2. **Monitoring Setup**: Track formatting performance and error rates
3. **Team Training**: Document new formatting service usage
4. **Future Enhancements**: Consider additional economic indicator types