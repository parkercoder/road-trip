import test from "node:test";
import assert from "node:assert/strict";

import { buildPlannerInput, endpointFor, modelOptionsFor, normalizeAITripSpec, requestAIPlan, extractJson } from "../src/ai-planner.mjs";

test("extracts a JSON planning response from a fenced model message", () => {
  assert.deepEqual(extractJson("```json\n{\"status\":\"needs_input\",\"questions\":[]}\n```"), {
    status: "needs_input",
    questions: []
  });
});

test("includes brief and follow-up answers in planner input", () => {
  const input = buildPlannerInput({
    brief: "Toronto to Banff",
    answers: { vehicle: "Model Y" },
    today: "2026-07-19"
  });
  assert.match(input, /Toronto to Banff/);
  assert.match(input, /vehicle: Model Y/);
});

test("requests an OpenAI Responses plan without storing the response", async () => {
  let request;
  const result = await requestAIPlan({
    provider: "openai",
    model: "user-selected-model",
    token: "temporary-secret",
    brief: "A short trip",
    today: "2026-07-19",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        async json() {
          return {
            output: [{ content: [{ type: "output_text", text: JSON.stringify({
              status: "ready",
              tripPlan: { schemaVersion: "1.0" },
              assumptions: [],
              warnings: []
            }) }] }]
          };
        }
      };
    }
  });
  assert.equal(result.status, "ready");
  assert.deepEqual(result.tripPlan, { schemaVersion: "1.0" });
  assert.equal(request.url, "https://api.openai.com/v1/responses");
  assert.equal(request.options.headers.authorization, "Bearer temporary-secret");
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, "user-selected-model");
  assert.equal(body.store, false);
  assert.doesNotMatch(request.options.body, /temporary-secret/);
});

test("provides current common model presets with matching provider endpoints", () => {
  assert.equal(modelOptionsFor("openai")[0][0], "gpt-5.6-terra");
  assert.equal(modelOptionsFor("anthropic")[0][0], "claude-sonnet-4-6");
  assert.equal(modelOptionsFor("gemini")[0][0], "gemini-3.5-flash");
  assert.equal(modelOptionsFor("deepseek")[0][0], "deepseek-v4-flash");
  assert.equal(modelOptionsFor("xai")[0][0], "grok-4.5");
  assert.equal(modelOptionsFor("mistral")[0][0], "mistral-large-latest");
  assert.equal(modelOptionsFor("openrouter")[0][0], "openrouter/auto");
  assert.equal(endpointFor("gemini"), "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions");
});

test("uses chat completions for a named compatible provider", async () => {
  let request;
  const result = await requestAIPlan({
    provider: "anthropic",
    model: "claude-sonnet-4-6",
    token: "temporary-secret",
    brief: "Plan it",
    fetchImpl: async (url, options) => {
      request = { url, options };
      return {
        ok: true,
        status: 200,
        async json() {
          return { choices: [{ message: { content: JSON.stringify({
            status: "ready",
            tripPlan: { schemaVersion: "1.0" },
            assumptions: [],
            warnings: []
          }) } }] };
        }
      };
    }
  });
  assert.equal(result.status, "ready");
  assert.deepEqual(result.tripPlan, { schemaVersion: "1.0" });
  assert.equal(request.url, "https://api.anthropic.com/v1/chat/completions");
  assert.equal(JSON.parse(request.options.body).model, "claude-sonnet-4-6");
});

test("caps follow-up questions at three", async () => {
  const result = await requestAIPlan({
    provider: "compatible",
    endpoint: "https://models.example.com/v1/chat/completions",
    model: "chosen-model",
    token: "temporary-secret",
    brief: "Plan it",
    fetchImpl: async () => ({
      ok: true,
      status: 200,
      async json() {
        return { choices: [{ message: { content: JSON.stringify({
          status: "needs_input",
          questions: [1, 2, 3, 4].map(number => ({ id: `q-${number}`, question: `Q${number}` }))
        }) } }] };
      }
    })
  });
  assert.equal(result.questions.length, 3);
});

test("normalizes common model place and stay aliases before validation", () => {
  const normalized = normalizeAITripSpec({
    vehicle: { mode: "plane", fuelType: "jet", chargingConnectors: "NACS" },
    travelers: { children: [9, "12"], accessibilityNeeds: "step-free" },
    preferences: {
      route: { avoidCountries: "us" },
      lodging: { preferredTypes: "hotel", requiredAmenities: null, preferredAmenities: "parking" },
      activities: { interests: "hiking" }
    },
    places: [
      { id: "toronto-pearson-airport", kind: "airport-terminal", location: { coordinates: { lat: 43.6777, lng: -79.6248 } }, address: "YYZ" },
      { id: "whitehorse-lodging-tbd", kind: "lodging", location: {} },
      { id: "charge-stop", kind: "charger", location: {} }
    ],
    days: [{ notes: "First note\nSecond note", route: {}, stay: { type: "accommodation", amenities: "breakfast" } }]
  });
  assert.equal(normalized.vehicle.mode, "airplane");
  assert.equal(normalized.vehicle.fuelType, "aviation");
  assert.equal(normalized.places[0].kind, "airport");
  assert.equal(normalized.places[0].location.address, "YYZ");
  assert.equal(normalized.places[0].location.coordinateStatus, "unverified");
  assert.equal(normalized.places[1].kind, "overnight");
  assert.equal(normalized.places[2].kind, "charging");
  assert.equal(normalized.days[0].stay.type, "hotel");
  assert.deepEqual(normalized.days[0].notes, ["First note", "Second note"]);
  assert.deepEqual(normalized.days[0].route.optionalStopPlaceIds, []);
  assert.deepEqual(normalized.days[0].stay.amenities, ["breakfast"]);
  assert.deepEqual(normalized.travelers.children, [{ age: 9 }, { age: 12 }]);
  assert.deepEqual(normalized.preferences.route.avoidCountries, ["US"]);
});
