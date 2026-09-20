// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ['dist/*'],
  },
  {
    // Reanimated shared values are mutable by design (`sv.value = ...` is the
    // documented API). The React Compiler immutability rule cannot know that,
    // so it flags every animation we write; turn it off rather than sprinkle
    // per-line disables through every animated component.
    rules: {
      'react-hooks/immutability': 'off',
    },
  },
]);
