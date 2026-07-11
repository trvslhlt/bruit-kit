# web-audio-toy-kit

Small, reusable pieces extracted from [granular_midi](../granular_midi):
generic Web Audio / vanilla-DOM infrastructure with no dependency on any
specific synth or app. Not published to npm — meant to be consumed by
sibling projects via a `file:` dependency.

## Parts

- **`web-audio-toy-kit/audio`** — dry/wet crossfade helper, four effects
  (filter, delay, distortion, reverb — each with a synthesized/native
  implementation, many params, and a dry/wet control), a `MediaRecorder`
  capture-to-download `Recorder`, and a small LFO modulation engine (fixed
  slots, each assignable to either a worklet-internal param or a native
  `AudioParam`, given the app's own target registry — see
  `granular_midi/frontend/src/modulation/lfoTargets.ts` for an example of
  building one).
- **`web-audio-toy-kit/ui`** — a waveform-preview-with-playhead-scrubber
  widget (`createWaveformView`) and labeled-range-slider helpers
  (`rangeControl`/`bindSlider`), both vanilla DOM, no framework. Pairs with
  `web-audio-toy-kit/ui/waveformView.css`, `/sliderControl.css`, and
  `/columns.css` (a small 3-column responsive control-panel grid).
- **`web-audio-toy-kit/midi`** — a generic MIDI-performance toolkit: the
  `NoteTarget`/`ClockedNoteTarget` abstraction everything else is built on,
  `@tonejs/midi` file loading, a stateful `MidiPlaybackController` (live
  loop/speed/chord/arp changes without restarting playback), and
  Chord/Arpeggiator effects in both live (keyboard) and file-preprocessing
  forms.
- **`web-audio-toy-kit/sources`** — things that *originate* audio, as
  distinct from `audio`'s effects (which process an existing stream).
  Currently one: `GranularSynth`, a from-scratch `AudioWorkletProcessor`-
  based granular synthesis engine (implements `NoteTarget`, so it's a drop-
  in `noteOn`/`noteOff` target for anything in `midi`). **Needs one extra
  manual step** — see below.

## Using it from another project

Not published — add a `file:` dependency pointing at this directory from
a sibling project's `package.json`:

```json
"dependencies": {
  "web-audio-toy-kit": "file:../web-audio-toy-kit"
}
```

Then `npm install` (build this package first — see below) and import from
whichever parts you need:

```ts
import { createDryWet, FilterEffect } from "web-audio-toy-kit/audio";
import { createWaveformView, bindSlider } from "web-audio-toy-kit/ui";
import { MidiPlaybackController, ChordEffect } from "web-audio-toy-kit/midi";
import { GranularSynth } from "web-audio-toy-kit/sources";
```

### `GranularSynth`'s extra step

`AudioWorkletProcessor` scripts are loaded by
`audioContext.audioWorklet.addModule(url)` — a runtime fetch of a URL, not
a bundler-resolved import — so the raw processor script can't just be
imported like everything else here. Copy it into your own app's static
assets once:

```
cp node_modules/web-audio-toy-kit/dist/sources/granular-processor.js public/worklets/
```

Then either rely on the default (`GranularSynth` expects
`/worklets/granular-processor.js` if you don't say otherwise), or point it
at wherever you put the file:

```ts
new GranularSynth(audioContext, { workletUrl: "/some/other/path.js" });
```

## Develop

Docker-only, same convention as the sibling projects — no Node needed on
the host:

```
make up
make build      # compiles dist/ — do this before a consuming project's
                 # npm install picks up changes
make lint
make typecheck
```
