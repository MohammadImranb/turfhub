//load .env from the project root, not from init/
require("dotenv").config({ path: require("path").join(__dirname, "..", ".env") });

const mongoose = require("mongoose");
const initData = require("./data.js");
const Listing = require("../models/listing.js");
const User = require("../models/user.js");

//same variable app.js uses, so seeding always targets the database the app reads.
//No fallback: silently seeding local Mongo while the app reads Atlas is the worst
//outcome here - you get an empty site and no error anywhere to explain it.
const dbUrl = process.env.ATLASDB_URL;
if (!dbUrl) {
  console.log("ATLASDB_URL is not set. Fill it in .env before seeding.");
  process.exit(1);
}

main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(dbUrl);
}

const initDB = async () => {
  //every listing needs an owner now, else nobody can edit the seeded ones
  const owner = await User.findOne({});
  if (!owner) {
    console.log("No user found. Sign up at /signup first, then re-run this script.");
    await mongoose.connection.close();
    return;
  }

  await Listing.deleteMany({});

  //each turf already carries its own sport/category now, so no keyword guessing needed
  const seeded = initData.data.map((obj) => ({ ...obj, owner: owner._id }));
  await Listing.insertMany(seeded);
  console.log(`data was initialized (owner: ${owner.username})`);
  await mongoose.connection.close(); //otherwise the script never exits
};

initDB();