import { deriveFerryLegs, deriveFlightLegs, deriveRouteSegments } from "./trip-spec.mjs?v=20260719-9";
import { endpointFor, modelOptionsFor, requestAIPlan } from "./ai-planner.mjs?v=20260719-9";
import { geocodeAddress } from "./geocoding-provider.mjs?v=20260719-9";
import { evaluateFeasibility, feasibilitySummary } from "./planner-rules.mjs?v=20260719-9";
import { enrichRoutePlan, hasCurrentRoutePlan, hasSurfaceRouteLegs } from "./route-provider.mjs?v=20260719-9";
import {
  addActivity,
  addDay,
  addPlace,
  addRouteAnchor,
  clearDraft,
  createStarterTrip,
  draftErrors,
  invalidateGeneratedRoute,
  loadDraft,
  placeUsage,
  prepareTripSpec,
  removeActivity,
  removeDay,
  removePlace,
  removeRouteAnchor,
  saveDraft,
  setDayEndpoint,
  slugify,
  synchronizeTrip
} from "./studio-core.mjs?v=20260719-9";

const PLACE_KINDS = [
  ["home", "Home / 起终点"], ["campground", "Campground / 营地"], ["hotel", "Hotel / 酒店"], ["airport", "Airport / 机场"],
  ["charging", "Charging / 充电"], ["fuel", "Fuel / 加油"], ["ferry-terminal", "Ferry terminal / 码头"],
  ["attraction", "Attraction / 景点"], ["trailhead", "Trailhead / 徒步入口"], ["lookout", "Lookout / 观景点"],
  ["food", "Food / 餐饮"], ["service", "Service / 服务点"], ["overnight", "Overnight / 住宿"]
];
const STAY_TYPES = ["campground", "rv-park", "hotel", "motel", "cabin", "rental", "home", "none"];
const PRIORITIES = ["required", "preferred", "optional"];
const TRAVEL_MODES = [
  ["car", "汽车"], ["campervan", "露营车"], ["rv", "房车"], ["motorcycle", "摩托车"],
  ["airplane", "飞机"], ["bicycle", "自行车"], ["walking", "步行"]
];
const FUEL_TYPES = [
  ["gasoline", "汽油"], ["diesel", "柴油"], ["hybrid", "混合动力"], ["electric", "电力"],
  ["aviation", "航空燃料"], ["human", "人力"]
];

function allowedFuelTypes(mode) {
  if (mode === "airplane") return ["aviation", "electric"];
  if (mode === "bicycle") return ["human", "electric"];
  if (mode === "walking") return ["human"];
  return ["gasoline", "diesel", "hybrid", "electric"];
}

const tripFields = document.querySelector("[data-trip-fields]");
const travelFields = document.querySelector("[data-travel-fields]");
const placesEl = document.querySelector("[data-places]");
const daysEl = document.querySelector("[data-days]");
const saveStatus = document.querySelector("[data-save-status]");
const previewButton = document.querySelector("[data-preview]");
const validationEl = document.querySelector("[data-validation]");
const validationTitle = document.querySelector("[data-validation-title]");
const validationList = document.querySelector("[data-validation-list]");
const previewTitle = document.querySelector("[data-preview-title]");
const previewSummary = document.querySelector("[data-preview-summary]");
const toastEl = document.querySelector("[data-toast]");
const feasibilityEl = document.querySelector("[data-feasibility]");
const feasibilityTitle = document.querySelector("[data-feasibility-title]");
const feasibilityList = document.querySelector("[data-feasibility-list]");
const aiBriefInput = document.querySelector("[data-ai-brief]");
const aiProviderInput = document.querySelector("[data-ai-provider]");
const aiModelInput = document.querySelector("[data-ai-model]");
const aiModelCustomInput = document.querySelector("[data-ai-model-custom]");
const aiTokenInput = document.querySelector("[data-ai-token]");
const aiEndpointInput = document.querySelector("[data-ai-endpoint]");
const aiQuestionsEl = document.querySelector("[data-ai-questions]");
const aiGenerateButton = document.querySelector("[data-ai-generate]");
const aiStatusEl = document.querySelector("[data-ai-status]");

let spec;
let map;
let mapLayer;
let pickingPlaceId = null;
let toastTimer = 0;
let aiQuestions = [];
let plannerRuntimeIssues = [];
const geocodingInFlight = new Map();
const geocodingTimers = new Map();

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function optionList(options, selected) {
  return options.map(option => {
    const [value, label] = Array.isArray(option) ? option : [option, option];
    return `<option value="${escapeHtml(value)}" ${value === selected ? "selected" : ""}>${escapeHtml(label)}</option>`;
  }).join("");
}

function placeOptions(selected) {
  return spec.places.map(place =>
    `<option value="${escapeHtml(place.id)}" ${place.id === selected ? "selected" : ""}>${escapeHtml(place.name)} · ${escapeHtml(place.id)}</option>`
  ).join("");
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  toastEl.textContent = message;
  toastEl.classList.add("show");
  toastTimer = window.setTimeout(() => toastEl.classList.remove("show"), 2400);
}

function renderAIModelOptions() {
  const options = modelOptionsFor(aiProviderInput.value);
  aiModelInput.innerHTML = [
    ...options.map(([value, label]) => `<option value="${escapeHtml(value)}">${escapeHtml(value)} — ${escapeHtml(label)}</option>`),
    '<option value="__custom__">自定义模型 ID…</option>'
  ].join("");
  aiModelInput.value = options.length ? options[0][0] : "__custom__";
  aiModelCustomInput.hidden = aiModelInput.value !== "__custom__";
  if (!aiModelCustomInput.hidden) aiModelCustomInput.focus();
}

function selectedAIModel() {
  return aiModelInput.value === "__custom__" ? aiModelCustomInput.value : aiModelInput.value;
}

function setPath(target, path, value) {
  const keys = path.split(".");
  let cursor = target;
  for (const key of keys.slice(0, -1)) cursor = cursor[key];
  cursor[keys.at(-1)] = value;
}

function numericValue(input) {
  return input.value === "" ? undefined : Number(input.value);
}

function renderTripFields() {
  tripFields.innerHTML = `
    <label class="field full">行程名称
      <input data-path="trip.title" value="${escapeHtml(spec.trip.title)}" required>
    </label>
    <label class="field">Trip ID
      <input data-path="trip.id" value="${escapeHtml(spec.trip.id)}" pattern="[a-z0-9-]+" required>
    </label>
    <label class="field">状态
      <select data-path="trip.status">${optionList(["draft", "planned", "active", "completed", "archived"], spec.trip.status)}</select>
    </label>
    <label class="field full">简介
      <textarea data-path="trip.summary">${escapeHtml(spec.trip.summary || "")}</textarea>
    </label>
    <label class="field">语言
      <select data-path="trip.locale">${optionList([["zh-CN", "中文"], ["en-CA", "English (Canada)"], ["fr-CA", "Français (Canada)"]], spec.trip.locale)}</select>
    </label>
    <label class="field">时区
      <input data-path="trip.timezone" value="${escapeHtml(spec.trip.timezone)}">
    </label>
    <label class="field">开始日期
      <input value="${escapeHtml(spec.trip.startDate)}" readonly>
    </label>
    <label class="field">结束日期
      <input value="${escapeHtml(spec.trip.endDate)}" readonly>
    </label>`;
}

function renderTravelFields() {
  travelFields.innerHTML = `
    <label class="field">成人
      <input type="number" min="0" data-path="travelers.adults" value="${escapeHtml(spec.travelers.adults)}">
    </label>
    <label class="field">主要出行方式
      <select data-path="vehicle.mode">${optionList(TRAVEL_MODES, spec.vehicle.mode)}</select>
    </label>
    <label class="field">动力 / 能源
      <select data-path="vehicle.fuelType">${optionList(FUEL_TYPES.filter(([value]) => allowedFuelTypes(spec.vehicle.mode).includes(value)), spec.vehicle.fuelType)}</select>
    </label>
    <label class="field">品牌
      <input data-path="vehicle.make" value="${escapeHtml(spec.vehicle.make || "")}" placeholder="例如 Tesla">
    </label>
    <label class="field">车型
      <input data-path="vehicle.model" value="${escapeHtml(spec.vehicle.model || "")}" placeholder="例如 Model Y">
    </label>
    <label class="field">实用续航（km）
      <input type="number" min="1" data-path="vehicle.practicalRangeKm" value="${escapeHtml(spec.vehicle.practicalRangeKm || "")}">
    </label>
    <label class="field">目标移动（小时/天）
      <input type="number" min="0.5" max="24" step="0.5" data-path="preferences.driving.targetHoursPerDay" value="${escapeHtml(spec.preferences.driving.targetHoursPerDay)}">
    </label>
    <label class="field">最长移动（小时/天）
      <input type="number" min="0.5" max="24" step="0.5" data-path="preferences.driving.maximumHoursPerDay" value="${escapeHtml(spec.preferences.driving.maximumHoursPerDay)}">
    </label>
    <label class="field">每隔几天住酒店（可选）
      <input type="number" min="1" step="1" data-path="preferences.lodging.hotelEveryDays" value="${escapeHtml(spec.preferences.lodging.hotelEveryDays || "")}" placeholder="留空表示不限制">
      <small class="muted">只用于酒店频率约束，不代表是否已有住宿；露营计划可留空。</small>
    </label>
    <label class="field">路线偏好
      <select data-path="preferences.route.preferScenicRoads" data-boolean>
        ${optionList([["true", "优先风景道路"], ["false", "优先直接路线"]], String(spec.preferences.route.preferScenicRoads))}
      </select>
    </label>`;
}

function renderPlaces() {
  placesEl.innerHTML = spec.places.map((place, index) => {
    const coordinates = place.location.coordinates;
    const usage = placeUsage(spec, place.id);
    return `<article class="item-card" data-place-card="${escapeHtml(place.id)}">
      <div class="item-head">
        <div><h3>${escapeHtml(place.name)}</h3><small>${escapeHtml(place.id)} · 地点 ${index + 1}</small></div>
        <div class="item-actions">
          <button class="mini-button" type="button" data-action="geocode-place" data-place-id="${escapeHtml(place.id)}">地址定位</button>
          <button class="mini-button" type="button" data-action="pick-place" data-place-id="${escapeHtml(place.id)}">地图取点</button>
          <button class="mini-button danger" type="button" data-action="remove-place" data-place-id="${escapeHtml(place.id)}" ${usage ? "disabled" : ""} title="${usage ? "此地点仍被行程引用" : "删除地点"}">删除</button>
        </div>
      </div>
      <div class="form-grid three">
        <label class="field">名称
          <input data-place-id="${escapeHtml(place.id)}" data-place-field="name" value="${escapeHtml(place.name)}">
        </label>
        <label class="field">类型
          <select data-place-id="${escapeHtml(place.id)}" data-place-field="kind">${optionList(PLACE_KINDS, place.kind)}</select>
        </label>
        <label class="field">ID
          <input value="${escapeHtml(place.id)}" readonly>
        </label>
        <label class="field">纬度
          <input type="number" step="any" min="-90" max="90" data-place-id="${escapeHtml(place.id)}" data-place-field="lat" value="${escapeHtml(coordinates.lat)}">
        </label>
        <label class="field">经度
          <input type="number" step="any" min="-180" max="180" data-place-id="${escapeHtml(place.id)}" data-place-field="lng" value="${escapeHtml(coordinates.lng)}">
        </label>
        <label class="field full">地址
          <input data-place-id="${escapeHtml(place.id)}" data-place-field="address" value="${escapeHtml(place.location.address || "")}" placeholder="街道、城市、省州、邮编或机场名称">
          <small class="muted">停止输入后会自动更新经纬度；也可点击“地址定位”立即重试。</small>
        </label>
        <label class="field">说明
          <input data-place-id="${escapeHtml(place.id)}" data-place-field="notes" value="${escapeHtml(place.notes || "")}" placeholder="可选">
        </label>
      </div>
    </article>`;
  }).join("");
}

function renderDay(day, dayIndex) {
  const note = (day.notes || []).join("\n");
  const anchors = day.route.anchorPlaceIds.map((placeId, anchorIndex) => {
    const endpoint = anchorIndex === 0 || anchorIndex === day.route.anchorPlaceIds.length - 1;
    return `<div class="route-row">
      <span class="route-number">${anchorIndex + 1}</span>
      <select data-day-id="${escapeHtml(day.id)}" data-anchor-index="${anchorIndex}" ${endpoint ? "disabled" : ""}>${placeOptions(placeId)}</select>
      <button class="mini-button danger" type="button" data-action="remove-anchor" data-day-id="${escapeHtml(day.id)}" data-index="${anchorIndex}" ${endpoint ? "disabled" : ""}>移除</button>
    </div>`;
  }).join("");

  const activities = day.activities.map((activity, activityIndex) => `<div class="activity-row">
    <select data-day-id="${escapeHtml(day.id)}" data-activity-index="${activityIndex}" data-activity-field="placeId">${placeOptions(activity.placeId)}</select>
    <select data-day-id="${escapeHtml(day.id)}" data-activity-index="${activityIndex}" data-activity-field="priority">${optionList(PRIORITIES, activity.priority)}</select>
    <button class="mini-button danger" type="button" data-action="remove-activity" data-day-id="${escapeHtml(day.id)}" data-index="${activityIndex}">移除</button>
  </div>`).join("");

  return `<article class="item-card" data-day-card="${escapeHtml(day.id)}">
    <div class="item-head">
      <div><h3>Day ${dayIndex + 1} · ${escapeHtml(day.title)}</h3><small>${escapeHtml(day.id)}</small></div>
      <button class="mini-button danger" type="button" data-action="remove-day" data-day-id="${escapeHtml(day.id)}" ${spec.days.length <= 1 ? "disabled" : ""}>删除这天</button>
    </div>
    <div class="form-grid">
      <label class="field">日期
        <input type="date" data-day-id="${escapeHtml(day.id)}" data-day-field="date" value="${escapeHtml(day.date)}">
      </label>
      <label class="field">标题
        <input data-day-id="${escapeHtml(day.id)}" data-day-field="title" value="${escapeHtml(day.title)}">
      </label>
      <label class="field">起点
        <select data-day-id="${escapeHtml(day.id)}" data-endpoint="origin">${placeOptions(day.originPlaceId)}</select>
      </label>
      <label class="field">终点
        <select data-day-id="${escapeHtml(day.id)}" data-endpoint="destination">${placeOptions(day.destinationPlaceId)}</select>
      </label>
      <label class="field">预计里程（km）
        <input type="number" min="0" step="1" data-day-id="${escapeHtml(day.id)}" data-route-field="distanceKm" value="${escapeHtml(day.route.distanceKm ?? "")}" placeholder="可留空">
      </label>
        <label class="field">预计移动（小时）
        <input type="number" min="0" step="0.25" data-day-id="${escapeHtml(day.id)}" data-drive-hours value="${escapeHtml(Number.isFinite(day.route.driveMinutes) ? day.route.driveMinutes / 60 : "")}" placeholder="可留空">
      </label>
      <label class="field">住宿地点
        <select data-day-id="${escapeHtml(day.id)}" data-stay-field="placeId">${placeOptions(day.stay?.placeId || day.destinationPlaceId)}</select>
      </label>
      <label class="field">住宿类型
        <select data-day-id="${escapeHtml(day.id)}" data-stay-field="type">${optionList(STAY_TYPES, day.stay?.type || "none")}</select>
      </label>
      <label class="field full">当日备注
        <textarea data-day-id="${escapeHtml(day.id)}" data-day-notes placeholder="每行一条备注">${escapeHtml(note)}</textarea>
      </label>
    </div>
    <div class="subsection">
      <div class="subsection-title"><span>路线锚点 · 按移动顺序</span><button class="mini-button" type="button" data-action="add-anchor" data-day-id="${escapeHtml(day.id)}">＋ 必经点</button></div>
      <div class="route-list">${anchors}</div>
    </div>
    <div class="subsection">
      <div class="subsection-title"><span>可选活动 · 不改变路线</span><button class="mini-button" type="button" data-action="add-activity" data-day-id="${escapeHtml(day.id)}">＋ 活动</button></div>
      <div class="activity-list">${activities || '<span class="muted">尚未添加活动</span>'}</div>
    </div>
  </article>`;
}

function renderDays() {
  daysEl.innerHTML = spec.days.map(renderDay).join("");
}

function renderAll() {
  synchronizeTrip(spec);
  renderTripFields();
  renderTravelFields();
  renderPlaces();
  renderDays();
  refreshProductState();
}

function refreshValidation() {
  const errors = draftErrors(spec);
  const valid = errors.length === 0;
  validationEl.classList.toggle("ok", valid);
  validationTitle.textContent = valid ? "TripPlan 有效，可以预览和保存" : `${errors.length} 个问题需要处理`;
  validationList.innerHTML = valid
    ? "<li>地点引用、路线端点和坐标均有效。</li>"
    : errors.slice(0, 12).map(error => `<li>${escapeHtml(error)}</li>`).join("");
  previewButton.disabled = !valid;
  saveStatus.textContent = valid ? "已自动保存 · 有效" : "已自动保存 · 待修正";
  saveStatus.classList.toggle("invalid", !valid);
  return errors;
}

function refreshFeasibility() {
  const failedGeocodingPlaces = new Set(plannerRuntimeIssues
    .filter(item => item.code === "address-geocoding-failed")
    .map(item => item.placeId));
  const ruleIssues = evaluateFeasibility(spec).filter(item =>
    !(item.code === "stale-place-coordinates" && failedGeocodingPlaces.has(item.placeId))
  );
  const issues = [...plannerRuntimeIssues, ...ruleIssues];
  const summary = feasibilitySummary(issues);
  feasibilityEl.classList.toggle("ok", summary.errors === 0);
  feasibilityTitle.textContent = summary.errors
    ? `${summary.errors} 个可行性阻断 · ${summary.warnings} 个提醒`
    : `未发现阻断 · ${summary.warnings} 个提醒`;
  feasibilityList.innerHTML = issues.slice(0, 20).map(item =>
    `<li class="${escapeHtml(item.severity)}">${escapeHtml(item.message)}</li>`
  ).join("");
  return issues;
}

function safeTooltip(text) {
  const element = document.createElement("span");
  element.textContent = text;
  return element;
}

function refreshMap() {
  if (!map || !mapLayer) return;
  mapLayer.clearLayers();
  const bounds = [];

  for (const place of spec.places) {
    const { lat, lng } = place.location?.coordinates || {};
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const color = place.kind === "ferry-terminal" ? "#7c3aed"
      : ["attraction", "trailhead", "lookout"].includes(place.kind) ? "#b23b3b"
      : "#135f57";
    const point = [lat, lng];
    bounds.push(point);
    L.circleMarker(point, { radius: 7, color: "#fff", weight: 2, fillColor: color, fillOpacity: 1 })
      .bindTooltip(safeTooltip(place.name))
      .addTo(mapLayer);
  }

  try {
    for (const segment of deriveRouteSegments(spec)) {
      L.polyline(segment.coords, { color: segment.color, weight: 5, opacity: .9 }).addTo(mapLayer);
    }
    for (const ferry of deriveFerryLegs(spec)) {
      L.polyline(ferry.coords, { color: "#7c3aed", weight: 4, dashArray: "7 7", opacity: .95 }).addTo(mapLayer);
    }
    for (const flight of deriveFlightLegs(spec)) {
      L.polyline(flight.coords, { color: "#2563eb", weight: 4, dashArray: "10 8", opacity: .95 }).addTo(mapLayer);
    }
  } catch {
    // Incomplete drafts still show every place that has usable coordinates.
  }

  if (bounds.length === 1) map.setView(bounds[0], 8);
  else if (bounds.length > 1) map.fitBounds(bounds, { padding: [28, 28], maxZoom: 10 });
}

function refreshProductState() {
  synchronizeTrip(spec);
  try {
    saveDraft(spec);
  } catch {
    saveStatus.textContent = "无法自动保存";
    saveStatus.classList.add("invalid");
  }
  previewTitle.textContent = spec.trip.title || "路线预览";
  previewSummary.textContent = `${spec.places.length} 个地点 · ${spec.days.length} 天`;
  refreshValidation();
  refreshFeasibility();
  refreshMap();
}

function setAIStatus(message, kind = "") {
  aiStatusEl.hidden = !message;
  aiStatusEl.className = `ai-status${kind ? ` ${kind}` : ""}`;
  aiStatusEl.textContent = message;
}

function removePlaceRuntimeIssues(placeId) {
  plannerRuntimeIssues = plannerRuntimeIssues.filter(item => item.placeId !== placeId);
}

async function geocodePlace(placeId) {
  window.clearTimeout(geocodingTimers.get(placeId));
  geocodingTimers.delete(placeId);
  const place = spec.places.find(item => item.id === placeId);
  const address = place?.location?.address?.trim();
  if (!place || !address) {
    showToast("请先填写完整地址");
    return;
  }
  const existing = geocodingInFlight.get(placeId);
  if (existing?.address === address) return existing.promise;
  showToast(`正在定位 ${place.name}…`);
  const promise = (async () => {
    try {
    const result = await geocodeAddress(address, { locale: spec.trip.locale });
    invalidateGeneratedRoute(spec);
    place.location.coordinates = {
      lat: Number(result.lat.toFixed(6)),
      lng: Number(result.lng.toFixed(6))
    };
    place.location.coordinateStatus = "resolved";
    removePlaceRuntimeIssues(placeId);
    renderAll();
    showToast(`已更新 ${place.name} 的经纬度，请在地图上复核位置`);
    } catch (error) {
      removePlaceRuntimeIssues(placeId);
      plannerRuntimeIssues.push({
        severity: "error",
        code: "address-geocoding-failed",
        placeId,
        message: `${place.name} 的地址无法定位，经纬度仍是旧值：${error?.message || "geocoder error"}`
      });
      refreshProductState();
      feasibilityEl.open = true;
      showToast(`地址定位失败：${error?.message || "未知错误"}`);
    }
  })();
  geocodingInFlight.set(placeId, { address, promise });
  try {
    return await promise;
  } finally {
    if (geocodingInFlight.get(placeId)?.promise === promise) geocodingInFlight.delete(placeId);
  }
}

function renderAIQuestions(questions) {
  aiQuestions = questions;
  aiQuestionsEl.hidden = !questions.length;
  aiQuestionsEl.innerHTML = questions.map((item, index) => {
    const id = String(item.id || `question-${index + 1}`).replace(/[^a-z0-9-]/gi, "-").toLowerCase();
    return `<label class="field">${escapeHtml(item.question || "请补充信息")}
      <input data-ai-answer="${escapeHtml(id)}" autocomplete="off">
      ${item.reason ? `<small class="muted">${escapeHtml(item.reason)}</small>` : ""}
    </label>`;
  }).join("");
  aiGenerateButton.textContent = questions.length ? "提交回答并生成" : "分析需求并规划";
}

function collectAIAnswers() {
  return Object.fromEntries([...aiQuestionsEl.querySelectorAll("[data-ai-answer]")]
    .map(input => [input.dataset.aiAnswer, input.value.trim()]));
}

async function generateWithAI() {
  if (aiGenerateButton.disabled) return;
  aiGenerateButton.disabled = true;
  setAIStatus("正在调用你选择的模型理解旅行需求…");
  try {
    const result = await requestAIPlan({
      provider: aiProviderInput.value,
      endpoint: aiEndpointInput.value,
      model: selectedAIModel(),
      token: aiTokenInput.value,
      brief: aiBriefInput.value,
      answers: collectAIAnswers()
    });
    if (result.status === "needs_input") {
      renderAIQuestions(result.questions);
      setAIStatus(`还需要 ${result.questions.length} 个关键信息。回答后会生成路线。`);
      return;
    }

    const structuralErrors = draftErrors(result.tripPlan);
    if (structuralErrors.length) {
      throw new Error(`模型生成的 TripPlan 未通过结构校验：${structuralErrors.slice(0, 3).join("；")}`);
    }
    result.tripPlan.trip.sourceBrief = aiBriefInput.value.trim();
    setAIStatus("TripPlan 已生成，正在按交通方式生成实际路线和逐向指引…");
    plannerRuntimeIssues = await enrichRoutePlan(result.tripPlan);
    plannerRuntimeIssues.push(
      ...result.assumptions.map(message => ({ severity: "info", code: "ai-assumption", message: `AI 假设：${message}` })),
      ...result.warnings.map(message => ({ severity: "warning", code: "ai-warning", message: `AI 提醒：${message}` }))
    );
    spec = prepareTripSpec(result.tripPlan);
    saveDraft(spec);
    renderAIQuestions([]);
    renderAll();
    const summary = feasibilitySummary([...plannerRuntimeIssues, ...evaluateFeasibility(spec)]);
    feasibilityEl.open = true;
    setAIStatus(summary.errors
      ? `路线初稿已生成，但还有 ${summary.errors} 个阻断问题；可在下方手动修正。`
      : "路线初稿已生成并通过当前可行性规则，可以继续微调或打开 Trip Preview。", summary.errors ? "error" : "success");
    document.querySelector("[data-trip-fields]")?.scrollIntoView({ behavior: "smooth", block: "start" });
  } catch (error) {
    setAIStatus(error?.message || "AI 规划失败", "error");
  } finally {
    aiGenerateButton.disabled = false;
  }
}

async function previewInTraveler() {
  const errors = draftErrors(spec);
  if (errors.length) return;
  previewButton.disabled = true;
  try {
    const needsRoute = spec.vehicle.mode === "airplane"
      ? spec.generated?.routeData?.mode !== "airplane"
      : !hasCurrentRoutePlan(spec);
    if (needsRoute) {
      showToast(spec.vehicle.mode === "airplane" ? "正在准备航线预览…" : "正在生成实际路线和逐向指引…");
      const routeIssues = await enrichRoutePlan(spec);
      const routeIssueCodes = new Set(["route-provider", "route-coordinates", "route-ferry", "route-flight", "route-walking", "route-mode-provider"]);
      plannerRuntimeIssues = [
        ...plannerRuntimeIssues.filter(item => !routeIssueCodes.has(item.code)),
        ...routeIssues
      ];
      refreshProductState();
    }
    if (spec.vehicle.mode !== "airplane"
      && hasSurfaceRouteLegs(spec)
      && !spec.generated?.routeData?.segments?.length
      && !spec.generated?.routeData?.unroutedSegments?.length) {
      feasibilityEl.open = true;
      showToast("实际路线生成失败，请查看可行性报告后重试");
      return;
    }
    saveDraft(spec);
    window.location.href = "index.html?draft=1";
  } catch (error) {
    plannerRuntimeIssues.push({
      severity: "error",
      code: "route-provider",
      message: `实际路线生成失败：${error?.message || "provider error"}`
    });
    refreshProductState();
    feasibilityEl.open = true;
    showToast("实际路线生成失败，请查看可行性报告");
  } finally {
    if (window.location.pathname.endsWith("studio.html")) previewButton.disabled = draftErrors(spec).length > 0;
  }
}

function initMap() {
  if (!window.L) return;
  map = L.map("studio-map", { zoomControl: true, attributionControl: true }).setView([45, -79], 5);
  L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap contributors"
  }).addTo(map);
  mapLayer = L.layerGroup().addTo(map);
  map.on("click", event => {
    if (!pickingPlaceId) return;
    const place = spec.places.find(item => item.id === pickingPlaceId);
    if (!place) return;
      invalidateGeneratedRoute(spec);
      place.location.coordinates = {
        lat: Number(event.latlng.lat.toFixed(6)),
        lng: Number(event.latlng.lng.toFixed(6))
      };
      place.location.coordinateStatus = "resolved";
    pickingPlaceId = null;
    map.getContainer().classList.remove("picking");
    renderAll();
    showToast("地点坐标已从地图更新");
  });
}

function handleFieldInput(input) {
  if (input.dataset.path) {
    let value = input.dataset.boolean ? input.value === "true" : input.value;
    if (input.type === "number") value = numericValue(input);
    if (value === undefined) {
      const keys = input.dataset.path.split(".");
      let cursor = spec;
      for (const key of keys.slice(0, -1)) cursor = cursor[key];
      delete cursor[keys.at(-1)];
    } else {
      setPath(spec, input.dataset.path, value);
    }
    if (input.dataset.path === "trip.id") spec.trip.id = slugify(input.value, "road-trip");
    if (input.dataset.path === "vehicle.mode") {
      const allowed = allowedFuelTypes(spec.vehicle.mode);
      if (!allowed.includes(spec.vehicle.fuelType)) spec.vehicle.fuelType = allowed[0];
    }
    if (["trip.id", "vehicle.mode"].includes(input.dataset.path)) invalidateGeneratedRoute(spec);
    return true;
  }

  if (input.dataset.placeField) {
    const place = spec.places.find(item => item.id === input.dataset.placeId);
    if (!place) return false;
    if (input.dataset.placeField === "lat" || input.dataset.placeField === "lng") {
      invalidateGeneratedRoute(spec);
      place.location.coordinates[input.dataset.placeField] = numericValue(input);
      place.location.coordinateStatus = "resolved";
    } else if (input.dataset.placeField === "address") {
      invalidateGeneratedRoute(spec);
      if (input.value.trim()) place.location.address = input.value.trim();
      else delete place.location.address;
      place.location.coordinateStatus = input.value.trim() ? "stale" : "resolved";
    } else if (input.value === "" && input.dataset.placeField === "notes") {
      delete place.notes;
    } else {
      place[input.dataset.placeField] = input.value;
      if (input.dataset.placeField === "kind") invalidateGeneratedRoute(spec);
    }
    return true;
  }

  const day = spec.days.find(item => item.id === input.dataset.dayId);
  if (!day) return false;
  if (input.dataset.dayField) day[input.dataset.dayField] = input.value;
  else if (input.dataset.routeField) {
    const value = numericValue(input);
    if (value === undefined) delete day.route[input.dataset.routeField];
    else day.route[input.dataset.routeField] = value;
  } else if (input.hasAttribute("data-drive-hours")) {
    const value = numericValue(input);
    if (value === undefined) delete day.route.driveMinutes;
    else day.route.driveMinutes = Math.round(value * 60);
  } else if (input.hasAttribute("data-day-notes")) {
    day.notes = input.value.split("\n");
  } else if (input.dataset.stayField) {
    day.stay ||= { placeId: day.destinationPlaceId, type: "none", status: "idea", amenities: [] };
    day.stay[input.dataset.stayField] = input.value;
  } else if (input.dataset.anchorIndex) {
    invalidateGeneratedRoute(spec);
    day.route.anchorPlaceIds[Number(input.dataset.anchorIndex)] = input.value;
  } else if (input.hasAttribute("data-activity-index")) {
    const activity = day.activities[Number(input.dataset.activityIndex)];
    activity[input.dataset.activityField] = input.value;
    day.route.optionalStopPlaceIds = [...new Set(day.activities.map(item => item.placeId))];
  } else {
    return false;
  }
  return true;
}

document.addEventListener("input", event => {
  const input = event.target.closest("input, select, textarea");
  if (!input || !handleFieldInput(input)) return;
  if (input.dataset.placeField === "address") {
    removePlaceRuntimeIssues(input.dataset.placeId);
    if (input.value.trim()) {
      plannerRuntimeIssues.push({
        severity: "warning",
        code: "address-coordinates-stale",
        placeId: input.dataset.placeId,
        message: "地址已修改，正在等待重新定位；当前经纬度可能与地址不一致。"
      });
      window.clearTimeout(geocodingTimers.get(input.dataset.placeId));
      geocodingTimers.set(input.dataset.placeId, window.setTimeout(() => {
        void geocodePlace(input.dataset.placeId);
      }, 900));
    } else {
      window.clearTimeout(geocodingTimers.get(input.dataset.placeId));
      geocodingTimers.delete(input.dataset.placeId);
    }
  } else {
    plannerRuntimeIssues = [];
  }
  refreshProductState();
});

document.addEventListener("change", event => {
  const input = event.target.closest("input, select, textarea");
  if (!input) return;

  if (input.dataset.endpoint) {
    setDayEndpoint(spec, input.dataset.dayId, input.dataset.endpoint, input.value);
    renderAll();
    return;
  }

  if (input.dataset.path === "vehicle.mode") {
    handleFieldInput(input);
    plannerRuntimeIssues = [];
    renderAll();
    return;
  }

  if (input.dataset.placeField === "name" || input.dataset.placeField === "kind") renderAll();
});

document.addEventListener("click", event => {
  const button = event.target.closest("button");
  if (!button) return;

  if (button.hasAttribute("data-new")) {
    clearDraft();
    spec = createStarterTrip();
    plannerRuntimeIssues = [];
    renderAll();
    showToast("已创建新的本地行程");
    return;
  }

  if (button.hasAttribute("data-export")) {
    const errors = draftErrors(spec);
    if (errors.length) {
      validationEl.open = true;
      validationEl.scrollIntoView({ behavior: "smooth", block: "center" });
      showToast("请先修正 TripPlan 问题");
      return;
    }
    const prepared = prepareTripSpec(spec);
    const blob = new Blob([JSON.stringify(prepared, null, 2) + "\n"], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `${prepared.trip.id}.tripplan.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(link.href), 1000);
    showToast("TripPlan 已保存");
    return;
  }

  if (button.hasAttribute("data-preview")) {
    void previewInTraveler();
    return;
  }

  if (button.hasAttribute("data-add-place")) {
    addPlace(spec);
    renderAll();
    showToast("已添加地点");
    return;
  }

  if (button.hasAttribute("data-add-day")) {
    addDay(spec);
    renderAll();
    showToast("已添加一天");
    return;
  }

  const { action, dayId, placeId } = button.dataset;
  if (!action) return;
  if (action === "pick-place") {
    removePlaceRuntimeIssues(placeId);
    pickingPlaceId = placeId;
    map?.getContainer().classList.add("picking");
    document.querySelector(".preview-card")?.scrollIntoView({ behavior: "smooth", block: "start" });
    showToast("请在预览地图上点击地点位置");
    return;
  } else if (action === "geocode-place") {
    void geocodePlace(placeId);
    return;
  } else if (action === "remove-place") {
    if (!removePlace(spec, placeId)) showToast("此地点仍被行程引用，暂不能删除");
  } else if (action === "remove-day") {
    removeDay(spec, dayId);
  } else if (action === "add-anchor") {
    const day = spec.days.find(item => item.id === dayId);
    const candidate = spec.places.find(place => !day.route.anchorPlaceIds.includes(place.id));
    if (!candidate) {
      showToast("请先添加一个尚未使用的地点");
      return;
    }
    addRouteAnchor(spec, dayId, candidate.id);
  } else if (action === "remove-anchor") {
    removeRouteAnchor(spec, dayId, Number(button.dataset.index));
  } else if (action === "add-activity") {
    const day = spec.days.find(item => item.id === dayId);
    const candidate = spec.places.find(place =>
      !day.route.anchorPlaceIds.includes(place.id)
      && !day.activities.some(activity => activity.placeId === place.id)
    );
    if (!candidate) {
      showToast("请先添加一个不在路线锚点中的活动地点");
      return;
    }
    addActivity(spec, dayId, candidate.id);
  } else if (action === "remove-activity") {
    removeActivity(spec, dayId, Number(button.dataset.index));
  }
  renderAll();
});

document.querySelector("[data-import]").addEventListener("change", async event => {
  const [file] = event.target.files || [];
  event.target.value = "";
  if (!file) return;
  try {
    const imported = JSON.parse(await file.text());
    const errors = draftErrors(imported);
    if (errors.length) throw new Error(errors.slice(0, 3).join("；"));
    spec = prepareTripSpec(imported);
    plannerRuntimeIssues = [];
    saveDraft(spec);
    renderAll();
    showToast(`已导入 ${file.name}`);
  } catch (error) {
    showToast("导入失败：" + error.message);
  }
});

aiProviderInput.addEventListener("change", () => {
  aiEndpointInput.value = endpointFor(aiProviderInput.value);
  renderAIModelOptions();
  if (aiProviderInput.value === "compatible") aiEndpointInput.focus();
});

aiModelInput.addEventListener("change", () => {
  aiModelCustomInput.hidden = aiModelInput.value !== "__custom__";
  if (!aiModelCustomInput.hidden) aiModelCustomInput.focus();
});

aiGenerateButton.addEventListener("click", generateWithAI);

async function loadInitialSpec() {
  const params = new URLSearchParams(window.location.search);
  const template = params.get("template");
  if (template) {
    try {
      const url = new URL(template, window.location.href);
      if (url.origin !== window.location.origin) throw new Error("模板必须来自当前站点");
      const response = await fetch(url, { cache: "no-store" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const imported = await response.json();
      const errors = draftErrors(imported);
      if (errors.length) throw new Error(errors.slice(0, 3).join("；"));
      return prepareTripSpec(imported);
    } catch (error) {
      window.setTimeout(() => showToast("模板载入失败：" + error.message), 0);
    }
  }
  return loadDraft() || createStarterTrip();
}

renderAIModelOptions();
spec = await loadInitialSpec();
initMap();
renderAll();
