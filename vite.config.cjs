import { resolve } from "node:path";
import { defineConfig } from "vite";

// Library mode with 4 independent entry points — consumers import
// "bruit-kit/ui", "/audio", "/midi", or "/sources" separately rather than
// one monolithic bundle, since a project might only want one or two parts.
//
// .cjs, not .ts or .mjs: Vite always bundles a config file through esbuild
// before loading it, but *how* it loads the bundled result depends on the
// file's extension (see loadConfigFromBundledFile in Vite's source) --
// .mjs (and .ts, since its resolved isESM check follows the same rule)
// gets written to a real temp file on disk and then dynamically
// import()-ed, while .cjs is always treated as CommonJS regardless of this
// package's own "type": "module" and gets loaded by patching Node's
// require cache in memory, no disk write involved. Only the former races
// against this machine's virtualized bind mount (surfaced as
// "ERR_MODULE_NOT_FOUND ... vite.config.*.timestamp-*.mjs" failures) --
// esbuild still happily transpiles this file's import/export syntax
// either way, so nothing else about the config needs to change.
export default defineConfig({
  build: {
    lib: {
      entry: {
        ui: resolve(__dirname, "src/ui/index.ts"),
        audio: resolve(__dirname, "src/audio/index.ts"),
        midi: resolve(__dirname, "src/midi/index.ts"),
        sources: resolve(__dirname, "src/sources/index.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      // Left for the consumer's own node_modules to supply, rather than
      // bundled into this package's output twice.
      external: ["@tonejs/midi"],
      output: {
        // Nest as dist/<part>/index.js, matching tsc's --emitDeclarationOnly
        // output (which mirrors src/'s directory structure), so each part's
        // package.json "exports" entry can point at one consistent path for
        // both "types" and "import".
        entryFileNames: "[name]/index.js",
      },
    },
    outDir: "dist",
    emptyOutDir: true,
  },
});
