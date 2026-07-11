import { type AdsrParams, triggerAttack, triggerRelease } from "./envelope";
import type { NoteTarget } from "../midi/noteTarget";
import { midiToFrequency } from "./pitch";

export interface FmSynthParams extends AdsrParams {
  carrierWaveform: OscillatorType;
  modulatorWaveform: OscillatorType;
  /** Modulator frequency as a ratio of the carrier's — e.g. 2 gives an
   * octave-up modulator, non-integer ratios give inharmonic/bell-like
   * tones. */
  harmonicity: number;
  /** Modulator swing in Hz applied to the carrier's frequency — the
   * classic FM "index," just expressed directly in Hz via a gain node
   * rather than the dimensionless index some other synths use. */
  modulationIndex: number;
}

interface Voice {
  carrier: OscillatorNode;
  modulator: OscillatorNode;
  modGain: GainNode;
  gain: GainNode;
}

const DEFAULT_PARAMS: FmSynthParams = {
  carrierWaveform: "sine",
  modulatorWaveform: "sine",
  harmonicity: 2,
  modulationIndex: 100,
  attackMs: 5,
  decayMs: 200,
  sustainLevel: 0.6,
  releaseMs: 250,
};

/** A 2-operator FM voice using plain native OscillatorNodes — no worklet:
 * a modulator oscillator drives a gain node (the modulation index, in Hz)
 * which feeds directly into the carrier's frequency AudioParam. */
export class FmSynth implements NoteTarget {
  readonly output: GainNode;
  private params: FmSynthParams = { ...DEFAULT_PARAMS };
  private voices = new Map<number, Voice>();

  constructor(private audioContext: AudioContext) {
    this.output = audioContext.createGain();
  }

  setParams(params: Partial<FmSynthParams>): void {
    this.params = { ...this.params, ...params };
    for (const voice of this.voices.values()) {
      if (params.carrierWaveform !== undefined)
        voice.carrier.type = params.carrierWaveform;
      if (params.modulatorWaveform !== undefined)
        voice.modulator.type = params.modulatorWaveform;
      if (params.modulationIndex !== undefined)
        voice.modGain.gain.value = params.modulationIndex;
      if (params.harmonicity !== undefined)
        voice.modulator.frequency.value =
          voice.carrier.frequency.value * params.harmonicity;
    }
  }

  noteOn(note: number, velocity: number, time?: number): void {
    this.stopVoice(note, this.audioContext.currentTime);

    const startTime = time ?? this.audioContext.currentTime;
    const carrierFreq = midiToFrequency(note);

    const carrier = this.audioContext.createOscillator();
    carrier.type = this.params.carrierWaveform;
    carrier.frequency.value = carrierFreq;

    const modulator = this.audioContext.createOscillator();
    modulator.type = this.params.modulatorWaveform;
    modulator.frequency.value = carrierFreq * this.params.harmonicity;

    const modGain = this.audioContext.createGain();
    modGain.gain.value = this.params.modulationIndex;
    modulator.connect(modGain).connect(carrier.frequency);

    const gain = this.audioContext.createGain();
    gain.gain.value = 0;
    carrier.connect(gain).connect(this.output);

    carrier.start(startTime);
    modulator.start(startTime);

    triggerAttack(gain.gain, this.audioContext, this.params, velocity, startTime);
    this.voices.set(note, { carrier, modulator, modGain, gain });
  }

  noteOff(note: number, time?: number): void {
    const voice = this.voices.get(note);
    if (!voice) return;
    const atTime = time ?? this.audioContext.currentTime;
    const endTime = triggerRelease(
      voice.gain.gain,
      this.audioContext,
      this.params,
      atTime,
    );
    voice.carrier.stop(endTime);
    voice.modulator.stop(endTime);
    voice.carrier.onended = () => {
      voice.carrier.disconnect();
      voice.modulator.disconnect();
      voice.modGain.disconnect();
      voice.gain.disconnect();
    };
    this.voices.delete(note);
  }

  get currentTime(): number {
    return this.audioContext.currentTime;
  }

  private stopVoice(note: number, time: number): void {
    const voice = this.voices.get(note);
    if (!voice) return;
    voice.carrier.stop(time);
    voice.modulator.stop(time);
    voice.carrier.onended = () => {
      voice.carrier.disconnect();
      voice.modulator.disconnect();
      voice.modGain.disconnect();
      voice.gain.disconnect();
    };
    this.voices.delete(note);
  }
}
