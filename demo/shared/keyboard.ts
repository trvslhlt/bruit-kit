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

/** A minimal ~2-octave on-screen piano: mousedown/mouseup -> noteOn/noteOff
 * on `target`, at a fixed velocity. Reused by every demo that needs live
 * note input rather than each building its own. */
export function createOnScreenKeyboard(
  container: HTMLElement,
  target: NoteTarget,
  velocity = 100,
): void {
  container.innerHTML = "";
  const row = document.createElement("div");
  row.className = "keyboard-row";
  container.appendChild(row);

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
  }
}
