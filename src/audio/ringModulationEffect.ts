import { type DryWetWrapper, createDryWet } from "./dryWet";

// Every OscillatorType the carrier can actually be, short of "custom"
// (which needs a PeriodicWave, not a simple type string).
export type RingModulationWaveform =
  | "sine"
  | "square"
  | "sawtooth"
  | "triangle";

export interface RingModulationEffectParams {
  frequency: number;
  waveform: RingModulationWaveform;
  wet: number;
}

/** Ring modulation: an audio-rate oscillator multiplies the signal directly
 * (gain node's *base* value is 0, so the modulator's raw -1..1 output is
 * the entire multiplier), rather than adding to it the way TremoloEffect's
 * LFO does. Running the modulator at audio-rate rather than a slow LFO
 * rate is what gives ring mod its metallic, bell-like character instead of
 * a simple volume pulse. */
export class RingModulationEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into it —
   * see FilterEffect.frequencyParam's doc comment. */
  readonly frequencyParam: AudioParam;
  private oscillator: OscillatorNode;
  private carrierGain: GainNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.oscillator = audioContext.createOscillator();
    this.oscillator.type = "sine";
    this.oscillator.frequency.value = 30;
    this.frequencyParam = this.oscillator.frequency;

    this.carrierGain = audioContext.createGain();
    this.carrierGain.gain.value = 0;
    this.oscillator.connect(this.carrierGain.gain);
    this.oscillator.start();

    this.dryWet = createDryWet(
      audioContext,
      this.carrierGain,
      this.carrierGain,
      0,
    );
    this.input = this.dryWet.input;
    this.output = this.dryWet.output;
  }

  setParams(params: Partial<RingModulationEffectParams>): void {
    if (params.frequency !== undefined)
      this.oscillator.frequency.value = params.frequency;
    if (params.waveform !== undefined) this.oscillator.type = params.waveform;
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
