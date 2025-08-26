/**
 * Adaptive subdivision search runner (TASK 5)
 *
 * - Implements an adaptive test-area sync that processes primary grid points and
 *   creates subdivisions when a Places search appears to hit the API limit.
 *
 * Exports:
 * - type AdaptiveSearchResult
 * - type AdaptiveSearchSummary
 * - async function runAdaptiveTestSync(options?)
 *
 * Heuristics / comments:
 * - Default subdivision offsetKm = 1 and radius = 1000m (matching generateSubdivisionPoints).
 * - Default maxDepth = 4 to avoid runaway recursion in pathological cases.
 * - We conservatively subdivide when nearbySearchWithPagination returns hitLimit === true
 *   or when the task's resultCount >= 60 (Places page upper-bound).
 *
 * Logging follows the project's existing conventions but uses explicit messages required
 * by the task prompt (e.g., "AdaptiveSearch: processed ...", "Adaptive sync aborted: ...").
 *
 * Note: This file intentionally does not perform cross-task deduplication; it only
 * deduplicates places within a task by place id when available.
 */

import { generateGrid, type GridPoint } from "./grid";
import {
  nearbySearchWithPagination,
  type NearbySearchResult,
  generateSubdivisionPoints,
} from "./density";

/* Exported types */
export type AdaptiveSearchResult = {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  level: number;
  parentId?: string | null;
  places: any[]; // places returned for this task (deduped within the task)
  resultCount: number; // places.length
  apiCalls: number; // apiCalls consumed for this task
  subdivided?: boolean;
};

export type AdaptiveSearchSummary = {
  totalAreasSearched: number;
  totalPlaces: number;
  apiCalls: number;
  subdivisions: number;
  aborted: boolean;
  results: AdaptiveSearchResult[];
};

type RunOptions = {
  maxApiCalls?: number; // safety cap for whole run
  rateLimitMs?: number; // ms to wait between starting successive tasks
  maxDepth?: number; // maximum subdivision depth
  debugLog?: boolean; // whether to log debug messages (default true)
  abortSignal?: AbortSignal; // optional abort signal
};

/**
 * runAdaptiveTestSync
 *
 * Process a FIFO queue of grid/search tasks starting from generateGrid('test').
 * Subdivide a task into 4 children when a search appears to have hit the Places API limit.
 *
 * Default options:
 * - maxApiCalls = 50
 * - rateLimitMs = 1000
 * - maxDepth = 4
 * - debugLog = true
 */
export async function runAdaptiveTestSync(options?: RunOptions): Promise<AdaptiveSearchSummary> {
  const {
    maxApiCalls = 50,
    rateLimitMs = 1000,
    maxDepth = 4,
    debugLog = true,
    abortSignal,
  } = options ?? {};

  // FIFO queue of pending tasks (GridPoint-like objects). parentId may be added later.
  const initialPoints = generateGrid("test");
  // Clone and extend with parentId (null)
  const queue: (GridPoint & { parentId?: string | null })[] = initialPoints.map((p) => ({
    ...p,
    parentId: null,
  }));

  const results: AdaptiveSearchResult[] = [];
  let totalApiCalls = 0;
  let subdivisionsCount = 0;
  let totalPlaces = 0;
  let aborted = false;
  let processedCount = 0;

  // Helper sleep that honors abortSignal
  const sleep = (ms: number) =>
    new Promise<void>((resolve, reject) => {
      if (abortSignal?.aborted) return reject(new Error("Aborted"));
      const t = setTimeout(() => {
        clearTimeout(t);
        resolve();
      }, ms);
      if (abortSignal) {
        abortSignal.addEventListener(
          "abort",
          () => {
            clearTimeout(t);
            reject(new Error("Aborted"));
          },
          { once: true }
        );
      }
    });

  // Process tasks until queue empty or abort condition
  while (queue.length > 0) {
    // Honor abortSignal and api call safety before starting the next task
    if (abortSignal?.aborted) {
      console.log("Adaptive sync aborted: abortSignal triggered");
      aborted = true;
      break;
    }
    if (totalApiCalls > maxApiCalls) {
      console.error(
        `Adaptive sync aborted: exceeded maxApiCalls (used ${totalApiCalls} of limit ${maxApiCalls})`
      );
      aborted = true;
      break;
    }

    const task = queue.shift()!;
    // Rate-limit between starting successive tasks
    if (processedCount > 0 && rateLimitMs > 0) {
      try {
        await sleep(rateLimitMs);
      } catch {
        console.log("Adaptive sync aborted: abortSignal triggered");
        aborted = true;
        break;
      }
      // honor abortSignal again after sleep
      if (abortSignal?.aborted) {
        console.log("Adaptive sync aborted: abortSignal triggered");
        aborted = true;
        break;
      }
      if (totalApiCalls > maxApiCalls) {
        console.error(
          `Adaptive sync aborted: exceeded maxApiCalls (used ${totalApiCalls} of limit ${maxApiCalls})`
        );
        aborted = true;
        break;
      }
    }

    // Execute the nearby search for this task
    let nearbyRes: NearbySearchResult | null = null;
    let apiCallsForThisTask = 0;
    let taskPlaces: any[] = [];
    try {
      nearbyRes = await nearbySearchWithPagination({
        lat: task.lat,
        lng: task.lng,
        radius: task.radius,
        keyword: "coffee",
      });
      apiCallsForThisTask = nearbyRes.apiCalls ?? 0;
      totalApiCalls += apiCallsForThisTask;

      // Deduplicate within-task by normalized id (prefer place_id/id)
      const dedupe = new Map<string, any>();
      const pagePlaces = nearbyRes.places ?? [];
      for (const p of pagePlaces) {
        const pid = (p.place_id as string) ?? (p.placeId as string) ?? (p.id as string) ?? null;
        const key = pid ?? JSON.stringify({ lat: p.location?.lat ?? p.geometry?.location?.lat, lng: p.location?.lng ?? p.geometry?.location?.lng, name: p.name ?? "" });
        if (!dedupe.has(key)) dedupe.set(key, p);
      }
      taskPlaces = Array.from(dedupe.values());
    } catch (err) {
      // Per-task errors are non-fatal; record zero places for this task and continue.
      console.error("[adaptive-search] Error during nearbySearchWithPagination for", task.id, err);
      nearbyRes = null;
      apiCallsForThisTask = 0;
      // Note: do not increment totalApiCalls further here
      taskPlaces = [];
    }

    const resultCount = taskPlaces.length;
    const thisResult: AdaptiveSearchResult = {
      id: task.id,
      lat: task.lat,
      lng: task.lng,
      radius: task.radius,
      level: task.level,
      parentId: task.parentId ?? null,
      places: taskPlaces,
      resultCount,
      apiCalls: apiCallsForThisTask,
      subdivided: false,
    };

    // Decide whether to subdivide:
    const hitLimit = nearbyRes?.hitLimit ?? false;
    // Conservative: also subdivide if resultCount >= 60 (Places API known upper-bound)
    const reachedBound = resultCount >= 60;

    if ((hitLimit || reachedBound) && task.level < maxDepth) {
      // Generate 4 subdivisions using helper
      try {
        const subs = generateSubdivisionPoints(task, { offsetKm: 1, radius: 1000 });
        for (const s of subs) {
          // Attach parentId and push to queue for future processing
          (s as GridPoint & { parentId?: string | null }).parentId = task.id;
          queue.push(s as GridPoint & { parentId?: string | null });
        }
        thisResult.subdivided = true;
        subdivisionsCount += subs.length;
        console.log(`AdaptiveSearch: created 4 subdivisions for ${task.id} at level ${task.level + 1}`);
      } catch (err) {
        console.error("[adaptive-search] Error generating subdivisions for", task.id, err);
      }
    } else if ((hitLimit || reachedBound) && task.level >= maxDepth) {
      // Max depth reached; log and do not subdivide
      console.log(`Max subdivision depth reached for ${task.id}`);
    }

    // Log the processed task message
    console.log(
      `AdaptiveSearch: processed ${task.id} (level ${task.level}) — ${resultCount} places — apiCalls=${apiCallsForThisTask}${
        thisResult.subdivided ? " — subdivided" : ""
      }`
    );

    // Save result and update counters
    results.push(thisResult);
    totalPlaces += resultCount;
    processedCount += 1;

    // Check API safety after processing task: if exceeded, abort immediately
    if (totalApiCalls > maxApiCalls) {
      console.error(
        `Adaptive sync aborted: exceeded maxApiCalls (used ${totalApiCalls} of limit ${maxApiCalls})`
      );
      aborted = true;
      break;
    }

    // Honor abortSignal once more at loop end
    if (abortSignal?.aborted) {
      console.log("Adaptive sync aborted: abortSignal triggered");
      aborted = true;
      break;
    }
  } // end while

  const summary: AdaptiveSearchSummary = {
    totalAreasSearched: processedCount,
    totalPlaces,
    apiCalls: totalApiCalls,
    subdivisions: subdivisionsCount,
    aborted,
    results,
  };

  console.log(
    `Adaptive sync complete: ${summary.totalAreasSearched} areas searched, ${summary.totalPlaces} places found, ${summary.apiCalls} API calls used${
      summary.aborted ? " — aborted" : ""
    }`
  );

  return summary;
}

/* End of adaptive-search.ts */