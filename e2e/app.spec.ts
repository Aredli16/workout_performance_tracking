import { test, expect } from '@playwright/test';

test('has title and main sections', async ({ page }) => {
    await page.goto('/');

    // Expect a title "to contain" a substring.
    await expect(page).toHaveTitle(/FitTrack/);

    // Check header text
    await expect(page.getByText('FitTrack Pro')).toBeVisible();

    // Check for chart sections (initially empty state text might be present)
    // Since we load default data in the app, we expect charts to eventually load.
    // We'll wait for a text that only appears when data is loaded, e.g., "Poids Actuel"
    await expect(page.getByText('Poids Actuel')).toBeVisible();

    // Check if at least one chart is visible (recharts usually creates svg)
    // We can look for the text "Performances Musculaires"
    await expect(page.getByText('Performances Musculaires')).toBeVisible();
});
