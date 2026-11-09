// Copies MapLibre's web worker into /public so the browser can load it.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public", { recursive: true });
copyFileSync("node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs", "public/maplibre-gl-worker.mjs");
console.log("Copied maplibre-gl-worker.mjs to public/");
