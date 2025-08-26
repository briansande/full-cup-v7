/**
 * progress.ts
 *
 * Lightweight in-process progress/event tracker for sync runners (test-area flows).
 *
 * - Provides a deterministic, singleton, event-emitter style API that runners can
 *   emit to and React components can subscribe to for live updates during development.
 * - No external services, no DOM/window side-effects. Works both in Node and client
 *   (subscribers in React should import the singleton from this module).
 *
 * Usage:
 *   import { progress, type ProgressEvent } from "full-cup/src/lib/progress";
 *   const unsubscribe = progress.subscribe((ev) => { console.log(ev); });
 *   unsubscribe();
 *
 * Thread/context assumptions:
 * - This module is a simple in-memory singleton. It is safe within a single Node
 *   process / browser tab. Do NOT rely on it for cross-process synchronization.
 * - Runners (grid/adaptive) may emit events synchronously after each step so UIs
 *   can update promptly. React components must subscribe on the client (e.g. inside
 *   useEffect that runs only when window is defined).
 */

export type ProgressEvent =
  | { type: "start"; totalEstimatedSearches?: number; mode?: "test" | "production" }
  | { type: "search-start"; id: string; level: number; lat: number; lng: number; radius: number }
  | {
      type: "search-complete";
      id: string;
      level: number;
      resultCount: number;
      apiCalls: number;
      subdivided?: boolean;
    }
  | { type: "subdivision-created"; parentId: string; children: string[] }
  | { type: "abort"; reason: string }
  | {
      type: "complete";
      totalAreasSearched: number;
      totalPlaces: number;
      apiCalls: number;
      subdivisions: number;
      aborted: boolean;
    };

/**
 * Snapshot summary shape returned by getSnapshot()
 */
export type ProgressSnapshot = {
  events: ProgressEvent[]; // recent events (circular buffer, newest last)
  latestSummary?: {
    totalAreasSearched: number;
    totalPlaces: number;
    apiCalls: number;
    subdivisions: number;
    aborted: boolean;
  };
};

/**
 * ProgressTracker
 *
 * - subscribe(fn): registers a callback and immediately replays recent events (sync).
 *   Returns an unsubscribe function that is idempotent and safe to call multiple times.
 * - emit(ev): synchronously notifies subscribers and stores event in a fixed-size
 *   circular buffer (default 200 entries) so late subscribers can catch up.
 * - getSnapshot(): returns a copy of the recent events and an optional latestSummary
 *   derived from emitted events.
 * - reset(): clears buffer, counters and latestSummary. Does NOT remove subscribers.
 */
export class ProgressTracker {
  private subscribers: Set<(ev: ProgressEvent) => void> = new Set();
  private buffer: ProgressEvent[] = [];
  private readonly maxBuffer = 200;

  // Running aggregates to make getSnapshot() cheap and deterministic.
  private totalAreasSearched = 0;
  private totalPlaces = 0;
  private apiCalls = 0;
  private subdivisions = 0;
  private aborted = false;

  // latestSummary is updated when a 'complete' or 'abort' event arrives OR built progressively.
  private latestSummary?: {
    totalAreasSearched: number;
    totalPlaces: number;
    apiCalls: number;
    subdivisions: number;
    aborted: boolean;
  };

  constructor() {}

  /**
   * Subscribe to progress events.
   * Immediately replays recent events (in chronological order) synchronously.
   * Returns an idempotent unsubscribe function.
   */
  subscribe(fn: (ev: ProgressEvent) => void): () => void {
    if (!fn || typeof fn !== "function") {
      // Defensive: do not register invalid callbacks.
      return () => {};
    }

    this.subscribers.add(fn);

    // Replay recent events synchronously so client state can initialize.
    // Provide a shallow copy to prevent mutation by subscribers.
    for (const ev of [...this.buffer]) {
      try {
        fn(ev);
      } catch (err) {
        // Subscriber errors should not break the tracker.
        // Keep behavior consistent with other logging in project.
        // eslint-disable-next-line no-console
        console.error("[progress] subscriber threw during replay:", err);
      }
    }

    let unsubbed = false;
    return () => {
      if (unsubbed) return;
      unsubbed = true;
      this.subscribers.delete(fn);
    };
  }

  /**
   * Emit a ProgressEvent to all subscribers and store it in the recent buffer.
   * Synchronous by design so UIs update promptly after runner steps.
   */
  emit(ev: ProgressEvent): void {
    // Update internal aggregates for efficient snapshots.
    this.updateAggregates(ev);

    // Push into circular buffer
    this.buffer.push(ev);
    if (this.buffer.length > this.maxBuffer) {
      // drop oldest
      this.buffer.shift();
    }

    // Notify subscribers synchronously
    for (const fn of Array.from(this.subscribers)) {
      try {
        fn(ev);
      } catch (err) {
        // Subscriber exceptions are isolated and logged.
        // eslint-disable-next-line no-console
        console.error("[progress] subscriber threw:", err);
      }
    }
  }

  /**
   * Returns a snapshot copy of recent events and a latestSummary if available.
   * Callers should treat returned arrays as read-only.
   */
  getSnapshot(): ProgressSnapshot {
    // If a 'complete' event was emitted, prefer that explicit summary.
    if (this.latestSummary) {
      return {
        events: [...this.buffer],
        latestSummary: { ...this.latestSummary },
      };
    }

    // Otherwise build a summary from running aggregates.
    return {
      events: [...this.buffer],
      latestSummary: {
        totalAreasSearched: this.totalAreasSearched,
        totalPlaces: this.totalPlaces,
        apiCalls: this.apiCalls,
        subdivisions: this.subdivisions,
        aborted: this.aborted,
      },
    };
  }

  /**
   * Reset tracker state. Does NOT remove existing subscribers.
   */
  reset(): void {
    this.buffer = [];
    this.totalAreasSearched = 0;
    this.totalPlaces = 0;
    this.apiCalls = 0;
    this.subdivisions = 0;
    this.aborted = false;
    this.latestSummary = undefined;
  }

  /**
   * Internal: update aggregates and latestSummary when specific event types are emitted.
   */
  private updateAggregates(ev: ProgressEvent) {
    switch (ev.type) {
      case "search-complete":
        this.totalAreasSearched += 1;
        this.totalPlaces += ev.resultCount ?? 0;
        this.apiCalls += ev.apiCalls ?? 0;
        if (ev.subdivided) {
          // subdivisions created will also be signaled by subdivision-created events;
          // incrementing here conservatively records that the completed search requested subdivisions.
          this.subdivisions += 1;
        }
        break;
      case "subdivision-created":
        // children length is a reliable count of subdivisions created
        this.subdivisions += ev.children.length;
        break;
      case "abort":
        this.aborted = true;
        // store a summary reflecting current aggregates and aborted flag
        this.latestSummary = {
          totalAreasSearched: this.totalAreasSearched,
          totalPlaces: this.totalPlaces,
          apiCalls: this.apiCalls,
          subdivisions: this.subdivisions,
          aborted: true,
        };
        break;
      case "complete":
        // override aggregates with authoritative values from the runner
        this.latestSummary = {
          totalAreasSearched: ev.totalAreasSearched,
          totalPlaces: ev.totalPlaces,
          apiCalls: ev.apiCalls,
          subdivisions: ev.subdivisions,
          aborted: ev.aborted,
        };
        // also reflect in running counters
        this.totalAreasSearched = ev.totalAreasSearched;
        this.totalPlaces = ev.totalPlaces;
        this.apiCalls = ev.apiCalls;
        this.subdivisions = ev.subdivisions;
        this.aborted = ev.aborted;
        break;
      case "start":
        // start doesn't change aggregates but clear aborted flag for a fresh run
        this.aborted = false;
        // do not reset aggregates here; callers may call reset() explicitly if desired.
        break;
      default:
        break;
    }
  }
}

/**
 * Module-level singleton for in-process progress tracking.
 * Import this in runners and UI components:
 *   import { progress } from 'full-cup/src/lib/progress';
 */
export const progress = new ProgressTracker();