module.exports = {
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts"],
  setupFiles: ["<rootDir>/test/jest-setup.cjs"],
  transform: {
    "^.+\\.tsx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript" },
          target: "es2022",
        },
        module: { type: "commonjs" },
      },
    ],
  },
  moduleNameMapper: {
    "^(\\.{1,2}/.*)\\.js$": "$1",
  },
  clearMocks: true,
  testTimeout: 10000,
  collectCoverageFrom: [
    "src/auth/**/*.ts",
    "src/chat/**/*.ts",
    "src/middleware/**/*.ts",
    "src/web-socket/**/*.ts",
    "src/utils/**/*.ts",
    "!**/tests/**",
  ],
};
