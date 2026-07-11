import { Midi } from "@tonejs/midi";
import type { ArpPattern } from "../src/midi/arpPatterns";
import type { ChordShapeName } from "../src/midi/chordShapes";
import { MidiPlaybackController } from "../src/midi/midiPlayer";
import { OscillatorSynth } from "../src/sources/oscillatorSynth";
import { connectToOutput, unlockAudioContext } from "./shared/audioContext";
import { renderParamPanel, renderSelect } from "./shared/paramPanel";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const playButtonEl = document.querySelector<HTMLButtonElement>("#play-button")!;
const stopButtonEl = document.querySelector<HTMLButtonElement>("#stop-button")!;
const loopToggleEl = document.querySelector<HTMLInputElement>("#loop-toggle")!;
const positionEl = document.querySelector<HTMLParagraphElement>("#position")!;
const paramsEl = document.querySelector<HTMLDivElement>("#params")!;
const chordToggleEl =
  document.querySelector<HTMLInputElement>("#chord-toggle")!;
const chordSelectEl = document.querySelector<HTMLDivElement>("#chord-select")!;
const arpToggleEl = document.querySelector<HTMLInputElement>("#arp-toggle")!;
const arpParamsEl = document.querySelector<HTMLDivElement>("#arp-params")!;

const CHORD_SHAPES = [
  "major",
  "minor",
  "sus4",
  "power",
  "major7",
  "minor7",
  "dom7",
] as const satisfies readonly ChordShapeName[];

/** A short two-bar melody, built with @tonejs/midi's track API rather than
 * loading a bundled .mid file. */
function buildDemoMidi(): Midi {
  const midi = new Midi();
  const track = midi.addTrack();
  const melody = [60, 64, 67, 71, 72, 71, 67, 64];
  melody.forEach((note, i) => {
    track.addNote({ midi: note, time: i * 0.3, duration: 0.28, velocity: 0.8 });
  });
  return midi;
}

unlockAudioContext(unlockEl).then((audioContext) => {
  const synth = new OscillatorSynth(audioContext);
  connectToOutput(synth.output, audioContext);

  const midi = buildDemoMidi();
  const player = new MidiPlaybackController(synth);

  playButtonEl.addEventListener("click", () => {
    player.start(midi, 1, loopToggleEl.checked);
  });
  stopButtonEl.addEventListener("click", () => player.stop());
  loopToggleEl.addEventListener("change", () =>
    player.setLoop(loopToggleEl.checked),
  );

  function tick(): void {
    positionEl.textContent = player.isPlaying()
      ? `playing — ${(player.getPositionFraction() * 100).toFixed(0)}%`
      : "stopped";
    requestAnimationFrame(tick);
  }
  tick();

  renderParamPanel(paramsEl, [
    {
      id: "speed",
      label: "Speed",
      min: 0.25,
      max: 3,
      step: 0.05,
      value: 1,
      onChange: (value) => player.setSpeed(value),
    },
  ]);

  chordToggleEl.addEventListener("change", () =>
    player.setChordEnabled(chordToggleEl.checked),
  );
  renderSelect(chordSelectEl, "Shape", CHORD_SHAPES, "major", (shape) =>
    player.setChordShape(shape),
  );

  arpToggleEl.addEventListener("change", () =>
    player.setArpEnabled(arpToggleEl.checked),
  );
  const ARP_PATTERNS = [
    "up",
    "down",
    "up-down",
    "random",
    "as-played",
  ] as const satisfies readonly ArpPattern[];
  renderParamPanel(arpParamsEl, [
    {
      id: "arpRateHz",
      label: "Arp rate (Hz)",
      min: 1,
      max: 20,
      step: 0.5,
      value: 8,
      onChange: (value) => player.setArpParams({ rateHz: value }),
    },
  ]);
  const arpPatternSelectEl = document.createElement("div");
  arpParamsEl.prepend(arpPatternSelectEl);
  renderSelect(
    arpPatternSelectEl,
    "Arp pattern",
    ARP_PATTERNS,
    "up",
    (pattern) => player.setArpParams({ pattern }),
  );
});
