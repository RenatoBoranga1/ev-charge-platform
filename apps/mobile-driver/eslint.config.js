const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');

const strictExpoConfig = expoConfig.map((config) => {
  if (config.plugins?.['@typescript-eslint']) {
    return {
      ...config,
      rules: { ...config.rules, '@typescript-eslint/no-explicit-any': 'error' },
    };
  }
  if (config.plugins?.['react-hooks']) {
    return {
      ...config,
      rules: { ...config.rules, 'react-hooks/exhaustive-deps': 'error' },
    };
  }
  return config;
});

module.exports = defineConfig([
  strictExpoConfig,
  {
    ignores: ['dist/**', '.expo/**', 'coverage/**'],
  },
]);
