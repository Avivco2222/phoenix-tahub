import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
  {
    // Pragmatic relaxations for this codebase:
    // - no-unescaped-entities: noisy for Hebrew copy where straight quotes
    //   are legitimate; entity-encoding hurts readability.
    // - set-state-in-effect: brand-new strict rule in React 19; many
    //   legitimate hydration/sync patterns trip it. Keep visible as a warning.
    rules: {
      "react/no-unescaped-entities": "off",
      "react-hooks/set-state-in-effect": "warn",
    },
  },
]);

export default eslintConfig;
