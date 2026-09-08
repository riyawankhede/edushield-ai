/** @type {import('jest').Config} */
const config = {
  testEnvironment: "node",
  // ts-jest handles .ts/.tsx; jose is ESM-only so it must also be transformed
  transform: {
    "^.+\\.tsx?$": ["ts-jest", { tsconfig: { moduleResolution: "node" } }],
    "^.+\\.js$": ["ts-jest", { tsconfig: { moduleResolution: "node" } }],
  },
  // By default Jest ignores node_modules — override for jose (ESM-only package)
  transformIgnorePatterns: [
    "/node_modules/(?!jose/)",
  ],
  moduleNameMapper: {
    // Resolve Next.js @ path alias to src/
    "^@/(.*)$": "<rootDir>/src/$1",
    // Map jose to its CJS-friendly webapi build explicitly
    "^jose$": "<rootDir>/node_modules/jose/dist/webapi/index.js",
  },
  testMatch: ["**/__tests__/**/*.test.ts"],
  clearMocks: true,
  extensionsToTreatAsEsm: [],
};

module.exports = config;
