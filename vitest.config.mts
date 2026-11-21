import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";

// "server-only" throws outside the Next.js server bundle; tests import server modules directly.
const serverOnlyStub = fileURLToPath(new URL("./tests/stubs/server-only.ts", import.meta.url));

export default defineConfig({
  plugins: [tsconfigPaths(), react()],
  resolve: {
    alias: { "server-only": serverOnlyStub },
  },
  test: {
    globals: true,
    coverage: {
      provider: "v8",
      include: ["lib/**", "app/**", "components/**"],
      exclude: ["lib/generated/**"],
    },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          environment: "jsdom",
          setupFiles: ["./tests/setup.ts"],
          include: ["tests/unit/**/*.test.{ts,tsx}"],
        },
      },
      {
        extends: true,
        test: {
          name: "integration",
          environment: "node",
          include: ["tests/integration/**/*.test.ts"],
          // Tests share one database, so run files one at a time.
          fileParallelism: false,
          setupFiles: ["./tests/integration/setup.ts"],
        },
      },
    ],
  },
});
