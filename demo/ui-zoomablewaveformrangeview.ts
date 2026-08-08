import { createZoomableWaveformRangeView } from "../src/ui/zoomableWaveformRangeView";
import { unlockAudioContext } from "./shared/audioContext";
import { createTestBuffer } from "./shared/testBuffer";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const fileInputEl = document.querySelector<HTMLInputElement>("#file-input")!;
const waveformEl = document.querySelector<HTMLDivElement>("#waveform")!;
const rangeTextEl =
  document.querySelector<HTMLParagraphElement>("#range-text")!;
const liveToggleEl = document.querySelector<HTMLInputElement>("#live-toggle")!;

unlockAudioContext(unlockEl).then((audioContext) => {
  let buffer = createTestBuffer(audioContext);

  function formatRange(start: number, end: number): string {
    return `start: ${(start * 100).toFixed(2)}%  end: ${(end * 100).toFixed(2)}%`;
  }

  const view = createZoomableWaveformRangeView(waveformEl, {
    initialRange: { start: 0.2, end: 0.8 },
    onChange: (range) => {
      rangeTextEl.textContent = formatRange(range.start, range.end);
    },
  });
  view.setBuffer(buffer);
  rangeTextEl.textContent = formatRange(0.2, 0.8);

  fileInputEl.addEventListener("change", async () => {
    const file = fileInputEl.files?.[0];
    if (!file) return;
    buffer = await audioContext.decodeAudioData(await file.arrayBuffer());
    view.setBuffer(buffer);
  });

  let liveHandle: ReturnType<typeof setInterval> | null = null;
  liveToggleEl.addEventListener("change", () => {
    if (liveToggleEl.checked) {
      const t0 = performance.now();
      liveHandle = setInterval(() => {
        const t = (performance.now() - t0) / 1000;
        view.setLiveMarker(0.5 + 0.4 * Math.sin(t));
      }, 100);
    } else if (liveHandle) {
      clearInterval(liveHandle);
      liveHandle = null;
      view.setLiveMarker(null);
    }
  });
});
