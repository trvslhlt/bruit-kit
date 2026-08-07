/** Reads an AnalyserNode's current peak amplitude in dBFS -- the pure Web
 * Audio math half of a level meter, with no DOM/CSS/color-band logic
 * attached (see main.ts's own updateMasterMeter for how this app maps the
 * result onto a meter bar's width and color). Owns its own scratch buffer
 * (sized off the analyser's own fftSize) so a caller just calls
 * `readPeakDb()` on a rAF/interval loop without managing one itself. */

export interface PeakMeter {
  /** Peak absolute sample amplitude across the analyser's current time-
   * domain window, converted to dBFS -- Number.NEGATIVE_INFINITY for true
   * silence (peak === 0), not NaN/-Infinity-from-log(0) leaking out
   * unhandled. */
  readPeakDb(): number;
}

export function createPeakMeter(analyser: AnalyserNode): PeakMeter {
  const buffer = new Float32Array(analyser.fftSize);
  return {
    readPeakDb() {
      analyser.getFloatTimeDomainData(buffer);
      let peak = 0;
      for (const sample of buffer) {
        const abs = Math.abs(sample);
        if (abs > peak) peak = abs;
      }
      return peak > 0 ? 20 * Math.log10(peak) : Number.NEGATIVE_INFINITY;
    },
  };
}
