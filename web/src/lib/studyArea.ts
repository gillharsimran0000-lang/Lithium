// The app covers only the southern Arkansas area that USGS studied for Smackover lithium
// (Knierim and others, 2024, doi:10.5066/P9QPRYZN). Other regions are future work: they lack
// lithium measurements and the Smackover geology maps the model needs.

// Corners of the USGS model area (web/public/data/domain.geojson), as [longitude, latitude].
const OUTLINE: [number, number][] = [
  [-94.0509, 33.0191], [-94.0366, 33.5922], [-93.0607, 33.5714],
  [-92.0853, 33.5424], [-92.1137, 32.9696], [-93.0820, 32.9985],
];

// Counties that overlap the USGS model area by at least 10% of their land.
export const STUDY_COUNTIES = ["Bradley", "Calhoun", "Columbia", "Hempstead", "Lafayette", "Miller", "Nevada", "Ouachita", "Union"];

// [west, south, east, north] around those counties, for the map's starting view.
export const STUDY_BOUNDS = [-94.1, 32.95, -91.95, 34.05];

// Ray casting: count how many outline edges a line going east from the point crosses. Odd means inside.
export function inStudyArea(lat: number | null, lon: number | null) {
  if (lat == null || lon == null) return false;
  let inside = false;
  for (let i = 0, j = OUTLINE.length - 1; i < OUTLINE.length; j = i++) {
    const [xi, yi] = OUTLINE[i];
    const [xj, yj] = OUTLINE[j];
    if (yi > lat !== yj > lat && lon < ((xj - xi) * (lat - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}
