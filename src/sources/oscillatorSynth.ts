import type { NoteTarget } from "../midi/noteTarget";
import { type AdsrParams, triggerAttack, triggerRelease } from "./envelope";
import { midiToFrequency } from "./pitch";

export interface OscillatorSynthParams extends AdsrParams {
  waveform: OscillatorType;
  detune: number;
}

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
}

const DEFAULT_PARAMS: OscillatorSynthParams = {
  waveform: "sine",
  detune: 0,
  attackMs: 5,
  decayMs: 150,
  sustainLevel: 0.7,
  releaseMs: 200,
};

/** A plain polyphonic subtractive-synth voice: one OscillatorNode per note,
 * gated by a per-voice ADSR gain. No worklet involved — a simple baseline
 * source to contrast against GranularSynth when testing effects/modulation. */
export class OscillatorSynth implements NoteTarget {
  readonly output: GainNode;
  private params: OscillatorSynthParams = { ...DEFAULT_PARAMS };
  private voices = new Map<number, Voice>();

  constructor(private audioContext: AudioContext) {
    this.output = audioContext.createGain();
  }

  setParams(params: Partial<OscillatorSynthParams>): void {
    this.params = { ...this.params, ...params };
    if (params.waveform !== undefined || params.detune !== undefined) {
      for (const voice of this.voices.values()) {
        if (params.waveform !== undefined) voice.osc.type = params.waveform;
        if (params.detune !== undefined) voice.osc.detune.value = params.detune;
      }
    }
  }

  noteOn(note: number, velocity: number, time?: number): void {
    const startTime = time ?? this.audioContext.currentTime;
    // Cut off a stale same-note voice at *this* note's own start time, not
    // real "now" -- a lookahead scheduler calls noteOn well ahead of when a
    // note is actually audible, and since noteOff no longer deletes a
    // voice from `voices` synchronously (see its own doc comment), a
    // previous voice can still be tracked here purely because its onended
    // hasn't fired yet in real time, even though it already has its own
    // graceful release scheduled to finish on its own. Stopping it at
    // real-now would truncate that release mid-flight, audible as a click;
    // stopping it at startTime is a no-op whenever the two don't actually
    // overlap (the common case), and a clean handoff when they do.
    this.stopVoice(note, startTime);

    const osc = this.audioContext.createOscillator();
    osc.type = this.params.waveform;
    osc.detune.value = this.params.detune;
    osc.frequency.value = midiToFrequency(note);

    const gain = this.audioContext.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(this.output);
    osc.start(startTime);

    triggerAttack(
      gain.gain,
      this.audioContext,
      this.params,
      velocity / 127,
      startTime,
    );
    this.voices.set(note, { osc, gain });
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
    voice.osc.stop(endTime);
    // Deletion is deferred to onended (real audio-stop time), not done here
    // synchronously -- a lookahead scheduler calls noteOn then noteOff back
    // to back well before the note is actually audible, so deleting here
    // would make `voices` (and therefore setParams' live-voice waveform/
    // detune update above) never see a voice that's still actually
    // sounding. The identity check guards against a same-note retrigger
    // that's already replaced this map entry by the time onended fires.
    voice.osc.onended = () => {
      voice.osc.disconnect();
      voice.gain.disconnect();
      if (this.voices.get(note) === voice) this.voices.delete(note);
    };
  }

  get currentTime(): number {
    return this.audioContext.currentTime;
  }

  private stopVoice(note: number, time: number): void {
    const voice = this.voices.get(note);
    if (!voice) return;
    voice.osc.stop(time);
    voice.osc.onended = () => {
      voice.osc.disconnect();
      voice.gain.disconnect();
    };
    this.voices.delete(note);
  }
}
