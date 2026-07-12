import { createWaveformRangeView } from "../src/ui/waveformRangeView";
import { connectToOutput, unlockAudioContext } from "./shared/audioContext";
import { createTestBuffer } from "./shared/testBuffer";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const fileInputEl = document.querySelector<HTMLInputElement>("#file-input")!;
const waveformEl = document.querySelector<HTMLDivElement>("#waveform")!;
const rangeTextEl =
  document.querySelector<HTMLParagraphElement>("#range-text")!;
const playButtonEl = document.querySelector<HTMLButtonElement>("#play-button")!;
const stopButtonEl = document.querySelector<HTMLButtonElement>("#stop-button")!;

function formatRange(start: number, end: number): string {
  return `start: ${(start * 100).toFixed(1)}%  end: ${(end * 100).toFixed(1)}%`;
}

unlockAudioContext(unlockEl).then((audioContext) => {
  let buffer = createTestBuffer(audioContext);
  let activeSource: AudioBufferSourceNode | null = null;

  function play(): void {
    activeSource?.stop();
    const range = view.getRange();
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = range.start * buffer.duration;
    source.loopEnd = range.end * buffer.duration;
    connectToOutput(source, audioContext);
    source.start(0, source.loopStart);
    activeSource = source;
  }

  const view = createWaveformRangeView(waveformEl, {
    initialRange: { start: 0.2, end: 0.8 },
    onChange: (range) => {
      rangeTextEl.textContent = formatRange(range.start, range.end);
      // Only retrigger if something's already playing -- dragging the
      // handles shouldn't start playback on its own, just live-update it.
      if (activeSource) play();
    },
  });
  view.setBuffer(buffer);
  rangeTextEl.textContent = formatRange(0.2, 0.8);

  fileInputEl.addEventListener("change", async () => {
    const file = fileInputEl.files?.[0];
    if (!file) return;
    buffer = await audioContext.decodeAudioData(await file.arrayBuffer());
    view.setBuffer(buffer);
    view.setRange(view.getRange());
  });

  playButtonEl.addEventListener("click", play);

  stopButtonEl.addEventListener("click", () => {
    activeSource?.stop();
    activeSource = null;
  });
});
