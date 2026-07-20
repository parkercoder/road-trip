import assert from "node:assert/strict";
import test from "node:test";
import { DRAFT_STORAGE_KEY, loadTripSpec, validateTripSpec } from "../src/trip-spec.mjs";
import {
  addActivity,
  addDay,
  addPlace,
  addRouteAnchor,
  createStarterTrip,
  draftErrors,
  loadDraft,
  placeUsage,
  prepareTripSpec,
  removePlace,
  saveDraft,
  setDayEndpoint
} from "../src/studio-core.mjs";

function memoryStorage() {
  const values = new Map();
  return {
    getItem: key => values.get(key) ?? null,
    setItem: (key, value) => values.set(key, String(value)),
    removeItem: key => values.delete(key)
  };
}

test("creates an immediately valid starter trip", () => {
  const spec = createStarterTrip({ now: new Date("2026-08-01T12:00:00") });
  assert.equal(spec.trip.startDate, "2026-08-01");
  assert.equal(spec.days.length, 1);
  assert.deepEqual(draftErrors(spec), []);
});

test("builds a multi-day trip with required anchors and optional activities", () => {
  const spec = createStarterTrip({ now: new Date("2026-08-01T12:00:00") });
  const chargeId = addPlace(spec, { name: "Kingston Charge", kind: "charging", lat: 44.2312, lng: -76.486 });
  const trailId = addPlace(spec, { name: "Lakeside Trail", kind: "trailhead", lat: 44.5, lng: -76.2 });
  addRouteAnchor(spec, "day-01", chargeId);
  addActivity(spec, "day-01", trailId);
  const secondDayId = addDay(spec);
  setDayEndpoint(spec, secondDayId, "destination", "start");

  assert.equal(spec.days.length, 2);
  assert.deepEqual(spec.days[0].route.anchorPlaceIds, ["start", chargeId, "destination"]);
  assert.deepEqual(spec.days[0].route.optionalStopPlaceIds, [trailId]);
  assert.equal(spec.trip.destinationPlaceId, "start");
  assert.deepEqual(draftErrors(spec), []);
});

test("protects referenced places from deletion", () => {
  const spec = createStarterTrip();
  assert.ok(placeUsage(spec, "start") > 0);
  assert.equal(removePlace(spec, "start"), false);
  const unusedId = addPlace(spec);
  assert.equal(removePlace(spec, unusedId), true);
});

test("persists a draft and hands it to the Traveler loader", async () => {
  const storage = memoryStorage();
  const spec = createStarterTrip({ now: new Date("2026-09-10T12:00:00") });
  spec.trip.title = "Fresh Test Trip";
  saveDraft(spec, storage);

  assert.equal(loadDraft(storage).trip.title, "Fresh Test Trip");
  assert.ok(storage.getItem(DRAFT_STORAGE_KEY));

  const loaded = await loadTripSpec({
    search: "?draft=1",
    baseUrl: "https://road-trip.test/traveler.html",
    storage,
    fetchImpl: async () => { throw new Error("draft loading must not fetch"); }
  });
  assert.equal(loaded.source, "draft");
  assert.equal(loaded.spec.trip.title, "Fresh Test Trip");
});

test("prepares Studio output without stale route geometry", () => {
  const spec = createStarterTrip();
  spec.generated.routeDataFile = "data/old-routes.json";
  const prepared = prepareTripSpec(spec);

  assert.equal(prepared.generated.routeDataFile, undefined);
  assert.deepEqual(validateTripSpec(prepared), []);
});

test("invalidates generated route data when route anchors change", () => {
  const spec = createStarterTrip();
  const waypointId = addPlace(spec, { name: "Waypoint", lat: 44, lng: -77 });
  spec.generated.routeData = { segments: [{ geometry: "abc" }] };
  addRouteAnchor(spec, "day-01", waypointId);
  assert.equal(spec.generated.routeData, undefined);
});

test("prepareTripSpec defensively converts a single day note to an array", () => {
  const spec = createStarterTrip();
  spec.days[0].notes = "Remember water";
  const prepared = prepareTripSpec(spec);
  assert.deepEqual(prepared.days[0].notes, ["Remember water"]);
});
