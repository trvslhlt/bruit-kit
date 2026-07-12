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

  // Bookkeeping to answer "where is the playhead right now" without
  // AudioBufferSourceNode exposing it directly. nodeLoopStart/nodeLoopEnd
  // track whatever the *live* node's loop points currently are (which we
  // sometimes update in place, without restarting playback -- see
  // updateRange below), so this stays accurate across those live edits.
  let nodeStartTime = 0;
  let nodeStartOffset = 0;
  let nodeLoopStart = 0;
  let nodeLoopEnd = 0;

  function currentPlayheadSeconds(): number {
    const elapsed = audioContext.currentTime - nodeStartTime;
    const posIfUnlooped = nodeStartOffset + elapsed;
    if (posIfUnlooped <= nodeLoopEnd) return posIfUnlooped;
    const loopLength = Math.max(nodeLoopEnd - nodeLoopStart, 0.001);
    const overflow = (posIfUnlooped - nodeLoopEnd) % loopLength;
    return nodeLoopStart + overflow;
  }

  function restartPlayback(): void {
    activeSource?.stop();
    const range = view.getRange();
    const startSec = range.start * buffer.duration;
    const endSec = range.end * buffer.duration;
    const source = audioContext.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.loopStart = startSec;
    source.loopEnd = endSec;
    connectToOutput(source, audioContext);
    source.start(0, startSec);
    activeSource = source;
    nodeStartTime = audioContext.currentTime;
    nodeStartOffset = startSec;
    nodeLoopStart = startSec;
    nodeLoopEnd = endSec;
  }

  // Called on every drag update while something's playing. If the
  // playhead is still within the new range, just move the same node's
  // loop points -- AudioBufferSourceNode reads them live, so this doesn't
  // interrupt the sound, it just changes where it'll next wrap. Only
  // falls back to a hard restart when the playhead has drifted outside
  // the new bounds entirely (nothing to continue from).
  function updateRange(range: { start: number; end: number }): void {
    if (!activeSource) return;
    const startSec = range.start * buffer.duration;
    const endSec = range.end * buffer.duration;
    const playhead = currentPlayheadSeconds();
    if (playhead >= startSec && playhead <= endSec) {
      activeSource.loopStart = startSec;
      activeSource.loopEnd = endSec;
      nodeLoopStart = startSec;
      nodeLoopEnd = endSec;
    } else {
      restartPlayback();
    }
  }

  const view = createWaveformRangeView(waveformEl, {
    initialRange: { start: 0.2, end: 0.8 },
    onChange: (range) => {
      rangeTextEl.textContent = formatRange(range.start, range.end);
      updateRange(range);
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

  playButtonEl.addEventListener("click", restartPlayback);

  stopButtonEl.addEventListener("click", () => {
    activeSource?.stop();
    activeSource = null;
  });
});
