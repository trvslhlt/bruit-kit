import { type DryWetWrapper, createDryWet } from "./dryWet";

export interface PitchShiftEffectParams {
  /** Coarse shift in whole semitones, e.g. -12..12. */
  semitones: number;
  /** Coarse shift in whole octaves (each ±1 is ±12 semitones), on top of
   * `semitones` -- mirrors hardware harmonizer pedals' separate
   * octave/semitone/fine controls rather than one wide semitone range. */
  octave: number;
  /** Fine shift in cents (100ths of a semitone), e.g. -50..50. */
  cents: number;
  wet: number;
}

const DEFAULT_WORKLET_URL = "/worklets/pitch-shift-processor.js";

/** Registers pitch-shift-processor.js on `audioContext`. Must be awaited
 * once per AudioContext (real-time *or* offline) before constructing any
 * PitchShiftEffect against that context -- worklet registration is
 * asynchronous and scoped per-context (a fresh OfflineAudioContext does
 * NOT inherit registration from an AudioContext that already loaded the
 * same URL), but PitchShiftEffect's own constructor is synchronous like
 * every other effect class here (see its doc comment for why), so this
 * can't be done lazily inside the constructor the way GranularSynth's
 * init() does. Real-time callers preload once at app startup, long before
 * a user could plausibly add the effect; offline-render callers must
 * await this fresh for every new OfflineAudioContext they create. */
export function preloadPitchShiftWorklet(
  audioContext: BaseAudioContext,
  workletUrl: string = DEFAULT_WORKLET_URL,
): Promise<void> {
  return audioContext.audioWorklet.addModule(workletUrl);
}

/** Real-time pitch shift via a dual-grain crossfading circular buffer
 * running in an AudioWorkletProcessor (see pitch-shift-processor.js) --
 * the same overlapping-grain idea as GranularSynth's playback, just
 * reading a live buffer of the incoming signal instead of a static
 * sample. Unlike GranularSynth, construction here is fully synchronous
 * (matching every other effect class / the ChainableNode contract
 * grid apps' instantiateEffect-style code relies on): the caller MUST
 * have already awaited preloadPitchShiftWorklet(audioContext) at least
 * once for this exact context, or the AudioWorkletNode construction below
 * throws synchronously (unregistered processor name) rather than silently
 * producing dry-only output. */
export class PitchShiftEffect {
  readonly input: AudioNode;
  readonly output: AudioNode;
  private node: AudioWorkletNode;
  private dryWet: DryWetWrapper;
  private params: PitchShiftEffectParams = {
    semitones: 0,
    octave: 0,
    cents: 0,
    wet: 0,
  };

  constructor(audioContext: AudioContext) {
    this.node = new AudioWorkletNode(audioContext, "pitch-shift-processor", {
      outputChannelCount: [2],
    });
    this.dryWet = createDryWet(audioContext, this.node, this.node, 0);
    this.input = this.dryWet.input;
    this.output = this.dryWet.output;
  }

  setParams(params: Partial<PitchShiftEffectParams>): void {
    this.params = { ...this.params, ...params };
    if (params.wet !== undefined) this.dryWet.setWet(params.wet);
    if (
      params.semitones !== undefined ||
      params.octave !== undefined ||
      params.cents !== undefined
    ) {
      const totalSemitones =
        this.params.octave * 12 +
        this.params.semitones +
        this.params.cents / 100;
      this.node.port.postMessage({
        type: "setRate",
        rate: 2 ** (totalSemitones / 12),
      });
    }
  }
}
