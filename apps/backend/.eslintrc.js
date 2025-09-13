module.exports = {
  extends: ['../../.eslintrc.js'],
  env: {
    node: true,
    es6: true,
  },
  rules: {
    '@typescript-eslint/no-unused-vars': 'error',
    'no-console': 'warn',
  },
};