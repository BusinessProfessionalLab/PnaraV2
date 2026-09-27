import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import nextTypescript from "eslint-config-next/typescript";

/**
 * Next 16 ships flat ESLint configs directly, so they are spread instead of
 * going through FlatCompat (which cannot serialize them any more).
 */
const eslintConfig = [
  ...nextCoreWebVitals,
  ...nextTypescript,
  {
    ignores: [".next/**", "node_modules/**", "menu-import/**"],
  },
];

export default eslintConfig;
