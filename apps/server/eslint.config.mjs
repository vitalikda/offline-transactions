import antfu from "@antfu/eslint-config";

export default antfu(
  {
    type: "app",
    typescript: true,
    formatters: false,
    stylistic: false,
    ignores: ["dist", "**/migrations/*"],
  },
  {
    rules: {
      "no-console": ["warn"],
      "antfu/no-top-level-await": ["off"],
      "node/prefer-global/process": ["off"],
      "node/prefer-global/buffer": ["error", "always"],
      "node/no-process-env": ["error"],
      "perfectionist/sort-imports": ["off"],
      "perfectionist/sort-named-imports": ["off"],
    },
  }
);
