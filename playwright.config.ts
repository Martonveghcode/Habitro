import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests", testMatch: "presentations.browser.spec.ts", outputDir: "work/browser-results",
  workers: 1, reporter: "list", timeout: 30000,
  use: { baseURL: process.env.PRESENTATIONS_TEST_URL || "http://127.0.0.1:4174", channel: "chrome", viewport: { width: 1440, height: 1100 }, screenshot: "only-on-failure", trace: "retain-on-failure" },
  webServer: process.env.PRESENTATIONS_TEST_URL ? undefined : { command: "node node_modules/vite/bin/vite.js --host 127.0.0.1 --port 4174", url: "http://127.0.0.1:4174", reuseExistingServer: true },
});
