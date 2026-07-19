export const DEFAULT_TRIP_PATH = "data/cross-canada.trip.json";
export const DRAFT_STORAGE_KEY = "road-trip.studio.trip.v1";
const ID_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const PLACE_KINDS = new Set([
  "origin", "destination", "overnight", "campground", "hotel", "airport", "charging", "fuel",
  "ferry-terminal", "attraction", "trailhead", "lookout", "food", "service", "home"
]);

export class TripSpecError extends Error {
  constructor(message, code, details = []) {
    super(message);
    this.name = "TripSpecError";
    this.code = code;
    this.details = details;
  }
}

export function validateTripSpec(spec) {
  const errors = [];
  if (!spec || typeof spec !== "object" || Array.isArray(spec)) {
    return ["TripPlan must be a JSON object"];
  }

  if (spec.schemaVersion !== "1.0") errors.push("schemaVersion must be 1.0");
  for (const key of ["trip", "travelers", "vehicle", "preferences", "places", "days"]) {
    if (spec[key] == null) errors.push(`missing top-level field: ${key}`);
  }

  if (spec.trip) {
    if (!ID_PATTERN.test(spec.trip.id || "")) errors.push("trip.id must use lowercase letters, numbers, and hyphens");
    if (!String(spec.trip.title || "").trim()) errors.push("trip.title is required");
    if (!DATE_PATTERN.test(spec.trip.startDate || "")) errors.push("trip.startDate must use YYYY-MM-DD");
    if (!DATE_PATTERN.test(spec.trip.endDate || "")) errors.push("trip.endDate must use YYYY-MM-DD");
    if (!String(spec.trip.locale || "").trim()) errors.push("trip.locale is required");
    if (!String(spec.trip.timezone || "").trim()) errors.push("trip.timezone is required");
  }

  if (spec.travelers) {
    if (!Number.isInteger(spec.travelers.adults) || spec.travelers.adults < 0) errors.push("travelers.adults must be a non-negative integer");
    if (!Array.isArray(spec.travelers.children)) errors.push("travelers.children must be an array");
  }

  if (spec.vehicle) {
    if (!["car", "campervan", "rv", "motorcycle", "airplane", "bicycle", "walking"].includes(spec.vehicle.mode)) errors.push("vehicle.mode is invalid");
    if (!["gasoline", "diesel", "hybrid", "electric", "aviation", "human"].includes(spec.vehicle.fuelType)) errors.push("vehicle.fuelType is invalid");
  }

  if (spec.preferences) {
    for (const key of ["driving", "route", "lodging", "activities", "alerts"]) {
      if (!spec.preferences[key] || typeof spec.preferences[key] !== "object") errors.push(`preferences.${key} is required`);
    }
    const { targetHoursPerDay, maximumHoursPerDay } = spec.preferences.driving || {};
    if (!Number.isFinite(targetHoursPerDay) || targetHoursPerDay <= 0 || targetHoursPerDay > 24) {
      errors.push("preferences.driving.targetHoursPerDay must be between 0 and 24");
    }
    if (!Number.isFinite(maximumHoursPerDay) || maximumHoursPerDay <= 0 || maximumHoursPerDay > 24) {
      errors.push("preferences.driving.maximumHoursPerDay must be between 0 and 24");
    }
  }

  const places = new Map();
  if (!Array.isArray(spec.places)) {
    errors.push("places must be an array");
  } else {
    for (const place of spec.places) {
      if (!place || typeof place !== "object") {
        errors.push("every place must be an object");
        continue;
      }
      if (!place.id) errors.push("every place requires an id");
      else if (!ID_PATTERN.test(place.id)) errors.push(`invalid place id: ${place.id}`);
      else if (places.has(place.id)) errors.push(`duplicate place id: ${place.id}`);
      else places.set(place.id, place);

      if (!String(place.name || "").trim()) errors.push(`place name is required: ${place.id || "unknown"}`);
      if (!PLACE_KINDS.has(place.kind)) errors.push(`invalid place kind "${place.kind || "missing"}": ${place.id || "unknown"}`);

      const { lat, lng } = place.location?.coordinates || {};
      if (!Number.isFinite(lat) || lat < -90 || lat > 90) errors.push(`invalid latitude: ${place.id || "unknown"}`);
      if (!Number.isFinite(lng) || lng < -180 || lng > 180) errors.push(`invalid longitude: ${place.id || "unknown"}`);
      if (place.location?.coordinateStatus && !["resolved", "unverified", "stale"].includes(place.location.coordinateStatus)) {
        errors.push(`invalid coordinate status: ${place.id || "unknown"}`);
      }
    }
  }

  for (const placeId of [spec.trip?.originPlaceId, spec.trip?.destinationPlaceId].filter(Boolean)) {
    if (!places.has(placeId)) errors.push(`trip references missing place: ${placeId}`);
  }

  const dayIds = new Set();
  if (!Array.isArray(spec.days) || !spec.days.length) {
    errors.push("days must be a non-empty array");
  } else {
    for (const day of spec.days) {
      if (!day || typeof day !== "object") {
        errors.push("every day must be an object");
        continue;
      }
      if (!day.id) errors.push("every day requires an id");
      else if (!ID_PATTERN.test(day.id)) errors.push(`invalid day id: ${day.id}`);
      else if (dayIds.has(day.id)) errors.push(`duplicate day id: ${day.id}`);
      else dayIds.add(day.id);

      if (!DATE_PATTERN.test(day.date || "")) errors.push(`${day.id || "unknown day"} date must use YYYY-MM-DD`);
      if (!String(day.title || "").trim()) errors.push(`${day.id || "unknown day"} title is required`);

      const anchors = Array.isArray(day.route?.anchorPlaceIds) ? day.route.anchorPlaceIds : [];
      const optionalStops = Array.isArray(day.route?.optionalStopPlaceIds) ? day.route.optionalStopPlaceIds : [];
      const activities = Array.isArray(day.activities) ? day.activities : [];
      if (!Array.isArray(day.route?.anchorPlaceIds)) errors.push(`${day.id || "unknown day"} anchorPlaceIds must be an array`);
      if (!Array.isArray(day.route?.optionalStopPlaceIds)) errors.push(`${day.id || "unknown day"} optionalStopPlaceIds must be an array`);
      if (!Array.isArray(day.activities)) errors.push(`${day.id || "unknown day"} activities must be an array`);
      if (day.notes != null && !Array.isArray(day.notes)) errors.push(`${day.id || "unknown day"} notes must be an array`);

      const references = [
        day.originPlaceId,
        day.destinationPlaceId,
        ...anchors,
        ...optionalStops,
        ...activities.map(activity => activity?.placeId),
        day.stay?.placeId
      ].filter(Boolean);

      for (const placeId of references) {
        if (!places.has(placeId)) errors.push(`${day.id || "unknown day"} references missing place: ${placeId}`);
      }

      if (anchors.length < 2) errors.push(`${day.id || "unknown day"} needs at least two route anchors`);
      if (anchors[0] !== day.originPlaceId) errors.push(`${day.id || "unknown day"} first anchor must be its origin`);
      if (anchors.at(-1) !== day.destinationPlaceId) errors.push(`${day.id || "unknown day"} last anchor must be its destination`);
    }
  }

  return errors;
}

export function resolveTripUrl({
  search = "",
  baseUrl,
  defaultPath = DEFAULT_TRIP_PATH
}) {
  const base = new URL(baseUrl);
  const requestedPath = new URLSearchParams(search).get("trip")?.trim() || defaultPath;
  let resolved;

  try {
    resolved = new URL(requestedPath, base);
  } catch {
    throw new TripSpecError("行程地址无效。", "invalid-url");
  }

  if (resolved.origin !== base.origin) {
    throw new TripSpecError("只支持载入当前站点内的 TripPlan 文件。", "unsupported-origin");
  }
  if (!resolved.pathname.toLowerCase().endsWith(".json")) {
    throw new TripSpecError("行程文件必须是 JSON。", "unsupported-file");
  }

  return resolved.href;
}

export async function loadTripSpec({
  search = globalThis.location?.search || "",
  baseUrl = globalThis.location?.href,
  defaultPath = DEFAULT_TRIP_PATH,
  fetchImpl = globalThis.fetch,
  storage = globalThis.localStorage
} = {}) {
  const params = new URLSearchParams(search);
  if (params.get("draft") === "1") {
    const rawDraft = storage?.getItem(DRAFT_STORAGE_KEY);
    if (!rawDraft) {
      throw new TripSpecError("Trip Builder 中没有可预览的草稿。", "missing-draft");
    }

    let draft;
    try {
      draft = JSON.parse(rawDraft);
    } catch {
      throw new TripSpecError("Trip Builder 草稿不是有效的 JSON。", "invalid-draft-json");
    }

    const draftErrors = validateTripSpec(draft);
    if (draftErrors.length) {
      throw new TripSpecError(`Trip Builder 草稿校验失败：${draftErrors.slice(0, 3).join("；")}`, "invalid-draft", draftErrors);
    }
    return { spec: draft, url: "studio-draft", source: "draft" };
  }

  const url = resolveTripUrl({ search, baseUrl, defaultPath });
  let response;

  try {
    response = await fetchImpl(url, { cache: "no-store" });
  } catch {
    throw new TripSpecError("无法连接到行程文件。", "network-error");
  }

  if (!response.ok) {
    throw new TripSpecError(`无法读取行程文件（HTTP ${response.status}）。`, "http-error");
  }

  let spec;
  try {
    spec = await response.json();
  } catch {
    throw new TripSpecError("行程文件不是有效的 JSON。", "invalid-json");
  }

  const errors = validateTripSpec(spec);
  if (errors.length) {
    throw new TripSpecError(`TripPlan 校验失败：${errors.slice(0, 3).join("；")}`, "invalid-spec", errors);
  }

  return { spec, url, source: "file" };
}

export function validateRouteData(spec, data) {
  if (data?.tripId && data.tripId !== spec.trip.id) {
    throw new TripSpecError("实际路线属于另一个行程。", "route-mismatch");
  }
  const segments = Array.isArray(data?.segments) ? data.segments : [];
  const unroutedSegments = Array.isArray(data?.unroutedSegments) ? data.unroutedSegments : [];
  if (!segments.length && !unroutedSegments.length) {
    throw new TripSpecError("路线数据没有可用路径。", "empty-route-data");
  }
  return segments;
}

function placeIndex(spec) {
  return new Map(spec.places.map(place => [place.id, place]));
}

function coordinatesFor(placeById, placeId) {
  const coordinates = placeById.get(placeId)?.location?.coordinates;
  if (!coordinates) throw new TripSpecError(`缺少地点坐标：${placeId}`, "missing-coordinates");
  return [coordinates.lat, coordinates.lng];
}

function directionColor(placeById, day) {
  const origin = coordinatesFor(placeById, day.originPlaceId);
  const destination = coordinatesFor(placeById, day.destinationPlaceId);
  return destination[1] < origin[1] ? "#1769d1" : "#d46a1f";
}

export function deriveRouteSegments(spec) {
  const placeById = placeIndex(spec);
  const segments = [];
  let current = null;
  let segmentNumber = 0;

  const flush = () => {
    if (current?.coords.length > 1) {
      current.id = `route-${String(++segmentNumber).padStart(2, "0")}`;
      segments.push(current);
    }
    current = null;
  };

  for (const day of spec.days) {
    const color = directionColor(placeById, day);
    const anchors = day.route.anchorPlaceIds;

    for (let index = 0; index < anchors.length - 1; index += 1) {
      const from = placeById.get(anchors[index]);
      const to = placeById.get(anchors[index + 1]);
      const fromPos = coordinatesFor(placeById, from.id);
      const toPos = coordinatesFor(placeById, to.id);

      if ((from.kind === "ferry-terminal" && to.kind === "ferry-terminal")
        || (from.kind === "airport" && to.kind === "airport")) {
        flush();
        continue;
      }

      const continues = current
        && current.color === color
        && current.coords.at(-1)[0] === fromPos[0]
        && current.coords.at(-1)[1] === fromPos[1];

      if (!continues) {
        flush();
        current = { color, coords: [fromPos, toPos] };
      } else {
        current.coords.push(toPos);
      }
    }
  }

  flush();
  return segments;
}

export function deriveFerryLegs(spec) {
  const placeById = placeIndex(spec);
  const ferryLegs = [];

  for (const day of spec.days) {
    const anchors = day.route.anchorPlaceIds;
    for (let index = 0; index < anchors.length - 1; index += 1) {
      const from = placeById.get(anchors[index]);
      const to = placeById.get(anchors[index + 1]);
      if (from.kind !== "ferry-terminal" || to.kind !== "ferry-terminal") continue;

      ferryLegs.push({
        name: `${from.name} → ${to.name}`,
        dayId: day.id,
        coords: [coordinatesFor(placeById, from.id), coordinatesFor(placeById, to.id)],
        note: day.route.ferryMinutes
          ? `${day.date} · ferry ${day.route.ferryMinutes} min`
          : day.date
      });
    }
  }

  return ferryLegs;
}

export function deriveFlightLegs(spec) {
  const placeById = placeIndex(spec);
  const flightLegs = [];

  for (const day of spec.days) {
    const anchors = day.route.anchorPlaceIds;
    for (let index = 0; index < anchors.length - 1; index += 1) {
      const from = placeById.get(anchors[index]);
      const to = placeById.get(anchors[index + 1]);
      if (from.kind !== "airport" || to.kind !== "airport") continue;

      flightLegs.push({
        name: `${from.name} → ${to.name}`,
        dayId: day.id,
        coords: [coordinatesFor(placeById, from.id), coordinatesFor(placeById, to.id)],
        note: `${day.date} · flight`
      });
    }
  }

  return flightLegs;
}

function isoDateInTimeZone(date, timeZone) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function createTravelerModel(spec, { now = new Date() } = {}) {
  const placeById = placeIndex(spec);
  const positionFor = placeId => coordinatesFor(placeById, placeId);
  const dateFormatter = new Intl.DateTimeFormat(spec.trip.locale || "zh-CN", {
    month: "numeric",
    day: "numeric",
    timeZone: "UTC"
  });
  const todayIso = isoDateInTimeZone(now, spec.trip.timezone);

  const days = spec.days.map(day => {
    const stay = day.stay ? placeById.get(day.stay.placeId) : placeById.get(day.destinationPlaceId);
    const hasDriveTime = Number.isFinite(day.route.driveMinutes);
    const driveHours = hasDriveTime ? Math.floor(day.route.driveMinutes / 60) : 0;
    const driveRemainder = hasDriveTime ? day.route.driveMinutes % 60 : 0;
    const drive = !hasDriveTime ? "时间待计算"
      : driveRemainder ? `${driveHours}h ${driveRemainder}m`
      : `${driveHours}h`;
    const stayType = day.stay?.type || stay.kind;

    return {
      id: day.id,
      day: dateFormatter.format(new Date(`${day.date}T00:00:00Z`)),
      title: day.title,
      name: stay.name,
      type: stay.kind === "airport" ? "airport"
        : stayType === "campground" || stayType === "rv-park" ? "camp"
        : stayType === "hotel" || stayType === "motel" ? "hotel"
        : "home",
      pos: positionFor(stay.id),
      distance: Number.isFinite(day.route.distanceKm) ? `约${Math.round(day.route.distanceKm)} km` : "里程待计算",
      drive,
      note: (day.notes || []).join(" ") || day.stay?.notes || "",
      today: day.date === todayIso
    };
  });

  const activities = spec.days.flatMap(day =>
    day.activities.map(activity => {
      const place = placeById.get(activity.placeId);
      return [place.name, positionFor(place.id), day.id, activity.notes || place.notes || ""];
    })
  );

  const chargerByPlace = new Map();
  for (const day of spec.days) {
    for (const placeId of day.route.anchorPlaceIds) {
      const place = placeById.get(placeId);
      if (place.kind === "charging" && !chargerByPlace.has(placeId)) {
        chargerByPlace.set(placeId, [place.name, positionFor(placeId), day.id]);
      }
    }
  }

  const originPlace = placeById.get(spec.trip.originPlaceId);
  return {
    placeById,
    positionFor,
    routeSegments: deriveRouteSegments(spec),
    ferries: deriveFerryLegs(spec),
    flights: deriveFlightLegs(spec),
    days,
    activities,
    chargers: [...chargerByPlace.values()],
    originPlace,
    originPos: positionFor(originPlace.id),
    vehicleName: [spec.vehicle.make, spec.vehicle.model].filter(Boolean).join(" ") || ({
      car: "Car",
      campervan: "Campervan",
      rv: "RV",
      motorcycle: "Motorcycle",
      airplane: "Flight",
      bicycle: "Bicycle",
      walking: "Walking"
    }[spec.vehicle.mode] || "Transport"),
    transportMode: spec.vehicle.mode
  };
}

// Product-facing aliases; legacy names remain available for V1 integrations.
export { TripSpecError as TripPlanError };
export const validateTripPlan = validateTripSpec;
export const loadTripPlan = loadTripSpec;
