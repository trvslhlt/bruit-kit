/** Anything with a `currentTime` (an `AudioContext`, a `ClockedNoteTarget`,
 * etc.) already satisfies this structurally — no import needed to use
 * createStepClock. */
export interface StepClockSource {
  currentTime: number;
}

export type StepClockTickHandler = (
  stepIndex: number,
  atTime: number,
  stepSeconds: number,
) => void;

export interface StepClock {
  /** Registers a handler to be called on every step boundary. Returns an
   * unsubscribe function. */
  onTick(handler: StepClockTickHandler): () => void;
  start(leadIn?: number): void;
  /** Ticks already scheduled inside the lookahead window at the moment
   * this is called will still fire — same documented caveat as
   * StepSequencer.stop(). */
  stop(): void;
  isPlaying(): boolean;
  /** Resolves which step index is actually audible at `atTime` (defaults
   * to now) — see StepSequencer.getCurrentStepIndex's doc for why this
   * needs a schedule log rather than just reading the last-ticked index. */
  getCurrentStepIndex(atTime?: number): number | null;
}

interface ScheduledTick {
  index: number;
  startTime: number;
  stepSeconds: number;
}

// Same reasoning and same values as stepSequencer.ts.
const LOOKAHEAD_SECONDS = 0.2;
const POLL_INTERVAL_MS = 50;
const MIN_STEP_SECONDS = 0.01;
const SCHEDULE_LOG_RETENTION_SECONDS = 2;

/** A bare lookahead-scheduling clock with no NoteTarget of its own — the
 * same technique as StepSequencer/ArpeggiatorEffect/MidiPlaybackController,
 * but notifying any number of subscribers on each step boundary instead of
 * firing notes on one target directly.
 *
 * This is what actually makes multi-row sequencing stay in sync: N
 * independent StepSequencers, each computing its own schedule, only start
 * in sync by coincidence (calling .start() on all of them within the same
 * synchronous turn happens to work, since AudioContext.currentTime doesn't
 * advance mid-turn) — but that guarantee doesn't survive a row being added,
 * muted, or removed later, since each one owns and can drift its own
 * clock. Subscribing multiple createStepTrack rows to one createStepClock
 * instead means every row receives the exact same (stepIndex, atTime,
 * stepSeconds) at once — there's only one clock to drift. */
export function createStepClock(
  clockSource: StepClockSource,
  getStepSeconds: () => number,
): StepClock {
  const handlers = new Set<StepClockTickHandler>();
  let running = false;
  let stepIndex = 0;
  let nextStepTime = 0;
  let intervalId: ReturnType<typeof setInterval> | null = null;
  const scheduleLog: ScheduledTick[] = [];

  function tick(atTime: number): void {
    const stepSeconds = Math.max(getStepSeconds(), MIN_STEP_SECONDS);
    for (const handler of handlers) handler(stepIndex, atTime, stepSeconds);
    scheduleLog.push({ index: stepIndex, startTime: atTime, stepSeconds });
    stepIndex++;
    nextStepTime = atTime + stepSeconds;
  }

  function pruneScheduleLog(): void {
    const cutoff = clockSource.currentTime - SCHEDULE_LOG_RETENTION_SECONDS;
    while (
      scheduleLog.length > 0 &&
      scheduleLog[0].startTime + scheduleLog[0].stepSeconds < cutoff
    ) {
      scheduleLog.shift();
    }
  }

  function startClock(): void {
    if (intervalId !== null) return;
    const fill = () => {
      while (nextStepTime - clockSource.currentTime < LOOKAHEAD_SECONDS) {
        tick(nextStepTime);
      }
      pruneScheduleLog();
    };
    fill();
    intervalId = setInterval(fill, POLL_INTERVAL_MS);
  }

  function stopClock(): void {
    if (intervalId !== null) {
      clearInterval(intervalId);
      intervalId = null;
    }
  }

  return {
    onTick(handler) {
      handlers.add(handler);
      return () => {
        handlers.delete(handler);
      };
    },
    start(leadIn = 0.05) {
      if (running) return;
      running = true;
      stepIndex = 0;
      nextStepTime = clockSource.currentTime + leadIn;
      startClock();
    },
    stop() {
      running = false;
      stopClock();
    },
    isPlaying() {
      return running;
    },
    getCurrentStepIndex(atTime = clockSource.currentTime) {
      for (let i = scheduleLog.length - 1; i >= 0; i--) {
        const entry = scheduleLog[i];
        if (
          atTime >= entry.startTime &&
          atTime < entry.startTime + entry.stepSeconds
        ) {
          return entry.index;
        }
      }
      return null;
    },
  };
}
