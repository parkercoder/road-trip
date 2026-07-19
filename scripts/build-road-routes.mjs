import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import { deriveRouteSegments } from "./derive-route-segments.mjs";

const tripFile = process.argv[2] || "data/cross-canada.trip.json";
const spec = JSON.parse(await readFile(tripFile, "utf8"));
const segments = deriveRouteSegments(spec);
const outputFile = spec.generated?.routeDataFile || "data/road-routes.json";

function osrmUrl(coords) {
  const pairs = coords.map(([lat, lon]) => `${lon.toFixed(5)},${lat.toFixed(5)}`).join(";");
  const radiuses = coords.map(() => "5000").join(";");
  return `https://router.project-osrm.org/route/v1/driving/${pairs}?overview=full&geometries=polyline6&steps=false&alternatives=false&radiuses=${radiuses}`;
}

async function fetchSegment(segment) {
  const response = await fetch(osrmUrl(segment.coords), {
    headers: { "user-agent": "crossing-canada-route-builder/1.0" }
  });
  if (!response.ok) throw new Error(`${segment.id}: OSRM ${response.status}`);
  const data = await response.json();
  const geometry = data?.routes?.[0]?.geometry;
  if (typeof geometry !== "string" || geometry.length < 2) {
    throw new Error(`${segment.id}: no route geometry`);
  }
  return {
    id: segment.id,
    color: segment.color,
    distanceMeters: Math.round(data.routes[0].distance),
    durationSeconds: Math.round(data.routes[0].duration),
    geometry
  };
}

const routes = [];
for (const segment of segments) {
  console.log(`Routing ${segment.id}...`);
  routes.push(await fetchSegment(segment));
}

await mkdir(dirname(outputFile), { recursive: true });
await writeFile(outputFile, JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: "Project OSRM demo server / OpenStreetMap road network",
  tripId: spec.trip.id,
  segments: routes
}));

console.log(`Wrote ${outputFile} (${routes.reduce((sum, route) => sum + route.geometry.length, 0)} encoded characters)`);
