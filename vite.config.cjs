const { resolve } = require("node:path");

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
// esbuild still happily transpiles either import/export or require/
// module.exports syntax here, so this file's own syntax choice below is
// about Biome, not Vite (see next paragraph). See the root CLAUDE.md's
// "Vite config: .cjs and the CJS deprecation warning" section before
// touching this file's extension or its config-loading mechanism.
//
// Genuine require()/module.exports here, not import/export -- Biome
// infers a file's module type from its extension, so `.cjs` gets parsed
// as strict CommonJS regardless of content; ESM syntax in this file used
// to be a permanent, unfixable Biome parse error (esbuild tolerated it
// for Vite's sake, Biome didn't). Being honest CJS keeps this file
// actually lintable instead of permanently excluded.
//
// No `import { defineConfig } from "vite"` (nor `require("vite")`) here,
// deliberately: `defineConfig` is only a no-op identity wrapper for type
// inference, but requiring anything from "vite" at all trips Vite's own
// `index.cjs` module-level `warnCjsUsage()` side effect ("The CJS build
// of Vite's Node API is deprecated..."), every time this config loads.
// Skipping that import and typing the config via the JSDoc annotation
// below instead gets the same editor/type support without ever
// requiring "vite" itself, so the warning has nothing to fire from.
/** @type {import('vite').UserConfig} */
module.exports = {
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
};
