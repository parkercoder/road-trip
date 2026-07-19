# Road Trip

Road Trip is a mobile-first, full-screen trip map for long-distance driving. The map stays available while itinerary cards live in a swipeable side drawer.

The included demo is a completed cross-Canada road trip. It contains public route and place information only; booking confirmations and personal data are deliberately excluded.

The project is evolving into a trip generator built around **TripSpec V1**: one portable plan that can be created by a visual Studio or an AI assistant, enriched by deterministic planning tools, and rendered by the Traveler interface.

## Features

- Full-screen interactive Leaflet map optimized for phones
- Road-level route overlays generated from OSRM
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
python3 -m http.server 8766
```

Open `http://localhost:8766`.

To open another same-origin TripSpec without changing the app, pass its path in the URL:

```text
http://localhost:8766/?trip=examples%2Flakes-and-pines.trip.json
```

## Customize a Trip

The Traveler reads its default public demo from [`data/cross-canada.trip.json`](data/cross-canada.trip.json). Edit that file or select another same-origin JSON file with the `trip` query parameter to change the cards, route anchors, ferries, stays, activities, and charging markers.

Only origins, destinations, ferry terminals, and required charging stops should be route anchors. Optional attractions should remain activities or optional stops so they do not force a detour.

New integrations should target [`TripSpec V1`](docs/TRIP-SPEC-V1.md). The canonical JSON Schema is in [`schemas/trip-spec.v1.schema.json`](schemas/trip-spec.v1.schema.json), with a smaller fictional example in [`examples/lakes-and-pines.trip.json`](examples/lakes-and-pines.trip.json).

```bash
npm run check:tripspec
npm test
```

After changing route anchors, regenerate road geometry from the same TripSpec:

```bash
npm run build:routes
```

The script uses the public OSRM demo endpoint. Use it sparingly; production deployments should use an appropriate routing service or a self-hosted OSRM instance.

## Privacy

Never commit reservation numbers, confirmation pages, payment details, personal email addresses, or live location history. See [PRIVACY.md](PRIVACY.md).

## Project Structure

```text
road-trip/
├── docs/TRIP-SPEC-V1.md
├── examples/*.trip.json
├── schemas/trip-spec.v1.schema.json
├── data/cross-canada.trip.json
├── index.html
├── data/road-routes.json
├── src/trip-spec.mjs
├── src/traveler-app.mjs
├── scripts/build-road-routes.mjs
├── tests/*.test.mjs
├── vendor/leaflet/
└── .github/
```

`src/trip-spec.mjs` is the shared TripSpec runtime used by the Traveler, validators, tests, and route builder. A TripSpec without `generated.routeDataFile` remains usable with straight anchor lines. A route file whose `tripId` does not match the selected trip is rejected with a visible fallback notice.

## Contributing

Bug reports, accessibility improvements, map reliability work, and itinerary-data separation are welcome. Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening a pull request.

## License

Road Trip is available under the [MIT License](LICENSE). Leaflet is distributed under its own BSD-2-Clause license; see [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

## 中文简介

Road Trip 是一个为手机和长途自驾设计的全屏地图。行程卡采用侧滑抽屉，地图支持公路级路线、定位、分享、充电点、景点和灾害提醒。仓库中的加拿大路线仅作为不含个人预订资料的示例。
