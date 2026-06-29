// src/ui/timers — a per-editor lifecycle bag for intervals / rAF / listeners.
//
// The legacy core.js kept a single module-global `timers[]` cleared on overlay
// close. Here each editor render gets its own Disposer (passed via context),
// so animated widgets register their interval and the host disposes them all on
// close — no shared mutable global.

export interface Disposer {
  /** Register an interval id (returns it for convenience). */
  interval(fn: () => void, ms: number): number;
  /** Register a requestAnimationFrame loop; returns a stop function. */
  raf(frame: () => void): () => void;
  /** Register an arbitrary teardown callback. */
  add(teardown: () => void): void;
  /** Run and clear every registered teardown. */
  dispose(): void;
}

export function makeDisposer(): Disposer {
  const teardowns: Array<() => void> = [];
  return {
    interval(fn, ms) {
      const id = setInterval(fn, ms) as unknown as number;
      teardowns.push(() => clearInterval(id));
      return id;
    },
    raf(frame) {
      let running = true;
      let handle = 0;
      const tick = (): void => {
        if (!running) return;
        frame();
        handle = requestAnimationFrame(tick);
      };
      handle = requestAnimationFrame(tick);
      const stop = (): void => {
        running = false;
        cancelAnimationFrame(handle);
      };
      teardowns.push(stop);
      return stop;
    },
    add(teardown) {
      teardowns.push(teardown);
    },
    dispose() {
      for (const t of teardowns.splice(0)) {
        try {
          t();
        } catch {
          /* a failing teardown must not block the rest */
        }
      }
    },
  };
}
