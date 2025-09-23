/**
 * grid-search.ts - Test area sync runner (test-only)
 *
 * Implements TASK 4: Basic Grid Search Implementation
 *
 * Notes:
 * - Generates the 2x3 test grid via generateGrid('test')
 * - Uses nearbySearchWithPagination from density.ts which handles pagination internally
 * - Rate-limits 1s (configurable) between top-level grid searches (not between pages)
 * - Applies comprehensive coffee shop filtering system
 * - Aborts immediately if cumulative API calls exceed safety limit
 * - Returns an in-memory summary object with per-grid and global stats
 */

import { generateGrid, type GridPoint } from "./grid";
import { nearbySearchWithPagination, type NearbySearchResult, type NearbyPlace } from "./density";
import { progress } from "@/src/lib/progress";
import { applyCoffeeShopFilters, type FilteredPlace } from "./coffee-filtering";

import { upsertShopsBatch } from "./db-integration";
export type GridSearchResult = {
  gridId: string;
  lat: number;
  lng: number;
  radius: number;
  resultCount: number;
  apiCalls: number;
  places: NearbyPlace[];
  filterStats?: {
    original: number;
    afterChainFilter: number;
    afterKeywordFilter: number;
    afterTypeFilter: number;
    afterQualityFilter: number;
    final: number;
  };
};

export type GridSearchSummary = {
  searchesRun: number;
  totalPlaces: number;
  apiCalls: number;
  aborted: boolean;
  perGrid: GridSearchResult[];
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
  maxApiCalls?: number;
  rateLimitMs?: number;
  filterChains?: string[]; // Legacy option - now handled by comprehensive filtering
  abortSignal?: AbortSignal;
  enableFiltering?: boolean; // Option to disable filtering for debugging
};

/**
 * runTestAreaSync
 *
 * - options.maxApiCalls: safety limit for total API calls (default 25)
 * - options.rateLimitMs: ms to wait between top-level grid searches (default 1000)
 * - options.filterChains: DEPRECATED - filtering now uses comprehensive system
 * - options.abortSignal: optional AbortSignal for UI-driven aborts (honored between waits and before searches)
 * - options.enableFiltering: enable comprehensive filtering system (default true)
 *
 * Enhanced filtering system:
 * - Uses multi-layer filtering: chains, keywords, types, and quality validation
 * - Applies Houston area geographic validation
 * - Provides detailed filtering statistics for monitoring
 * - Maintains compatibility with existing API but with vastly improved results
 */
export async function runTestAreaSync(options?: RunOptions): Promise<GridSearchSummary> {
  const {
    maxApiCalls = 25,
    rateLimitMs = 1000,
    filterChains = [], // Deprecated but kept for compatibility
    abortSignal,
    enableFiltering = true,
  } = options ?? {};

  // Log deprecation warning if filterChains is used
  if (filterChains.length > 0) {
    console.warn("[grid-search] filterChains option is deprecated. Using comprehensive filtering system instead.");
  }
  
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

  // Cumulative filtering statistics
  const totalFilterStats = {
    original: 0,
    afterChainFilter: 0,
    afterKeywordFilter: 0,
    afterTypeFilter: 0,
    afterQualityFilter: 0,
    final: 0,
  };

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
  
        // Apply comprehensive filtering to results before including them
        let filteredPlaces: NearbyPlace[] = res.places ?? [];
        let filterStats = undefined;
        
        if (enableFiltering && filteredPlaces.length > 0) {
          const filterResult = applyCoffeeShopFilters(filteredPlaces);
          filteredPlaces = filterResult.filtered;
          filterStats = filterResult.stats;
          
          // Update cumulative stats
          totalFilterStats.original += filterStats.original;
          totalFilterStats.afterChainFilter += filterStats.afterChainFilter;
          totalFilterStats.afterKeywordFilter += filterStats.afterKeywordFilter;
          totalFilterStats.afterTypeFilter += filterStats.afterTypeFilter;
          totalFilterStats.afterQualityFilter += filterStats.afterQualityFilter;
          totalFilterStats.final += filterStats.final;

          console.log(`[grid-search] ${p.id} filtering: ${filterStats.original} → ${filterStats.final} places (${Math.round((filterStats.final/filterStats.original)*100)}% passed)`);
        }

        perGrid.push({
          gridId: p.id,
          lat: p.lat,
          lng: p.lng,
          radius: p.radius,
          resultCount: filteredPlaces.length,
          apiCalls: res.apiCalls,
          places: filteredPlaces,
          filterStats,
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

      // Apply comprehensive filtering system
      let places: NearbyPlace[] = res.places ?? [];
      let filterStats = undefined;
      
      if (enableFiltering && places.length > 0) {
        const filterResult = applyCoffeeShopFilters(places);
        places = filterResult.filtered;
        filterStats = filterResult.stats;
        
        // Update cumulative stats
        totalFilterStats.original += filterStats.original;
        totalFilterStats.afterChainFilter += filterStats.afterChainFilter;
        totalFilterStats.afterKeywordFilter += filterStats.afterKeywordFilter;
        totalFilterStats.afterTypeFilter += filterStats.afterTypeFilter;
        totalFilterStats.afterQualityFilter += filterStats.afterQualityFilter;
        totalFilterStats.final += filterStats.final;

        // Log filtering results for this grid
        console.log(`[grid-search] ${p.id} filtering results:`);
        console.log(`  Original: ${filterStats.original}`);
        console.log(`  After chain filter: ${filterStats.afterChainFilter} (${filterStats.original - filterStats.afterChainFilter} removed)`);
        console.log(`  After keyword filter: ${filterStats.afterKeywordFilter} (${filterStats.afterChainFilter - filterStats.afterKeywordFilter} removed)`);
        console.log(`  After type filter: ${filterStats.afterTypeFilter} (${filterStats.afterKeywordFilter - filterStats.afterTypeFilter} removed)`);
        console.log(`  After quality filter: ${filterStats.afterQualityFilter} (${filterStats.afterTypeFilter - filterStats.afterQualityFilter} removed)`);
        console.log(`  Final: ${filterStats.final} (${Math.round((filterStats.final/filterStats.original)*100)}% passed)`);
      } else if (!enableFiltering) {
        console.log(`[grid-search] ${p.id} filtering disabled - using all ${places.length} results`);
      }

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
        filterStats,
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
    totalFilterStats: enableFiltering ? totalFilterStats : undefined,
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

  // Enhanced completion logging with filtering statistics
  if (enableFiltering && totalFilterStats.original > 0) {
    const filteringEfficiency = Math.round((totalFilterStats.final / totalFilterStats.original) * 100);
    console.log(
      `Test sync complete: ${searchesRun} searches, ${totalPlaces} coffee shops found, ${totalApiCalls} API calls used${
        aborted ? " — aborted" : ""
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
      `Test sync complete: ${searchesRun} searches, ${totalPlaces} coffee shops found, ${totalApiCalls} API calls used${
        aborted ? " — aborted" : ""
      }${!enableFiltering ? " (filtering disabled)" : ""}`
    );
  }
  
  return summary;
}