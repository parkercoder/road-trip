import { readFile } from "node:fs/promises";
import { validateTripSpec } from "../src/trip-spec.mjs";

const files = process.argv.slice(2);
if (!files.length) {
  throw new Error("Usage: node scripts/check-trip-spec.mjs <trip.json> [...trip.json]");
}

let invalid = false;
for (const file of files) {
  const spec = JSON.parse(await readFile(file, "utf8"));
  const errors = validateTripSpec(spec);
  if (errors.length) {
    console.error(`TripPlan validation failed for ${file}:\n- ${errors.join("\n- ")}`);
    invalid = true;
  } else {
    console.log(`TripPlan validation passed: ${file}`);
  }
}

if (invalid) process.exitCode = 1;
