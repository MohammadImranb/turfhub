module.exports = {
  testEnvironment: "node",
  // mongodb-memory-server downloads a real mongod binary the first time it runs and
  // then starts it, which comfortably exceeds Jest's 5s default. The concurrency tests
  // also fire many requests at once, so they need room.
  testTimeout: 120000,
  // Run test files one at a time. They share a single in-memory MongoDB, so running
  // files in parallel would let one file's clearDb() wipe another file's fixtures.
  maxWorkers: 1,
  testMatch: ["**/tests/**/*.test.js"],
  // setup.js is a helper, not a suite
  testPathIgnorePatterns: ["/node_modules/", "/tests/setup.js"],
  verbose: true
};
