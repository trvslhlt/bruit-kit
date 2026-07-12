// Formalizes two ad-hoc verification scripts: a small drag that keeps the
// playhead inside the new range should continue the same node (no new
// start() call, no audible interruption); a large drag that pushes the
// range past the current playhead should restart it.

import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __startCount: number;
  }
}

test("small range drag doesn't restart playback; large drag does", async ({
  page,
}) => {
  await page.goto("/ui-waveformrangeview.html");
  await page.locator(".unlock-button").click();
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    window.__startCount = 0;
    const orig = AudioBufferSourceNode.prototype.start;
    AudioBufferSourceNode.prototype.start = function (
      ...args: Parameters<typeof orig>
    ) {
      window.__startCount++;
      return orig.apply(this, args);
    };
  });

  await page.locator("#play-button").click();
  await page.waitForTimeout(200);
  const afterPlay = await page.evaluate(() => window.__startCount);
  expect(afterPlay).toBe(1);

  const startHandle = page.locator(".waveform-range-handle").first();

  let box = await startHandle.boundingBox();
  if (!box) throw new Error("start handle not found");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 15, box.y + box.height / 2, { steps: 3 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const afterSmallDrag = await page.evaluate(() => window.__startCount);
  expect(afterSmallDrag).toBe(afterPlay);

  box = await startHandle.boundingBox();
  if (!box) throw new Error("start handle not found");
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(box.x + 300, box.y + box.height / 2, { steps: 5 });
  await page.mouse.up();
  await page.waitForTimeout(200);
  const afterBigDrag = await page.evaluate(() => window.__startCount);
  expect(afterBigDrag).toBeGreaterThan(afterSmallDrag);
});
