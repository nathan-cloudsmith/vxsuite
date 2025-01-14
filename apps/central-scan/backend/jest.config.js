const shared = require('../../../jest.config.shared');

/**
 * @type {import('@jest/types').Config.InitialOptions}
 */
module.exports = {
  ...shared,
  restoreMocks: true,
  // This is here because jest finds `build/__mocks__`,
  // which we should probably make not be there by using smarter
  // tsconfig.json values.
  roots: ['<rootDir>/src'],
  coverageProvider: 'v8',
  collectCoverageFrom: [
    '**/*.{ts,tsx}',
    '!**/node_modules/**',
    '!**/*.d.ts',
    '!src/index.ts',
    '!src/types.ts',
    '!test/**/*',
  ],
  coverageThreshold: {
    global: {
      statements: 87,
      branches: 72,
      functions: 88,
      lines: 87,
    },
  },
};
