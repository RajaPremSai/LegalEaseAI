module.exports = {
  projects: [
    {
      displayName: 'frontend',
      testMatch: ['<rootDir>/apps/frontend/**/*.test.{js,ts,tsx}'],
      testEnvironment: 'jsdom',
      setupFilesAfterEnv: ['<rootDir>/apps/frontend/jest.setup.js'],
      moduleNameMapping: {
        '^@legal-ai/shared$': '<rootDir>/packages/shared/src',
      },
    },
    {
      displayName: 'backend',
      testMatch: ['<rootDir>/apps/backend/**/*.test.{js,ts}'],
      testEnvironment: 'node',
      moduleNameMapping: {
        '^@legal-ai/shared$': '<rootDir>/packages/shared/src',
      },
    },
    {
      displayName: 'shared',
      testMatch: ['<rootDir>/packages/shared/**/*.test.{js,ts}'],
      testEnvironment: 'node',
    },
  ],
  collectCoverageFrom: [
    'apps/**/*.{js,ts,tsx}',
    'packages/**/*.{js,ts}',
    '!**/*.d.ts',
    '!**/node_modules/**',
    '!**/dist/**',
    '!**/.next/**',
  ],
};