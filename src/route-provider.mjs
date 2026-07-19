const DEFAULT_ENDPOINTS = Object.freeze({
  car: "https://routing.openstreetmap.de/routed-car/route/v1/driving",
  campervan: "https://routing.openstreetmap.de/routed-car/route/v1/driving",
  rv: "https://routing.openstreetmap.de/routed-car/route/v1/driving",
  motorcycle: "https://routing.openstreetmap.de/routed-car/route/v1/driving",
  bicycle: "https://routing.openstreetmap.de/routed-bike/route/v1/driving",
  walking: "https://routing.openstreetmap.de/routed-foot/route/v1/driving"
});

const MODE_LABELS = Object.freeze({
  car: "驾车",
  campervan: "露营车",
  rv: "房车",
  motorcycle: "摩托车",
  bicycle: "骑行",
  walking: "步行",
  airplane: "飞机"
});

const ROAD_MODES = new Set(["car", "campervan", "rv", "motorcycle"]);

function roadUrl(endpoint, coordinates) {
  const pairs = coordinates
    .map(({ lat, lng }) => `${Number(lng).toFixed(6)},${Number(lat).toFixed(6)}`)
    .join(";");
  const radiuses = coordinates.map(() => "5000").join(";");
  return `${endpoint.replace(/\/$/, "")}/${pairs}?overview=full&steps=true&geometries=polyline6&alternatives=false&radiuses=${radiuses}`;
}

function delay(milliseconds) {
  return milliseconds > 0 ? new Promise(resolve => setTimeout(resolve, milliseconds)) : Promise.resolve();
}

function routeColor(coordinates, mode) {
  if (mode === "walking") return "#14805e";
  if (mode === "bicycle") return "#0f7490";
  return coordinates.at(-1).lng < coordinates[0].lng ? "#1769d1" : "#d46a1f";
}

function placeTags(place) {
  return new Set(Array.isArray(place?.tags) ? place.tags : []);
}

function isBackcountryTrailPlace(place) {
  const tags = placeTags(place);
  return place?.kind === "trailhead"
    || tags.has("backcountry-campground")
    || tags.has("backcountry-access");
}

function legMode(primaryMode, from, to) {
  if (from.kind === "ferry-terminal" && to.kind === "ferry-terminal") return "ferry";
  if (from.kind === "airport" && to.kind === "airport") return "airplane";
  if (isBackcountryTrailPlace(from) && isBackcountryTrailPlace(to)) return "walking";
  return primaryMode;
}

function routeChunksForDay(day, placeById, primaryMode) {
  const places = day.route.anchorPlaceIds.map(id => placeById.get(id));
  if (places.some(place => !place?.location?.coordinates)) return null;
  const chunks = [];
  let current = null;

  const flush = () => {
    if (current?.places.length > 1) chunks.push(current);
    current = null;
  };

  for (let index = 0; index < places.length - 1; index += 1) {
    const from = places[index];
    const to = places[index + 1];
    const mode = legMode(primaryMode, from, to);
    if (["ferry", "airplane"].includes(mode)) {
      flush();
      continue;
    }
    if (!current) current = { mode, places: [from, to] };
    else if (current.mode === mode && current.places.at(-1).id === from.id) current.places.push(to);
    else {
      flush();
      current = { mode, places: [from, to] };
    }
  }
  flush();
  return chunks;
}

function modifierText(modifier) {
  return ({
    "uturn": "掉头",
    "sharp right": "向右急转",
    "right": "右转",
    "slight right": "稍向右转",
    "straight": "直行",
    "slight left": "稍向左转",
    "left": "左转",
    "sharp left": "向左急转"
  })[modifier] || "继续前行";
}

function stepInstruction(step) {
  const maneuver = step?.maneuver || {};
  const road = step?.name ? `进入 ${step.name}` : "";
  const toward = step?.destinations ? `，朝 ${step.destinations}` : "";
  switch (maneuver.type) {
    case "depart": return road ? `出发，${road}${toward}` : "从起点出发";
    case "arrive": return "到达目的地";
    case "roundabout":
    case "rotary": return `进入环岛${maneuver.exit ? `，从第 ${maneuver.exit} 个出口驶出` : ""}${road ? `，${road}` : ""}`;
    case "merge": return `并入${step.name ? ` ${step.name}` : "前方道路"}${toward}`;
    case "on ramp": return `${modifierText(maneuver.modifier)}上匝道${toward}`;
    case "off ramp": return `${modifierText(maneuver.modifier)}驶出匝道${toward}`;
    case "fork": return `在岔路口${modifierText(maneuver.modifier)}${road ? `，${road}` : ""}${toward}`;
    case "end of road": return `道路尽头${modifierText(maneuver.modifier)}${road ? `，${road}` : ""}`;
    case "new name": return road ? `继续前行，${road}${toward}` : "继续前行";
    case "continue": return `${modifierText(maneuver.modifier)}${road ? `，${road}` : ""}${toward}`;
    case "turn":
    default: return `${modifierText(maneuver.modifier)}${road ? `，${road}` : ""}${toward}`;
  }
}

function normalizeStep(step) {
  const location = Array.isArray(step?.maneuver?.location) ? step.maneuver.location : [];
  return {
    distanceMeters: Math.round(Number(step?.distance) || 0),
    durationSeconds: Math.round(Number(step?.duration) || 0),
    instruction: stepInstruction(step),
    ...(step?.name ? { name: step.name } : {}),
    maneuver: {
      type: step?.maneuver?.type || "turn",
      ...(step?.maneuver?.modifier ? { modifier: step.maneuver.modifier } : {}),
      ...(Number.isInteger(step?.maneuver?.exit) && step.maneuver.exit > 0 ? { exit: step.maneuver.exit } : {}),
      ...(location.length === 2 ? { location: [Number(location[1]), Number(location[0])] } : {})
    }
  };
}

export function routeFingerprint(spec) {
  return JSON.stringify({
    version: 2,
    tripId: spec.trip.id,
    mode: spec.vehicle.mode,
    days: spec.days.map(day => ({
      id: day.id,
      anchors: day.route.anchorPlaceIds.map(id => {
        const place = spec.places.find(item => item.id === id);
        const coordinates = place?.location?.coordinates || {};
        const tags = Array.isArray(place?.tags) ? place.tags.slice().sort() : [];
        return [id, coordinates.lat, coordinates.lng, place?.kind, ...tags];
      })
    }))
  });
}

export function hasSurfaceRouteLegs(spec) {
  const placeById = new Map(spec.places.map(place => [place.id, place]));
  return spec.days.some(day => day.route.anchorPlaceIds.some((id, index, ids) => {
    if (index >= ids.length - 1) return false;
    const from = placeById.get(id);
    const to = placeById.get(ids[index + 1]);
    return !((from?.kind === "ferry-terminal" && to?.kind === "ferry-terminal")
      || (from?.kind === "airport" && to?.kind === "airport"));
  }));
}

export function hasCurrentRoutePlan(spec) {
  if (spec.vehicle.mode === "airplane") return true;
  const routeData = spec.generated?.routeData;
  return routeData?.routeFingerprint === routeFingerprint(spec)
    && Array.isArray(routeData.segments)
    && (routeData.segments.length > 0
      || (Array.isArray(routeData.unroutedSegments) && routeData.unroutedSegments.length > 0)
      || !hasSurfaceRouteLegs(spec));
}

export async function enrichRoutePlan(spec, {
  fetchImpl = globalThis.fetch,
  endpoint,
  endpoints = DEFAULT_ENDPOINTS,
  minIntervalMs = 1100,
  now = () => new Date()
} = {}) {
  const mode = spec.vehicle.mode;
  spec.generated ||= {};
  if (mode === "airplane") {
    spec.generated.routeData = {
      generatedAt: now().toISOString(),
      source: "Point-to-point flight preview",
      tripId: spec.trip.id,
      mode,
      routeFingerprint: routeFingerprint(spec),
      segments: [],
      unroutedSegments: []
    };
    return [];
  }

  if (!endpoint && !endpoints[mode]) {
    return [{
      severity: "warning",
      code: "route-mode-provider",
      message: `${MODE_LABELS[mode] || mode}尚未配置路线 provider，Traveler 将显示路线锚点。`
    }];
  }

  const placeById = new Map(spec.places.map(place => [place.id, place]));
  const issues = [];
  const segments = [];
  const unroutedSegments = [];
  let previousRequestAt = 0;

  for (const day of spec.days) {
    const chunks = routeChunksForDay(day, placeById, mode);
    if (!chunks) {
      issues.push({ severity: "warning", code: "route-coordinates", dayId: day.id, message: `${day.date} 缺少路线坐标，无法生成实际路线。` });
      continue;
    }

    let dayDistanceMeters = 0;
    let dayDurationSeconds = 0;
    for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
      const chunk = chunks[chunkIndex];
      const coordinates = chunk.places.map(place => place.location.coordinates);
      const selectedEndpoint = endpoint && chunk.mode === mode ? endpoint : endpoints[chunk.mode];
      try {
        if (!selectedEndpoint) throw new Error(`${MODE_LABELS[chunk.mode] || chunk.mode} provider unavailable`);
        const elapsed = Date.now() - previousRequestAt;
        await delay(previousRequestAt ? Math.max(0, minIntervalMs - elapsed) : 0);
        const response = await fetchImpl(roadUrl(selectedEndpoint, coordinates), {
          headers: { accept: "application/json" }
        });
        previousRequestAt = Date.now();
        const data = await response.json();
        const route = data?.routes?.[0];
        if (!response.ok || typeof route?.geometry !== "string") {
          throw new Error(data?.message || `HTTP ${response.status}`);
        }
        const distanceMeters = Math.round(Number(route.distance) || 0);
        const durationSeconds = Math.round(Number(route.duration) || 0);
        dayDistanceMeters += distanceMeters;
        if (chunk.mode === mode || (ROAD_MODES.has(mode) && ROAD_MODES.has(chunk.mode))) {
          dayDurationSeconds += durationSeconds;
        }
        segments.push({
          id: `${day.id}-route-${String(chunkIndex + 1).padStart(2, "0")}`,
          dayId: day.id,
          mode: chunk.mode,
          anchorPlaceIds: chunk.places.map(place => place.id),
          color: routeColor(coordinates, chunk.mode),
          distanceMeters,
          durationSeconds,
          geometry: route.geometry,
          steps: (route.legs || []).flatMap(leg => (leg.steps || []).map(normalizeStep))
        });
      } catch (error) {
        const reason = error?.message || "provider error";
        for (let legIndex = 0; legIndex < chunk.places.length - 1; legIndex += 1) {
          unroutedSegments.push({
            id: `${day.id}-unrouted-${String(chunkIndex + 1).padStart(2, "0")}-${String(legIndex + 1).padStart(2, "0")}`,
            dayId: day.id,
            mode: chunk.mode,
            fromPlaceId: chunk.places[legIndex].id,
            toPlaceId: chunk.places[legIndex + 1].id,
            message: chunk.mode === "walking"
              ? `未在 OpenStreetMap 步道网络中找到连续路径；当前显示锚点连线，请用官方地图或 GPX 校对。`
              : `未能吸附到${MODE_LABELS[chunk.mode] || "地面"}网络；当前显示锚点连线，请检查坐标。`
          });
        }
        issues.push({
          severity: "warning",
          code: "route-provider",
          dayId: day.id,
          message: `${day.date} ${MODE_LABELS[chunk.mode] || "路线"}生成失败：${reason}`
        });
      }
    }

    if (dayDistanceMeters > 0) day.route.distanceKm = Math.round(dayDistanceMeters / 1000);
    if (dayDurationSeconds > 0) {
      day.route.driveMinutes = Math.round(dayDurationSeconds / 60) + (Number(day.route.ferryMinutes) || 0);
    }
    if (day.route.anchorPlaceIds.some((id, index, ids) => {
      const next = placeById.get(ids[index + 1]);
      return placeById.get(id)?.kind === "ferry-terminal" && next?.kind === "ferry-terminal";
    })) {
      issues.push({ severity: "info", code: "route-ferry", dayId: day.id, message: `${day.date} 的轮渡段保持独立显示，请按实际班次复核。` });
    }
    if (day.route.anchorPlaceIds.some((id, index, ids) => {
      const next = placeById.get(ids[index + 1]);
      return placeById.get(id)?.kind === "airport" && next?.kind === "airport";
    })) {
      issues.push({ severity: "info", code: "route-flight", dayId: day.id, message: `${day.date} 的机场到机场段已识别为航班，使用直线连接。` });
    }
    if (chunks.some(chunk => chunk.mode === "walking") && mode !== "walking") {
      issues.push({ severity: "info", code: "route-walking", dayId: day.id, message: `${day.date} 的 backcountry 锚点已识别为徒步段，使用 trail 路线。` });
    }
  }

  spec.generated.routeData = {
    generatedAt: now().toISOString(),
    source: "FOSSGIS OSRM / OpenStreetMap network",
    tripId: spec.trip.id,
    mode,
    routeFingerprint: routeFingerprint(spec),
    segments,
    unroutedSegments
  };
  return issues;
}

export const enrichRoadMetrics = enrichRoutePlan;
