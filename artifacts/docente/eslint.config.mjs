import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  // Unused inherited Vite scaffold components are outside the Next app surface.
  globalIgnores([".next/**", "src/components/ui/**", "src/pages/**", "src/hooks/**", "src/components/error-boundary.tsx"]),
]);