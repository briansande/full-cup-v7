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
 * Enhanced with comprehensive coffee shop filtering system:
 * - Uses multi-layer filtering: chains, keywords, types, and quality validation
 * - Applies Houston area geographic validation
 * - Provides detailed filtering statistics for monitoring
 * - Maintains compatibility with existing API but with vastly improved results
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
import { progress } from "./progress";
import { upsertShopsBatch } from "./db-integration";
import type { NearbyPlace } from "./density";
import { applyCoffeeShopFilters } from "./coffee-filtering";

// Helper to normalize lat/lng across v1 and legacy shapes
function extractLatLng(p: NearbyPlace): { lat?: number; lng?: number } {
  const loc: unknown = p.location;
  let lat: number | undefined;
  let lng: number | undefined;

  // v1: { location: { latitude, longitude } }
  if (loc && typeof loc === "object" && "latitude" in (loc as Record<string, unknown>)) {
    lat = (loc as { latitude?: number }).latitude;
  }
  if (loc && typeof loc === "object" && "longitude" in (loc as Record<string, unknown>)) {
    lng = (loc as { longitude?: number }).longitude;
  }

  // legacy-ish: { location: { lat, lng } }
  if (lat === undefined && loc && typeof loc === "object" && "lat" in (loc as Record<string, unknown>)) {
    lat = (loc as { lat?: number }).lat;
  }
  if (lng === undefined && loc && typeof loc === "object" && "lng" in (loc as Record<string, unknown>)) {
    lng = (loc as { lng?: number }).lng;
  }

  // fallback: geometry.location.{lat,lng}
  if (lat === undefined) lat = p.geometry?.location?.lat;
  if (lng === undefined) lng = p.geometry?.location?.lng;

  return { lat, lng };
}

/* Exported types */
export type AdaptiveSearchResult = {
  id: string;
  lat: number;
  lng: number;
  radius: number;
  level: number;
  parentId?: string | null;
  places: NearbyPlace[]; // places returned for this task (deduped within the task and filtered)
  resultCount: number; // places.length after filtering
  apiCalls: number; // apiCalls consumed for this task
  subdivided?: boolean;
  filterStats?: {
    original: number;
    afterChainFilter: number;
    afterKeywordFilter: number;
    afterTypeFilter: number;
    afterQualityFilter: number;
    final: number;
  };
};

export type AdaptiveSearchSummary = {
  totalAreasSearched: number;
  totalPlaces: number;
  apiCalls: number;
  subdivisions: number;
  aborted: boolean;
  results: AdaptiveSearchResult[];
  totalFilterStats?: {
    original: number;
    afterChainFilter: number;
    afterKeywordFilter: number;
    afterTypeFilter: number;
    afterQualityFilter: number;
    final: number;
  };
};

type RunOptions = {
  maxApiCalls?: number; // safety cap for whole run
  rateLimitMs?: number; // ms to wait between starting successive tasks
  maxDepth?: number; // maximum subdivision depth
  debugLog?: boolean; // whether to log debug messages (default true)
  abortSignal?: AbortSignal; // optional abort signal
  enableFiltering?: boolean; // enable comprehensive filtering system (default true)
};

/**
 * runAdaptiveTestSync
 *
 * Process a FIFO queue of grid/search tasks starting from generateGrid('test').
 * Subdivide a task into 4 children when a search appears to have hit the Places API limit.
 *
 * Enhanced with comprehensive filtering system that applies multiple layers of validation
 * to ensure only legitimate coffee shops are included in results.
 *
 * Default options:
 * - maxApiCalls = 50
 * - rateLimitMs = 1000
 * - maxDepth = 4
 * - debugLog = true
 * - enableFiltering = true
 */
export async function runAdaptiveTestSync(options?: RunOptions): Promise<AdaptiveSearchSummary> {
  const {
    maxApiCalls = 50,
    rateLimitMs = 1000,
    maxDepth = 4,
    debugLog = true,
    abortSignal,
    enableFiltering = true,
  } = options ?? {};

  // FIFO queue of pending tasks (GridPoint-like objects). parentId may be added later.
  const initialPoints = generateGrid("test");
  // Clone and extend with parentId (null)
  const queue: (GridPoint & { parentId?: string | null })[] = initialPoints.map((p) => ({
    ...p,
    parentId: null,
  }));

  // Emit start so UIs can initialize progress state. Use the initial primary count as an estimate.
  try {
    progress.emit({ type: "start", totalEstimatedSearches: initialPoints.length, mode: "test" });
  } catch (e) {
    console.error("[adaptive-search] progress emit failed:", e);
  }

  const results: AdaptiveSearchResult[] = [];
  let totalApiCalls = 0;
  let subdivisionsCount = 0;
  let totalPlaces = 0;
  let aborted = false;
  let processedCount = 0;

  // Cumulative filtering statistics
  const totalFilterStats = {
    original: 0,
    afterChainFilter: 0,
    afterKeywordFilter: 0,
    afterTypeFilter: 0,
    afterQualityFilter: 0,
    final: 0,
  };

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
    // Notify progress subscribers that this search is starting.
    try {
      progress.emit({
        type: "search-start",
        id: task.id,
        level: task.level,
        lat: task.lat,
        lng: task.lng,
        radius: task.radius,
      });
    } catch (e) {
      console.error("[adaptive-search] progress emit failed:", e);
    }

    let nearbyRes: NearbySearchResult | null = null;
    let apiCallsForThisTask = 0;
    let taskPlaces: NearbyPlace[] = [];
    let filterStats = undefined;
    // Count of deduplicated places returned by the API before applying our keyword/type/quality filters.
    // Declared in outer scope so subdivision decision logic (outside the try/catch) can reference it.
    let preFilterCount = 0;
    
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
      const dedupe = new Map<string, NearbyPlace>();
      const pagePlaces = nearbyRes.places ?? [];
      for (const p of pagePlaces) {
        const pid = p.place_id ?? p.placeId ?? p.id ?? p.name ?? null;
        const coords = extractLatLng(p);
        const displayName = (typeof p.name === "string" ? p.name : p.displayName?.text) ?? "";
        const key = pid ?? JSON.stringify({
          lat: coords.lat ?? "",
          lng: coords.lng ?? "",
          name: displayName
        });
        if (!dedupe.has(key)) dedupe.set(key, p);
      }
      
      const deduplicatedPlaces = Array.from(dedupe.values());
      // Set pre-filter count (deduplicated) so we can decide to subdivide based on
      // how many unique items the API returned before filtering.
      preFilterCount = deduplicatedPlaces.length;

      // Apply comprehensive filtering system
      if (enableFiltering && deduplicatedPlaces.length > 0) {
        const filterResult = applyCoffeeShopFilters(deduplicatedPlaces);
        taskPlaces = filterResult.filtered;
        filterStats = filterResult.stats;
        
        // Update cumulative stats
        totalFilterStats.original += filterStats.original;
        totalFilterStats.afterChainFilter += filterStats.afterChainFilter;
        totalFilterStats.afterKeywordFilter += filterStats.afterKeywordFilter;
        totalFilterStats.afterTypeFilter += filterStats.afterTypeFilter;
        totalFilterStats.afterQualityFilter += filterStats.afterQualityFilter;
        totalFilterStats.final += filterStats.final;

        if (debugLog) {
          console.log(`[adaptive-search] ${task.id} filtering results:`);
          console.log(`  Original: ${filterStats.original}`);
          console.log(`  After chain filter: ${filterStats.afterChainFilter} (${filterStats.original - filterStats.afterChainFilter} removed)`);
          console.log(`  After keyword filter: ${filterStats.afterKeywordFilter} (${filterStats.afterChainFilter - filterStats.afterKeywordFilter} removed)`);
          console.log(`  After type filter: ${filterStats.afterTypeFilter} (${filterStats.afterKeywordFilter - filterStats.afterTypeFilter} removed)`);
          console.log(`  After quality filter: ${filterStats.afterQualityFilter} (${filterStats.afterTypeFilter - filterStats.afterQualityFilter} removed)`);
          console.log(`  Final: ${filterStats.final} (${Math.round((filterStats.final/filterStats.original)*100)}% passed)`);
        }
      } else {
        taskPlaces = deduplicatedPlaces;
        if (!enableFiltering && debugLog) {
          console.log(`[adaptive-search] ${task.id} filtering disabled - using all ${taskPlaces.length} results`);
        }
      }

      // Persist task results to DB (test and production parity)
      try {
        const batchItems = taskPlaces.map((pl) => ({
          place: pl,
          sourceGridId: task.id,
          gridRadius: task.radius,
          searchLevel: task.level,
        }));
        if (batchItems.length > 0) {
          const { inserted, updated } = await upsertShopsBatch(batchItems);
          console.info(`[adaptive-search] DB upsert for ${task.id}: inserted=${inserted} updated=${updated}`);
        }
      } catch (e) {
        console.error(`[adaptive-search] DB upsert failed for ${task.id}:`, e);
      }
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
      filterStats,
    };

    // Decide whether to subdivide:
    const rawCount = nearbyRes?.rawCount ?? (nearbyRes?.places?.length ?? 0);
    // Prefer raw API response count to detect truncation (searchNearby maxResultCount = 20).
    // Also consider the pre-filter (deduplicated) count and original filter count so that
    // filtering does not prevent subdivision when the API returned a full page.
    const hitLimit = nearbyRes?.hitLimit ?? rawCount >= 20;
    // reachedBound when ANY of:
    //  - raw API returned the page size (rawCount >= 20)
    //  - the deduplicated pre-filter count is >= 20
    //  - when filtering is enabled and we have stats, the original (pre-filter) count >= 20
    const reachedBound =
      rawCount >= 20 ||
      preFilterCount >= 20 ||
      (enableFiltering && filterStats ? (filterStats.original ?? 0) >= 20 : false);
    if (debugLog) {
      console.log(
        `[adaptive-search] ${task.id} counts: raw=${rawCount}, preFilter=${preFilterCount}, filtered=${resultCount}, hitLimit=${hitLimit}, reachedBound=${reachedBound}`
      );
    }

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

        // Notify progress subscribers that subdivisions were created (children IDs available)
        try {
          const childIds = subs.map((c) => c.id);
          progress.emit({ type: "subdivision-created", parentId: task.id, children: childIds });
        } catch (e) {
          console.error("[adaptive-search] progress emit failed:", e);
        }
      } catch (err) {
        console.error("[adaptive-search] Error generating subdivisions for", task.id, err);
      }
    } else if ((hitLimit || reachedBound) && task.level >= maxDepth) {
      // Max depth reached; log and do not subdivide
      console.log(`Max subdivision depth reached for ${task.id}`);
    }

    // Log the processed task message with filtering information
    const filteringInfo = enableFiltering && filterStats ? 
      ` — filtered ${filterStats.original} → ${filterStats.final}` : "";
    console.log(
      `AdaptiveSearch: processed ${task.id} (level ${task.level}) — ${resultCount} places — apiCalls=${apiCallsForThisTask}${filteringInfo}${
        thisResult.subdivided ? " — subdivided" : ""
      }`
    );

    // Emit search-complete so UI can update progress; include subdivided flag if subdivisions were generated.
    try {
      progress.emit({
        type: "search-complete",
        id: thisResult.id,
        level: thisResult.level,
        resultCount: thisResult.resultCount,
        apiCalls: thisResult.apiCalls,
        subdivided: !!thisResult.subdivided,
      });
    } catch (e) {
      console.error("[adaptive-search] progress emit failed:", e);
    }

    // Save result and update counters
    results.push(thisResult);
    totalPlaces += resultCount;
    processedCount += 1;

    // Check API safety after processing task: if exceeded, abort immediately
    if (totalApiCalls > maxApiCalls) {
      console.error(
        `Adaptive sync aborted: exceeded maxApiCalls (used ${totalApiCalls} of limit ${maxApiCalls})`
      );
      // Emit abort for UI consumers
      try {
        progress.emit({ type: "abort", reason: "exceeded maxApiCalls" });
      } catch (e) {
        console.error("[adaptive-search] progress emit failed:", e);
      }
      aborted = true;
      break;
    }

    // Honor abortSignal once more at loop end
    if (abortSignal?.aborted) {
      console.log("Adaptive sync aborted: abortSignal triggered");
      try {
        progress.emit({ type: "abort", reason: "abortSignal triggered (end-of-loop)" });
      } catch (e) {
        console.error("[adaptive-search] progress emit failed:", e);
      }
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
    totalFilterStats: enableFiltering ? totalFilterStats : undefined,
  };

  // Emit final completion (or aborted) summary for UI consumers
  try {
    progress.emit({
      type: "complete",
      totalAreasSearched: summary.totalAreasSearched,
      totalPlaces: summary.totalPlaces,
      apiCalls: summary.apiCalls,
      subdivisions: summary.subdivisions,
      aborted: summary.aborted,
    });
  } catch (e) {
    console.error("[adaptive-search] progress emit failed:", e);
  }
  
  // Enhanced completion logging with filtering statistics
  if (enableFiltering && totalFilterStats.original > 0) {
    const filteringEfficiency = Math.round((totalFilterStats.final / totalFilterStats.original) * 100);
    console.log(
      `Adaptive sync complete: ${summary.totalAreasSearched} areas searched, ${summary.totalPlaces} places found, ${summary.apiCalls} API calls used${
        summary.aborted ? " — aborted" : ""
      }`
    );
    console.log(`Filtering efficiency: ${totalFilterStats.original} → ${totalFilterStats.final} (${filteringEfficiency}% passed)`);
    console.log("Filtering breakdown:");
    console.log(`  Chain filter removed: ${totalFilterStats.original - totalFilterStats.afterChainFilter}`);
    console.log(`  Keyword filter removed: ${totalFilterStats.afterChainFilter - totalFilterStats.afterKeywordFilter}`);
    console.log(`  Type filter removed: ${totalFilterStats.afterKeywordFilter - totalFilterStats.afterTypeFilter}`);
    console.log(`  Quality filter removed: ${totalFilterStats.afterTypeFilter - totalFilterStats.afterQualityFilter}`);
  } else {
    console.log(
      `Adaptive sync complete: ${summary.totalAreasSearched} areas searched, ${summary.totalPlaces} places found, ${summary.apiCalls} API calls used${
        summary.aborted ? " — aborted" : ""
      }${!enableFiltering ? " (filtering disabled)" : ""}`
    );
  }
  
  return summary;
}

/* End of adaptive-search.ts */