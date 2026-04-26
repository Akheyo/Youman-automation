import { expect, test } from '@playwright/test';

/**
 * Smoke test — happy path through the configurator.
 *
 * Strategy: we cannot rely on real Mapbox/Overpass/NRW/PVGIS calls in CI,
 * so we mock the API routes via `page.route(...)` and verify that the UI
 * orchestrates the calls and renders the result correctly.
 */

const FAKE_ADDRESS = {
  id: 'fake_1',
  placeName: 'Mölndalstraße 8, 46325 Borken, Deutschland',
  center: [6.86, 51.84] as [number, number],
  source: 'mapbox' as const,
};

const FAKE_BUILDING = {
  id: 12345,
  coordinates: [
    [6.85998, 51.83998],
    [6.86002, 51.83998],
    [6.86002, 51.84002],
    [6.85998, 51.84002],
    [6.85998, 51.83998],
  ],
};

const FAKE_SEGMENT = {
  id: 'seg-1',
  polygon: {
    type: 'Feature' as const,
    properties: {},
    geometry: {
      type: 'Polygon' as const,
      coordinates: [
        [
          [6.85998, 51.83998],
          [6.86002, 51.83998],
          [6.86002, 51.84002],
          [6.85998, 51.84002],
          [6.85998, 51.83998],
        ],
      ],
    },
  },
  azimuthDeg: 180,
  pitchDeg: 30,
  suitability: 'sehr gut',
  yieldKwh: 5800,
  moduleCount: 18,
  areaM2: 32,
};

test.describe('PV-Konfigurator smoke', () => {
  test.beforeEach(async ({ page }) => {
    await page.route('**/api/geocode**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ results: [FAKE_ADDRESS], provider: 'mapbox' }),
      }),
    );
    await page.route('**/api/buildings**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ buildings: [FAKE_BUILDING], selected: FAKE_BUILDING }),
      }),
    );
    await page.route('**/api/nrw-wfs**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ segments: [FAKE_SEGMENT] }),
      }),
    );
    await page.route('**/api/pvgis**', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ yearlyKwh: 5700, monthlyKwh: [] }),
      }),
    );
  });

  test('landing → address → 3D viewer appears', async ({ page }) => {
    await page.goto('/');
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/in 5 sekunden/i);

    const input = page.getByRole('combobox');
    await input.fill('Mölndalstraße');
    await expect(page.getByRole('option')).toBeVisible({ timeout: 5000 });
    await page.getByRole('option').first().click();

    // Stepper should advance to "Dach".
    await expect(page.getByRole('button', { name: /^2/ })).toBeVisible();
    // Cesium viewer container should be in the DOM (canvas may take a moment).
    await expect(page.locator('.cesium-viewer')).toBeVisible({ timeout: 10000 });
  });

  test('roof bar shows segment count and Maximum-Belegung enables next step', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox').fill('Mölndalstraße');
    await expect(page.getByRole('option')).toBeVisible();
    await page.getByRole('option').first().click();
    await expect(page.getByText(/Dachsegmente erkannt/)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Maximum-Belegung/ }).click();
    await expect(page.getByRole('button', { name: /Weiter zur Konfiguration/ })).toBeEnabled();
  });

  test('sidebar updates when consumption presets toggle', async ({ page }) => {
    await page.goto('/');
    await page.getByRole('combobox').fill('Mölndalstraße');
    await expect(page.getByRole('option')).toBeVisible();
    await page.getByRole('option').first().click();
    await expect(page.getByText(/Dachsegmente erkannt/)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: /Maximum-Belegung/ }).click();
    // Sidebar shows kwp + module count once layout exists.
    await expect(page.getByText(/Anlagengröße/)).toBeVisible();
    // Pick the 5+ persons preset and check the consumption number changes.
    await page.getByRole('button', { name: /5\+/ }).click();
    await expect(page.getByLabel(/Verbrauch/i)).toHaveValue('6500');
  });
});
