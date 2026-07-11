import { readdirSync } from "node:fs";
import { resolve } from "node:path";
import { defineConfig } from "vite";

const demoDir = __dirname;

// Every demo/*.html file becomes its own rollup input for `vite build`, so
// the built demo is a real multi-page site rather than just index.html.
// Discovered at config-load time rather than listed by hand, so adding a
// new demo page never means updating this file too.
function htmlEntries(): Record<string, string> {
  const entries: Record<string, string> = {};
  for (const file of readdirSync(demoDir)) {
    if (file.endsWith(".html")) {
      entries[file.replace(/\.html$/, "")] = resolve(demoDir, file);
    }
  }
  return entries;
}

export default defineConfig({
  root: demoDir,
  server: {
    fs: {
      // Demo pages import from ../src and link ../src/ui/*.css directly
      // (see demo.css) rather than the built dist/, so the dev server
      // needs to serve outside its own root.
      allow: [resolve(demoDir, "..")],
    },
  },
  build: {
    outDir: resolve(demoDir, "../dist-demo"),
    rollupOptions: {
      input: htmlEntries(),
    },
  },
});
