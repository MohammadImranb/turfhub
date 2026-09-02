//Single source of truth for the dropdown/filter values.
//These used to be copy-pasted into the model, the Joi schema and three views,
//so changing one list meant editing six files and silently breaking the filters.

module.exports.SPORTS = [
  { name: "Football 5s", icon: "fa-futbol" },
  { name: "Football 7s", icon: "fa-futbol" },
  { name: "Box Cricket", icon: "fa-baseball" },
  { name: "Cricket Nets", icon: "fa-baseball-bat-ball" },
  { name: "Badminton", icon: "fa-shuttlecock" },
  { name: "Tennis", icon: "fa-table-tennis-paddle-ball" },
  { name: "Basketball", icon: "fa-basketball" },
  { name: "Volleyball", icon: "fa-volleyball" },
  { name: "Pickleball", icon: "fa-table-tennis-paddle-ball" },
  { name: "Multi-sport", icon: "fa-medal" }
];

//localities across Hubballi-Dharwad
module.exports.AREAS = [
  "Vidyanagar",
  "Gokul Road",
  "Keshwapur",
  "Navanagar",
  "Unkal",
  "Deshpande Nagar",
  "Shirur Park",
  "Manjunath Nagar",
  "Railway Colony",
  "Laxmi Colony",
  "Kallur Layout",
  "New Timberyard Layout",
  "Rajnagar",
  "Akshay Park",
  "Bhairidevarkoppa",
  "Old Hubli",
  "Hosur",
  "Dharwad"
];

module.exports.SURFACES = ["Artificial grass", "Natural grass", "Concrete", "Clay", "Wooden", "Synthetic"];

module.exports.AMENITIES = [
  "Floodlights",
  "Parking",
  "Washroom",
  "Changing room",
  "Drinking water",
  "Seating",
  "First aid",
  "Equipment rental"
];

//plain name arrays, handy for the mongoose enum and Joi .valid()
module.exports.SPORT_NAMES = module.exports.SPORTS.map(s => s.name);

//--- booking ---
//Bookings are flexible: the user picks any start and end on a BLOCK_MINUTES boundary.
//Internally each booking claims one SlotLock row per block, which is what makes
//double booking impossible (unique index) even when two people click at the same instant.
//Drop this to 15 for finer slots - nothing else needs changing.
module.exports.BLOCK_MINUTES = 30;
module.exports.MIN_BOOKING_MINUTES = 30;
module.exports.MAX_BOOKING_MINUTES = 240;

//8:30 -> 510 -> block 17. A booking covers [startBlock, endBlock) so 8:30-9:30 = blocks 17,18.
module.exports.blocksFor = (startMin, endMin) => {
  const B = module.exports.BLOCK_MINUTES;
  const blocks = [];
  for (let b = Math.floor(startMin / B); b < Math.ceil(endMin / B); b++) {
    blocks.push(b);
  }
  return blocks;
};

//570 -> "09:30"
module.exports.minToLabel = (m) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

//"YYYY-MM-DD" for today in IST, without dragging a Date through UTC
module.exports.todayStr = () => {
  const now = new Date();
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
  return `${ist.getFullYear()}-${String(ist.getMonth() + 1).padStart(2, "0")}-${String(ist.getDate()).padStart(2, "0")}`;
};

//minutes since midnight right now, in IST
module.exports.nowMinIST = () => {
  const now = new Date();
  const ist = new Date(now.getTime() + (330 + now.getTimezoneOffset()) * 60000);
  return ist.getHours() * 60 + ist.getMinutes();
};
