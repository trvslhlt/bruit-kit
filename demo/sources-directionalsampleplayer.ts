import {
  DirectionalSamplePlayer,
  type PlaybackDirection,
} from "../src/sources/directionalSamplePlayer";
import { createWaveformRangeView } from "../src/ui/waveformRangeView";
import { connectToOutput, unlockAudioContext } from "./shared/audioContext";
import { renderParamPanel } from "./shared/paramPanel";
import { createTestBuffer } from "./shared/testBuffer";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const fileInputEl = document.querySelector<HTMLInputElement>("#file-input")!;
const waveformEl = document.querySelector<HTMLDivElement>("#waveform")!;
const forwardButtonEl =
  document.querySelector<HTMLButtonElement>("#play-forward")!;
const backwardButtonEl =
  document.querySelector<HTMLButtonElement>("#play-backward")!;
const burstButtonEl = document.querySelector<HTMLButtonElement>("#play-burst")!;
const overlapButtonEl =
  document.querySelector<HTMLButtonElement>("#play-overlap")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

let rateSemitones = 0;
let fadeMs = 4;

unlockAudioContext(unlockEl).then(async (audioContext) => {
  const player = new DirectionalSamplePlayer(audioContext);
  await player.init();
  await player.resume();
  connectToOutput(player.output, audioContext);

  let buffer = createTestBuffer(audioContext);
  await player.loadSample(buffer);

  const rangeView = createWaveformRangeView(waveformEl, {
    initialRange: { start: 0.1, end: 0.9 },
  });
  rangeView.setBuffer(buffer);

  fileInputEl.addEventListener("change", async () => {
    const file = fileInputEl.files?.[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    buffer = await audioContext.decodeAudioData(arrayBuffer);
    await player.loadSample(buffer);
    rangeView.setBuffer(buffer);
  });

  function currentRange(): { startFraction: number; endFraction: number } {
    const range = rangeView.getRange();
    return { startFraction: range.start, endFraction: range.end };
  }

  function playOnce(direction: PlaybackDirection): void {
    const { startFraction, endFraction } = currentRange();
    player.playVoice({
      startFraction,
      endFraction,
      direction,
      fadeMs,
      rateSemitones,
    });
  }

  forwardButtonEl.addEventListener("click", () => playOnce("forward"));
  backwardButtonEl.addEventListener("click", () => playOnce("backward"));

  // Alternating burst: 6 fires, alternating direction, each starting where
  // the last one's declick fade has already finished -- the same shape
  // relpmas's curve-spaced firing pattern will schedule, just with a fixed
  // gap here instead of a breakpoint curve.
  burstButtonEl.addEventListener("click", () => {
    const { startFraction, endFraction } = currentRange();
    const fireCount = 6;
    const gapSeconds = 0.25;
    for (let i = 0; i < fireCount; i++) {
      player.playVoice({
        startFraction,
        endFraction,
        direction: i % 2 === 0 ? "forward" : "backward",
        fadeMs,
        rateSemitones,
        time: audioContext.currentTime + i * gapSeconds,
      });
    }
  });

  // Overlap check: fire forward and backward at the same instant so any
  // click/dropout from two voices reading the same buffer concurrently
  // would be obvious.
  overlapButtonEl.addEventListener("click", () => {
    const { startFraction, endFraction } = currentRange();
    player.playVoice({
      startFraction,
      endFraction,
      direction: "forward",
      fadeMs,
      rateSemitones,
    });
    player.playVoice({
      startFraction,
      endFraction,
      direction: "backward",
      fadeMs,
      rateSemitones,
    });
  });

  renderParamPanel(paramsEl, [
    {
      id: "rateSemitones",
      label: "Rate (semitones)",
      min: -24,
      max: 24,
      step: 1,
      value: 0,
      onChange: (value) => {
        rateSemitones = value;
      },
    },
    {
      id: "fadeMs",
      label: "Declick fade (ms)",
      min: 0,
      max: 50,
      step: 1,
      value: 4,
      onChange: (value) => {
        fadeMs = value;
      },
    },
  ]);
});
