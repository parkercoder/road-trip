import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  DEFAULT_TRIP_PATH,
  TripSpecError,
  createTravelerModel,
  deriveFerryLegs,
  deriveFlightLegs,
  deriveRouteSegments,
  loadTripSpec,
  resolveTripUrl,
  validateRouteData,
  validateTripSpec
} from "../src/trip-spec.mjs";

const crossCanada = JSON.parse(await readFile("data/cross-canada.trip.json", "utf8"));

test("resolves the default and a selected same-origin trip", () => {
  const baseUrl = "https://road-trip.test/traveler.html";
  assert.equal(
    resolveTripUrl({ baseUrl }),
    `https://road-trip.test/${DEFAULT_TRIP_PATH}`
  );
  assert.equal(
    resolveTripUrl({ baseUrl, search: "?trip=examples%2Flakes-and-pines.trip.json" }),
    "https://road-trip.test/examples/lakes-and-pines.trip.json"
  );
});

test("rejects cross-origin and non-JSON trip sources", () => {
  const baseUrl = "https://road-trip.test/traveler.html";
  assert.throws(
    () => resolveTripUrl({ baseUrl, search: "?trip=https%3A%2F%2Fevil.test%2Ftrip.json" }),
    error => error instanceof TripSpecError && error.code === "unsupported-origin"
  );
  assert.throws(
    () => resolveTripUrl({ baseUrl, search: "?trip=data%2Ftrip.txt" }),
    error => error instanceof TripSpecError && error.code === "unsupported-file"
  );
});

test("loads and validates a selected TripSpec", async () => {
  const result = await loadTripSpec({
    baseUrl: "https://road-trip.test/traveler.html",
    search: "?trip=data%2Fdemo.trip.json",
    fetchImpl: async url => ({
      ok: true,
      status: 200,
      json: async () => structuredClone(crossCanada),
      url
    })
  });

  assert.equal(result.url, "https://road-trip.test/data/demo.trip.json");
  assert.equal(result.spec.trip.id, "cross-canada-summer-2026");
});

test("reports invalid TripSpec data before rendering", async () => {
  await assert.rejects(
    loadTripSpec({
      baseUrl: "https://road-trip.test/traveler.html",
      fetchImpl: async () => ({ ok: true, status: 200, json: async () => ({ schemaVersion: "1.0" }) })
    }),
    error => error instanceof TripSpecError && error.code === "invalid-spec" && error.details.length > 0
  );
});

test("derives five road segments and three ferry legs without routing activities", () => {
  const segments = deriveRouteSegments(crossCanada);
  const ferries = deriveFerryLegs(crossCanada);
  const anchorIds = new Set(crossCanada.days.flatMap(day => day.route.anchorPlaceIds));
  const activityIds = new Set(crossCanada.days.flatMap(day => day.activities.map(activity => activity.placeId)));

  assert.equal(segments.length, 5);
  assert.equal(ferries.length, 3);
  assert.deepEqual(segments.map(segment => segment.color), [
    "#1769d1", "#1769d1", "#d46a1f", "#d46a1f", "#d46a1f"
  ]);
  assert.equal([...activityIds].some(placeId => anchorIds.has(placeId)), false);
});

test("builds Traveler fallbacks when optional route metrics are absent", () => {
  const spec = structuredClone(crossCanada);
  delete spec.days[0].route.distanceKm;
  delete spec.days[0].route.driveMinutes;
  const model = createTravelerModel(spec, { now: new Date("2026-06-26T12:00:00Z") });

  assert.equal(model.days.length, 18);
  assert.equal(model.days[0].distance, "里程待计算");
  assert.equal(model.days[0].drive, "时间待计算");
  assert.equal(model.days[0].today, true);
});

test("detects route geometry generated for another trip", () => {
  assert.throws(
    () => validateRouteData(crossCanada, { tripId: "another-trip", segments: [{ geometry: "abc" }] }),
    error => error instanceof TripSpecError && error.code === "route-mismatch"
  );
  assert.equal(
    validateRouteData(crossCanada, { tripId: crossCanada.trip.id, segments: [{ geometry: "abc" }] }).length,
    1
  );
});

test("the committed TripSpec remains valid", () => {
  assert.deepEqual(validateTripSpec(crossCanada), []);
});

test("accepts walking trips and place addresses", () => {
  const spec = structuredClone(crossCanada);
  spec.vehicle.mode = "walking";
  spec.vehicle.fuelType = "human";
  spec.places[0].location.address = "Toronto, Ontario, Canada";
  assert.deepEqual(validateTripSpec(spec), []);
});

test("accepts airports as durable places", () => {
  const spec = structuredClone(crossCanada);
  spec.places[0].kind = "airport";
  assert.deepEqual(validateTripSpec(spec), []);
});

test("treats consecutive airport anchors as a direct flight leg", () => {
  const spec = structuredClone(crossCanada);
  const firstDay = spec.days[0];
  const origin = spec.places.find(place => place.id === firstDay.originPlaceId);
  const destination = spec.places.find(place => place.id === firstDay.destinationPlaceId);
  origin.kind = "airport";
  destination.kind = "airport";
  firstDay.route.anchorPlaceIds = [origin.id, destination.id];
  spec.days = [firstDay];

  const flights = deriveFlightLegs(spec);
  const roads = deriveRouteSegments(spec);
  assert.equal(flights.length, 1);
  assert.equal(flights[0].dayId, firstDay.id);
  assert.deepEqual(roads, []);
});
