const shared = require('../../../jest.config.shared');

/**
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  ...shared,
  collectCoverageFrom: [
    'src/**/*.{js,jsx,ts,tsx}',
    '!src/config/*',
    '!src/**/*.d.ts',
    '!src/index.tsx',
  ],
  coverageThreshold: {
    global: {
      statements: 93,
      branches: 85,
      functions: 85,
      lines: 93,
    },
  },
  resetMocks: true,
  setupFiles: ['react-app-polyfill/jsdom'],
  setupFilesAfterEnv: ['<rootDir>/src/setupTests.ts'],
  testEnvironment: 'jsdom',
  transform: {
    '^.+\\.css$': '<rootDir>/config/jest/cssTransform.js',
  },
  transformIgnorePatterns: [
    '[/\\\\]node_modules[/\\\\].+\\.(js|jsx|mjs|cjs|ts|tsx)$',
  ],
};
