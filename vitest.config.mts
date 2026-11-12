import { defineConfig } from "vitest/config";
import path from "node:path";

// Tests van de rekenkern (maten, stuklijst, stroom, vormen) en van de regels rond adressen en deellinks.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  esbuild: { jsx: "automatic" },
  test: { include: ["tests/**/*.test.{js,ts}"], environment: "node", css: false },
});
