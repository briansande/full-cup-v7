/**
 * grid-search.ts - Test area sync runner (test-only)
 *
 * Implements TASK 4: Basic Grid Search Implementation
 *
 * Notes:
 * - Generates the 2x3 test grid via generateGrid('test')
 * - Uses nearbySearchWithPagination from density.ts which handles pagination internally
 * - Rate-limits 1s (configurable) between top-level grid searches (not between pages)
 * - Filters out major chains by simple case-insensitive substring heuristics
 * - Aborts immediately if cumulative API calls exceed safety limit
 * - Returns an in-memory summary object with per-grid and global stats
 */

import { generateGrid, type GridPoint } from "./grid";
import { nearbySearchWithPagination, type NearbySearchResult, type NearbyPlace } from "./density";
import { progress } from "@/src/lib/progress";

import { upsertShopsBatch } from "./db-integration";
export type GridSearchResult = {
  gridId: string;
  lat: number;
  lng: number;
  radius: number;
  resultCount: number;
  apiCalls: number;
  places: NearbyPlace[];
};

export type GridSearchSummary = {
  searchesRun: number;
  totalPlaces: number;
  apiCalls: number;
  aborted: boolean;
  perGrid: GridSearchResult[];
};

type RunOptions = {
  maxApiCalls?: number;
  rateLimitMs?: number;
  filterChains?: string[];
  abortSignal?: AbortSignal;
};

/**
 * runTestAreaSync
 *
 * - options.maxApiCalls: safety limit for total API calls (default 25)
 * - options.rateLimitMs: ms to wait between top-level grid searches (default 1000)
 * - options.filterChains: case-insensitive substrings to filter out (major chains)
 * - options.abortSignal: optional AbortSignal for UI-driven aborts (honored between waits and before searches)
 *
 * Heuristics/comments:
 * - Chain filter uses simple case-insensitive substring matching against place.name or place.displayName.
 * - Rate-limiting is applied only between starting each grid point's top-level search
 *   (density helper handles internal page delays and counts).
 */
export async function runTestAreaSync(options?: RunOptions): Promise<GridSearchSummary> {
  const {
    maxApiCalls = 25,
    rateLimitMs = 1000,
    filterChains = [
      "starbucks",
      "dunkin",
      "dunkin donuts",
      "peet",
      "tim hortons",
      "cafe rio",
      "mcdonald",
      "mcafe",
      "caribou",
    ],
    abortSignal,
  } = options ?? {};

  // Normalize chain patterns for case-insensitive matching
  const chainPatterns = filterChains.map((s) => s.toLowerCase());
  
  const points = generateGrid("test");
  const perGrid: GridSearchResult[] = [];

  // Emit a start event so the UI can initialize progress state.
  // totalEstimatedSearches is the initial count of primary points; consumers may treat this as an estimate.
  try {
    progress.emit({ type: "start", totalEstimatedSearches: points.length, mode: "test" });
  } catch (e) {
    console.error("[grid-search] progress emit failed:", e);
  }

  let totalApiCalls = 0;
  let totalPlaces = 0;
  let searchesRun = 0;
  let aborted = false;

  // Helper: sleep with abortSignal support
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

  for (const p of points) {
    // Honor abortSignal before starting each point
    if (abortSignal?.aborted) {
      console.log(`[grid-search] Abort requested before starting grid ${p.id}`);
      try {
        progress.emit({ type: "abort", reason: "abortSignal triggered before starting next grid" });
      } catch (e) {
        console.error("[grid-search] progress emit failed:", e);
      }
      aborted = true;
      break;
    }

    try {
      // Rate-limit between top-level grid searches (not between pagination pages)
      if (searchesRun > 0) {
        try {
          await sleep(rateLimitMs);
        } catch {
          console.log("[grid-search] Abort signal received during rate limit wait");
          aborted = true;
          break;
        }
      }

      // Notify subscribers we're starting this point's search
      try {
        progress.emit({
          type: "search-start",
          id: p.id,
          level: p.level,
          lat: p.lat,
          lng: p.lng,
          radius: p.radius,
        });
      } catch (e) {
        console.error("[grid-search] progress emit failed:", e);
      }

      // Perform nearby search with pagination (density helper aggregates pages)
      const res: NearbySearchResult = await nearbySearchWithPagination({
        lat: p.lat,
        lng: p.lng,
        radius: p.radius,
        keyword: "coffee",
      });

      totalApiCalls += res.apiCalls;

      // Abort check: if we've exceeded the configured safety limit, abort immediately
      if (totalApiCalls > maxApiCalls) {
        aborted = true;
        console.error(
          `Test sync aborted: exceeded maxApiCalls (used ${totalApiCalls} of limit ${maxApiCalls})`
        );
  
        // Still include filtered results for this grid point (post-filter)
        const filteredPlaces = (res.places ?? []).filter((pl) => {
          const name = (pl.name ?? pl.displayName ?? "").toString().toLowerCase();
          return !chainPatterns.some((pat) => name.includes(pat));
        });
  
        perGrid.push({
          gridId: p.id,
          lat: p.lat,
          lng: p.lng,
          radius: p.radius,
          resultCount: filteredPlaces.length,
          apiCalls: res.apiCalls,
          places: filteredPlaces,
        });
  
        totalPlaces += filteredPlaces.length;
        searchesRun += 1;

        // Emit search-complete for this point (we processed it but then aborted due to safety limits)
        try {
          progress.emit({
            type: "search-complete",
            id: p.id,
            level: p.level,
            resultCount: filteredPlaces.length,
            apiCalls: res.apiCalls,
            subdivided: false,
          });
        } catch (e) {
          console.error("[grid-search] progress emit failed:", e);
        }

        break;
      }

      // Filter out major chains by name heuristics (case-insensitive substring)
      const places = (res.places ?? []).filter((pl) => {
        const rawName = (pl.name ?? pl.displayName ?? "").toString();
        const name = rawName.toLowerCase();
        return !chainPatterns.some((pat) => name.includes(pat));
      });

// Persist filtered results to DB for this grid point
try {
  const batchItems = places.map((pl) => ({
    place: pl,
    sourceGridId: p.id,
    gridRadius: p.radius,
    searchLevel: p.level,
  }));
  if (batchItems.length > 0) {
    const { inserted, updated } = await upsertShopsBatch(batchItems);
    console.info(`[grid-search] DB upsert for ${p.id}: inserted=${inserted} updated=${updated}`);
  }
} catch (e) {
  console.error(`[grid-search] DB upsert failed for ${p.id}:`, e);
}
      perGrid.push({
        gridId: p.id,
        lat: p.lat,
        lng: p.lng,
        radius: p.radius,
        resultCount: places.length,
        apiCalls: res.apiCalls,
        places,
      });
  
      totalPlaces += places.length;
      searchesRun += 1;

      // Emit search-complete for the UI with metrics for this grid point
      try {
        progress.emit({
          type: "search-complete",
          id: p.id,
          level: p.level,
          resultCount: places.length,
          apiCalls: res.apiCalls,
          subdivided: false,
        });
      } catch (e) {
        console.error("[grid-search] progress emit failed:", e);
      }
    } catch (err) {
      // Log the error for this grid point and continue unless abortSignal triggered
      console.error(`[grid-search] Error during grid ${p.id}:`, err);
      if (abortSignal?.aborted) {
        aborted = true;
        break;
      }
    }
  }

  const summary: GridSearchSummary = {
    searchesRun,
    totalPlaces,
    apiCalls: totalApiCalls,
    aborted,
    perGrid,
  };

  // Emit final completion (or aborted) summary for UI consumers
  try {
    progress.emit({
      type: "complete",
      totalAreasSearched: searchesRun,
      totalPlaces,
      apiCalls: totalApiCalls,
      subdivisions: 0,
      aborted,
    });
  } catch (e) {
    console.error("[grid-search] progress emit failed:", e);
  }

  console.log(
    `Test sync complete: ${searchesRun} searches, ${totalPlaces} coffee shops found, ${totalApiCalls} API calls used${
      aborted ? " — aborted" : ""
    }`
  );
  
  return summary;
}