// Regression test for a bug where <link href="../src/ui/*.css"> in an
// HTML file at the demo site's root silently resolved to index.html
// (Vite's dev-server SPA fallback) instead of 404ing -- the toggle cells
// were in the DOM but rendered at 0px height with no visible styling.
// This asserts the actual rendered size, which is what would have caught
// it immediately instead of a bug report.

import { expect, test } from "@playwright/test";

test("step sequencer grid renders visible toggle cells", async ({ page }) => {
  await page.goto("/midi-stepsequencer.html");
  await page.locator(".unlock-button").click();
  await page.waitForTimeout(300);

  const toggles = page.locator(".step-sequencer-toggle");
  await expect(toggles).toHaveCount(8);

  const box = await toggles.first().boundingBox();
  expect(box).not.toBeNull();
  expect(box?.width ?? 0).toBeGreaterThan(10);
  expect(box?.height ?? 0).toBeGreaterThan(10);
});
