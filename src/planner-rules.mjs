import { validateTripSpec } from "./trip-spec.mjs?v=20260719-9";

const HOTEL_TYPES = new Set(["hotel", "motel", "cabin", "rental"]);
const ROAD_MODES = new Set(["car", "campervan", "rv", "motorcycle"]);

function issue(severity, code, message, dayId) {
  return { severity, code, message, ...(dayId ? { dayId } : {}) };
}

function haversineKm(a, b) {
  const radians = value => value * Math.PI / 180;
  const lat1 = radians(a.lat);
  const lat2 = radians(b.lat);
  const dLat = lat2 - lat1;
  const dLng = radians(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

function isFlightPair(from, to) {
  return from?.kind === "airport" && to?.kind === "airport";
}

function dayHasFlight(day, placeById) {
  return day.route.anchorPlaceIds.some((id, index, ids) =>
    index < ids.length - 1 && isFlightPair(placeById.get(id), placeById.get(ids[index + 1]))
  );
}

function surfaceMinutesForDay(spec, day, hasFlight) {
  if (!hasFlight && spec.vehicle.mode !== "airplane") return day.route.driveMinutes;
  const routeData = spec.generated?.routeData;
  if (!routeData || routeData.tripId !== spec.trip.id || !Array.isArray(routeData.segments)) return undefined;
  return Math.round(routeData.segments
    .filter(segment => segment.dayId === day.id)
    .filter(segment => !segment.mode
      || (ROAD_MODES.has(spec.vehicle.mode) ? ROAD_MODES.has(segment.mode) : segment.mode === spec.vehicle.mode))
    .reduce((sum, segment) => sum + (Number(segment.durationSeconds) || 0), 0) / 60);
}

function hotelCadenceIssue(run, hotelEveryDays) {
  if (run.length < hotelEveryDays) return null;
  const range = run.length === 1 ? run[0].date : `${run[0].date} 至 ${run.at(-1).date}`;
  return issue(
    "warning",
    "hotel-cadence",
    `${range} 连续 ${run.length} 晚为非酒店住宿，与“每 ${hotelEveryDays} 天住一次酒店”的偏好冲突。`,
    run.at(-1).id
  );
}

export function evaluateFeasibility(spec) {
  const issues = validateTripSpec(spec).map(message => issue("error", "invalid-tripplan", message));
  if (issues.length) return issues;

  const placeById = new Map(spec.places.map(place => [place.id, place]));
  const maximumMinutes = Number(spec.preferences.driving.maximumHoursPerDay) * 60;
  const targetMinutes = Number(spec.preferences.driving.targetHoursPerDay) * 60;
  const evRange = spec.vehicle.fuelType === "electric" ? Number(spec.vehicle.practicalRangeKm) : 0;

  for (const place of spec.places) {
    if (place.location?.coordinateStatus === "stale") {
      issues.push({ ...issue("error", "stale-place-coordinates", `${place.name} 的地址已变化，但经纬度尚未重新解析。`), placeId: place.id });
    } else if (place.location?.coordinateStatus === "unverified") {
      issues.push({ ...issue("warning", "unverified-place-coordinates", `${place.name} 的坐标由 AI 提议，尚未通过地址定位或地图取点复核。`), placeId: place.id });
    }
  }

  for (let index = 0; index < spec.days.length; index += 1) {
    const day = spec.days[index];
    const previous = spec.days[index - 1];
    if (previous && previous.destinationPlaceId !== day.originPlaceId) {
      issues.push(issue("error", "route-discontinuity", `${day.date} 的起点不是前一天终点。`, day.id));
    }
    const hasFlight = dayHasFlight(day, placeById);
    const surfaceMinutes = surfaceMinutesForDay(spec, day, hasFlight);
    if (Number.isFinite(surfaceMinutes)) {
      if (surfaceMinutes > maximumMinutes) {
        issues.push(issue("error", "maximum-driving-time", `${day.date} 预计驾驶 ${(surfaceMinutes / 60).toFixed(1)} 小时，超过上限 ${spec.preferences.driving.maximumHoursPerDay} 小时。`, day.id));
      } else if (surfaceMinutes > targetMinutes * 1.15) {
        issues.push(issue("warning", "target-driving-time", `${day.date} 驾驶时间高于目标值。`, day.id));
      }
    } else if (!hasFlight && spec.vehicle.mode !== "airplane") {
      issues.push(issue("warning", "missing-road-metrics", `${day.date} 尚未获得公路驾驶时间。`, day.id));
    }

    if (day.stay && day.stay.placeId !== day.destinationPlaceId) {
      issues.push(issue("warning", "stay-detour", `${day.date} 的住宿地点不是当天路线终点。`, day.id));
    }

    if (evRange > 0) {
      const safeRange = evRange * 0.8;
      for (let anchorIndex = 1; anchorIndex < day.route.anchorPlaceIds.length; anchorIndex += 1) {
        const from = placeById.get(day.route.anchorPlaceIds[anchorIndex - 1]);
        const to = placeById.get(day.route.anchorPlaceIds[anchorIndex]);
        if (isFlightPair(from, to)
          || (from.kind === "ferry-terminal" && to.kind === "ferry-terminal")) continue;
        const straightKm = haversineKm(from.location.coordinates, to.location.coordinates);
        const conservativeKm = straightKm * 1.18;
        if (conservativeKm > safeRange) {
          issues.push(issue("error", "ev-range-gap", `${day.date} 的 ${from.name} → ${to.name} 预计至少约 ${Math.round(conservativeKm)} km，超过 80% 实用续航 ${Math.round(safeRange)} km；需要增加充电锚点。`, day.id));
        }
      }
    } else if (spec.vehicle.fuelType === "electric") {
      issues.push(issue("warning", "missing-ev-range", "电动车尚未填写实用续航，无法验证充电间距。"));
      break;
    }
  }

  const hotelEveryDays = Number(spec.preferences.lodging.hotelEveryDays);
  if (Number.isInteger(hotelEveryDays) && hotelEveryDays > 0) {
    let nonHotelRun = [];
    for (const day of spec.days) {
      if (!day.stay || day.stay.type === "none") continue;
      if (HOTEL_TYPES.has(day.stay.type)) {
        const cadenceIssue = hotelCadenceIssue(nonHotelRun, hotelEveryDays);
        if (cadenceIssue) issues.push(cadenceIssue);
        nonHotelRun = [];
      } else {
        nonHotelRun.push(day);
      }
    }
    const cadenceIssue = hotelCadenceIssue(nonHotelRun, hotelEveryDays);
    if (cadenceIssue) issues.push(cadenceIssue);
  }

  if (spec.trip.roundTrip && spec.trip.originPlaceId !== spec.trip.destinationPlaceId) {
    issues.push(issue("error", "round-trip-open", "行程标记为往返，但最终目的地不是出发地。"));
  }
  if ((spec.preferences.route.avoidCountries || []).length) {
    issues.push(issue("info", "country-route-review", `已记录避开国家 ${spec.preferences.route.avoidCountries.join(", ")}；当前公路 provider 不能证明整条路线未跨境，发布前需要复核。`));
  }
  if (!issues.some(item => item.severity === "error")) {
    issues.push(issue("success", "feasible", "结构、每日连续性、驾驶上限和已知车辆约束均未发现阻断问题。"));
  }
  return issues;
}

export function feasibilitySummary(issues) {
  return {
    errors: issues.filter(item => item.severity === "error").length,
    warnings: issues.filter(item => item.severity === "warning").length,
    infos: issues.filter(item => item.severity === "info").length
  };
}
