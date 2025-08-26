/**
 * dedupe.ts - Deduplication utilities for Full Cup
 *
 * Exports:
 * - type DedupResult = { placeId: string; place: any; preferredGridId: string; sourceGridIds: string[]; preferredRadius: number }
 * - type DeduplicationOutput = { dedupedPlaces: any[]; mapping: Record<string, DedupResult>; duplicatesByGrid: Record<string, number> }
 * - function deduplicateByPlaceId(perGridPlaces: Record<string, any[]>, options?: { preferSmallerRadius?: boolean }): DeduplicationOutput
 *
 * Assumptions:
 * - perGridPlaces is a mapping of gridId -> placesArray OR gridId -> { places: any[]; radius?: number; level?: number }
 * - place objects may have place_id, placeId, or id. If missing, we create a stable fallback using name + coords.
 * - radius and level metadata may be provided per-grid (in the value object) or not. If absent, selection falls back to first encountered.
 * - Function is synchronous and pure in-memory.
 *
 * Heuristics / tie-breakers (documented here):
 * 1) Prefer the occurrence coming from the smallest radius (more precise) when `preferSmallerRadius` is true (default).
 * 2) If candidate radii are equal (or radii are not available), prefer the occurrence with the highest `level` value (subdivisions have larger level -> more precise).
 * 3) If level is not available, fall back to the deterministic encounter order (first encountered in the perGridPlaces iteration).
 *
 * Determinism:
 * - Iteration order uses Object.keys(perGridPlaces) insertion order and the order of items within each places array.
 * - All tie-breakers rely on deterministic comparisons so same input => same output.
 */

export type DedupResult = {
  placeId: string;
  place: any;
  preferredGridId: string;
  sourceGridIds: string[];
  preferredRadius: number;
};

export type DeduplicationOutput = {
  dedupedPlaces: any[];
  mapping: Record<string, DedupResult>;
  duplicatesByGrid: Record<string, number>;
};

type PerGridValue = any[] | { places: any[]; radius?: number; level?: number };

/**
 * deduplicateByPlaceId
 *
 * Input:
 * - perGridPlaces: Record<gridId, placesArray | { places, radius?, level? }>
 * - options.preferSmallerRadius (default true)
 *
 * Output:
 * - DeduplicationOutput as specified in task
 *
 * Notes:
 * - This function is synchronous and purely in-memory.
 * - It will not mutate the original place objects; cloned shallow copies are returned with `_sourceInfo`.
 */
export function deduplicateByPlaceId(
  perGridPlaces: Record<string, PerGridValue>,
  options?: { preferSmallerRadius?: boolean }
): DeduplicationOutput {
  const preferSmallerRadius = options?.preferSmallerRadius ?? true;

  // Helper to produce deterministic unique id from a place object
  function getPlaceId(p: any): string {
    const pid = p?.place_id ?? p?.placeId ?? p?.id;
    if (pid) return String(pid);

    // fallback: try to build from name + coords; normalize name and coords to fixed precision
    const name = (p?.name ?? p?.displayName ?? "").toString().trim().toLowerCase();
    const lat = p?.location?.lat ?? p?.geometry?.location?.lat ?? p?.lat ?? p?.latitude;
    const lng = p?.location?.lng ?? p?.geometry?.location?.lng ?? p?.lng ?? p?.longitude;
    const latStr = typeof lat === "number" ? lat.toFixed(6) : String(lat);
    const lngStr = typeof lng === "number" ? lng.toFixed(6) : String(lng);
    return `${name}|${latStr}|${lngStr}`;
  }

  // Helper to extract deterministic numeric radius/level if provided
  function extractMeta(value: PerGridValue): { places: any[]; radius?: number; level?: number } {
    if (Array.isArray(value)) return { places: value };
    return {
      places: value.places ?? [],
      radius: typeof value.radius === "number" ? value.radius : undefined,
      level: typeof value.level === "number" ? value.level : undefined,
    };
  }

  // Track insertion order of gridIds to use as deterministic tie-breaker
  const gridOrder: Record<string, number> = {};
  let orderCounter = 0;
  for (const gid of Object.keys(perGridPlaces)) {
    gridOrder[gid] = orderCounter++;
  }

  type Occurrence = { gridId: string; place: any; radius?: number; level?: number; encounterIndex: number };

  const occurrencesByPlace = new Map<string, Occurrence[]>();
  let encounterCounter = 0;

  // Iterate inputs in deterministic order (Object.keys order) and within each places array in order
  for (const gridId of Object.keys(perGridPlaces)) {
    const meta = extractMeta(perGridPlaces[gridId]);
    const radius = meta.radius;
    const level = meta.level;
    const places = meta.places ?? [];
    for (const pl of places) {
      const pid = getPlaceId(pl);
      const occ: Occurrence = { gridId, place: pl, radius, level, encounterIndex: encounterCounter++ };
      const arr = occurrencesByPlace.get(pid);
      if (!arr) occurrencesByPlace.set(pid, [occ]);
      else arr.push(occ);
    }
  }

  const mapping: Record<string, DedupResult> = {};
  const dedupedPlaces: any[] = [];
  const duplicatesByGrid: Record<string, number> = {};

  // For each unique place, choose preferred occurrence per heuristics
  for (const [pid, occs] of occurrencesByPlace.entries()) {
    // Gather all gridIds
    const sourceGridIds = Array.from(new Set(occs.map((o) => o.gridId)));

    // Determine preferred occurrence
    let preferredOcc: Occurrence | undefined;

    if (preferSmallerRadius) {
      // Find smallest numeric radius among occurrences that have radius defined
      const numericRadii = occs.map((o) => (typeof o.radius === "number" ? o.radius : undefined)).filter((r) => typeof r === "number") as number[];
      if (numericRadii.length > 0) {
        const minRadius = Math.min(...numericRadii);
        // Filter occs with radius === minRadius
        const candidates = occs.filter((o) => typeof o.radius === "number" && o.radius === minRadius);
        // If multiple candidates, pick highest level if present
        if (candidates.length === 1) {
          preferredOcc = candidates[0];
        } else {
          // choose highest level among candidates if level info present
          const numericLevels = candidates.map((c) => (typeof c.level === "number" ? c.level : undefined)).filter((l) => typeof l === "number") as number[];
          if (numericLevels.length > 0) {
            const maxLevel = Math.max(...numericLevels);
            const lvlCandidates = candidates.filter((c) => c.level === maxLevel);
            // deterministic: if multiple, pick the one with smallest encounterIndex (first encountered)
            preferredOcc = lvlCandidates.sort((a, b) => a.encounterIndex - b.encounterIndex)[0];
          } else {
            // no level info, pick first encountered among candidates
            preferredOcc = candidates.sort((a, b) => a.encounterIndex - b.encounterIndex)[0];
          }
        }
      }
    }

    // If preferred not determined by radius or preferSmallerRadius=false, fall back to level then encounter order
    if (!preferredOcc) {
      // Pick occurrences with max level if any level info present
      const numericLevels = occs.map((o) => (typeof o.level === "number" ? o.level : undefined)).filter((l) => typeof l === "number") as number[];
      if (numericLevels.length > 0) {
        const maxLevel = Math.max(...numericLevels);
        const lvlCandidates = occs.filter((o) => o.level === maxLevel);
        preferredOcc = lvlCandidates.sort((a, b) => a.encounterIndex - b.encounterIndex)[0];
      } else {
        // No level info; pick first encountered deterministically
        preferredOcc = occs.sort((a, b) => a.encounterIndex - b.encounterIndex)[0];
      }
    }

    // Compose DedupResult
    const preferredGridId = preferredOcc.gridId;
    const preferredRadius = typeof preferredOcc.radius === "number" ? preferredOcc.radius : -1;

    mapping[pid] = {
      placeId: pid,
      place: preferredOcc.place,
      preferredGridId,
      sourceGridIds,
      preferredRadius,
    };

    // Clone place object (shallow) and add _sourceInfo without mutating original
    const cloned = { ...preferredOcc.place, _sourceInfo: { preferredGridId, sourceGridIds } };
    dedupedPlaces.push(cloned);

    // Update duplicatesByGrid: for any place that appeared in >1 grid, increment counters for all source grids
    if (sourceGridIds.length > 1) {
      for (const gid of sourceGridIds) {
        duplicatesByGrid[gid] = (duplicatesByGrid[gid] ?? 0) + 1;
      }
    }
  }

  return { dedupedPlaces, mapping, duplicatesByGrid };
}