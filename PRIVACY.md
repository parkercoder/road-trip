# Privacy Guidelines

Road-trip itineraries can expose sensitive information even when the application contains no accounts or server-side storage.

Do not commit or publish:

- Reservation, booking, order, invoice, or itinerary numbers
- Confirmation letters, screenshots, PDFs, or guest-portal links
- Names, personal email addresses, phone numbers, or payment details
- Exact live or historical device-location logs
- Private API keys or access tokens
- Future home-away dates tied to an identifiable person

Public examples should use completed trips, fictional data, or coarse locations. Review every file, including images and generated exports, before publishing.

Studio autosaves the current draft to the browser's local storage. It does not upload that draft to a project-owned server. Anyone with access to the same browser profile may be able to open it, so use JSON export for deliberate backups and clear or replace the draft on shared devices.

The optional AI planner uses a user-supplied model endpoint, model ID, and API token. The token remains in the page's password input and is never added to local storage or TripPlan. The travel brief and follow-up answers are sent directly to the selected model provider, whose retention and privacy policies apply. Do not include booking confirmations, payment data, API keys, or unnecessary personal identifiers in the travel brief.

When Studio generates an actual route, it sends the ordered route-anchor coordinates (but not the AI token or private booking fields) to the configured routing provider. That provider's logging, retention, and acceptable-use policies apply. Self-host or replace the provider adapter when public routing requests are unsuitable.

Device geolocation is requested only after the user presses the location control. The current static application does not transmit that position to a project-owned server, but map providers and external navigation links have their own privacy policies.
