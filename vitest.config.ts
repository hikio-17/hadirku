import path from "node:path";
import tsconfigPaths from "vite-tsconfig-paths";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    // "server-only" asli melempar error di luar React Server Components;
    // di unit test semua import bersifat server-side.
    alias: {
      "server-only": path.resolve(__dirname, "src/test/shims/server-only.ts"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
