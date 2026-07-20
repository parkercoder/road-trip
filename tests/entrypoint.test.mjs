import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";

const entrypoint = await readFile("index.html", "utf8");
const redirectScript = entrypoint.match(/<script>([\s\S]*?)<\/script>/)?.[1];

function redirectFor(search = "", hash = "") {
  let destination;
  vm.runInNewContext(redirectScript, {
    URLSearchParams,
    window: {
      location: {
        search,
        hash,
        replace(value) {
          destination = value;
        }
      }
    }
  });
  return destination;
}

test("the default entrypoint opens Trip Builder", () => {
  assert.ok(redirectScript, "index.html must contain redirect logic");
  assert.equal(redirectFor(), "studio.html");
});

test("legacy Traveler query links remain compatible", () => {
  assert.equal(
    redirectFor("?trip=examples%2Flakes-and-pines.trip.json"),
    "traveler.html?trip=examples%2Flakes-and-pines.trip.json"
  );
  assert.equal(redirectFor("?draft=1", "#map"), "traveler.html?draft=1#map");
});
