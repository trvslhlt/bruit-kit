import type { NoteTarget } from "../../src/midi/noteTarget";

const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
];
const START_NOTE = 60; // C4
const OCTAVES = 2;

// The standard "typing keyboard as piano" layout (same convention as
// GarageBand/Ableton's computer-keyboard note input): bottom QWERTY row is
// white keys starting at C, top row fills in the sharps in between. Keyed
// by KeyboardEvent.code rather than .key so it's layout-independent (a
// physical key stays mapped to the same note regardless of the OS's
// active input language). Offsets are semitones above START_NOTE.
const COMPUTER_KEY_OFFSETS: Record<string, number> = {
  KeyA: 0, // C4
  KeyW: 1,
  KeyS: 2,
  KeyE: 3,
  KeyD: 4,
  KeyF: 5,
  KeyT: 6,
  KeyG: 7,
  KeyY: 8,
  KeyH: 9,
  KeyU: 10,
  KeyJ: 11,
  KeyK: 12, // C5
  KeyO: 13,
  KeyL: 14,
  KeyP: 15,
  Semicolon: 16,
  Quote: 17,
};

/** A minimal ~2-octave on-screen piano: mousedown/mouseup -> noteOn/noteOff
 * on `target`, at a fixed velocity. Also binds the physical keyboard (see
 * COMPUTER_KEY_OFFSETS) to the same notes -- a mouse can only ever depress
 * one key at a time, so it can't play overlapping/legato notes at all;
 * the computer keyboard can hold several keys down simultaneously, which
 * portamento and chords both need to be testable. Reused by every demo
 * that needs live note input rather than each building its own. */
export function createOnScreenKeyboard(
  container: HTMLElement,
  target: NoteTarget,
  velocity = 100,
): void {
  container.innerHTML = "";
  const row = document.createElement("div");
  row.className = "keyboard-row";
  container.appendChild(row);

  const keysByNote = new Map<number, HTMLElement>();

  const totalKeys = OCTAVES * 12 + 1;
  for (let i = 0; i < totalKeys; i++) {
    const note = START_NOTE + i;
    const name = NOTE_NAMES[note % 12];
    const isSharp = name.includes("#");

    const key = document.createElement("div");
    key.className = isSharp
      ? "keyboard-key keyboard-key-sharp"
      : "keyboard-key";
    key.textContent = isSharp ? "" : name;

    const release = () => target.noteOff(note);
    key.addEventListener("mousedown", () => target.noteOn(note, velocity));
    key.addEventListener("mouseup", release);
    key.addEventListener("mouseleave", release);
    row.appendChild(key);
    keysByNote.set(note, key);
  }

  // Guards against both a stray double-bind (if this ever ran twice on
  // the same page) and the OS's key-repeat, which resends keydown for a
  // held key without a matching keyup -- without tracking what's already
  // down, that would retrigger noteOn on every repeat instead of once.
  const heldCodes = new Set<string>();

  document.addEventListener("keydown", (event) => {
    // Don't hijack typing into the param panel's own inputs, or OS/browser
    // shortcuts held with a modifier.
    const eventTarget = event.target as HTMLElement | null;
    if (eventTarget && /^(INPUT|SELECT|TEXTAREA)$/.test(eventTarget.tagName))
      return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;

    const offset = COMPUTER_KEY_OFFSETS[event.code];
    if (offset === undefined || heldCodes.has(event.code)) return;
    heldCodes.add(event.code);

    const note = START_NOTE + offset;
    keysByNote.get(note)?.classList.add("is-pressed");
    target.noteOn(note, velocity);
  });

  document.addEventListener("keyup", (event) => {
    const offset = COMPUTER_KEY_OFFSETS[event.code];
    if (offset === undefined) return;
    heldCodes.delete(event.code);

    const note = START_NOTE + offset;
    keysByNote.get(note)?.classList.remove("is-pressed");
    target.noteOff(note);
  });
}
