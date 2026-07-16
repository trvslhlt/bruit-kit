import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface AutoWahEffectParams {
  baseFrequency: number;
  q: number;
  sensitivity: number;
  attackHz: number;
  wet: number;
}

const MAX_SWEEP_HZ = 3000;

/** Full-wave rectification via a WaveShaperNode curve -- same technique as
 * DistortionEffect's curve, just x -> abs(x) instead of a soft-clip shape.
 * Turns the bipolar input into an all-positive envelope signal. */
function makeRectifierCurve(): Float32Array<ArrayBuffer> {
  const n = 1024;
  const curve = new Float32Array(new ArrayBuffer(n * 4));
  for (let i = 0; i < n; i++) {
    const x = (i * 2) / n - 1;
    curve[i] = Math.abs(x);
  }
  return curve;
}

/** A bandpass filter whose center frequency is pushed around by the
 * input's own loudness rather than an LFO: input -> rectifier -> lowpass
 * (smooths the rectified signal into a slow-moving envelope) -> sensitivity
 * gain -> filter.frequency (additive, same trick as every LFO-driven
 * effect here). No AudioWorklet involved -- a lowpass filter doubling as
 * an envelope follower is a coarser attack/release curve than a real
 * per-sample follower, but stays synchronous like every other effect in
 * this file. */
export class AutoWahEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into it —
   * see FilterEffect.frequencyParam's doc comment. */
  readonly qParam: AudioParam;
  private filterNode: BiquadFilterNode;
  private rectifier: WaveShaperNode;
  private envelopeSmoother: BiquadFilterNode;
  private sensitivityGain: GainNode;
  private wetInput: GainNode;
  private dryWet: DryWetWrapper;

  constructor(audioContext: AudioContext) {
    this.filterNode = audioContext.createBiquadFilter();
    this.filterNode.type = "bandpass";
    this.filterNode.frequency.value = 500;
    this.filterNode.Q.value = 6;
    this.qParam = this.filterNode.Q;

    this.rectifier = audioContext.createWaveShaper();
    this.rectifier.curve = makeRectifierCurve();

    this.envelopeSmoother = audioContext.createBiquadFilter();
    this.envelopeSmoother.type = "lowpass";
    this.envelopeSmoother.frequency.value = 15;
    this.envelopeSmoother.Q.value = 0.5;

    this.sensitivityGain = audioContext.createGain();
    this.sensitivityGain.gain.value = MAX_SWEEP_HZ * 0.5;

    this.rectifier.connect(this.envelopeSmoother);
    this.envelopeSmoother.connect(this.sensitivityGain);
    this.sensitivityGain.connect(this.filterNode.frequency);

    this.wetInput = audioContext.createGain();
    this.wetInput.connect(this.filterNode);
    this.wetInput.connect(this.rectifier);

    this.dryWet = createDryWet(audioContext, this.wetInput, this.filterNode, 0);
    this.input = this.dryWet.input;
    this.output = this.dryWet.output;
  }

  setParams(params: Partial<AutoWahEffectParams>): void {
    if (params.baseFrequency !== undefined)
      this.filterNode.frequency.value = params.baseFrequency;
    if (params.q !== undefined) this.filterNode.Q.value = params.q;
    if (params.sensitivity !== undefined) {
      const clamped = Math.min(Math.max(params.sensitivity, 0), 1);
      this.sensitivityGain.gain.value = clamped * MAX_SWEEP_HZ;
    }
    if (params.attackHz !== undefined) {
      this.envelopeSmoother.frequency.value = Math.min(
        Math.max(params.attackHz, 1),
        50,
      );
    }
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
