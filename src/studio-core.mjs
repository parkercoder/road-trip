import { DRAFT_STORAGE_KEY, validateTripSpec } from "./trip-spec.mjs?v=20260719-10";

const DAY_MS = 24 * 60 * 60 * 1000;

function isoDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function nextId(prefix, items) {
  const used = new Set(items.map(item => item.id));
  let number = items.length + 1;
  while (used.has(`${prefix}-${String(number).padStart(2, "0")}`)) number += 1;
  return `${prefix}-${String(number).padStart(2, "0")}`;
}

export function slugify(value, fallback = "road-trip") {
  const slug = String(value || "")
    .normalize("NFKD")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
  return slug || fallback;
}

export function createStarterTrip({ now = new Date() } = {}) {
  const date = isoDate(now);
  return {
    schemaVersion: "1.0",
    trip: {
      id: "new-road-trip",
      title: "New Road Trip",
      summary: "Plan a new trip, then open it in Traveler.",
      locale: "zh-CN",
      timezone: "America/Toronto",
      startDate: date,
      endDate: date,
      originPlaceId: "start",
      destinationPlaceId: "destination",
      roundTrip: false,
      status: "draft"
    },
    travelers: {
      adults: 1,
      children: [],
      accessibilityNeeds: []
    },
    vehicle: {
      mode: "car",
      fuelType: "gasoline"
    },
    preferences: {
      driving: {
        targetHoursPerDay: 5,
        maximumHoursPerDay: 8,
        restEveryMinutes: 120
      },
      route: {
        avoidCountries: [],
        avoidTolls: false,
        avoidFerries: false,
        preferScenicRoads: true,
        avoidRepeatingRoads: false
      },
      lodging: {
        preferredTypes: ["hotel", "campground"],
        requiredAmenities: [],
        preferredAmenities: ["parking"]
      },
      activities: {
        interests: [],
        hikingDifficulty: "any",
        maximumHikeHours: 4
      },
      alerts: {
        weather: true,
        wildfire: true,
        roadClosures: true,
        airQuality: true
      }
    },
    places: [
      {
        id: "start",
        name: "Toronto",
        kind: "home",
        location: { coordinates: { lat: 43.6532, lng: -79.3832 } },
        tags: ["origin"]
      },
      {
        id: "destination",
        name: "Ottawa",
        kind: "hotel",
        location: { coordinates: { lat: 45.4215, lng: -75.6972 } },
        tags: ["destination", "overnight"]
      }
    ],
    days: [
      {
        id: "day-01",
        date,
        title: "Toronto → Ottawa",
        originPlaceId: "start",
        destinationPlaceId: "destination",
        route: {
          anchorPlaceIds: ["start", "destination"],
          optionalStopPlaceIds: [],
          distanceKm: 450,
          driveMinutes: 300
        },
        stay: {
          placeId: "destination",
          type: "hotel",
          status: "idea",
          amenities: []
        },
        activities: [],
        notes: []
      }
    ],
    generated: {
      generatorVersion: "1.0.0"
    }
  };
}

export function placeUsage(spec, placeId) {
  let count = 0;
  if (spec.trip.originPlaceId === placeId) count += 1;
  if (spec.trip.destinationPlaceId === placeId) count += 1;
  for (const day of spec.days) {
    if (day.originPlaceId === placeId) count += 1;
    if (day.destinationPlaceId === placeId) count += 1;
    count += day.route.anchorPlaceIds.filter(id => id === placeId).length;
    count += day.route.optionalStopPlaceIds.filter(id => id === placeId).length;
    count += day.activities.filter(activity => activity.placeId === placeId).length;
    if (day.stay?.placeId === placeId) count += 1;
  }
  return count;
}

export function invalidateGeneratedRoute(spec) {
  if (!spec.generated) return spec;
  delete spec.generated.routeData;
  delete spec.generated.routeDataFile;
  return spec;
}

export function addPlace(spec, values = {}) {
  const id = nextId("place", spec.places);
  const reference = spec.places.at(-1)?.location?.coordinates || { lat: 45, lng: -79 };
  spec.places.push({
    id,
    name: values.name || "New place",
    kind: values.kind || "attraction",
    location: {
      coordinates: {
        lat: Number.isFinite(values.lat) ? values.lat : reference.lat,
        lng: Number.isFinite(values.lng) ? values.lng : reference.lng
      }
    },
    tags: []
  });
  return id;
}

export function removePlace(spec, placeId) {
  if (placeUsage(spec, placeId) > 0) return false;
  const index = spec.places.findIndex(place => place.id === placeId);
  if (index < 0) return false;
  spec.places.splice(index, 1);
  invalidateGeneratedRoute(spec);
  return true;
}

export function addDay(spec) {
  const previous = spec.days.at(-1);
  const originPlaceId = previous?.destinationPlaceId || spec.places[0]?.id;
  const destinationPlaceId = spec.places.find(place => place.id !== originPlaceId)?.id || originPlaceId;
  const previousDate = previous?.date ? new Date(`${previous.date}T12:00:00`) : new Date();
  const date = isoDate(new Date(previousDate.getTime() + DAY_MS));
  const origin = spec.places.find(place => place.id === originPlaceId)?.name || "Origin";
  const destination = spec.places.find(place => place.id === destinationPlaceId)?.name || "Destination";
  const id = nextId("day", spec.days);

  spec.days.push({
    id,
    date,
    title: `${origin} → ${destination}`,
    originPlaceId,
    destinationPlaceId,
    route: {
      anchorPlaceIds: [originPlaceId, destinationPlaceId],
      optionalStopPlaceIds: []
    },
    stay: {
      placeId: destinationPlaceId,
      type: "hotel",
      status: "idea",
      amenities: []
    },
    activities: [],
    notes: []
  });
  invalidateGeneratedRoute(spec);
  synchronizeTrip(spec);
  return id;
}

export function removeDay(spec, dayId) {
  if (spec.days.length <= 1) return false;
  const index = spec.days.findIndex(day => day.id === dayId);
  if (index < 0) return false;
  spec.days.splice(index, 1);
  invalidateGeneratedRoute(spec);
  synchronizeTrip(spec);
  return true;
}

export function setDayEndpoint(spec, dayId, endpoint, placeId) {
  const day = spec.days.find(item => item.id === dayId);
  if (!day || !["origin", "destination"].includes(endpoint)) return false;
  if (endpoint === "origin") {
    day.originPlaceId = placeId;
    day.route.anchorPlaceIds[0] = placeId;
  } else {
    day.destinationPlaceId = placeId;
    day.route.anchorPlaceIds[day.route.anchorPlaceIds.length - 1] = placeId;
    if (day.stay) day.stay.placeId = placeId;
  }
  invalidateGeneratedRoute(spec);
  synchronizeTrip(spec);
  return true;
}

export function addRouteAnchor(spec, dayId, placeId) {
  const day = spec.days.find(item => item.id === dayId);
  if (!day || !placeId) return false;
  day.route.anchorPlaceIds.splice(-1, 0, placeId);
  invalidateGeneratedRoute(spec);
  return true;
}

export function removeRouteAnchor(spec, dayId, index) {
  const day = spec.days.find(item => item.id === dayId);
  if (!day || index <= 0 || index >= day.route.anchorPlaceIds.length - 1) return false;
  day.route.anchorPlaceIds.splice(index, 1);
  invalidateGeneratedRoute(spec);
  return true;
}

export function addActivity(spec, dayId, placeId) {
  const day = spec.days.find(item => item.id === dayId);
  if (!day || !placeId) return false;
  day.activities.push({ placeId, priority: "optional" });
  if (!day.route.optionalStopPlaceIds.includes(placeId)) day.route.optionalStopPlaceIds.push(placeId);
  return true;
}

export function removeActivity(spec, dayId, index) {
  const day = spec.days.find(item => item.id === dayId);
  if (!day || index < 0 || index >= day.activities.length) return false;
  const [removed] = day.activities.splice(index, 1);
  if (!day.activities.some(activity => activity.placeId === removed.placeId)) {
    day.route.optionalStopPlaceIds = day.route.optionalStopPlaceIds.filter(id => id !== removed.placeId);
  }
  return true;
}

export function synchronizeTrip(spec) {
  const firstDay = spec.days[0];
  const lastDay = spec.days.at(-1);
  if (firstDay && lastDay) {
    spec.trip.startDate = firstDay.date;
    spec.trip.endDate = lastDay.date;
    spec.trip.originPlaceId = firstDay.originPlaceId;
    spec.trip.destinationPlaceId = lastDay.destinationPlaceId;
  }
  spec.trip.id = slugify(spec.trip.id || spec.trip.title);
  spec.trip.status = spec.trip.status || "draft";
  spec.generated = {
    ...(spec.generated || {}),
    generatorVersion: "1.0.0"
  };
  delete spec.generated.routeDataFile;
  return spec;
}

export function prepareTripSpec(spec) {
  const prepared = structuredClone(spec);
  synchronizeTrip(prepared);
  for (const day of prepared.days) {
    const notes = Array.isArray(day.notes) ? day.notes : day.notes == null ? [] : [day.notes];
    day.notes = notes.map(note => String(note).trim()).filter(Boolean);
    for (const activity of day.activities) {
      if (!activity.notes) delete activity.notes;
    }
  }
  return prepared;
}

export function draftErrors(spec) {
  const structuralErrors = validateTripSpec(spec);
  if (structuralErrors.length) return structuralErrors;
  return validateTripSpec(prepareTripSpec(spec));
}

export function saveDraft(spec, storage = globalThis.localStorage) {
  const prepared = prepareTripSpec(spec);
  storage.setItem(DRAFT_STORAGE_KEY, JSON.stringify(prepared));
  return prepared;
}

export function loadDraft(storage = globalThis.localStorage) {
  const raw = storage?.getItem(DRAFT_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function clearDraft(storage = globalThis.localStorage) {
  storage?.removeItem(DRAFT_STORAGE_KEY);
}
