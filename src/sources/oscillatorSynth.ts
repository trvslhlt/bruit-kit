import type { NoteTarget } from "../midi/noteTarget";
import {
  type AdsrParams,
  type EnvelopeSchedule,
  triggerAttack,
  triggerRelease,
  triggerStealFade,
} from "./envelope";
import { midiToFrequency } from "./pitch";

export interface OscillatorSynthParams extends AdsrParams {
  waveform: OscillatorType;
  detune: number;
  /** Glide time (ms) between two overlapping notes. 0 = off (default
   * polyphonic behavior: every note gets its own voice, pitch jumps
   * instantly). Above 0, a note that arrives while another is still
   * sounding reuses that voice and slides to the new pitch instead of
   * starting a fresh oscillator -- see the noteOn portamento branch. */
  portamentoMs: number;
}

/** Tracks the portamento glide currently (or most recently) scheduled on a
 * voice's frequency param -- needed for the same reason EnvelopeSchedule is
 * needed for gain (see envelope.ts's triggerRelease doc comment): asking
 * cancelAndHoldAtTime for the param's current value once a prior
 * exponential ramp has already completed returns a wrong, too-low-or-high
 * value in Chrome, confirmed with the same kind of minimal repro used for
 * the gain bug. A single glide is just one exponential ramp with known
 * endpoints, so its value at any time is simple to compute directly. */
interface FrequencyGlide {
  from: number;
  to: number;
  startTime: number;
  endTime: number;
}

function frequencyAt(atTime: number, glide: FrequencyGlide): number {
  if (atTime <= glide.startTime) return glide.from;
  if (atTime >= glide.endTime) return glide.to;
  const progress = (atTime - glide.startTime) / (glide.endTime - glide.startTime);
  return glide.from * (glide.to / glide.from) ** progress;
}

interface Voice {
  osc: OscillatorNode;
  gain: GainNode;
  envelope: EnvelopeSchedule;
  freqGlide: FrequencyGlide;
}

const DEFAULT_PARAMS: OscillatorSynthParams = {
  waveform: "sine",
  detune: 0,
  attackMs: 5,
  decayMs: 150,
  sustainLevel: 0.7,
  releaseMs: 200,
  portamentoMs: 0,
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

    // Portamento glide: only when a *different* note is already sounding --
    // a same-note retrigger falls through to the normal stop-and-restart
    // path below, same as with portamento off. Reuses the existing voice's
    // oscillator and slides it to the new pitch instead of starting a new
    // one, and leaves its gain envelope untouched (legato phrasing doesn't
    // re-attack). This intentionally collapses to monophonic while gliding:
    // there is exactly one glide target, so anything else already sounding
    // gets re-keyed onto this note rather than kept as a separate voice. A
    // note released later that got re-keyed away (e.g. holding a chord
    // while gliding) will find nothing under its own key in `voices` and
    // silently no-op in noteOff, rather than resuming the glide -- there's
    // no held-note stack here, just last-note priority.
    const glideSeconds = Math.max(this.params.portamentoMs, 0) / 1000;
    if (glideSeconds > 0 && this.voices.size > 0 && !this.voices.has(note)) {
      const [prevNote, voice] = [...this.voices][0];
      const currentFreq = frequencyAt(startTime, voice.freqGlide);
      const targetFreq = midiToFrequency(note);
      voice.osc.frequency.cancelScheduledValues(startTime);
      voice.osc.frequency.setValueAtTime(currentFreq, startTime);
      voice.osc.frequency.exponentialRampToValueAtTime(
        targetFreq,
        startTime + glideSeconds,
      );
      voice.freqGlide = {
        from: currentFreq,
        to: targetFreq,
        startTime,
        endTime: startTime + glideSeconds,
      };
      this.voices.delete(prevNote);
      this.voices.set(note, voice);
      return;
    }

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
    //
    // stopVoice returns when it's actually safe for the new voice to start
    // -- if it stole a still-sounding voice, that's after its declick fade
    // finishes, not immediately at startTime. Starting a fresh oscillator
    // (always phase 0) while the old one (at some arbitrary phase) is still
    // audibly overlapping it can briefly cancel if their phases land
    // roughly opposite, an audible dip/glitch confirmed by directly
    // measuring the summed output's RMS around a retrigger -- infrequent
    // and timing-dependent (only bad phase alignments produce it), matching
    // reports of an occasional, hard-to-reproduce pop on rapid retriggers.
    // A few ms of silence between the old voice ending and the new one
    // starting is imperceptible as lag but guarantees they never overlap.
    const voiceStartTime = this.stopVoice(note, startTime);

    const osc = this.audioContext.createOscillator();
    osc.type = this.params.waveform;
    osc.detune.value = this.params.detune;
    const freq = midiToFrequency(note);
    osc.frequency.value = freq;

    const gain = this.audioContext.createGain();
    gain.gain.value = 0;
    osc.connect(gain).connect(this.output);
    osc.start(voiceStartTime);

    const envelope = triggerAttack(
      gain.gain,
      this.audioContext,
      this.params,
      velocity / 127,
      voiceStartTime,
    );
    this.voices.set(note, {
      osc,
      gain,
      envelope,
      freqGlide: {
        from: freq,
        to: freq,
        startTime: voiceStartTime,
        endTime: voiceStartTime,
      },
    });
  }

  noteOff(note: number, time?: number): void {
    const voice = this.voices.get(note);
    if (!voice) return;
    const atTime = time ?? this.audioContext.currentTime;
    const { endTime, schedule } = triggerRelease(
      voice.gain.gain,
      this.audioContext,
      voice.envelope,
      atTime,
    );
    voice.envelope = schedule;
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
    voice.osc.stop(endTime);
    voice.osc.onended = () => {
      voice.osc.disconnect();
      voice.gain.disconnect();
    };
    this.voices.delete(note);
    return endTime;
  }
}
