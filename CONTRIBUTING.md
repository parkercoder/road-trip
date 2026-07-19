# Contributing

Thanks for helping improve Road Trip.

## Before You Start

1. Check existing issues before opening a new one.
2. Keep changes focused and mobile-first.
3. Do not include personal trip records, booking confirmations, API keys, or live location history.
4. Preserve attribution for map and routing data.

## Local Development

```bash
python3 -m http.server 8766
```

Open `http://localhost:8766` and test at phone widths down to 320 px.

## Pull Requests

- Explain the user-facing problem and the chosen solution.
- Include before/after screenshots for visual changes.
- Verify map drag, pinch zoom, marker popups, drawer gestures, and the full-route control.
- Test both light and dark system themes.
- Keep optional attractions out of route anchors.
- Update documentation when behavior or configuration changes.

## Commit Style

Use short, imperative commit messages, for example:

```text
Improve tile fallback recovery
Move trip data into JSON
Fix drawer gesture on iOS
```
