import { createTravelerModel, loadTripSpec, validateRouteData } from "./trip-spec.mjs";

function showFatalError(error) {
  document.body.classList.add("map-error");
  const detail = document.querySelector("[data-error-detail]");
  const loadStatus = document.querySelector("[data-load-status]");
  if (detail) detail.textContent = error?.message || "未知错误";
  if (loadStatus) loadStatus.textContent = "行程载入失败";
}

(async function () {
  const { spec: tripSpec, url: tripSourceUrl } = await loadTripSpec();
  const {
    placeById,
    positionFor,
    routeSegments,
    ferries,
    days,
    activities,
    chargers,
    originPlace,
    originPos,
    vehicleName
  } = createTravelerModel(tripSpec);
  const wildfireWatch = [];
  const drawer = document.querySelector("[data-drawer]");
  const cardsEl = document.querySelector("[data-cards]");
  const handle = document.querySelector("[data-handle]");
  const closeButton = document.querySelector("[data-close]");
  const edgeZone = document.querySelector("[data-edge]");
  const selectedSummary = document.querySelector("[data-selected-summary]");
  const loadStatus = document.querySelector("[data-load-status]");
  const routeStatus = document.querySelector("[data-route-status]");
  const tripTitle = document.querySelector("[data-trip-title]");
  const appTitle = document.querySelector("[data-app-title]");
  tripTitle.textContent = tripSpec.trip.title;
  appTitle.textContent = "Road Trip";
  document.title = `${tripSpec.trip.title} · Road Trip`;
  let map;
  let baseTiles;
  let chargerLayer;
  let activityLayer;
  let wildfireLayer;
  let routeLayer;
  let roadRouteLayer;
  let edgeStart = null;
  let drawerStart = null;
  let mapHasUserMoved = false;
  const straightRouteLines = [];
  const markerByDay = new Map();
  const todayDay = days.find(d => d.today) || days[0];

  function openDrawer(day) {
    drawer.classList.add("open");
    handle.setAttribute("aria-expanded", "true");
    handle.setAttribute("aria-label", "关闭 Road Trip 行程卡");
    requestAnimationFrame(() => selectDay(day || todayDay, false));
  }

  function closeDrawer() {
    drawer.classList.remove("open");
    handle.setAttribute("aria-expanded", "false");
    handle.setAttribute("aria-label", "打开 Road Trip 行程卡");
  }

  function selectDay(day, pan = true, openPopup = false) {
    if (!day) return;
    document.querySelectorAll(".card").forEach(card => card.classList.toggle("selected", card.dataset.dayId === day.id));
    const card = document.querySelector(`[data-day-id="${day.id}"]`);
    if (card) {
      const cardTop = card.offsetTop - cardsEl.offsetTop;
      cardsEl.scrollTo({ top: Math.max(0, cardTop - 10), behavior: "smooth" });
    }
    selectedSummary.textContent = `${day.day} · ${day.title}`;
    if (pan && map) map.setView(day.pos, Math.max(map.getZoom(), 8), { animate: true });
    const marker = markerByDay.get(day.id);
    if (marker && openPopup) marker.openPopup();
  }

  function iconFor(type, extraClass = "") {
    const symbol = type === "camp" ? "🏕" : type === "hotel" ? "🏨" : type === "charge" ? "T" : type === "activity" ? "📍" : type === "ferry" ? "⛴" : type === "warn" ? "🔥" : "🏠";
    return L.divIcon({
      className: "",
      html: `<div class="pin ${type} ${extraClass}">${symbol}</div>`,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
      popupAnchor: [0, -16]
    });
  }

  function popupHtml(title, note, dayId, pos) {
    const day = days.find(d => d.id === dayId);
    const dayLine = day ? `${day.day} · ${day.title}` : "";
    const shareTitle = encodeURIComponent(title);
    const shareText = encodeURIComponent(dayLine || note || "Road Trip location");
    const shareUrl = encodeURIComponent(`https://www.google.com/maps/search/?api=1&query=${pos[0]},${pos[1]}`);
    return `<b>${title}</b>${dayLine}<br>${note || ""}<button class="popup-share" type="button" aria-label="分享位置" title="分享位置" data-share-title="${shareTitle}" data-share-text="${shareText}" data-share-url="${shareUrl}"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="18" cy="5" r="2.5"></circle><circle cx="6" cy="12" r="2.5"></circle><circle cx="18" cy="19" r="2.5"></circle><path d="m8.2 10.8 7.6-4.5M8.2 13.2l7.6 4.5"></path></svg></button>`;
  }

  function marker(item) {
    return L.marker(item.pos, { icon: iconFor(item.type, item.extraClass || "") })
      .bindPopup(popupHtml(item.name, item.note, item.dayId, item.pos), { autoPan: false, keepInView: false });
  }

  function renderCards() {
    cardsEl.innerHTML = days.map(day => `
      <article class="card ${day.today ? "today" : ""}" data-day-id="${day.id}">
        <div class="card-top">
          <span class="muted">${day.today ? "Demo today · " : ""}${day.day}</span>
          <h2>${day.title}</h2>
          <span class="muted">${day.name}</span>
        </div>
        <div class="chips">
          <span class="chip">🧭 ${day.distance}</span>
          <span class="chip">⏱ ${day.drive}</span>
        </div>
        <div class="actions">
          <a class="action primary" href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(day.name + " Canada")}" target="_blank" rel="noopener">导航</a>
          <button class="action" type="button" data-show-map="${day.id}">地图</button>
        </div>
        <ul class="mini-list">
          <li><span>${day.type === "camp" ? "🏕" : day.type === "hotel" ? "🏨" : "🏠"}</span><span>${day.note}</span></li>
        </ul>
      </article>
    `).join("");

    cardsEl.querySelectorAll(".card").forEach(card => {
      card.addEventListener("click", event => {
        if (event.target.closest("a, button")) return;
        const day = days.find(d => d.id === card.dataset.dayId);
        selectDay(day, true, false);
      });
    });

    cardsEl.querySelectorAll("[data-show-map]").forEach(button => {
      button.addEventListener("click", () => {
        const day = days.find(d => d.id === button.dataset.showMap);
        selectDay(day, true, false);
        closeDrawer();
      });
    });
  }

  function fitRoute() {
    if (!map) return;
    map.invalidateSize({ pan: false, debounceMoveend: true });
    const all = [...routeSegments.flatMap(segment => segment.coords), ...ferries.flatMap(ferry => ferry.coords)];
    map.fitBounds(L.latLngBounds(all), { padding: [34, 34] });
  }

  function scheduleInitialMapFit() {
    [0, 120, 420, 900, 1800].forEach(delay => {
      window.setTimeout(() => {
        if (!map || mapHasUserMoved) return;
        fitRoute();
      }, delay);
    });
  }

  function createResilientTileLayer() {
    const providers = [
      {
        name: "osm",
        url: ({ z, x, y }) => `https://tile.openstreetmap.org/${z}/${x}/${y}.png`
      },
      {
        name: "carto",
        url: ({ z, x, y }) => {
          const subdomain = ["a", "b", "c", "d"][Math.abs(x + y) % 4];
          return `https://${subdomain}.basemaps.cartocdn.com/light_all/${z}/${x}/${y}.png`;
        }
      },
      {
        name: "esri",
        url: ({ z, x, y }) => `https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/${z}/${y}/${x}`
      }
    ];

    const ResilientTileLayer = L.GridLayer.extend({
      createTile(coords, done) {
        const tile = document.createElement("img");
        tile.alt = "";
        tile.setAttribute("role", "presentation");
        let providerIndex = 0;
        let requestToken = 0;
        let timer = 0;
        let finished = false;

        const finish = error => {
          if (finished) return;
          finished = true;
          window.clearTimeout(timer);
          tile.onload = null;
          tile.onerror = null;
          done(error || null, tile);
        };

        const tryProvider = () => {
          if (providerIndex >= providers.length) {
            window.crossingMapDebug.tileFailures += 1;
            finish(new Error("All basemap providers failed"));
            return;
          }

          const provider = providers[providerIndex];
          const token = ++requestToken;
          const fallback = () => {
            if (finished || token !== requestToken) return;
            window.clearTimeout(timer);
            tile.onload = null;
            tile.onerror = null;
            providerIndex += 1;
            window.crossingMapDebug.tileFallbacks += 1;
            loadStatus.textContent = "正在切换备用底图…";
            tryProvider();
          };

          tile.onload = () => {
            if (finished || token !== requestToken) return;
            tile.dataset.provider = provider.name;
            window.crossingMapDebug.tileProviderHits[provider.name] += 1;
            finish();
          };
          tile.onerror = fallback;
          timer = window.setTimeout(fallback, 4500);
          tile.src = provider.url(coords);
        };

        tryProvider();
        return tile;
      }
    });

    return new ResilientTileLayer({
      minZoom: 2,
      maxZoom: 19,
      updateWhenIdle: false,
      updateWhenZooming: false,
      keepBuffer: 3,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO &copy; Esri"
    });
  }

  function refreshFullMap() {
    if (!map) return;
    map.stop();
    map.invalidateSize({ pan: false, debounceMoveend: false });
    baseTiles?.redraw();
    fitRoute();
    window.setTimeout(() => {
      if (!map) return;
      map.invalidateSize({ pan: false, debounceMoveend: false });
      baseTiles?.redraw();
      fitRoute();
    }, 160);
  }

  function decodePolyline(encoded, precision = 6) {
    const factor = 10 ** precision;
    const coords = [];
    let index = 0;
    let lat = 0;
    let lon = 0;

    while (index < encoded.length) {
      let byte = 0;
      let shift = 0;
      let result = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      lat += (result & 1) ? ~(result >> 1) : result >> 1;

      shift = 0;
      result = 0;
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      lon += (result & 1) ? ~(result >> 1) : result >> 1;

      coords.push([lat / factor, lon / factor]);
    }
    return coords;
  }

  async function loadRoadRoutes(routeRenderer) {
    try {
      window.crossingMapDebug.roadStage = "loading";
          const routeDataFile = tripSpec.generated?.routeDataFile;
          if (!routeDataFile) {
            window.crossingMapDebug.roadStage = "not-provided";
            routeStatus.textContent = "未提供公路几何，显示路线锚点";
            return;
      }

          const response = await fetch(routeDataFile, { cache: "no-store" });
          if (!response.ok) throw new Error(`road routes ${response.status}`);
          const data = await response.json();
          const segments = validateRouteData(tripSpec, data);

      roadRouteLayer = L.layerGroup().addTo(map);
      segments.forEach(segment => {
        const coords = decodePolyline(segment.geometry, 6);
        L.polyline(coords, {
          color: "#ffffff",
          weight: 9,
          opacity: .88,
          lineCap: "round",
          lineJoin: "round",
          smoothFactor: 1,
          pane: "routePane",
          renderer: routeRenderer
        }).addTo(roadRouteLayer);
        L.polyline(coords, {
          color: segment.color,
          weight: 5.5,
          opacity: .98,
          lineCap: "round",
          lineJoin: "round",
          smoothFactor: 1,
          pane: "routePane",
          renderer: routeRenderer
        }).addTo(roadRouteLayer);
      });

      straightRouteLines.forEach(line => line.setStyle({ opacity: .12, weight: 3 }));
          window.crossingMapDebug.roadStage = "ready";
          window.crossingMapDebug.roadSegments = segments.length;
          routeStatus.textContent = `公路几何已加载 · ${segments.length} 段`;
      if (!mapHasUserMoved) fitRoute();
    } catch (error) {
      window.crossingMapDebug.roadStage = error?.code === "route-mismatch" ? "mismatch" : "fallback";
      window.crossingMapDebug.roadError = String(error);
          routeStatus.textContent = error?.code === "route-mismatch"
            ? "公路几何不匹配，显示路线锚点"
            : "公路几何载入失败，显示路线锚点";
    }
  }

  function initMap() {
    if (!window.L) {
      throw new Error("地图脚本没有加载成功，请刷新。");
    }

    map = L.map("map", {
      center: [50.2, -103.5],
      zoom: 3,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: false,
      tap: true,
      dragging: true,
      touchZoom: true,
      doubleClickZoom: true,
      boxZoom: false,
      keyboard: false
    });

    map.dragging?.enable();
    map.touchZoom?.enable();
    map.doubleClickZoom?.enable();

    map.createPane("routePane");
    map.getPane("routePane").classList.add("leaflet-route-pane");
    const routeRenderer = L.svg({ pane: "routePane", padding: .5 });
    window.crossingMapDebug = {
      roadStage: "not-started",
      roadSegments: 0,
      tileFallbacks: 0,
      tileFailures: 0,
      tileProviderHits: { osm: 0, carto: 0, esri: 0 },
      tripSource: tripSourceUrl
    };

    baseTiles = createResilientTileLayer()
      .once("load", () => {
        document.body.classList.add("map-ready");
        loadStatus.textContent = "地图已加载";
        if (!mapHasUserMoved) requestAnimationFrame(fitRoute);
      })
      .on("tileerror", () => {
        loadStatus.textContent = "底图瓦片加载较慢，路线和点位仍可用";
      })
      .addTo(map);

    routeLayer = L.layerGroup().addTo(map);
    routeSegments.forEach(segment => {
      straightRouteLines.push(
        L.polyline(segment.coords, { color: "#ffffff", weight: 11, opacity: .82, pane: "routePane", renderer: routeRenderer }).addTo(routeLayer),
        L.polyline(segment.coords, { color: segment.color, weight: 7, opacity: .98, pane: "routePane", renderer: routeRenderer }).addTo(routeLayer)
      );
    });
    ferries.forEach(ferry => {
      L.polyline(ferry.coords, { color: "#7c3aed", weight: 5, opacity: .98, dashArray: "8 8", pane: "routePane", renderer: routeRenderer }).addTo(routeLayer);
      marker({ name:ferry.name, type:"ferry", pos:ferry.coords[0], dayId:ferry.dayId, note:ferry.note }).addTo(map);
    });

    marker({ name:originPlace.name, type:"home", pos:originPos, dayId:days[0].id, note:"起点 / 终点" }).addTo(map);

    days.forEach(day => {
      const m = marker({ name:day.name, type:day.type, pos:day.pos, dayId:day.id, note:`${day.day} · ${day.title}<br>${day.distance} · ${day.drive}` }).addTo(map);
      markerByDay.set(day.id, m);
    });

    activityLayer = L.layerGroup();
    activities.forEach(([name, pos, dayId, note]) => marker({ name, pos, dayId, note, type:"activity" }).addTo(activityLayer));

    chargerLayer = L.layerGroup();
    chargers.forEach(([name, pos, dayId]) => marker({ name, pos, dayId, note:"Tesla / 快充锚点，最终以车机实时状态为准。", type:"charge" }).addTo(chargerLayer));

    wildfireLayer = L.layerGroup().addTo(map);
    wildfireWatch.forEach(([name, pos, dayId]) => marker({ name, pos, dayId, note:"山火 / 烟雾 watch 点，出发前复核官方地图和道路状态。", type:"warn", extraClass:"warn" }).addTo(wildfireLayer));

    L.marker(originPos, {
      icon: L.divIcon({
        className: "",
        html: `<div class="model-y-pin">🚙 ${vehicleName}</div>`,
        iconSize: [124, 30],
        iconAnchor: [120, 15]
      })
    }).bindPopup(popupHtml(vehicleName, "示例当前位置", todayDay.id, originPos), { autoPan: false, keepInView: false }).addTo(map);

    const syncDetailLayers = () => {
      if (map.getZoom() >= 4) {
        if (!map.hasLayer(activityLayer)) activityLayer.addTo(map);
      } else if (map.hasLayer(activityLayer)) {
        map.removeLayer(activityLayer);
      }
    };
    map.on("zoomend", syncDetailLayers);
    map.on("dragstart zoomstart", event => {
      if (event.originalEvent) mapHasUserMoved = true;
    });

    map.whenReady(() => {
      loadStatus.textContent = "路线已显示，底图加载中…";
      requestAnimationFrame(() => {
        map.invalidateSize(false);
        selectDay(todayDay, false);
        syncDetailLayers();
        loadRoadRoutes(routeRenderer);
        scheduleInitialMapFit();
      });
    });
  }

  try {
    renderCards();
    initMap();
  } catch (error) {
    throw new Error("地图初始化失败：" + error.message, { cause: error });
  }

  document.querySelector("#map").addEventListener("click", async event => {
    const button = event.target.closest(".popup-share");
    if (!button) return;
    event.preventDefault();
    event.stopPropagation();

    const title = decodeURIComponent(button.dataset.shareTitle || "Road Trip location");
    const text = decodeURIComponent(button.dataset.shareText || "Road Trip location");
    const url = decodeURIComponent(button.dataset.shareUrl || "");
    const showCopiedState = () => {
      button.classList.add("copied");
      button.setAttribute("aria-label", "位置链接已复制");
      window.setTimeout(() => {
        button.classList.remove("copied");
        button.setAttribute("aria-label", "分享位置");
      }, 1600);
    };

    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
      } else if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(`${title}\n${url}`);
        showCopiedState();
      } else {
        window.open(url, "_blank", "noopener");
      }
    } catch (error) {
      if (error?.name === "AbortError") return;
      try {
        await navigator.clipboard?.writeText(`${title}\n${url}`);
        showCopiedState();
      } catch {
        window.open(url, "_blank", "noopener");
      }
    }
  });

  handle.addEventListener("click", () => {
    if (drawer.classList.contains("open")) closeDrawer();
    else openDrawer(todayDay);
  });

  closeButton.addEventListener("click", closeDrawer);

  edgeZone.addEventListener("pointerdown", event => {
    edgeStart = { x:event.clientX, y:event.clientY };
    edgeZone.setPointerCapture(event.pointerId);
  });

  edgeZone.addEventListener("pointerup", event => {
    if (!edgeStart) return;
    const dx = event.clientX - edgeStart.x;
    const dy = event.clientY - edgeStart.y;
    if (dx > 42 && Math.abs(dx) > Math.abs(dy) * 1.2) openDrawer(todayDay);
    edgeStart = null;
  });

  drawer.addEventListener("pointerdown", event => {
    if (!drawer.classList.contains("open")) return;
    drawerStart = { x:event.clientX, y:event.clientY };
  });

  drawer.addEventListener("pointerup", event => {
    if (!drawerStart) return;
    const dx = event.clientX - drawerStart.x;
    const dy = event.clientY - drawerStart.y;
    if (dx < -52 && Math.abs(dx) > Math.abs(dy) * 1.4) closeDrawer();
    drawerStart = null;
  });

  document.querySelector("[data-fit]").addEventListener("click", refreshFullMap);

  document.querySelector("[data-locate]").addEventListener("click", () => {
    if (!navigator.geolocation || !map) return;
    navigator.geolocation.getCurrentPosition(position => {
      const pos = [position.coords.latitude, position.coords.longitude];
      map.setView(pos, 11, { animate: true });
      L.circle(pos, { radius: position.coords.accuracy || 80, color: "#0f5fd7", fillColor: "#0f5fd7", fillOpacity: .12 }).addTo(map);
    });
  });

  let resizeFrame = 0;
  const refreshMapViewport = () => {
    cancelAnimationFrame(resizeFrame);
    resizeFrame = requestAnimationFrame(() => {
      if (!map) return;
      map.invalidateSize({ pan: false, debounceMoveend: true });
      if (!mapHasUserMoved) fitRoute();
    });
  };
  window.addEventListener("resize", refreshMapViewport);
  window.addEventListener("pageshow", refreshMapViewport);
  window.addEventListener("load", refreshMapViewport);
  window.visualViewport?.addEventListener("resize", refreshMapViewport);
})().catch(showFatalError);
