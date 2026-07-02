// src/platform/mqtt/throttle — leading-edge + guaranteed-trailing coalescer.
//
// Port of comMQTT's PUBLISH_INTERVAL_MS throttle (MqttProvider.jsx): a knob/fader
// drag fires onChange on every pointer tick; we publish the FIRST change at once
// (snappy), drop the intermediate ones, and always publish the FINAL resting value
// after the interval. Cuts bus flooding ~95% while never losing the last value.

export const DEFAULT_INTERVAL_MS = 22;   // ~45 Hz, matches comMQTT's default

export interface Throttler<T> {
  push(value: T): void;
  /** Flush a pending trailing value immediately (used on dispose). */
  flush(): void;
  cancel(): void;
}

export function createThrottler<T>(emit: (value: T) => void, intervalMs = DEFAULT_INTERVAL_MS): Throttler<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending = false;
  let pendingValue: T;
  let last = 0;

  const fire = (value: T): void => { last = Date.now(); emit(value); };

  const schedule = (): void => {
    if (timer) return;
    const wait = Math.max(0, intervalMs - (Date.now() - last));
    timer = setTimeout(() => {
      timer = null;
      if (pending) { pending = false; fire(pendingValue); }
    }, wait);
  };

  return {
    push(value: T): void {
      if (Date.now() - last >= intervalMs && !timer) { fire(value); return; }   // leading edge
      pending = true; pendingValue = value; schedule();                         // coalesce → trailing
    },
    flush(): void {
      if (timer) { clearTimeout(timer); timer = null; }
      if (pending) { pending = false; fire(pendingValue); }
    },
    cancel(): void {
      if (timer) { clearTimeout(timer); timer = null; }
      pending = false;
    },
  };
}
