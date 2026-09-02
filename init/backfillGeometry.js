//One-off: fill in geometry for turfs created before the map feature existed.
//Safe to re-run - it skips turfs that already have coordinates.
//Run with: node init/backfillGeometry.js
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const Listing = require("../models/listing.js");
const { geocodeArea } = require("../utils/geocode.js");

//same variable app.js uses, so this always backfills the database the app reads
const dbUrl = process.env.ATLASDB_URL;
if (!dbUrl) {
  console.log("ATLASDB_URL is not set. Fill it in .env before running this.");
  process.exit(1);
}

const run = async () => {
  await mongoose.connect(dbUrl);
  console.log("connected to DB");

  const turfs = await Listing.find({});
  let filled = 0, skipped = 0, failed = 0;

  //geocode one area only once, even when several turfs share it
  const cache = new Map();

  for (const t of turfs) {
    if (t.geometry && t.geometry.coordinates && t.geometry.coordinates.length === 2) {
      skipped++;
      continue;
    }

    if (!cache.has(t.location)) {
      cache.set(t.location, await geocodeArea(t.location));
    }
    const geo = cache.get(t.location);

    if (!geo) {
      console.log(`  FAILED  ${t.title} (${t.location})`);
      failed++;
      continue;
    }

    t.geometry = geo;
    await t.save();
    console.log(`  ok      ${t.title.padEnd(30)} ${t.location.padEnd(16)} [${geo.coordinates.map(n => n.toFixed(4)).join(", ")}]`);
    filled++;
  }

  console.log(`\nfilled ${filled}, already had coords ${skipped}, failed ${failed}`);
  console.log(`areas geocoded: ${cache.size} (one API call each)`);
  await mongoose.connection.close();
};

run().catch(e => { console.log(e); process.exit(1); });
