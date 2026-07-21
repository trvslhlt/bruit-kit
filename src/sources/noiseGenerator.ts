import type { NoteTarget } from "../midi/noteTarget";
import {
  type AdsrParams,
  type EnvelopeSchedule,
  triggerAttack,
  triggerRelease,
  triggerStealFade,
} from "./envelope";

export type NoiseType = "white" | "pink" | "brown";

export interface NoiseGeneratorParams extends AdsrParams {
  type: NoiseType;
}

interface Voice {
  source: AudioBufferSourceNode;
  gain: GainNode;
  envelope: EnvelopeSchedule;
}

const DEFAULT_PARAMS: NoiseGeneratorParams = {
  type: "white",
  attackMs: 5,
  decayMs: 100,
  sustainLevel: 0.8,
  releaseMs: 150,
};

const NOISE_BUFFER_SECONDS = 2;

function buildWhiteNoiseBuffer(audioContext: AudioContext): AudioBuffer {
  const length = audioContext.sampleRate * NOISE_BUFFER_SECONDS;
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

/** Paul Kellet's ~1/f filter, run once to fill a buffer rather than per
 * sample in real time — a standard, cheap approximation that needs no
 * worklet. */
function buildPinkNoiseBuffer(audioContext: AudioContext): AudioBuffer {
  const length = audioContext.sampleRate * NOISE_BUFFER_SECONDS;
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  let b0 = 0;
  let b1 = 0;
  let b2 = 0;
  let b3 = 0;
  let b4 = 0;
  let b5 = 0;
  let b6 = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    b0 = 0.99886 * b0 + white * 0.0555179;
    b1 = 0.99332 * b1 + white * 0.0750759;
    b2 = 0.969 * b2 + white * 0.153852;
    b3 = 0.8665 * b3 + white * 0.3104856;
    b4 = 0.55 * b4 + white * 0.5329522;
    b5 = -0.7616 * b5 - white * 0.016898;
    data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
    b6 = white * 0.115926;
  }
  return buffer;
}

/** A one-pole leaky integrator (the standard "brown noise" recipe) — each
 * sample is last sample's value nudged slightly by fresh white noise, so
 * it's a random walk that can't run away or accumulate DC drift. Measured
 * (via FFT, band-averaged over several trials) at roughly -5 to -6 dB per
 * octave, well below pink's -3 dB/octave — a real, audibly darker/bassier
 * noise, not just "even darker pink." */
function buildBrownNoiseBuffer(audioContext: AudioContext): AudioBuffer {
  const length = audioContext.sampleRate * NOISE_BUFFER_SECONDS;
  const buffer = audioContext.createBuffer(1, length, audioContext.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    last = (last + 0.02 * white) / 1.02;
    data[i] = last * 3.5; // gain compensation back up to roughly -1..1
  }
  return buffer;
}

/** A noise source, gated like a synth voice by the shared ADSR envelope.
 * Pitch/note number is ignored (only used as the voice map key) — velocity
 * still scales the envelope peak. White/pink/brown buffers are generated
 * once, lazily, and looped per voice rather than synthesized in real time. */
export class NoiseGenerator implements NoteTarget {
  readonly output: GainNode;
  private params: NoiseGeneratorParams = { ...DEFAULT_PARAMS };
  private buffers = new Map<NoiseType, AudioBuffer>();
  private voices = new Map<number, Voice>();

  constructor(private audioContext: AudioContext) {
    this.output = audioContext.createGain();
  }

  setParams(params: Partial<NoiseGeneratorParams>): void {
    this.params = { ...this.params, ...params };
  }

  noteOn(note: number, velocity: number, time?: number): void {
    const startTime = time ?? this.audioContext.currentTime;
    // See the matching comment in oscillatorSynth.ts's noteOn -- stopping
    // a stale same-note voice at real "now" instead of this note's own
    // start time truncates its already-scheduled graceful release
    // mid-flight, audible as a click. stopVoice's return value is when
    // it's actually safe to start the new voice -- see its own comment
    // for why a fresh source can't just start immediately at startTime if
    // something was stolen (every voice restarts the same cached noise
    // buffer from sample 0, so an overlap is two correlated copies of the
    // same signal at a fixed relative offset, not independent noise, and
    // can briefly cancel much like two out-of-phase tones would).
    const voiceStartTime = this.stopVoice(note, startTime);
    const source = this.audioContext.createBufferSource();
    source.buffer = this.getBuffer(this.params.type);
    source.loop = true;

    const gain = this.audioContext.createGain();
    gain.gain.value = 0;
    source.connect(gain).connect(this.output);
    source.start(voiceStartTime);

    const envelope = triggerAttack(
      gain.gain,
      this.audioContext,
      this.params,
      velocity / 127,
      voiceStartTime,
    );
    this.voices.set(note, { source, gain, envelope });
  }

  noteOff(note: number, time?: number): void {
    const voice = this.voices.get(note);
    if (!voice) return;
    const atTime = time ?? this.audioContext.currentTime;
    const { endTime } = triggerRelease(
      voice.gain.gain,
      this.audioContext,
      voice.envelope,
      atTime,
    );
    voice.source.stop(endTime);
    voice.source.onended = () => {
      voice.source.disconnect();
      voice.gain.disconnect();
    };
    this.voices.delete(note);
  }

  get currentTime(): number {
    return this.audioContext.currentTime;
  }

  private getBuffer(type: NoiseType): AudioBuffer {
    let buffer = this.buffers.get(type);
    if (!buffer) {
      buffer =
        type === "pink"
          ? buildPinkNoiseBuffer(this.audioContext)
          : type === "brown"
            ? buildBrownNoiseBuffer(this.audioContext)
            : buildWhiteNoiseBuffer(this.audioContext);
      this.buffers.set(type, buffer);
    }
    return buffer;
  }

  /** Returns the time it's safe for a new voice to start: `time` unchanged
   * if there was nothing to steal, or the stolen voice's declick-fade
   * end time otherwise -- see the caller's comment for why that matters. */
  private stopVoice(note: number, time: number): number {
    const voice = this.voices.get(note);
    if (!voice) return time;
    const { endTime } = triggerStealFade(
      voice.gain.gain,
      this.audioContext,
      voice.envelope,
      time,
    );
    voice.source.stop(endTime);
    voice.source.onended = () => {
      voice.source.disconnect();
      voice.gain.disconnect();
    };
    this.voices.delete(note);
    return endTime;
  }
}
