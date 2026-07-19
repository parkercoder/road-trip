import test from "node:test";
import assert from "node:assert/strict";

import { addressCandidates, geocodeAddress } from "../src/geocoding-provider.mjs";

test("geocodes an address through the provider adapter", async () => {
  let requestedUrl;
  const result = await geocodeAddress("100 Queen St W, Toronto, ON", {
    minIntervalMs: 0,
    fetchImpl: async url => {
      requestedUrl = new URL(url);
      return {
        ok: true,
        status: 200,
        async json() {
          return [{ lat: "43.65348", lon: "-79.38409", display_name: "Toronto City Hall" }];
        }
      };
    }
  });
  assert.equal(requestedUrl.searchParams.get("q"), "100 Queen St W, Toronto, ON");
  assert.equal(requestedUrl.searchParams.get("limit"), "1");
  assert.deepEqual(result, { lat: 43.65348, lng: -79.38409, displayName: "Toronto City Hall" });
});

test("reports an address with no provider match", async () => {
  await assert.rejects(
    geocodeAddress("not-a-place", {
      minIntervalMs: 0,
      fetchImpl: async () => ({ ok: true, status: 200, async json() { return []; } })
    }),
    /没有找到匹配地点/
  );
});

test("retries a Canadian address without a malformed postal code", async () => {
  const requested = [];
  const result = await geocodeAddress("4220 4th Ave, Whitehorse, YT, Y1A1K1 Canada", {
    minIntervalMs: 0,
    fetchImpl: async url => {
      requested.push(new URL(url).searchParams.get("q"));
      return {
        ok: true,
        status: 200,
        async json() {
          return requested.length === 1 ? [] : [{ lat: "60.721", lon: "-135.057" }];
        }
      };
    }
  });
  assert.deepEqual(addressCandidates("4220 4th Ave, Whitehorse, YT, Y1A1K1 Canada"), [
    "4220 4th Ave, Whitehorse, YT, Y1A1K1 Canada",
    "4220 4th Ave, Whitehorse, YT, Canada"
  ]);
  assert.equal(requested[1], "4220 4th Ave, Whitehorse, YT, Canada");
  assert.deepEqual(result, { lat: 60.721, lng: -135.057, displayName: "4220 4th Ave, Whitehorse, YT, Canada" });
});
