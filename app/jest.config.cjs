module.exports = {
  testEnvironment: "jsdom",
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.[jt]s?(x)"],
  setupFilesAfterEnv: ["<rootDir>/test/setup.ts"],
  transform: {
    "^.+\\.[jt]sx?$": [
      "@swc/jest",
      {
        jsc: {
          parser: { syntax: "typescript", tsx: true },
          transform: { react: { runtime: "automatic" } },
          target: "es2022",
        },
        module: { type: "commonjs" },
      },
    ],
  },
  moduleNameMapper: {
    "\\.(css|scss|sass)$": "<rootDir>/test/style-mock.cjs",
    "^react-router$": "<rootDir>/test/react-router.cjs",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  clearMocks: true,
  transformIgnorePatterns: [
    "/node_modules/(?!(react-router|@remix-run/route-pattern|cookie|set-cookie-parser)/)",
  ],
};
