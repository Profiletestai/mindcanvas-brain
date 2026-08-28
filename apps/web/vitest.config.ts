import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    environment: "node",
    include: ["{app,lib}/**/*.test.ts"],
    // server-only throws when imported outside an RSC bundle; the modules under
    // test all carry it.
    alias: {
      "server-only": new URL("./test/stubs/server-only.ts", import.meta.url)
        .pathname,
    },
  },
});
