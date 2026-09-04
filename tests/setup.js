// Test database wiring.
//
// Tests run against a REAL MongoDB, not an in-process fake. That matters here: the
// whole booking design rests on a unique compound index, and only a real mongod
// enforces that. A mocked driver would happily let the concurrency test pass while
// production double-booked.
//
// Where that MongoDB comes from - the same default works in both places:
//   local  -> mongod already installed on 127.0.0.1:27017
//   CI     -> a mongo service container, also published on 127.0.0.1:27017
//   either -> override with MONGO_TEST_URL (e.g. 27018 for the docker-compose mongo)
//
// It always uses a SEPARATE database (turfhub_test) so running tests can never
// touch development or production data.
//
// (mongodb-memory-server was tried first and removed: its postinstall downloads a
// ~506MB mongod binary on every install, which is slow locally and would run on the
// deployment host too. A service container in CI is one line and costs nothing.)

const mongoose = require("mongoose");

const TEST_URI =
  process.env.MONGO_TEST_URL || "mongodb://127.0.0.1:27017/turfhub_test";

module.exports.startDb = async () => {
  // app.js reads these at require time, so they must be set before it is imported
  process.env.ATLASDB_URL = TEST_URI;
  process.env.SECRET = "test-secret-not-used-anywhere-real";
  process.env.NODE_ENV = "test";

  await mongoose.connect(TEST_URI, { serverSelectionTimeoutMS: 10000 });

  // guard against ever pointing this at a real database by accident
  if (!mongoose.connection.name.includes("test")) {
    throw new Error(
      `Refusing to run tests against database "${mongoose.connection.name}" - the name must contain "test".`
    );
  }
  return TEST_URI;
};

module.exports.stopDb = async () => {
  if (mongoose.connection.readyState === 1) {
    await mongoose.connection.dropDatabase();
    await mongoose.connection.close();
  }
};

// Empties data but leaves indexes in place, so each test starts from a clean slate.
module.exports.clearDb = async () => {
  const collections = await mongoose.connection.db.collections();
  for (const c of collections) {
    await c.deleteMany({});
  }
};

// The unique compound index on SlotLock is the mechanism under test. Mongoose builds
// indexes in the background, so without awaiting this the first concurrency test could
// run before the index exists - and pass for entirely the wrong reason.
module.exports.ensureIndexes = async () => {
  const SlotLock = require("../models/slotLock.js");
  const Listing = require("../models/listing.js");
  const User = require("../models/user.js");
  await Promise.all([SlotLock.init(), Listing.init(), User.init()]);
};
