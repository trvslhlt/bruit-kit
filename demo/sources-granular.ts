import { GranularSynth } from "../src/sources/granularSynth";
import { unlockAudioContext } from "./shared/audioContext";
import { renderParamPanel, renderSelect } from "./shared/paramPanel";
import { wireSourceDemo } from "./shared/sourceHarness";
import { createTestBuffer } from "./shared/testBuffer";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const fileInputEl = document.querySelector<HTMLInputElement>("#file-input")!;
const directPlayButtonEl = document.querySelector<HTMLButtonElement>(
  "#direct-play-button",
)!;
const statusEl = document.querySelector<HTMLParagraphElement>("#status")!;
const keyboardEl = document.querySelector<HTMLDivElement>("#keyboard")!;
const playheadSelectEl =
  document.querySelector<HTMLDivElement>("#select-playhead")!;
const durationModeSelectEl = document.querySelector<HTMLDivElement>(
  "#select-duration-mode",
)!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;

const PLAYHEAD_MODES = ["shared", "per-note"] as const;
const GRAIN_DURATION_MODES = ["random", "envelope"] as const;

unlockAudioContext(unlockEl).then(async (audioContext) => {
  const synth = new GranularSynth(audioContext);
  await synth.init();
  await synth.loadSample(createTestBuffer(audioContext));
  wireSourceDemo(audioContext, keyboardEl, synth);

  synth.onStatus((status) => {
    statusEl.textContent = `voices: ${status.activeVoices}  grains: ${status.activeGrains}  playhead: ${(status.playheadFraction * 100).toFixed(0)}%`;
  });

  fileInputEl.addEventListener("change", async () => {
    const file = fileInputEl.files?.[0];
    if (!file) return;
    const arrayBuffer = await file.arrayBuffer();
    const buffer = await audioContext.decodeAudioData(arrayBuffer);
    await synth.loadSample(buffer);
  });

  directPlayButtonEl.addEventListener("mousedown", async () => {
    await synth.resume();
    synth.directPlayOn();
  });
  directPlayButtonEl.addEventListener("mouseup", () => synth.directPlayOff());
  directPlayButtonEl.addEventListener("mouseleave", () =>
    synth.directPlayOff(),
  );

  renderSelect(
    playheadSelectEl,
    "Playhead mode",
    PLAYHEAD_MODES,
    "shared",
    (playheadMode) => synth.setParams({ playheadMode }),
  );

  renderSelect(
    durationModeSelectEl,
    "Grain duration mode",
    GRAIN_DURATION_MODES,
    "random",
    (grainDurationMode) => synth.setParams({ grainDurationMode }),
  );

  renderParamPanel(paramsEl, [
    {
      id: "grainDurationMinMs",
      label: "Grain min (ms)",
      min: 5,
      max: 300,
      step: 1,
      value: 40,
      onChange: (value) => synth.setParams({ grainDurationMinMs: value }),
    },
    {
      id: "grainDurationMaxMs",
      label: "Grain max (ms)",
      min: 5,
      max: 500,
      step: 1,
      value: 80,
      onChange: (value) => synth.setParams({ grainDurationMaxMs: value }),
    },
    {
      id: "densityHz",
      label: "Density (Hz)",
      min: 1,
      max: 100,
      step: 1,
      value: 20,
      onChange: (value) => synth.setParams({ densityHz: value }),
    },
    {
      id: "positionJitterMs",
      label: "Position jitter (ms)",
      min: 0,
      max: 500,
      step: 1,
      value: 30,
      onChange: (value) => synth.setParams({ positionJitterMs: value }),
    },
    {
      id: "pitchJitterCents",
      label: "Pitch jitter (cents)",
      min: 0,
      max: 200,
      step: 1,
      value: 10,
      onChange: (value) => synth.setParams({ pitchJitterCents: value }),
    },
    {
      id: "panSpread",
      label: "Pan spread",
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.5,
      onChange: (value) => synth.setParams({ panSpread: value }),
    },
    {
      id: "scanSpeed",
      label: "Scan speed",
      min: -4,
      max: 4,
      step: 0.01,
      value: 1,
      onChange: (value) => synth.setParams({ scanSpeed: value }),
    },
    {
      id: "attackMs",
      label: "Attack (ms)",
      min: 0,
      max: 2000,
      step: 1,
      value: 20,
      onChange: (value) => synth.setParams({ attackMs: value }),
    },
    {
      id: "decayMs",
      label: "Decay (ms)",
      min: 0,
      max: 2000,
      step: 1,
      value: 150,
      onChange: (value) => synth.setParams({ decayMs: value }),
    },
    {
      id: "sustainLevel",
      label: "Sustain",
      min: 0,
      max: 1,
      step: 0.01,
      value: 0.7,
      onChange: (value) => synth.setParams({ sustainLevel: value }),
    },
    {
      id: "releaseMs",
      label: "Release (ms)",
      min: 0,
      max: 3000,
      step: 1,
      value: 300,
      onChange: (value) => synth.setParams({ releaseMs: value }),
    },
    {
      id: "directPitchSemitones",
      label: "Direct pitch (semi)",
      min: -24,
      max: 24,
      step: 1,
      value: 0,
      onChange: (value) => synth.setParams({ directPitchSemitones: value }),
    },
  ]);
});
