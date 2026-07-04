import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import react from "eslint-plugin-react";
import reactNative from "eslint-plugin-react-native";

export default [
  js.configs.recommended,

  ...tseslint.configs.recommended,

  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
      },
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
    },

    plugins: {
      react,
      "react-native": reactNative,
    },

    settings: {
      react: {
        version: "detect",
      },
    },

    rules: {
  "react/react-in-jsx-scope": "off",

  // temporarily relaxed for stabilization phase
  "@typescript-eslint/no-explicit-any": "warn",
  "@typescript-eslint/no-unused-expressions": "warn",

  "react-native/no-inline-styles": "warn",
}
  },
];