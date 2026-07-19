import test from "node:test";
import assert from "node:assert/strict";

import { createStarterTrip } from "../src/studio-core.mjs";
import { evaluateFeasibility, feasibilitySummary } from "../src/planner-rules.mjs";

test("accepts the valid starter trip without a blocking issue", () => {
  const spec = createStarterTrip({ now: new Date("2026-07-19T12:00:00") });
  const summary = feasibilitySummary(evaluateFeasibility(spec));
  assert.equal(summary.errors, 0);
});

test("detects a day over the maximum driving time", () => {
  const spec = createStarterTrip();
  spec.days[0].route.driveMinutes = 9 * 60;
  const issues = evaluateFeasibility(spec);
  assert.ok(issues.some(item => item.code === "maximum-driving-time" && item.severity === "error"));
});

test("detects an unsafe EV anchor gap", () => {
  const spec = createStarterTrip();
  spec.vehicle.fuelType = "electric";
  spec.vehicle.practicalRangeKm = 300;
  const issues = evaluateFeasibility(spec);
  assert.ok(issues.some(item => item.code === "ev-range-gap" && item.severity === "error"));
});

test("detects route discontinuity between days", () => {
  const spec = createStarterTrip();
  spec.days.push({
    ...structuredClone(spec.days[0]),
    id: "day-02",
    date: "2026-07-20",
    originPlaceId: "start",
    route: { ...structuredClone(spec.days[0].route), anchorPlaceIds: ["start", "destination"] }
  });
  spec.trip.endDate = "2026-07-20";
  const issues = evaluateFeasibility(spec);
  assert.ok(issues.some(item => item.code === "route-discontinuity"));
});

test("blocks a place whose address changed without coordinate resolution", () => {
  const spec = createStarterTrip();
  spec.places[0].location.address = "A new address";
  spec.places[0].location.coordinateStatus = "stale";
  const issues = evaluateFeasibility(spec);
  assert.ok(issues.some(item => item.code === "stale-place-coordinates" && item.severity === "error"));
});

test("does not treat flight duration as driving time", () => {
  const spec = createStarterTrip();
  spec.places[0].kind = "airport";
  spec.places[1].kind = "airport";
  spec.days[0].route.driveMinutes = 3999;
  const issues = evaluateFeasibility(spec);
  assert.equal(issues.some(item => item.code === "maximum-driving-time"), false);
});

test("checks routed ground transfers on a flight day", () => {
  const spec = createStarterTrip();
  spec.places[0].kind = "airport";
  spec.places[1].kind = "airport";
  spec.generated.routeData = {
    tripId: spec.trip.id,
    segments: [{ dayId: spec.days[0].id, durationSeconds: 9 * 60 * 60 }]
  };
  const issues = evaluateFeasibility(spec);
  assert.ok(issues.some(item => item.code === "maximum-driving-time"));
});

test("groups a continuous non-hotel run into one cadence warning", () => {
  const spec = createStarterTrip();
  spec.preferences.lodging.hotelEveryDays = 1;
  spec.days = Array.from({ length: 5 }, (_, index) => {
    const day = structuredClone(spec.days[0]);
    day.id = `day-${index + 1}`;
    day.date = `2026-07-${String(20 + index).padStart(2, "0")}`;
    day.stay = index === 4 ? undefined : { ...day.stay, type: "campground" };
    return day;
  });
  const cadenceIssues = evaluateFeasibility(spec).filter(item => item.code === "hotel-cadence");
  assert.equal(cadenceIssues.length, 1);
  assert.match(cadenceIssues[0].message, /连续 4 晚/);
});
