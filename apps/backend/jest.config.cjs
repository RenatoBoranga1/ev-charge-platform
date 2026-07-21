module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  rootDir: '.',
  testEnvironment: 'node',
  testMatch: ['<rootDir>/test/**/*.spec.ts'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleNameMapper: {
    '^@solis/database$': '<rootDir>/../../packages/database/src/index.ts',
  },
  collectCoverageFrom: [
    'src/charging/domain/*.ts',
    'src/charging/charging-realtime.gateway.ts',
    'src/auth/jwt-auth.guard.ts',
    'src/common/correlation-id.middleware.ts',
  ],
  coverageDirectory: 'coverage',
  coverageThreshold: {
    global: {
      statements: 80,
      branches: 70,
      functions: 75,
      lines: 80,
    },
  },
};
