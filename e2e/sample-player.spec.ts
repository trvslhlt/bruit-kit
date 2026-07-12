// Regression test for a bug where SamplePlayer.noteOff checked the
// *current* live oneShot param instead of the value captured when the
// voice started. Toggling "One-shot" on while a sustained note was still
// held made noteOff bail out before ever looking up (and stopping) that
// voice -- a permanently stuck, looping note.

import { expect, test } from "@playwright/test";

declare global {
  interface Window {
    __stopCount: number;
  }
}

test("toggling one-shot while a note is held doesn't leave it stuck", async ({
  page,
}) => {
  await page.goto("/sources-sampleplayer.html");
  await page.locator(".unlock-button").click();
  await page.waitForTimeout(300);

  await page.evaluate(() => {
    window.__stopCount = 0;
    const orig = AudioBufferSourceNode.prototype.stop;
    AudioBufferSourceNode.prototype.stop = function (
      ...args: Parameters<typeof orig>
    ) {
      window.__stopCount++;
      return orig.apply(this, args);
    };
  });

  // Defaults are loop: true, oneShot: false -- pressing a key here starts
  // a sustained (non-oneShot) looping voice, same as the original repro.
  const key = page.locator(".keyboard-key").first();
  await key.hover();
  await page.mouse.down();
  await page.waitForTimeout(100);

  // The exact sequence that used to orphan the voice.
  await page.locator("#oneshot-toggle").check();
  await page.mouse.up();
  await page.waitForTimeout(400); // let the release envelope finish

  const stopCount = await page.evaluate(() => window.__stopCount);
  expect(stopCount).toBeGreaterThan(0);
});
