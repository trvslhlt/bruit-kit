import { type DryWetWrapper, createDryWet } from "./dryWet";

// Every OscillatorType the LFO can actually be, short of "custom" (which
// needs a PeriodicWave, not a simple type string).
export type TremoloWaveform = "sine" | "square" | "sawtooth" | "triangle";

export interface TremoloEffectParams {
  rate: number;
  depth: number;
  waveform: TremoloWaveform;
  wet: number;
}

/** Tremolo: an inaudible LFO modulates the gain of a dedicated carrier node
 * around a 0.5 base value, rather than multiplying the signal directly the
 * way RingModulationEffect's audio-rate oscillator does. `depth` is stored
 * 0..1 for a friendlier UI range; only half of it ever reaches the depth
 * gain's own gain value, since the carrier's 0.5 base already accounts for
 * the other half of the swing. */
export class TremoloEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into them —
   * see FilterEffect.frequencyParam's doc comment. */
  readonly rateParam: AudioParam;
  readonly depthParam: AudioParam;
  private lfo: OscillatorNode;
  private depthGain: GainNode;
  private carrierGain: GainNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.lfo = audioContext.createOscillator();
    this.lfo.type = "sine";
    this.lfo.frequency.value = 5;
    this.rateParam = this.lfo.frequency;

    this.depthGain = audioContext.createGain();
    this.depthGain.gain.value = 0.5 * 0.5;
    this.depthParam = this.depthGain.gain;

    this.carrierGain = audioContext.createGain();
    this.carrierGain.gain.value = 0.5;

    this.lfo.connect(this.depthGain);
    this.depthGain.connect(this.carrierGain.gain);
    this.lfo.start();

    this.dryWet = createDryWet(
      audioContext,
      this.carrierGain,
      this.carrierGain,
      0,
    );
    this.input = this.dryWet.input;
    this.output = this.dryWet.output;
  }

  setParams(params: Partial<TremoloEffectParams>): void {
    if (params.rate !== undefined) this.lfo.frequency.value = params.rate;
    if (params.depth !== undefined)
      this.depthGain.gain.value = params.depth * 0.5;
    if (params.waveform !== undefined) this.lfo.type = params.waveform;
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
