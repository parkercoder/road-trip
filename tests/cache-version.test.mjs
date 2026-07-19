import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

function moduleVersion(html, entryName) {
  const match = html.match(new RegExp(`${entryName}\\?v=([^"']+)`));
  assert.ok(match, `${entryName} must have a cache version`);
  return match[1];
}

function assertVersionedImports(source, version, filename) {
  const imports = [...source.matchAll(/from\s+["'](\.\/[^"']+\.mjs(?:\?[^"']*)?)["']/g)].map(match => match[1]);
  assert.ok(imports.length, `${filename} should contain module imports`);
  for (const specifier of imports) {
    assert.equal(specifier.endsWith(`?v=${version}`), true, `${filename}: unversioned module import ${specifier}`);
  }
}

test("browser module graphs use one cache version", async () => {
  const [studioHtml, travelerHtml, studioApp, travelerApp, studioCore, plannerRules] = await Promise.all([
    readFile("studio.html", "utf8"),
    readFile("index.html", "utf8"),
    readFile("src/studio-app.mjs", "utf8"),
    readFile("src/traveler-app.mjs", "utf8"),
    readFile("src/studio-core.mjs", "utf8"),
    readFile("src/planner-rules.mjs", "utf8")
  ]);
  const studioVersion = moduleVersion(studioHtml, "studio-app.mjs");
  const travelerVersion = moduleVersion(travelerHtml, "traveler-app.mjs");
  assert.equal(travelerVersion, studioVersion);
  for (const [source, filename] of [
    [studioApp, "src/studio-app.mjs"],
    [travelerApp, "src/traveler-app.mjs"],
    [studioCore, "src/studio-core.mjs"],
    [plannerRules, "src/planner-rules.mjs"]
  ]) {
    assertVersionedImports(source, studioVersion, filename);
  }
});
