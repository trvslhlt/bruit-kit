import { resolve } from "node:path";
import { defineConfig } from "vite";

// Library mode with 4 independent entry points — consumers import
// "bruit-kit/ui", "/audio", "/midi", or "/sources" separately rather than
// one monolithic bundle, since a project might only want one or two parts.
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
