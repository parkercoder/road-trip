# Road Trip

Road Trip is a mobile-first, full-screen trip map for long-distance driving. The map stays available while itinerary cards live in a swipeable side drawer.

The included demo is a completed cross-Canada road trip. It contains public route and place information only; booking confirmations and personal data are deliberately excluded.

The product is built around **TripPlan V1**: one portable plan that can be created in Trip Builder or by an AI assistant, saved as JSON, and rendered by the Traveler interface.

## Features

- Visual Studio for creating and editing trips without writing JSON
- BYOK AI planner that turns a natural-language brief and up to three follow-up answers into a TripPlan
- User-selected OpenAI Responses or OpenAI-compatible model and endpoint; API tokens are never persisted
- Browser-local autosave, Plan import/save, validation, and one-click Trip Preview
- Deterministic feasibility checks for route continuity, daily travel limits, EV range gaps, and lodging cadence
- Map-based coordinate picking plus ordered route-anchor and optional-activity editors
- Address geocoding with persistent stale/unverified coordinate warnings and map-based correction
- Full-screen interactive Leaflet map optimized for phones
- Mode-aware actual-route overlays: roads for driving, routable paths/trails for walking and cycling, point-to-point flights, and explicit dashed fallbacks for remote pairs absent from the provider graph
- Automatic airport-to-airport flight legs, with independently routed ground transfers before and after the flight
- Automatic mixed driving and hiking days for trailheads and tagged backcountry camps
- Collapsible turn-by-turn directions on each Traveler day card
- Per-tile fallback across OpenStreetMap, CARTO, and Esri basemaps
- Swipeable itinerary drawer that returns to the current-day card
- Campground, hotel, charging, ferry, attraction, and hazard markers
- Native location sharing for navigation apps
- Device geolocation support
- High-visibility weather and wildfire warning cards
- No framework, build step, account, or map API key required

## Quick Start

The route data is loaded with `fetch`, so serve the directory over HTTP instead of opening `index.html` directly.

```bash
cd road-trip
python3 -m http.server 8765
```

Open `http://localhost:8765/studio.html` to create a trip in Trip Builder, or `http://localhost:8765` to view the included Traveler demo.

To open another same-origin TripPlan without changing the app, pass its path in the URL:

```text
http://localhost:8765/?trip=examples%2Flakes-and-pines.trip.json
```

## Customize a Trip

The recommended path is the visual [`studio.html`](studio.html). Describe a trip for AI-assisted planning with your own model and API token, or use the complete manual editor. Trip Builder saves the TripPlan locally, supports addresses and map-based coordinate picking, imports and saves Plan files, checks feasibility, and opens the current draft in Trip Preview. See the [Trip Builder guide](docs/STUDIO.md).

Traveler reads its default public demo from [`data/cross-canada.trip.json`](data/cross-canada.trip.json). You can also select another same-origin JSON Plan file with the `trip` query parameter.

Only origins, destinations, ferry terminals, and required charging stops should be route anchors. Optional attractions should remain activities or optional stops so they do not force a detour.

New integrations should target [`TripPlan V1`](docs/TRIP-PLAN-V1.md). The canonical JSON Schema remains in [`schemas/trip-spec.v1.schema.json`](schemas/trip-spec.v1.schema.json) for V1 compatibility, with a smaller fictional example in [`examples/lakes-and-pines.trip.json`](examples/lakes-and-pines.trip.json).

```bash
npm run check:tripplan
npm test
```

Trip Builder regenerates inline route geometry automatically before Trip Preview. For the committed long-distance demo, the optional build script can still regenerate an external route file:

```bash
npm run build:routes
```

The browser adapter uses the public FOSSGIS car, bicycle, and foot OSRM services with a one-request-per-second queue. The script uses the public Project OSRM demo endpoint. Use public services sparingly; production deployments should use an appropriate routing service or a self-hosted routing stack.

## Privacy

Never commit reservation numbers, confirmation pages, payment details, personal email addresses, or live location history. See [PRIVACY.md](PRIVACY.md).

## Project Structure

```text
road-trip/
├── docs/STUDIO.md
├── docs/TRIP-PLAN-V1.md
├── examples/*.trip.json
├── schemas/trip-spec.v1.schema.json
├── data/cross-canada.trip.json
├── index.html
├── studio.html
├── data/road-routes.json
├── src/studio-core.mjs
├── src/studio-app.mjs
├── src/trip-spec.mjs
├── src/traveler-app.mjs
├── scripts/build-road-routes.mjs
├── tests/*.test.mjs
├── vendor/leaflet/
└── .github/
```

`src/trip-spec.mjs` is the shared TripPlan runtime used by Trip Builder, Traveler, validators, tests, and the route builder. The implementation filename remains stable for V1 compatibility. TripPlan supports inline `generated.routeData` plus the legacy external `generated.routeDataFile`. Missing, stale, or mismatched geometry falls back visibly to straight anchor lines.

## Contributing

Bug reports, accessibility improvements, map reliability work, and itinerary-data separation are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

Road Trip is available under the [MIT License](LICENSE). Leaflet is distributed under its own BSD-2-Clause license; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## 中文简介

Road Trip 是一套无需账户和后端的端到端旅行路线产品。你可以在 Trip Builder 中创建、校验、导入和保存 TripPlan，再通过 Trip Preview 交给适合手机使用的 Traveler。地图按汽车、骑行、步行或飞行模式展示实际路线，支持逐向指引、定位、分享、充电点、轮渡、景点和灾害提醒。仓库中的加拿大路线仅作为不含个人预订资料的示例。
