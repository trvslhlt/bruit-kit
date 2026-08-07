// Exercises the one piece of bruit-kit that can play audio backward.
// Console-error-free is the main signal here (see demos.spec.ts for the
// generic version of that) -- audio correctness itself isn't assertable
// through Playwright, but a worklet exception, a bad message shape, or an
// unbounded voice pool would all surface as a console error or a hang.

import { expect, test } from "@playwright/test";

test("forward, backward, burst, and overlapping playback all run without errors or hanging", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") errors.push(msg.text());
  });
  page.on("pageerror", (err) => errors.push(err.message));

  await page.goto("/sources-directionalsampleplayer.html");
  await page.locator(".unlock-button").click();
  await page.waitForTimeout(300);

  await page.locator("#play-forward").click();
  await page.waitForTimeout(150);
  await page.locator("#play-backward").click();
  await page.waitForTimeout(150);
  await page.locator("#play-burst").click();
  await page.waitForTimeout(150);
  await page.locator("#play-overlap").click();
  await page.waitForTimeout(150);

  // Fire everything again, fast, to catch anything that only shows up once
  // voices pile up (the burst button alone leaves 6 scheduled voices
  // in flight when clicked twice in a row before they've finished).
  await page.locator("#play-forward").click();
  await page.locator("#play-backward").click();
  await page.locator("#play-burst").click();
  await page.locator("#play-overlap").click();

  // Long enough for the burst's 6 * 0.25s schedule plus every voice's own
  // declick fade to finish.
  await page.waitForTimeout(2000);

  // The page (and worklet message port) should still be responsive after
  // all that -- a hung/crashed worklet would make this next click's
  // effects never resolve, though playwright itself would only actually
  // observe that as the subsequent console-error assertion timing out.
  await page.locator("#play-forward").click();
  await page.waitForTimeout(200);

  expect(errors, errors.join("\n")).toEqual([]);
});
