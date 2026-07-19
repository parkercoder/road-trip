import { mkdir, writeFile } from "node:fs/promises";

// Route anchors only: daily origins/destinations, ferry terminals and required charging stops.
// Sightseeing POIs are deliberately excluded so they can never force a detour.
const outbound = [
  [43.6532,-79.3832],[46.4917,-80.9930],[46.5219,-84.3461],[46.9700,-84.7000],
  [47.9925,-84.7740],[48.7553,-86.3447],[48.3620,-88.8000],[48.3809,-89.2477],
  [49.7670,-94.4890],[49.8951,-97.1384],[49.8485,-99.9501],[50.4452,-104.6189],
  [50.2851,-107.7972],[50.0405,-110.6765],[49.6562,-110.2922],[50.0405,-110.6765],
  [51.0447,-114.0719],[51.1784,-115.5708],[51.2990,-116.9680],[50.9981,-118.1957],
  [50.6745,-120.3273],[50.1120,-120.7940],[49.3800,-121.4410],[49.2827,-123.1207],
  [49.0070,-123.1300],[48.6890,-123.4100],[48.4610,-123.5580],[49.2339,-124.8055],
  [49.1530,-125.9060]
];

const inbound = [
  [49.1530,-125.9060],[49.2339,-124.8055],[49.1910,-123.9550],[49.3760,-123.2720],
  [49.7016,-123.1558],[50.1170,-122.9540],[50.6745,-120.3273],[51.2960,-120.1080],
  [52.8312,-119.2643],[52.8737,-118.0814],[53.5461,-113.4938],[53.2780,-110.0050],
  [52.7575,-108.2860],[52.1579,-106.6702],[51.2139,-102.4628],[49.8485,-99.9501],
  [49.8951,-97.1384],[49.7670,-94.4890],[49.7833,-92.8370],[48.3809,-89.2477],
  [48.7730,-86.6070],[47.9925,-84.7740],[46.5219,-84.3461],[46.1879,-82.9580],
  [46.2578,-81.7690],[45.9230,-82.2630],[45.5560,-82.0070],[44.9867,-81.2540],
  [44.3894,-80.5340],[44.3894,-79.6903],[43.6532,-79.3832]
];

const segments = [
  { id: "out-mainland", color: "#1769d1", coords: outbound.slice(0, 25) },
  { id: "out-island", color: "#1769d1", coords: outbound.slice(25) },
  { id: "back-island", color: "#d46a1f", coords: inbound.slice(0, 3) },
  { id: "back-mainland", color: "#d46a1f", coords: inbound.slice(3, 27) },
  { id: "back-ontario", color: "#d46a1f", coords: inbound.slice(27) }
];

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

await mkdir("data", { recursive: true });
await writeFile("data/road-routes.json", JSON.stringify({
  generatedAt: new Date().toISOString(),
  source: "Project OSRM demo server / OpenStreetMap road network",
  segments: routes
}));

console.log(`Wrote data/road-routes.json (${routes.reduce((sum, route) => sum + route.geometry.length, 0)} encoded characters)`);
