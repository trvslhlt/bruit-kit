import { LimiterEffect } from "../src/audio/limiterEffect";
import { unlockAudioContext } from "./shared/audioContext";

const unlockEl = document.querySelector<HTMLDivElement>("#unlock")!;
const toggleEl = document.querySelector<HTMLInputElement>("#limiter-toggle")!;
const buttonEl = document.querySelector<HTMLButtonElement>("#chord-button")!;

// Detune offsets (in cents) for a stack of sawtooth voices hot enough to
// sum well past 0dB — the whole point of this demo is to make clipping
// easy to hear when the limiter is switched off.
const DETUNE_CENTS = [-140, -40, 60, 180];

unlockAudioContext(unlockEl).then((audioContext) => {
  const hotGain = audioContext.createGain();
  hotGain.gain.value = 0.6;

  const limiter = new LimiterEffect(audioContext);
  limiter.output.connect(audioContext.destination);

  function applyRouting(limiterOn: boolean): void {
    hotGain.disconnect();
    hotGain.connect(limiterOn ? limiter.input : audioContext.destination);
  }
  applyRouting(toggleEl.checked);
  toggleEl.addEventListener("change", () => applyRouting(toggleEl.checked));

  let oscillators: OscillatorNode[] = [];

  function start(): void {
    oscillators = DETUNE_CENTS.map((detune) => {
      const osc = audioContext.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = 220;
      osc.detune.value = detune;
      osc.connect(hotGain);
      osc.start();
      return osc;
    });
  }

  function stop(): void {
    for (const osc of oscillators) osc.stop();
    oscillators = [];
  }

  buttonEl.addEventListener("mousedown", start);
  buttonEl.addEventListener("mouseup", stop);
  buttonEl.addEventListener("mouseleave", stop);
});
