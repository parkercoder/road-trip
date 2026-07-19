# TripSpec V1

TripSpec is the portable source of truth for a Road Trip plan. The Studio writes it, the planner enriches it, and the Traveler renders it.

## Design goals

- Friendly to visual editors, AI assistants, and hand-authored files
- Provider-neutral place, route, lodging, and activity data
- Stable enough to archive after a trip
- Explicit distinction between required route anchors and optional stops
- No reservation identifiers, payment data, API keys, or live location history
- No expiring weather, wildfire, air-quality, or road-closure snapshots

## Data boundaries

TripSpec contains durable travel facts:

- Trip dates and endpoints
- Traveler and vehicle constraints
- Driving, lodging, route, and activity preferences
- Places and their coordinates
- Daily route anchors, optional stops, activities, and overnight stays
- Rebuildable route metadata

Temporary operational information belongs in a separate runtime feed:

```text
trip.json               Durable TripSpec
generated/routes.json   Rebuildable route geometry
runtime/alerts.json     Expiring weather, wildfire and closure data
private/local.json      Optional private booking details; never committed
```

The Traveler may merge these sources in memory, but it must remain usable when runtime and private files are absent.

The browser Traveler can select any same-origin TripSpec with `?trip=path/to/trip.json`. When `generated.routeDataFile` is absent, unavailable, or belongs to another `trip.id`, the Traveler keeps working with straight anchor lines and displays a route-data notice.

## Route semantics

`anchorPlaceIds` changes the driven route. Use it only for:

- Daily origin and destination
- Required charging or fuel stops
- Ferry terminals
- A place the traveler explicitly requires the route to pass through

`optionalStopPlaceIds` and `activities` appear on the map and cards without forcing a detour. The planner may suggest a detour after comparing its cost, but it must not silently promote an optional stop to an anchor.

A ferry crossing is represented by two consecutive `ferry-terminal` anchors. The Traveler draws that pair as a ferry leg, while the road-route generator ends the road segment at the first terminal and resumes at the second.

## Privacy

TripSpec can include the selected lodging name and useful amenities. It must not include reservation numbers, confirmation links, contact details, payment records, or precise device-location history.

## Versioning

V1 files use `"schemaVersion": "1.0"`. Minor additions must remain backward-compatible. Breaking field changes require a new major schema and a migration tool.

The normative schema is [`schemas/trip-spec.v1.schema.json`](../schemas/trip-spec.v1.schema.json). A fictional complete example is available at [`examples/lakes-and-pines.trip.json`](../examples/lakes-and-pines.trip.json).
