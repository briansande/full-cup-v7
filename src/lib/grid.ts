/**
 * Grid generator for adaptive sync system.
 *
 * TASK 1: Create Test Area Grid Generator
 *
 * Exports:
 * - type GridPoint
 * - function generateGrid(mode: 'test' | 'production'): GridPoint[]
 *
 * Assumptions / Notes:
 * - Uses a simple equirectangular approximation for converting km -> degrees:
 *     latitude degrees per km ≈ 0.009  (approx for Houston latitude)
 * - Longitude degrees per km are scaled by cos(latitude) to account for convergence:
 *     lonDegPerKm = latDegPerKm / cos(latInRadians)
 * - For test mode: we generate a 2 columns × 3 rows grid (~2 km spacing) centered on
 *   Downtown Houston (29.7604, -95.3698) and respect the Test Area Boundaries below.
 * - For production mode: generate an 8×9 grid that fills the Full Houston boundaries.
 *
 * Boundaries are copied from adaptive_sync_prompt.md:
 * - TEST area:
 *     north: 29.78, south: 29.74, east: -95.35, west: -95.39
 * - FULL Houston:
 *     north: 30.05, south: 29.45, east: -94.95, west: -95.85
 *
 * IDs:
 * - Test (primary) points use id = `primary-r-c` (r = row, c = col)
 * - Production points use id = `prod-r-c`
 *
 * Logging:
 * - The generator logs boundaries and grid size for whichever mode is selected.
 */

export type GridPoint = {
  id: string;    // stable unique id (e.g., 'primary-0-0' or 'prod-2-3')
  lat: number;
  lng: number;
  radius: number; // meters
  level: number;  // 0 = primary, 1 = subdivision, ...
};

type Mode = 'test' | 'production';

/* Boundaries (from adaptive_sync_prompt.md) */
const TEST_BOUNDARIES = {
  north: 29.78,
  south: 29.74,
  east: -95.35,
  west: -95.39,
  centerLat: 29.7604,
  centerLng: -95.3698,
};

const HOUSTON_BOUNDARIES = {
  north: 30.05,
  south: 29.45,
  east: -94.95,
  west: -95.85,
};

/* Constants / conversion assumptions */
const LAT_DEGREES_PER_KM = 0.009; // approximate for Houston latitude
const DEFAULT_PRIMARY_RADIUS_M = 1000; // 2000 meters for primary grid points

/**
 * Helper: convert km offsets to degree offsets (lat, lon) at a reference latitude.
 * - latOffsetKm: kilometers north (+) / south (-)
 * - lngOffsetKm: kilometers east (+) / west (-)
 */
function kmOffsetToDeg(latRef: number, latOffsetKm: number, lngOffsetKm: number) {
  const latDeg = latOffsetKm * LAT_DEGREES_PER_KM;
  const latRad = (latRef * Math.PI) / 180;
  // increasing degrees longitude per km as km -> degrees: larger near equator.
  const lonDegPerKm = LAT_DEGREES_PER_KM / Math.cos(latRad);
  const lonDeg = lngOffsetKm * lonDegPerKm;
  return { latDeg, lonDeg };
}

/**
 * generateGrid
 *
 * mode: 'test' | 'production'
 *
 * Returns array of GridPoint
 */
export function generateGrid(mode: Mode): GridPoint[] {
  if (mode === 'test') {
    // Test mode: 2 cols x 3 rows centered on Downtown Houston
    const cols = 1;
    const rows = 1;
    const spacingKm = 2; // ~2 km spacing requested
    const centerLat = TEST_BOUNDARIES.centerLat;
    const centerLng = TEST_BOUNDARIES.centerLng;

    console.log('[grid] Generating TEST grid');
    console.log(
      `[grid] Test boundaries: north=${TEST_BOUNDARIES.north}, south=${TEST_BOUNDARIES.south}, east=${TEST_BOUNDARIES.east}, west=${TEST_BOUNDARIES.west}`
    );
    console.log(`[grid] Center: lat=${centerLat}, lng=${centerLng}`);
    console.log(`[grid] Grid size: ${cols} cols x ${rows} rows (total ${cols * rows} points), spacing ~${spacingKm} km`);

    // Determine per-column and per-row offsets (in km) relative to center such that
    // grid is centered. For even number of columns we offset by half-spacing.
    const colOffsetsKm: number[] = [];
    if (cols % 2 === 1) {
      // odd: symmetric including center column
      const half = Math.floor(cols / 2);
      for (let c = -half; c <= half; c++) {
        colOffsetsKm.push(c * spacingKm);
      }
    } else {
      // even: e.g., cols=2 -> offsets at -spacing/2, +spacing/2
      const start = -(cols / 2 - 0.5) * spacingKm;
      for (let c = 0; c < cols; c++) {
        colOffsetsKm.push(start + c * spacingKm);
      }
    }

    const rowOffsetsKm: number[] = [];
    if (rows % 2 === 1) {
      const half = Math.floor(rows / 2);
      for (let r = -half; r <= half; r++) {
        rowOffsetsKm.push(r * spacingKm);
      }
    } else {
      const start = -(rows / 2 - 0.5) * spacingKm;
      for (let r = 0; r < rows; r++) {
        rowOffsetsKm.push(start + r * spacingKm);
      }
    }

    const points: GridPoint[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const rowKm = rowOffsetsKm[r];
        const colKm = colOffsetsKm[c];
        const { latDeg, lonDeg } = kmOffsetToDeg(centerLat, rowKm, colKm);
        const lat = centerLat + latDeg;
        const lng = centerLng + lonDeg;
        const id = `primary-${r}-${c}`;
        points.push({
          id,
          lat,
          lng,
          radius: DEFAULT_PRIMARY_RADIUS_M,
          level: 0,
        });
      }
    }

    console.log(`[grid] Generated ${points.length} test grid points. Sample:`, points.slice(0, Math.min(5, points.length)));
    return points;
  } else {
    // Production mode: 8 x 9 grid that fills Full Houston Boundaries
    // We'll distribute points evenly across the bounding box (inclusive)
    const cols = 8; // east-west divisions
    const rows = 9; // north-south divisions

    const north = HOUSTON_BOUNDARIES.north;
    const south = HOUSTON_BOUNDARIES.south;
    const east = HOUSTON_BOUNDARIES.east;
    const west = HOUSTON_BOUNDARIES.west;

    console.log('[grid] Generating PRODUCTION grid');
    console.log(`[grid] Houston boundaries: north=${north}, south=${south}, east=${east}, west=${west}`);
    console.log(`[grid] Grid size: ${cols} cols x ${rows} rows (total ${cols * rows} points)`);

    // If rows or cols are 1, avoid division by zero
    const latStep = rows > 1 ? (north - south) / (rows - 1) : 0;
    const lngStep = cols > 1 ? (east - west) / (cols - 1) : 0;

    const points: GridPoint[] = [];
    // We'll assign rows from 0..rows-1 starting at south -> north (so row 0 = south)
    for (let r = 0; r < rows; r++) {
      const lat = south + r * latStep;
      for (let c = 0; c < cols; c++) {
        const lng = west + c * lngStep;
        const id = `prod-${r}-${c}`;
        points.push({
          id,
          lat,
          lng,
          radius: DEFAULT_PRIMARY_RADIUS_M,
          level: 0,
        });
      }
    }

    console.log(`[grid] Generated ${points.length} production grid points. Sample:`, points.slice(0, Math.min(5, points.length)));
    return points;
  }
}