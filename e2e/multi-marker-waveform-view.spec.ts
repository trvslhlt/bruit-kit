// Covers the marker-specific interactions multiRangeWaveformView.ts's own
// tests don't: dragging a not-yet-selected entry's marker directly (the
// same DOM-reorder-releases-pointer-capture hazard that turned up there
// first -- see this widget's own setSelected/reorderSelectedToTop doc
// comments), and right-click opening a context menu instead of starting a
// drag or the browser's own native menu.

import { expect, test } from "@playwright/test";

const NODE_2_COLOR = "#4c7dff";
const NODE_3_COLOR = "#6fdc8c";

test("dragging a not-yet-selected entry's marker directly still moves it", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/ui-multimarkerwaveformview.html");
  await page.locator(".unlock-button").click();
  await page.waitForTimeout(200);

  // node-1 is selected by default; drag node-2's marker directly.
  const node2Hit = page.locator(
    `g.multi-marker-entry:has(line[stroke="${NODE_2_COLOR}"]) .multi-marker-hit-area`,
  );
  const box = await node2Hit.boundingBox();
  if (!box) throw new Error("node-2 hit area not found");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 80, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(100);

  await expect(page.locator("#selected-text")).toContainText("node-2");
  // Started at 45% -- confirms the drag actually moved it, not just
  // selected it.
  await expect(page.locator("#selected-text")).not.toContainText("45.0%");
  expect(errors, errors.join("\n")).toEqual([]);
});

test("right-click opens a context menu instead of dragging or the native menu", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/ui-multimarkerwaveformview.html");
  await page.locator(".unlock-button").click();
  await page.waitForTimeout(200);

  const node3Hit = page.locator(
    `g.multi-marker-entry:has(line[stroke="${NODE_3_COLOR}"]) .multi-marker-hit-area`,
  );
  const box = await node3Hit.boundingBox();
  if (!box) throw new Error("node-3 hit area not found");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down({ button: "right" });
  await page.mouse.up({ button: "right" });
  await page.waitForTimeout(100);

  await expect(page.locator("#contextmenu-text")).toContainText("node-3");
  await expect(page.locator("#selected-text")).toContainText("node-3");
  // Position unchanged -- a right-click must not also drag.
  await expect(page.locator("#selected-text")).toContainText("75.0%");
  expect(errors, errors.join("\n")).toEqual([]);
});
