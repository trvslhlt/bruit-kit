/** Click-and-drag "paint" over a grid/matrix of toggle cells: the cell
 * under the pointer at mousedown toggles immediately, then every *other*
 * cell the pointer enters while the button is still down toggles once each
 * -- the common step-sequencer/piano-roll/XY-pad gesture of dragging a
 * finger across a row of buttons instead of clicking each one. No DOM or
 * framework coupling: the caller wires `start`/`enter` to its own
 * mousedown/mouseenter handlers and supplies whatever `paint()` callback
 * actually flips that cell's state, keyed by whatever identifier (string,
 * number, `${row}:${col}`, ...) the caller already uses for its cells. A
 * window-level mouseup (not a per-cell one) is what ends the drag, since
 * the button can be released anywhere, not just over a cell -- this
 * controller registers that listener itself, once, for its own lifetime. */

export interface DragPaintController<Key> {
  /** The cell under the pointer at mousedown -- always paints, and starts
   * a new drag that dedupes every cell entered until mouseup. */
  start(key: Key, paint: () => void): void;
  /** A cell the pointer has moved into while a drag (started via `start`)
   * is still active -- paints once per cell per drag, no-ops entirely
   * outside an active drag or on a cell this same drag already painted. */
  enter(key: Key, paint: () => void): void;
}

export function createDragPaint<Key>(): DragPaintController<Key> {
  let isPainting = false;
  let paintedKeys = new Set<Key>();
  window.addEventListener("mouseup", () => {
    isPainting = false;
  });

  return {
    start(key, paint) {
      isPainting = true;
      paintedKeys = new Set([key]);
      paint();
    },
    enter(key, paint) {
      if (!isPainting || paintedKeys.has(key)) return;
      paintedKeys.add(key);
      paint();
    },
  };
}
