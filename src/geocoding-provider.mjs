let requestQueue = Promise.resolve();
let lastRequestAt = 0;

function wait(ms) {
  return new Promise(resolve => globalThis.setTimeout(resolve, ms));
}

export function addressCandidates(address) {
  const query = String(address || "").trim();
  if (!query) return [];
  const simplified = query
    .replace(/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/gi, "")
    .replace(/\b\d{5}(?:-\d{4})?\b/g, "")
    .split(",")
    .map(part => part.trim())
    .filter(Boolean)
    .join(", ")
    .replace(/,\s*Canada$/i, ", Canada");
  return [...new Set([query, simplified].filter(Boolean))];
}

export function geocodeAddress(address, {
  fetchImpl = globalThis.fetch,
  endpoint = "https://nominatim.openstreetmap.org/search",
  locale = "zh-CN",
  minIntervalMs = 1100,
  now = () => Date.now(),
  waitImpl = wait
} = {}) {
  const queries = addressCandidates(address);
  if (!queries.length) return Promise.reject(new Error("请先填写地址"));

  const run = async () => {
    for (const query of queries) {
      const remaining = Math.max(0, minIntervalMs - (now() - lastRequestAt));
      if (remaining) await waitImpl(remaining);
      const url = new URL(endpoint);
      url.searchParams.set("q", query);
      url.searchParams.set("format", "jsonv2");
      url.searchParams.set("limit", "1");
      url.searchParams.set("addressdetails", "1");
      url.searchParams.set("accept-language", locale);
      lastRequestAt = now();

      const response = await fetchImpl(url, { headers: { accept: "application/json" } });
      if (!response.ok) throw new Error(`Geocoder HTTP ${response.status}`);
      const results = await response.json();
      const result = Array.isArray(results) ? results[0] : null;
      const lat = Number(result?.lat);
      const lng = Number(result?.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        return { lat, lng, displayName: result.display_name || query };
      }
    }
    throw new Error("没有找到匹配地点");
  };

  const result = requestQueue.then(run, run);
  requestQueue = result.catch(() => {});
  return result;
}
