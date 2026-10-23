// MapLibre runs map work in a Web Worker loaded from its own folder. Next.js bundles MapLibre elsewhere,
// so we copy the worker (and the code it shares with the main library) into public/ and point MapLibre at it.
import { copyFileSync, mkdirSync } from "node:fs";

mkdirSync("public/maplibre", { recursive: true });
for (const file of ["maplibre-gl-worker.mjs", "maplibre-gl-shared.mjs"]) {
  copyFileSync(`node_modules/maplibre-gl/dist/${file}`, `public/maplibre/${file}`);
}
console.log("Copied MapLibre worker to public/maplibre");
