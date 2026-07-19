# Trip Builder

Trip Builder is the browser-based editor for creating a complete TripPlan without writing JSON. It works as a static page, requires no account, and saves the current draft in the browser.

## Plan with your own AI model

1. Describe the trip in natural language.
2. Choose **OpenAI Responses API** or an **OpenAI-compatible Chat Completions** endpoint.
3. Enter a model ID available to your account and an API token.
4. Press **分析需求并规划**. The model may ask up to three critical follow-up questions.
5. Trip Builder validates the returned TripPlan, generates mode-specific route geometry and turn-by-turn steps, recalculates distance and duration through the routing provider, and runs deterministic feasibility rules.

The model interprets intent and proposes a TripPlan. It is not the source of truth for road time, EV range, route continuity, or lodging cadence. Blocking findings remain visible beside the map and can be corrected with the manual editor.

The API token exists only in the password field for the lifetime of the page. It is not placed in local storage, TripPlan, logs, or saved files. A public static build is intended for personal BYOK use. A shared or production deployment should put model calls behind a controlled backend proxy.

The model-service selector configures the matching endpoint and shows a curated text-model list for OpenAI, Anthropic Claude, Google Gemini, DeepSeek, xAI, Mistral AI, and OpenRouter. Each provider also offers a custom model-ID choice because account availability and model catalogs change independently. The curated IDs were checked against provider documentation on 2026-07-19; the user's provider account remains the final authority on availability.

Models and compatible providers vary in JSON reliability and browser CORS policy. Studio reports provider errors without replacing the current draft.

## Start a new trip

1. Serve the project over HTTP and open `http://localhost:8765/studio.html`.
2. Press **新建** to reset to a valid one-day starter trip.
3. Set the trip name, language, timezone, travelers, and transport constraints. Supported primary modes are car, campervan, RV, motorcycle, airplane, bicycle, and walking.
4. Rename the starter origin and destination and enter an address. After typing stops briefly, Studio geocodes it and synchronizes latitude and longitude. Use **地址定位** to retry immediately or **地图取点** to confirm/correct the result on the preview map.

AI-proposed coordinates are marked as unverified. Editing an address marks its previous coordinates as stale until geocoding succeeds or the user confirms a position on the map. A failed lookup never silently overwrites the old coordinates; it creates a visible feasibility finding instead.

`每隔几天住酒店` is an optional hotel-cadence constraint, not a lodging-coverage field. Leave it blank for a planned camping block; explicit campground stays remain valid accommodation. Consecutive non-hotel nights are reported as one grouped reminder rather than one warning per night.

The status badge and validation panel update after every edit. Invalid drafts are still autosaved, but preview and export remain disabled until required references and coordinates are valid.

## Build the route

Create every durable place before assembling the daily plan. Useful kinds include:

- `charging` or `fuel` for required energy stops
- `ferry-terminal` for each side of a ferry crossing
- `campground`, `hotel`, or `home` for overnight stays
- `attraction`, `trailhead`, and `lookout` for optional activities

For each day:

1. Choose the origin and destination.
2. Add required stops with **＋ 必经点** and keep them in driving order.
3. Represent a ferry with two consecutive places whose kind is `ferry-terminal`.
4. Add sightseeing with **＋ 活动**. Activities appear on the map and cards but do not change the driven route.
5. Set the stay, optional distance and driving time, and notes.

Additional days begin at the previous day's destination. The trip start, end, origin, and destination metadata are synchronized automatically.

## Save, move, and preview

- **Autosave:** every change is saved to browser local storage.
- **保存 Plan:** downloads a portable `*.tripplan.json` file after validation.
- **导入 Plan:** validates and replaces the current local draft with a selected TripPlan; legacy `*.trip.json` files remain compatible.
- **Trip Preview:** opens `index.html?draft=1`, where the same local draft is rendered as the mobile Traveler experience.
- **Edit from Traveler:** press the pencil control to return to Trip Builder without losing the draft.

Before preview, Studio generates rebuildable inline `generated.routeData` when the route is missing or stale. Driving modes follow the OpenStreetMap car graph; bicycle and walking modes use their dedicated OpenStreetMap graphs so endpoints snap to the nearest routable cycling or walking path/trail. Airplane trips intentionally remain point-to-point.

Two consecutive airport anchors are automatically treated as a flight leg regardless of the trip's primary mode. Studio skips route snapping for that pair and draws a direct line; ground transfers on either side are routed normally.

Backcountry days may mix modes in the same anchor list. A hotel-to-trailhead pair follows the primary road mode, while trailhead/backcountry-camp pairs and consecutive `backcountry-campground` pairs automatically use the walking trail provider. Traveler colors and labels those generated segments separately.

Changing the transport mode, an anchor, an address, or coordinates invalidates the previous route. The next preview regenerates geometry, daily metrics, and turn-by-turn steps. If only some remote road or trail pairs fail, `generated.routeData.unroutedSegments` preserves those failures and Traveler renders them as prominent dashed anchor lines with a per-day warning; successful pairs remain snapped to their provider graph. Traveler still supports legacy `generated.routeDataFile` files.

## Privacy and recovery

Local autosave is convenient, not a durable backup. Save the Plan before clearing browser data or moving to another device. Avoid putting reservation numbers, payment data, contact details, confirmation links, or precise location history into a TripPlan intended for sharing.

Generating a route sends only ordered anchor coordinates to the selected routing service. Provider retention and acceptable-use policies apply; private booking details and AI tokens are never included in routing requests.
