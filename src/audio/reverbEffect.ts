import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface ReverbEffectParams {
  decaySeconds: number;
  preDelayMs: number;
  dampingHz: number;
  wet: number;
}

/** Synthesizes a decaying-white-noise impulse response rather than loading
 * an external IR file — keeps the effect self-contained, no assets needed. */
function generateImpulseResponse(
  audioContext: AudioContext,
  decaySeconds: number,
): AudioBuffer {
  const length = Math.max(
    1,
    Math.round(audioContext.sampleRate * decaySeconds),
  );
  const impulse = audioContext.createBuffer(2, length, audioContext.sampleRate);
  for (let channel = 0; channel < impulse.numberOfChannels; channel++) {
    const data = impulse.getChannelData(channel);
    for (let i = 0; i < length; i++) {
      data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 2;
    }
  }
  return impulse;
}

export class ReverbEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  /** Exposed so an LFO engine can connect an oscillator directly into it —
   * see FilterEffect's frequencyParam for why this coexists safely with
   * setParams. decaySeconds isn't exposed: it regenerates the whole
   * impulse-response buffer per change, too expensive to drive from an LFO. */
  readonly preDelayParam: AudioParam;
  readonly dampingParam: AudioParam;
  private preDelay: DelayNode;
  private convolver: ConvolverNode;
  private damping: BiquadFilterNode;
  private dryWet: DryWetWrapper;
  private decaySeconds = 2;

  constructor(private audioContext: AudioContext) {
    this.preDelay = audioContext.createDelay(1);
    this.preDelay.delayTime.value = 0.02;

    this.convolver = audioContext.createConvolver();
    this.convolver.buffer = generateImpulseResponse(
      audioContext,
      this.decaySeconds,
    );

    this.damping = audioContext.createBiquadFilter();
    this.damping.type = "lowpass";
    this.damping.frequency.value = 6000;
    this.preDelayParam = this.preDelay.delayTime;
    this.dampingParam = this.damping.frequency;

    this.preDelay.connect(this.convolver);
    this.convolver.connect(this.damping);

    this.dryWet = createDryWet(audioContext, this.preDelay, this.damping, 0);
    this.input = this.dryWet.input;
    this.output = this.dryWet.output;
  }

  setParams(params: Partial<ReverbEffectParams>): void {
    if (params.preDelayMs !== undefined) {
      this.preDelay.delayTime.value = params.preDelayMs / 1000;
    }
    if (params.dampingHz !== undefined) {
      this.damping.frequency.value = params.dampingHz;
    }
    if (
      params.decaySeconds !== undefined &&
      params.decaySeconds !== this.decaySeconds
    ) {
      this.decaySeconds = params.decaySeconds;
      this.convolver.buffer = generateImpulseResponse(
        this.audioContext,
        this.decaySeconds,
      );
    }
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
  }
}
