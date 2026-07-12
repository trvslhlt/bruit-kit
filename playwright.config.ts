import { defineConfig } from "@playwright/test";

// Alpine (the Docker image's base) can't run Playwright's own downloaded
// Chromium build (musl vs. the glibc it's built against) -- the Dockerfile
// installs Alpine's own `chromium` package instead and points this at it
// via PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH. Unset on a normal host (how
// this suite was developed), Playwright falls back to its own
// `npx playwright install chromium` build with no branching needed here.
const chromiumExecutablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  reporter: "list",
  use: {
    baseURL: "http://localhost:5173",
    launchOptions: {
      executablePath: chromiumExecutablePath,
      // Headless Chromium's default /dev/shm is too small in a
      // container; shm_size could be bumped instead, but this is simpler.
      args: ["--disable-dev-shm-usage"],
    },
  },
  // Starts `npm run demo` before the suite and tears it down after --
  // replaces the "background it, sleep, curl to check it's up" dance
  // done by hand earlier this session.
  webServer: {
    command: "npm run demo",
    port: 5173,
    reuseExistingServer: !process.env.CI,
    timeout: 30_000,
  },
});
