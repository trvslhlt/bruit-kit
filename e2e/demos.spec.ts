// The generalized version of "load every demo page, click unlock, check
// for console errors" -- discovers demo/*.html the same way
// demo/vite.config.ts's htmlEntries() does, so adding a new demo page
// never means updating a test file too.

import { readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const demoDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../demo",
);
const htmlFiles = readdirSync(demoDir).filter((f) => f.endsWith(".html"));

for (const file of htmlFiles) {
  test(`${file} loads with no console errors`, async ({ page }) => {
    const errors: string[] = [];
    page.on("console", (msg) => {
      if (msg.type() === "error") errors.push(msg.text());
    });
    page.on("pageerror", (err) => errors.push(err.message));

    await page.goto(`/${file}`);
    const unlockButton = page.locator(".unlock-button");
    if ((await unlockButton.count()) > 0) {
      await unlockButton.click();
    }
    // Lets any async setup (worklet loading, buffer decoding, etc.)
    // settle before checking for errors.
    await page.waitForTimeout(500);

    expect(errors, errors.join("\n")).toEqual([]);
  });
}
