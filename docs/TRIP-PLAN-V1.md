# TripPlan V1

TripPlan is the portable source of truth for a Road Trip plan. Trip Builder writes it, the planner enriches it, and Traveler renders it. Existing `trip-spec` module and schema filenames remain stable implementation identifiers for V1 compatibility.

## Design goals

- Friendly to visual editors, AI assistants, and hand-authored files
- Provider-neutral place, route, lodging, and activity data
- Stable enough to archive after a trip
- Explicit distinction between required route anchors and optional stops
- No reservation identifiers, payment data, API keys, or live location history
- No expiring weather, wildfire, air-quality, or road-closure snapshots

## Data boundaries

TripPlan contains durable travel facts:

- Trip dates and endpoints
- Traveler and vehicle constraints
- Driving, lodging, route, and activity preferences
- Places and their coordinates
- Daily route anchors, optional stops, activities, and overnight stays
- Rebuildable route metadata

Temporary operational information belongs in a separate runtime feed:

```text
tripplan.json           Durable TripPlan
generated.routeData     Rebuildable route geometry and turn steps
generated/routes.json   Optional legacy/external route geometry
runtime/alerts.json     Expiring weather, wildfire and closure data
private/local.json      Optional private booking details; never committed
```

The Traveler may merge these sources in memory, but it must remain usable when runtime and private files are absent.

The browser Traveler can select any same-origin TripPlan with `?trip=path/to/tripplan.json`; legacy `*.trip.json` files remain supported. Trip Builder normally embeds regenerated geometry in `generated.routeData`; `generated.routeDataFile` remains supported for larger prebuilt trips. When route data is absent, stale, unavailable, or belongs to another `trip.id`, Traveler keeps working with straight anchor lines and displays a route-data notice.

## Route semantics

`anchorPlaceIds` changes the driven route. Use it only for:

- Daily origin and destination
- Required charging or fuel stops
- Ferry terminals
- A place the traveler explicitly requires the route to pass through

`optionalStopPlaceIds` and `activities` appear on the map and cards without forcing a detour. The planner may suggest a detour after comparing its cost, but it must not silently promote an optional stop to an anchor.

A ferry crossing is represented by two consecutive `ferry-terminal` anchors. The Traveler draws that pair as a ferry leg, while the road-route generator ends the road segment at the first terminal and resumes at the second.

`generated.routeData` records the transport mode, a route fingerprint, encoded polyline6 geometry, provider distance/duration, and normalized turn-by-turn steps grouped by `dayId`. Car-class modes use a road graph. Bicycle and walking modes use dedicated OpenStreetMap graphs that snap anchors to the nearest routable cycling/walking way, including mapped trails where permitted. Airplane mode has no surface-route segments and is rendered point-to-point. A failed pair is retained in `unroutedSegments`, including its mode and endpoint IDs, so Traveler can show a dashed fallback and an explicit coordinate/GPX warning instead of silently dropping that leg.

Two consecutive route anchors whose places both have `kind: "airport"` always form an automatic flight leg, even when the trip's primary `vehicle.mode` is a ground mode. That pair is never sent to a surface router and Traveler draws it as a direct airport-to-airport line. Ground legs before the departure airport or after the arrival airport remain independently routable.

Feasibility checks never interpret flight duration as driving time. On mixed flight days, driving limits apply only to generated surface-route segments. `preferences.lodging.hotelEveryDays` is optional and should be present only when the traveler explicitly requests a recurring hotel cadence.

Route mode may also change within a day. When both ends of an anchor pair are backcountry trail places (`kind: "trailhead"`, `tag: "backcountry-access"`, or `tag: "backcountry-campground"`), the route engine uses the walking/trail graph for that pair. Adjacent hotel-to-trailhead transfers keep the primary road mode. Each generated route segment records its own `mode`.

## Privacy

TripPlan can include the selected lodging name and useful amenities. It must not include reservation numbers, confirmation links, contact details, payment records, or precise device-location history.

## Versioning

V1 files use `"schemaVersion": "1.0"`. Minor additions must remain backward-compatible. Breaking field changes require a new major schema and a migration tool.

The normative schema is [`schemas/trip-spec.v1.schema.json`](../schemas/trip-spec.v1.schema.json). A fictional complete example is available at [`examples/lakes-and-pines.trip.json`](../examples/lakes-and-pines.trip.json).

The historical `vehicle` field now describes the primary transport mode and remains named for V1 compatibility. Its `mode` may be `car`, `campervan`, `rv`, `motorcycle`, `airplane`, `bicycle`, or `walking`. `fuelType` also supports `aviation` and `human`. Mode-specific route providers may enrich the same durable day and place structure.
