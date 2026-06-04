import type { Config } from "jest";

/**
 * Jest config for the e2e suite. Replaces the JSON config so we can wire
 * globalSetup + setupFiles + ts-jest in a single typed file.
 */
const config: Config = {
  rootDir: ".",
  testEnvironment: "node",
  testRegex: "\\.e2e-spec\\.ts$",
  moduleFileExtensions: ["js", "json", "ts"],
  transform: { "^.+\\.(t|j)s$": "ts-jest" },
  globalSetup: "<rootDir>/setup/global-setup.ts",
  setupFiles: ["<rootDir>/setup/setup-env.ts"],
  // Each spec gets its own Nest app + its own truncate cycle; we run them
  // serially so we never have two writers fighting over the test DB.
  maxWorkers: 1,
  testTimeout: 30_000,
};

export default config;
