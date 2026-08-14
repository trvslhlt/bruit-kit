// Runs in AudioWorkletGlobalScope. `sampleRate` and `currentTime` are globals
// provided by that scope and share the same clock as the main-thread
// AudioContext -- no clock translation needed between the two.
//
// Phase distortion synthesis (Casio CZ-style): each voice's phase advances
// linearly (0..1, at frequency/sampleRate per sample) exactly like a plain
// sine oscillator, but that linear phase is warped through a user-drawn
// lookup table *before* it's used to index the sine -- reading the same
// underlying sine at an uneven rate produces extra harmonics, a cheap way
// to get filter-sweep-like, harmonically rich tones from one sine and a
// curve. This is a different axis than the various waveshaping effects
// (fuzzEffect.ts, waveFolderEffect.ts, ...): those reshape an existing
// signal's *amplitude*; this reshapes the *rate of traversal* through the
// waveform, on an internally-generated tone -- see phaseDistortionSynth.ts's
// own doc comment for why that makes this a source, not an effect.
//
// ADSR envelope state machine mirrors granular-processor.js's own
// advanceEnvelope (same phase-transition-fallthrough logic, minus the
// grain-spawning) -- block-granularity envelope updates are fine here for
// the same reason: attack/decay/release are slow (tens-hundreds of ms)
// relative to one ~2.9ms render block.

class PhaseDistortionProcessor extends AudioWorkletProcessor {
  constructor() {
    super();

    this.params = {
      distortionAmount: 0.5,
      attackMs: 5,
      decayMs: 200,
      sustainLevel: 0.6,
      releaseMs: 250,
    };

    // table[i] (i in [0, N-1]) = warped phase at linear phase i/(N-1),
    // values expected in [0,1] -- built from an AutomationPoint[] curve on
    // the main thread (see phaseDistortionSynth.ts's setDistortionCurve)
    // and sent over once via setDistortionTable. Defaults to the identity
    // mapping (no distortion at all, a plain sine) until a real curve
    // arrives, rather than silence.
    this.distortionTable = identityTable(513);

    // Sorted ascending by time; only ever contains events not yet applied.
    this.events = [];

    // note -> voice. No stealing fade on a retriggered note (same as
    // granular-processor.js's activeVoices.set on noteOn) -- a fresh
    // voice just replaces whatever was there.
    this.voices = new Map();

    this.port.onmessage = (event) => this.handleMessage(event.data);
  }

  handleMessage(msg) {
    switch (msg.type) {
      case "setParams":
        Object.assign(this.params, msg.params);
        break;
      case "setDistortionTable":
        this.distortionTable = msg.table;
        break;
      case "noteOn":
        this.insertEvent({
          time: msg.time ?? currentTime,
          type: "noteOn",
          note: msg.note,
          velocity: msg.velocity,
        });
        break;
      case "noteOff":
        this.insertEvent({
          time: msg.time ?? currentTime,
          type: "noteOff",
          note: msg.note,
        });
        break;
      case "panic":
        this.events = [];
        this.voices.clear();
        break;
    }
  }

  insertEvent(ev) {
    this.events.push(ev);
    this.events.sort((a, b) => a.time - b.time);
  }

  applyEvent(ev) {
    if (ev.type === "noteOn") {
      // 440 * 2^((note-69)/12) -- MIDI note 69 (A4) = 440Hz, the same
      // reference pitch.ts's midiToFrequency uses on the main thread
      // (inlined here since worklet scripts are plain, import-free JS,
      // same as every other processor in this directory).
      const freq = 440 * 2 ** ((ev.note - 69) / 12);
      this.voices.set(ev.note, {
        freq,
        velocity: ev.velocity,
        phase: 0,
        envPhase: "attack",
        envTime: 0,
        envValue: 0,
        releaseStartLevel: 0,
      });
    } else if (ev.type === "noteOff") {
      const voice = this.voices.get(ev.note);
      if (
        voice &&
        voice.envPhase !== "release" &&
        voice.envPhase !== "finished"
      ) {
        voice.envPhase = "release";
        voice.envTime = 0;
        voice.releaseStartLevel = voice.envValue;
      }
    }
  }

  advanceEnvelope(voice, blockDuration) {
    const { attackMs, decayMs, sustainLevel, releaseMs } = this.params;
    const attackSec = Math.max(attackMs, 0) / 1000;
    const decaySec = Math.max(decayMs, 0) / 1000;
    const releaseSec = Math.max(releaseMs, 0) / 1000;

    voice.envTime += blockDuration;

    if (voice.envPhase === "attack") {
      if (attackSec <= 0) {
        voice.envPhase = "decay";
        voice.envTime = 0;
      } else if (voice.envTime >= attackSec) {
        voice.envPhase = "decay";
        voice.envTime -= attackSec;
      } else {
        voice.envValue = voice.envTime / attackSec;
        return;
      }
    }

    if (voice.envPhase === "decay") {
      if (decaySec <= 0) {
        voice.envPhase = "sustain";
        voice.envTime = 0;
      } else if (voice.envTime >= decaySec) {
        voice.envPhase = "sustain";
        voice.envTime -= decaySec;
      } else {
        voice.envValue = 1 + (sustainLevel - 1) * (voice.envTime / decaySec);
        return;
      }
    }

    if (voice.envPhase === "sustain") {
      voice.envValue = sustainLevel;
      return;
    }

    if (voice.envPhase === "release") {
      if (releaseSec <= 0 || voice.envTime >= releaseSec) {
        voice.envValue = 0;
        voice.envPhase = "finished";
        return;
      }
      voice.envValue =
        voice.releaseStartLevel * (1 - voice.envTime / releaseSec);
    }
  }

  // Linear-interpolated table lookup, same two-nearest-point interpolation
  // style as directional-sample-processor.js's buffer read. `p` is the
  // *linear* phase in [0,1).
  lookupWarpedPhase(p) {
    const table = this.distortionTable;
    const n = table.length;
    const idx = p * (n - 1);
    const i0 = Math.floor(idx);
    const i1 = Math.min(i0 + 1, n - 1);
    const frac = idx - i0;
    return table[i0] * (1 - frac) + table[i1] * frac;
  }

  render(outputL, outputR, blockDuration) {
    const blockSize = outputL.length;
    const { distortionAmount } = this.params;
    const toRemove = [];

    for (const [note, voice] of this.voices) {
      this.advanceEnvelope(voice, blockDuration);
      if (voice.envPhase === "finished") {
        toRemove.push(note);
        continue;
      }

      const phaseIncrement = voice.freq / sampleRate;
      const amp = voice.envValue * (voice.velocity / 127);

      for (let i = 0; i < blockSize; i++) {
        const warped = this.lookupWarpedPhase(voice.phase);
        // 0 = pure sine (identity phase, the table has no effect); 1 =
        // fully warped through the curve -- the classic CZ "DCW" sweep
        // (see phaseDistortionSynth.ts's own doc comment).
        const finalPhase =
          voice.phase + distortionAmount * (warped - voice.phase);
        const sample = Math.sin(2 * Math.PI * finalPhase) * amp;
        outputL[i] += sample;
        outputR[i] += sample;

        voice.phase += phaseIncrement;
        if (voice.phase >= 1) voice.phase -= 1;
      }
    }

    for (const note of toRemove) this.voices.delete(note);
  }

  process(_inputs, outputs) {
    const output = outputs[0];
    const outputL = output[0];
    const outputR = output[1] ?? output[0];
    outputL.fill(0);
    if (outputR !== outputL) outputR.fill(0);

    const blockDuration = outputL.length / sampleRate;
    const blockEndTime = currentTime + blockDuration;
    while (this.events.length > 0 && this.events[0].time <= blockEndTime) {
      this.applyEvent(this.events.shift());
    }

    this.render(outputL, outputR, blockDuration);
    return true;
  }
}

function identityTable(n) {
  const table = new Float32Array(n);
  for (let i = 0; i < n; i++) table[i] = i / (n - 1);
  return table;
}

registerProcessor("phase-distortion-processor", PhaseDistortionProcessor);
