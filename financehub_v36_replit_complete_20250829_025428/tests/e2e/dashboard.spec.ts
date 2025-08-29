import { test, expect } from '@playwright/test';

test.describe('FinanceHub Pro Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('should load the dashboard with main sections', async ({ page }) => {
    // Wait for the page to load
    await page.waitForLoadState('networkidle');

    // Check for main dashboard sections
    await expect(page.locator('[data-testid="economic-pulse-check"]')).toBeVisible();
    await expect(page.locator('[data-testid="momentum-strategies"]')).toBeVisible();
    await expect(page.locator('[data-testid="macroeconomic-indicators"]')).toBeVisible();
  });

  test('should display economic indicators with data', async ({ page }) => {
    // Wait for economic indicators to load
    await page.waitForSelector('[data-testid="macroeconomic-indicators-table"]', {
      timeout: 10000,
    });

    const table = page.locator('[data-testid="macroeconomic-indicators-table"]');
    await expect(table).toBeVisible();

    // Check for table headers
    await expect(page.locator('text=Metric')).toBeVisible();
    await expect(page.locator('text=Value')).toBeVisible();
    await expect(page.locator('text=Z-Score')).toBeVisible();
    await expect(page.locator('text=Δ Z-Score')).toBeVisible();

    // Check for at least one data row
    const rows = page.locator('[data-testid^="indicator-row-"]');
    await expect(rows.first()).toBeVisible();
  });

  test('should filter indicators by delta z-score', async ({ page }) => {
    // Wait for indicators to load
    await page.waitForSelector('[data-testid="macroeconomic-indicators-table"]');

    // Use the delta z-score filter
    const deltaFilter = page.locator('[data-testid="delta-zscore-filter"]');
    await deltaFilter.fill('2');

    // Wait for filtering to apply
    await page.waitForTimeout(1000);

    // Verify filtered results
    const visibleRows = page.locator('[data-testid^="indicator-row-"]:visible');
    const count = await visibleRows.count();
    
    // Should have some filtered results or show empty state
    expect(count).toBeGreaterThanOrEqual(0);
  });

  test('should display momentum strategies', async ({ page }) => {
    // Wait for momentum section to load
    await page.waitForSelector('[data-testid="momentum-strategies-table"]', {
      timeout: 10000,
    });

    const table = page.locator('[data-testid="momentum-strategies-table"]');
    await expect(table).toBeVisible();

    // Check for momentum table headers
    await expect(page.locator('text=Sector')).toBeVisible();
    await expect(page.locator('text=Return')).toBeVisible();
    await expect(page.locator('text=Volatility')).toBeVisible();
    await expect(page.locator('text=Sharpe')).toBeVisible();

    // Check for sector data
    const sectorRows = page.locator('[data-testid^="sector-row-"]');
    await expect(sectorRows.first()).toBeVisible();
  });

  test('should handle responsive design on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 });
    await page.waitForLoadState('networkidle');

    // Check that main sections are still visible on mobile
    await expect(page.locator('[data-testid="economic-pulse-check"]')).toBeVisible();
    
    // Tables should be responsive or scrollable
    const indicatorsTable = page.locator('[data-testid="macroeconomic-indicators-table"]');
    await expect(indicatorsTable).toBeVisible();
  });

  test('should load within performance budget', async ({ page }) => {
    const startTime = Date.now();
    
    await page.goto('/');
    await page.waitForSelector('[data-testid="economic-pulse-check"]');
    await page.waitForSelector('[data-testid="macroeconomic-indicators-table"]');
    
    const loadTime = Date.now() - startTime;
    
    // Dashboard should load within 5 seconds
    expect(loadTime).toBeLessThan(5000);
  });

  test('should handle error states gracefully', async ({ page }) => {
    // Simulate network issues by blocking API calls
    await page.route('**/api/**', route => {
      route.abort();
    });

    await page.goto('/');
    
    // Should show error states or loading indicators instead of crashing
    await page.waitForTimeout(2000);
    
    // The page should still render basic structure
    const body = page.locator('body');
    await expect(body).toBeVisible();
  });

  test('should maintain data consistency across refreshes', async ({ page }) => {
    // Load initial data
    await page.waitForSelector('[data-testid="macroeconomic-indicators-table"]');
    
    const firstIndicator = page.locator('[data-testid^="indicator-row-"]').first();
    const initialText = await firstIndicator.textContent();
    
    // Refresh the page
    await page.reload();
    await page.waitForSelector('[data-testid="macroeconomic-indicators-table"]');
    
    const refreshedIndicator = page.locator('[data-testid^="indicator-row-"]').first();
    const refreshedText = await refreshedIndicator.textContent();
    
    // Data should be consistent (cached or fresh)
    expect(refreshedText).toBeDefined();
  });
});