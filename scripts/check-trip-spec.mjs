import { readFile } from "node:fs/promises";

const files = process.argv.slice(2);
if (!files.length) {
  throw new Error("Usage: node scripts/check-trip-spec.mjs <trip.json> [...trip.json]");
}

async function validate(file) {
  const spec = JSON.parse(await readFile(file, "utf8"));
  const errors = [];

  if (spec.schemaVersion !== "1.0") errors.push("schemaVersion must be 1.0");
  for (const key of ["trip", "travelers", "vehicle", "preferences", "places", "days"]) {
    if (spec[key] == null) errors.push(`missing top-level field: ${key}`);
  }

  const places = new Map();
  for (const place of Array.isArray(spec.places) ? spec.places : []) {
    if (!place.id) errors.push("every place requires an id");
    else if (places.has(place.id)) errors.push(`duplicate place id: ${place.id}`);
    else places.set(place.id, place);

    const { lat, lng } = place.location?.coordinates || {};
    if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.push(`invalid latitude: ${place.id || "unknown"}`);
    if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.push(`invalid longitude: ${place.id || "unknown"}`);
  }

  for (const placeId of [spec.trip?.originPlaceId, spec.trip?.destinationPlaceId].filter(Boolean)) {
    if (!places.has(placeId)) errors.push(`trip references missing place: ${placeId}`);
  }

  const days = new Set();
  for (const day of Array.isArray(spec.days) ? spec.days : []) {
    if (!day.id) errors.push("every day requires an id");
    else if (days.has(day.id)) errors.push(`duplicate day id: ${day.id}`);
    else days.add(day.id);

    const references = [
      day.originPlaceId,
      day.destinationPlaceId,
      ...(day.route?.anchorPlaceIds || []),
      ...(day.route?.optionalStopPlaceIds || []),
      ...(day.activities || []).map(activity => activity.placeId),
      day.stay?.placeId
    ].filter(Boolean);

    for (const placeId of references) {
      if (!places.has(placeId)) errors.push(`${day.id || "unknown day"} references missing place: ${placeId}`);
    }

    const anchors = day.route?.anchorPlaceIds || [];
    if (anchors.length < 2) errors.push(`${day.id || "unknown day"} needs at least two route anchors`);
    if (anchors[0] !== day.originPlaceId) errors.push(`${day.id || "unknown day"} first anchor must be its origin`);
    if (anchors.at(-1) !== day.destinationPlaceId) errors.push(`${day.id || "unknown day"} last anchor must be its destination`);
  }

  return errors;
}

let invalid = false;
for (const file of files) {
  const errors = await validate(file);
  if (errors.length) {
    console.error(`TripSpec validation failed for ${file}:\n- ${errors.join("\n- ")}`);
    invalid = true;
  } else {
    console.log(`TripSpec validation passed: ${file}`);
  }
}

if (invalid) process.exitCode = 1;
