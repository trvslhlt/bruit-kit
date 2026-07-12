# web-audio-toy-kit

Reusable Web Audio / vanilla-DOM building blocks — effects, sound sources, a
MIDI performance toolkit, and UI widgets — with no dependency on any
specific synth or app. Not published to npm; consumed by sibling projects
via a `file:` dependency.

## Demo

A live, one-page-per-component demo app lives in `demo/`:

```
npm run demo          # dev server at http://localhost:5173
make demo             # same, from inside the Docker container (see below)
```

Every demo page needs one click to enable audio (browser autoplay policy),
then exercises exactly one component — effects, sources, and MIDI pieces
each get their own focused page rather than one big kitchen-sink app. It
imports straight from `src/`, not the built `dist/`, so it always reflects
what's currently in the repo with no build step first.

## Subpackages

- **`web-audio-toy-kit/audio`** — audio effects (each with a dry/wet
  control, except the always-fully-engaged safety limiter), a
  `MediaRecorder`-based recorder, an LFO modulation engine, and
  breakpoint-curve automation scheduling.
- **`web-audio-toy-kit/ui`** — vanilla-DOM widgets (waveform views, a
  breakpoint-curve editor, a step-sequencer grid, slider helpers), each
  paired with its own `.css` file.
- **`web-audio-toy-kit/midi`** — the `NoteTarget`/`ClockedNoteTarget`
  abstraction everything else is built on, MIDI file playback, and
  performance effects (chord, arpeggiator, step sequencer) usable live or
  applied to a file.
- **`web-audio-toy-kit/sources`** — things that *originate* audio, as
  distinct from `audio`'s effects (which process an existing stream):
  oscillator, sample, noise, FM, and granular synths.

See `demo/` for what each part actually looks/sounds like, or the source
under `src/<part>/` for the full API.

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

(`demo/sources-granular.ts` does the same thing for the demo app's own copy
under `demo/public/worklets/` — a working example of the same step.)

## Contributing

Docker-only, same convention as the sibling projects — no Node needed on
the host:

```
make up            # start the (long-running) builder container -- run this first
make demo          # run the demo app's dev server at http://localhost:5173
make test          # run the e2e suite against the demo app (Playwright)
make lint
make format
make typecheck
make build          # compiles dist/ -- do this before a consuming project's
                     # npm install picks up changes
```

`make up` has to run (and succeed) before any other target — `make demo`,
`make lint`, etc. all `docker compose exec` into the container `make up`
started, so if it isn't running they fail with "service ... is not
running." The container stays up in the background afterwards (it has no
dev server of its own; `make demo` execs `npm run demo` into it on demand),
so you only need to run `make up` again if you've stopped it (`make down`)
or changed `Dockerfile`/`docker-compose.yml` — a plain `exec` into an
already-running container won't pick up either kind of change.

A few things worth knowing before adding to this repo:

- Every part (`audio`, `ui`, `midi`, `sources`) is independently importable
  — no part should import from another's internals, only from another
  part's public exports (see `vite.config.ts`'s four separate library entry
  points).
- `ui/` code stays free of any Web Audio dependency, and `audio`/`midi`
  code stays free of any DOM dependency, even where two modules are clearly
  a pair (e.g. `audio/automation.ts` + `ui/automationEditor.ts`) — shapes
  get duplicated locally rather than imported across that boundary.
- New effects/sources typically pair a `<Thing>Params` interface with a
  `setParams(partial)` method; effects additionally wrap their signal path
  with `audio/dryWet.ts`'s `createDryWet`.
- `demo/` has its own `tsconfig.json`/`vite.config.ts`, deliberately
  separate from the root's (which builds the published library) — adding a
  new component should come with a matching `demo/<part>-<name>.html` +
  `.ts` pair (`npm run typecheck:demo` checks these; `demo/vite.config.ts`
  picks up new `.html` files automatically).
- `e2e/` (also its own `tsconfig.json`, checked by `npm run typecheck:e2e`)
  has a generic test that loads every `demo/*.html` page and fails on any
  console error — new demo pages are covered automatically, nothing to
  add there. A bug that only shows up visually (wrong size, wrong color,
  nothing thrown) needs its own targeted test instead — see
  `e2e/step-sequencer.spec.ts` for the pattern: assert on an actual
  rendered `boundingBox()`, not just the absence of an error.
