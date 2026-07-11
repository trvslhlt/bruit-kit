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
