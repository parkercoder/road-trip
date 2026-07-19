const DEFAULT_ENDPOINTS = {
  openai: "https://api.openai.com/v1/responses",
  anthropic: "https://api.anthropic.com/v1/chat/completions",
  gemini: "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
  deepseek: "https://api.deepseek.com/chat/completions",
  xai: "https://api.x.ai/v1/chat/completions",
  mistral: "https://api.mistral.ai/v1/chat/completions",
  openrouter: "https://openrouter.ai/api/v1/chat/completions",
  compatible: ""
};

// Common text models verified against provider documentation on 2026-07-19.
export const MODEL_OPTIONS = Object.freeze({
  openai: [
    ["gpt-5.6-terra", "GPT-5.6 Terra · balanced (recommended)"],
    ["gpt-5.6-sol", "GPT-5.6 Sol · highest capability"],
    ["gpt-5.6-luna", "GPT-5.6 Luna · lower cost"]
  ],
  anthropic: [
    ["claude-sonnet-4-6", "Claude Sonnet 4.6 · balanced (recommended)"],
    ["claude-fable-5", "Claude Fable 5 · highest capability"],
    ["claude-opus-4-8", "Claude Opus 4.8"],
    ["claude-haiku-4-5", "Claude Haiku 4.5 · fast"]
  ],
  gemini: [
    ["gemini-3.5-flash", "Gemini 3.5 Flash · stable (recommended)"],
    ["gemini-3.1-pro-preview", "Gemini 3.1 Pro · preview"],
    ["gemini-3.1-flash-lite", "Gemini 3.1 Flash-Lite · lower cost"],
    ["gemini-2.5-pro", "Gemini 2.5 Pro"]
  ],
  deepseek: [
    ["deepseek-v4-flash", "DeepSeek V4 Flash · balanced (recommended)"],
    ["deepseek-v4-pro", "DeepSeek V4 Pro · highest capability"]
  ],
  xai: [
    ["grok-4.5", "Grok 4.5 · flagship (recommended)"],
    ["grok-4.3", "Grok 4.3"]
  ],
  mistral: [
    ["mistral-large-latest", "Mistral Large · latest (recommended)"],
    ["mistral-large-2512", "Mistral Large 3 · pinned"],
    ["mistral-small-latest", "Mistral Small · latest"]
  ],
  openrouter: [
    ["openrouter/auto", "OpenRouter Auto · automatic routing (recommended)"]
  ],
  compatible: []
});

const PLACE_KIND_ALIASES = new Map([
  ["airfield", "airport"],
  ["airport-terminal", "airport"],
  ["lodging", "overnight"],
  ["accommodation", "overnight"],
  ["campsite", "campground"],
  ["camp", "campground"],
  ["charger", "charging"],
  ["charging-station", "charging"],
  ["gas-station", "fuel"],
  ["fuel-station", "fuel"],
  ["restaurant", "food"],
  ["poi", "attraction"],
  ["viewpoint", "lookout"],
  ["ferry", "ferry-terminal"]
]);

const STAY_TYPE_ALIASES = new Map([
  ["lodging", "hotel"],
  ["accommodation", "hotel"],
  ["camp", "campground"],
  ["campsite", "campground"]
]);

const SYSTEM_PROMPT = `You compile a natural-language road-trip brief into Road Trip TripPlan V1.

Return exactly one JSON object and no markdown. AI interprets intent; deterministic code will validate the result and recalculate road metrics.

If a genuinely critical fact is missing, return:
{"status":"needs_input","questions":[{"id":"short-kebab-id","question":"question in the user's language","reason":"why it matters"}]}
Ask no more than three questions. Do not ask for facts that can be expressed as an assumption.

Otherwise return:
{"status":"ready","tripPlan":{...},"assumptions":["..."],"warnings":["..."]}

TripPlan V1 requirements:
- schemaVersion is "1.0".
- trip has id, title, locale, timezone, startDate, endDate, originPlaceId, destinationPlaceId, roundTrip, status "draft", and sourceBrief.
- travelers has adults, children (objects with optional age and mobility), and accessibilityNeeds.
- vehicle describes the primary transport: mode (car|campervan|rv|motorcycle|airplane|bicycle|walking), fuelType (gasoline|diesel|hybrid|electric|aviation|human), and optional make, model, practicalRangeKm, chargingConnectors. Use aviation for airplane, human for walking or a non-electric bicycle.
- preferences has driving {targetHoursPerDay, maximumHoursPerDay, restEveryMinutes}, route {avoidCountries using ISO two-letter codes, avoidTolls, avoidFerries, preferScenicRoads, avoidRepeatingRoads}, lodging {preferredTypes, optional hotelEveryDays, nightlyBudget, requiredAmenities, preferredAmenities}, activities {interests, hikingDifficulty, maximumHikeHours}, alerts {weather,wildfire,roadClosures,airQuality}. Omit hotelEveryDays unless the user explicitly requests a cadence such as "a hotel every three days"; never infer it merely from a list of hotel and campground nights.
- places is a unique list of durable places. Every place has a lowercase kebab id, name, kind, location {coordinates:{lat,lng}, address}, tags, and optional notes. kind must be one of origin|destination|overnight|campground|hotel|airport|charging|fuel|ferry-terminal|attraction|trailhead|lookout|food|service|home. Use reasonable coordinates and a useful address when known, but list coordinate uncertainty as a warning.
- days contains every trip date in order. Every day has id, date, title, originPlaceId, destinationPlaceId, route {anchorPlaceIds, optionalStopPlaceIds, distanceKm, driveMinutes}, optional stay, activities as an array, and notes as an array of strings (never a single string).
- Only daily endpoints, explicitly required via points, required charging/fuel stops, and ferry terminals belong in anchorPlaceIds. Sightseeing belongs in optionalStopPlaceIds and activities.
- Represent a flight as two consecutive anchor places whose kind is airport. Do not insert road stops between the departure and arrival airports; ground transfers before or after the flight are separate anchor pairs.
- For backcountry hiking, mark trail access places as trailhead (optionally tag backcountry-access) and remote camps with the backcountry-campground tag. Keep the trailhead and each consecutive backcountry camp as route anchors so the route engine can split driving and walking trail segments automatically.
- Keep daily driving within maximumHoursPerDay and normally near targetHoursPerDay. For an EV, insert charging anchors often enough for practicalRangeKm with a safety margin.
- Respect round trips, avoided countries, lodging cadence, hiking ability, and required amenities.
- Never include reservation numbers, contact information, payment data, API keys, or other private booking details.`;

export function endpointFor(provider) {
  return DEFAULT_ENDPOINTS[provider] ?? "";
}

export function modelOptionsFor(provider) {
  return MODEL_OPTIONS[provider] || [];
}

function usesChatCompletions(provider) {
  return provider !== "openai";
}

export function extractJson(text) {
  const source = String(text || "").trim();
  const unfenced = source.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "").trim();
  try {
    return JSON.parse(unfenced);
  } catch {
    const start = unfenced.indexOf("{");
    const end = unfenced.lastIndexOf("}");
    if (start < 0 || end <= start) throw new Error("模型没有返回 JSON 对象");
    try {
      return JSON.parse(unfenced.slice(start, end + 1));
    } catch {
      throw new Error("模型返回的 JSON 无法解析");
    }
  }
}

function enumText(value) {
  return String(value || "").trim().toLowerCase().replace(/[\s_]+/g, "-");
}

function listValue(value, { lines = false } = {}) {
  if (Array.isArray(value)) return value;
  if (value == null || value === "") return [];
  if (lines && typeof value === "string") return value.split(/\r?\n/).map(item => item.trim()).filter(Boolean);
  return [value];
}

export function normalizeAITripPlan(source) {
  const spec = structuredClone(source);
  if (!spec || typeof spec !== "object") return spec;
  if (Array.isArray(spec.places)) {
    for (const place of spec.places) {
      if (!place || typeof place !== "object") continue;
      const kind = enumText(place.kind);
      place.kind = PLACE_KIND_ALIASES.get(kind) || kind;
      place.tags = listValue(place.tags).map(String);
      if (place.location?.coordinates && !place.location.coordinateStatus) place.location.coordinateStatus = "unverified";
      if (place.address && place.location && !place.location.address) {
        place.location.address = String(place.address);
        delete place.address;
      }
    }
  }
  if (Array.isArray(spec.days)) {
    for (const day of spec.days) {
      if (!day || typeof day !== "object") continue;
      day.notes = listValue(day.notes, { lines: true }).map(String);
      day.activities = listValue(day.activities);
      if (day.route && !Array.isArray(day.route.optionalStopPlaceIds)) day.route.optionalStopPlaceIds = [];
      if (day.stay?.type) {
        const type = enumText(day.stay.type);
        day.stay.type = STAY_TYPE_ALIASES.get(type) || type;
      }
      if (day.stay) day.stay.amenities = listValue(day.stay.amenities).map(String);
    }
  }
  if (spec.travelers) {
    spec.travelers.children = listValue(spec.travelers.children).map(child => {
      if (typeof child === "number") return { age: child };
      if (typeof child === "string" && /^\d+$/.test(child.trim())) return { age: Number(child) };
      return child;
    });
    spec.travelers.accessibilityNeeds = listValue(spec.travelers.accessibilityNeeds).map(String);
  }
  if (spec.vehicle) spec.vehicle.chargingConnectors = listValue(spec.vehicle.chargingConnectors).map(String);
  if (spec.preferences?.route) {
    spec.preferences.route.avoidCountries = listValue(spec.preferences.route.avoidCountries).map(value => String(value).toUpperCase());
  }
  if (spec.preferences?.lodging) {
    for (const key of ["preferredTypes", "requiredAmenities", "preferredAmenities"]) {
      spec.preferences.lodging[key] = listValue(spec.preferences.lodging[key]).map(String);
    }
  }
  if (spec.preferences?.activities) {
    spec.preferences.activities.interests = listValue(spec.preferences.activities.interests).map(String);
  }
  if (spec.vehicle?.mode) {
    const mode = enumText(spec.vehicle.mode);
    spec.vehicle.mode = ({ plane: "airplane", flight: "airplane", bike: "bicycle", cycle: "bicycle", walk: "walking", foot: "walking" })[mode] || mode;
  }
  if (spec.vehicle?.fuelType) {
    const fuel = enumText(spec.vehicle.fuelType);
    spec.vehicle.fuelType = ({ petrol: "gasoline", gas: "gasoline", ev: "electric", battery: "electric", jet: "aviation" })[fuel] || fuel;
  }
  return spec;
}

// Legacy export kept so integrations built before the product rename continue to work.
export const normalizeAITripSpec = normalizeAITripPlan;

export function buildPlannerInput({ brief, answers = {}, today = new Date() }) {
  const date = today instanceof Date ? today.toISOString().slice(0, 10) : String(today);
  const answerLines = Object.entries(answers)
    .filter(([, value]) => String(value).trim())
    .map(([key, value]) => `- ${key}: ${String(value).trim()}`)
    .join("\n");
  return `Current date: ${date}\n\nTrip brief:\n${String(brief).trim()}${answerLines ? `\n\nAnswers to follow-up questions:\n${answerLines}` : ""}`;
}

function responseText(data, provider) {
  if (usesChatCompletions(provider)) {
    const content = data?.choices?.[0]?.message?.content;
    if (typeof content === "string") return content;
    if (Array.isArray(content)) return content.map(item => item?.text || "").join("");
  }
  if (typeof data?.output_text === "string") return data.output_text;
  const parts = (data?.output || []).flatMap(item => item?.content || []);
  return parts.filter(item => item?.type === "output_text").map(item => item.text || "").join("");
}

export async function requestAIPlan({
  provider = "openai",
  endpoint,
  model,
  token,
  brief,
  answers = {},
  fetchImpl = globalThis.fetch,
  today = new Date()
}) {
  if (!String(model || "").trim()) throw new Error("请填写模型 ID");
  if (!String(token || "").trim()) throw new Error("请填写 API Token");
  if (!String(brief || "").trim()) throw new Error("请先描述这次旅行");
  const url = String(endpoint || endpointFor(provider)).trim();
  if (!/^https:\/\//i.test(url) && !/^http:\/\/localhost(?::\d+)?\//i.test(url) && !/^http:\/\/127\.0\.0\.1(?::\d+)?\//i.test(url)) {
    throw new Error("模型端点必须使用 HTTPS（本机 localhost 除外）");
  }

  const input = buildPlannerInput({ brief, answers, today });
  const body = usesChatCompletions(provider)
    ? {
        model: String(model).trim(),
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: input }
        ],
        temperature: 0.2
      }
    : {
        model: String(model).trim(),
        instructions: SYSTEM_PROMPT,
        input,
        store: false
      };

  let response;
  try {
    response = await fetchImpl(url, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${String(token).trim()}`
      },
      body: JSON.stringify(body)
    });
  } catch (error) {
    throw new Error(`无法连接模型服务：${error?.message || "网络错误"}`);
  }

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`模型服务返回了无法读取的响应（HTTP ${response.status}）`);
  }
  if (!response.ok) {
    const message = data?.error?.message || data?.message || `HTTP ${response.status}`;
    throw new Error(`模型服务拒绝了请求：${message}`);
  }

  const parsed = extractJson(responseText(data, provider));
  if (parsed?.status === "needs_input") {
    const questions = Array.isArray(parsed.questions) ? parsed.questions.slice(0, 3) : [];
    if (!questions.length) throw new Error("模型要求补充信息，但没有返回问题");
    return { status: "needs_input", questions };
  }
  const tripPlan = parsed?.tripPlan || parsed?.tripSpec;
  if (parsed?.status !== "ready" || !tripPlan) throw new Error("模型响应不符合规划契约");
  const normalizedTripPlan = normalizeAITripPlan(tripPlan);
  return {
    status: "ready",
    tripPlan: normalizedTripPlan,
    tripSpec: normalizedTripPlan,
    assumptions: Array.isArray(parsed.assumptions) ? parsed.assumptions : [],
    warnings: Array.isArray(parsed.warnings) ? parsed.warnings : []
  };
}
