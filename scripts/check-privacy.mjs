import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const textExtensions = new Set([".css", ".html", ".js", ".json", ".md", ".mjs", ".txt", ""]);
const ignoredDirectories = new Set([".git", "node_modules"]);
const checks = [
  ["personal email", /\b[A-Z0-9._%+-]+@(?!example\.com\b)[A-Z0-9.-]+\.[A-Z]{2,}\b/i],
  ["booking identifier", /\b(?:reservation|confirmation|booking reference|order id|invoice|itinerary)\s*(?:number|no\.?|#|id|reference)?\s*[:#-]?\s*(?=[A-Z0-9-]*\d)[A-Z0-9-]{6,}\b/i],
  ["secret-like value", /\b(?:api[_ -]?key|access[_ -]?token|client[_ -]?secret)\s*[:=]\s*["']?[A-Z0-9_\-]{12,}/i]
];

async function filesIn(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (ignoredDirectories.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await filesIn(path));
    else if (textExtensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const findings = [];
for (const file of await filesIn(root)) {
  const text = await readFile(file, "utf8");
  for (const [label, pattern] of checks) {
    if (pattern.test(text)) findings.push(`${relative(root, file)}: ${label}`);
  }
}

if (findings.length) {
  console.error("Potential private data found:\n" + findings.join("\n"));
  process.exitCode = 1;
} else {
  console.log("Privacy scan passed.");
}
