import { defineConfig } from "vitest/config";

export default defineConfig({
  // Resolve the `@/*` alias from tsconfig.json, so tests can import app code.
  resolve: { tsconfigPaths: true },
});
