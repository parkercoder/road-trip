export function deriveRouteSegments(spec) {
  const placeById = new Map(spec.places.map(place => [place.id, place]));
  const segments = [];
  let current = null;
  let segmentNumber = 0;

  const coordinatesFor = placeId => {
    const coordinates = placeById.get(placeId)?.location?.coordinates;
    if (!coordinates) throw new Error(`Missing coordinates for ${placeId}`);
    return [coordinates.lat, coordinates.lng];
  };

  const flush = () => {
    if (current?.coords.length > 1) {
      current.id = `route-${String(++segmentNumber).padStart(2, "0")}`;
      segments.push(current);
    }
    current = null;
  };

  for (const day of spec.days) {
    const origin = coordinatesFor(day.originPlaceId);
    const destination = coordinatesFor(day.destinationPlaceId);
    const color = destination[1] < origin[1] ? "#1769d1" : "#d46a1f";
    const anchors = day.route.anchorPlaceIds;

    for (let index = 0; index < anchors.length - 1; index += 1) {
      const from = placeById.get(anchors[index]);
      const to = placeById.get(anchors[index + 1]);
      const fromPos = coordinatesFor(from.id);
      const toPos = coordinatesFor(to.id);

      if (from.kind === "ferry-terminal" && to.kind === "ferry-terminal") {
        flush();
        continue;
      }

      const continues = current
        && current.color === color
        && current.coords.at(-1)[0] === fromPos[0]
        && current.coords.at(-1)[1] === fromPos[1];

      if (!continues) {
        flush();
        current = { color, coords: [fromPos, toPos] };
      } else {
        current.coords.push(toPos);
      }
    }
  }

  flush();
  return segments;
}
