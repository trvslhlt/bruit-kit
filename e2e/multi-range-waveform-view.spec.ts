// Covers the two things unique to this widget over waveformRangeView.ts's
// single-range version: dragging one entry's handle doesn't disturb another
// entry's range (independent state per id), and selecting an entry restyles
// it without erroring (the selection path re-parents an SVG group rather
// than rebuilding the DOM -- see multiRangeWaveformView.ts's own doc
// comment for why that distinction matters).
//
// Handles are located by their `stroke` color (each entry's own color, set
// in demo/ui-multirangewaveformview.ts's COLORS list) rather than by
// position -- selecting an entry re-parents its group to the end of the
// SVG, so a plain nth() index into ".multi-range-handle" silently points at
// a different entry before vs. after a selection change.

import { expect, test } from "@playwright/test";

const NODE_1_COLOR = "#ffb454";
const NODE_3_COLOR = "#6fdc8c";

test("dragging one entry's handle doesn't affect another entry's range", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/ui-multirangewaveformview.html");
  await page.locator(".unlock-button").click();
  await page.waitForTimeout(200);

  // node-1 (5-30%) is the default-selected entry; capture its start
  // handle's position before touching anything else.
  const node1Start = page
    .locator(`.multi-range-handle[stroke="${NODE_1_COLOR}"]`)
    .first();
  const node1StartBefore = await node1Start.boundingBox();
  if (!node1StartBefore) throw new Error("node-1 start handle not found");

  // Select node-3 (20-90%) by clicking its fill at 80%, a point covered by
  // no other entry (node-1 ends at 30%, node-2 ends at 65%) -- selecting it
  // re-parents its group last, guaranteeing its own handles are on top for
  // the drag below regardless of the demo's insertion order.
  const waveformBox = await page
    .locator(".multi-range-waveform-svg")
    .boundingBox();
  if (!waveformBox) throw new Error("waveform not found");
  await page.mouse.click(
    waveformBox.x + waveformBox.width * 0.8,
    waveformBox.y + waveformBox.height / 2,
  );
  await page.waitForTimeout(100);
  await expect(page.locator("#selected-text")).toContainText("node-3");

  const node3End = page
    .locator(`.multi-range-handle[stroke="${NODE_3_COLOR}"]`)
    .nth(1);
  const box = await node3End.boundingBox();
  if (!box) throw new Error("node-3 end handle not found");

  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x - 60, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(100);

  // node-3's own range moved (no longer ending at its original 90%)...
  await expect(page.locator("#selected-text")).not.toContainText("end 90.0%");
  // ...but node-1's handle, never touched, is exactly where it started.
  const node1StartAfter = await node1Start.boundingBox();
  // A few px of slack for sub-pixel layout jitter -- what actually matters
  // is that node-1 didn't shift by anything close to the drag's own ~60px.
  expect(
    Math.abs((node1StartAfter?.x ?? Number.NaN) - node1StartBefore.x),
  ).toBeLessThan(3);

  expect(errors, errors.join("\n")).toEqual([]);
});
