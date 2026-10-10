export default {
  preset: 'ts-jest/presets/default-esm',
  testEnvironment: 'node',
  // Jest runs the crypto tests only. The API and the client use vitest.
  roots: ['<rootDir>/packages/crypto/src'],
  extensionsToTreatAsEsm: ['.ts'],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        useESM: true,
        tsconfig: {
          module: 'ES2022',
          target: 'ES2022',
          esModuleInterop: true,
          moduleResolution: 'bundler',
        },
      },
    ],
  },
}
