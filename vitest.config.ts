import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts"],
    coverage: {
      reporter: ["text", "html"],
      include: ["src/sim/i8051/assembler.ts", "src/sim/jetson.ts", "src/lib/wiring.ts", "functions/src/grader/gradeCode.ts"],
    },
  },
});
