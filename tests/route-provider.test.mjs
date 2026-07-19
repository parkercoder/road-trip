import test from "node:test";
import assert from "node:assert/strict";

import { createStarterTrip } from "../src/studio-core.mjs";
import { enrichRoutePlan, hasCurrentRoutePlan } from "../src/route-provider.mjs";

function routeResponse({ distance = 432100, duration = 17460 } = {}) {
  return {
    ok: true,
    status: 200,
    async json() {
      return {
        routes: [{
          distance,
          duration,
          geometry: "_p~iF~ps|U_ulLnnqC_mqNvxq`@",
          legs: [{
            steps: [{
              distance: 120,
              duration: 30,
              name: "Main Street",
              maneuver: { type: "depart", modifier: "right", location: [-79.3832, 43.6532] }
            }, {
              distance: 431980,
              duration: 17430,
              name: "Highway 7",
              maneuver: { type: "turn", modifier: "right", location: [-79.38, 43.66] }
            }]
          }]
        }]
      };
    }
  };
}

test("stores road geometry, turn-by-turn steps, and provider metrics", async () => {
  const spec = createStarterTrip();
  let requestedUrl = "";
  const issues = await enrichRoutePlan(spec, {
    minIntervalMs: 0,
    now: () => new Date("2026-07-19T12:00:00Z"),
    fetchImpl: async url => {
      requestedUrl = url;
      return routeResponse();
    }
  });

  assert.deepEqual(issues, []);
  assert.match(requestedUrl, /routed-car\/route\/v1\/driving/);
  assert.match(requestedUrl, /-79\.383200,43\.653200;-75\.697200,45\.421500/);
  assert.match(requestedUrl, /overview=full&steps=true&geometries=polyline6/);
  assert.equal(spec.days[0].route.distanceKm, 432);
  assert.equal(spec.days[0].route.driveMinutes, 291);
  assert.equal(spec.generated.routeData.tripId, spec.trip.id);
  assert.equal(spec.generated.routeData.mode, "car");
  assert.equal(spec.generated.routeData.segments[0].dayId, "day-01");
  assert.equal(spec.generated.routeData.segments[0].mode, "car");
  assert.deepEqual(spec.generated.routeData.segments[0].anchorPlaceIds, ["start", "destination"]);
  assert.deepEqual(spec.generated.routeData.unroutedSegments, []);
  assert.equal(spec.generated.routeData.segments[0].steps[1].instruction, "右转，进入 Highway 7");
  assert.deepEqual(spec.generated.routeData.segments[0].steps[0].maneuver.location, [43.6532, -79.3832]);
  assert.equal(hasCurrentRoutePlan(spec), true);
});

test("uses the OpenStreetMap foot graph for walking routes", async () => {
  const spec = createStarterTrip();
  spec.vehicle.mode = "walking";
  spec.vehicle.fuelType = "human";
  let requestedUrl = "";
  await enrichRoutePlan(spec, {
    minIntervalMs: 0,
    fetchImpl: async url => {
      requestedUrl = url;
      return routeResponse({ distance: 400000, duration: 300000 });
    }
  });
  assert.match(requestedUrl, /routed-foot\/route\/v1\/driving/);
  assert.equal(spec.generated.routeData.mode, "walking");
  assert.equal(hasCurrentRoutePlan(spec), true);
});

test("uses the OpenStreetMap bicycle graph for bicycle routes", async () => {
  const spec = createStarterTrip();
  spec.vehicle.mode = "bicycle";
  spec.vehicle.fuelType = "human";
  let requestedUrl = "";
  await enrichRoutePlan(spec, {
    minIntervalMs: 0,
    fetchImpl: async url => {
      requestedUrl = url;
      return routeResponse({ distance: 440000, duration: 80000 });
    }
  });
  assert.match(requestedUrl, /routed-bike\/route\/v1\/driving/);
  assert.equal(spec.generated.routeData.mode, "bicycle");
});

test("keeps airplane trips as point-to-point without calling a surface router", async () => {
  const spec = createStarterTrip();
  spec.vehicle.mode = "airplane";
  spec.vehicle.fuelType = "aviation";
  let called = false;
  const issues = await enrichRoutePlan(spec, {
    fetchImpl: async () => { called = true; },
    now: () => new Date("2026-07-19T12:00:00Z")
  });
  assert.equal(called, false);
  assert.deepEqual(issues, []);
  assert.equal(spec.generated.routeData.mode, "airplane");
  assert.deepEqual(spec.generated.routeData.segments, []);
});

test("automatically skips surface routing between consecutive airports", async () => {
  const spec = createStarterTrip();
  spec.places[0].kind = "airport";
  spec.places[1].kind = "airport";
  let called = false;
  const issues = await enrichRoutePlan(spec, {
    minIntervalMs: 0,
    fetchImpl: async () => { called = true; }
  });
  assert.equal(called, false);
  assert.equal(issues.some(issue => issue.code === "route-flight"), true);
  assert.deepEqual(spec.generated.routeData.segments, []);
  assert.equal(hasCurrentRoutePlan(spec), true);
});

test("splits a car day into road and backcountry walking segments", async () => {
  const spec = createStarterTrip();
  spec.places.push({
    id: "trailhead",
    name: "Trailhead",
    kind: "trailhead",
    location: { coordinates: { lat: 44, lng: -78 } },
    tags: ["backcountry-access"]
  }, {
    id: "backcountry-camp",
    name: "Backcountry Camp",
    kind: "campground",
    location: { coordinates: { lat: 44.1, lng: -77.9 } },
    tags: ["backcountry-campground"]
  });
  spec.days[0].route.anchorPlaceIds = ["start", "trailhead", "backcountry-camp", "destination"];
  const requested = [];
  const issues = await enrichRoutePlan(spec, {
    minIntervalMs: 0,
    fetchImpl: async url => {
      requested.push(url);
      return routeResponse({ distance: 60000, duration: 3600 });
    }
  });
  assert.deepEqual(spec.generated.routeData.segments.map(segment => segment.mode), ["car", "walking", "car"]);
  assert.match(requested[0], /routed-car/);
  assert.match(requested[1], /routed-foot/);
  assert.match(requested[2], /routed-car/);
  assert.equal(spec.days[0].route.driveMinutes, 120);
  assert.equal(issues.some(issue => issue.code === "route-walking"), true);
});

test("keeps an explicit dashed fallback when a remote trail cannot be routed", async () => {
  const spec = createStarterTrip();
  spec.places.push({
    id: "trailhead",
    name: "Trailhead",
    kind: "trailhead",
    location: { coordinates: { lat: 64.413, lng: -138.303 } },
    tags: ["backcountry-access"]
  }, {
    id: "remote-camp",
    name: "Remote Camp",
    kind: "campground",
    location: { coordinates: { lat: 64.427, lng: -138.46 } },
    tags: ["backcountry-campground"]
  });
  spec.days[0].originPlaceId = "trailhead";
  spec.days[0].destinationPlaceId = "remote-camp";
  spec.days[0].route.anchorPlaceIds = ["trailhead", "remote-camp"];
  const issues = await enrichRoutePlan(spec, {
    minIntervalMs: 0,
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() { return { code: "NoRoute", message: "Impossible route between points" }; }
    })
  });

  assert.deepEqual(spec.generated.routeData.segments, []);
  assert.equal(spec.generated.routeData.unroutedSegments.length, 1);
  assert.equal(spec.generated.routeData.unroutedSegments[0].mode, "walking");
  assert.equal(spec.generated.routeData.unroutedSegments[0].fromPlaceId, "trailhead");
  assert.match(spec.generated.routeData.unroutedSegments[0].message, /GPX/);
  assert.equal(issues.some(issue => issue.code === "route-provider"), true);
  assert.equal(hasCurrentRoutePlan(spec), true);
});
