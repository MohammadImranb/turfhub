const mongoose = require("mongoose");
const Listing = require("../models/listing.js");
const Booking = require("../models/booking.js");
const SlotLock = require("../models/slotLock.js");
const {
  BLOCK_MINUTES, MIN_BOOKING_MINUTES, MAX_BOOKING_MINUTES,
  blocksFor, minToLabel, todayStr, nowMinIST
} = require("../constants.js");

//Shared rule check. Returns an error string, or null when the request is sane.
//Kept separate from the route so both the form post and the JSON endpoint agree.
function validateWindow(turf, date, startMin, endMin) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return "Pick a valid date.";
  if (!Number.isInteger(startMin) || !Number.isInteger(endMin)) return "Pick a valid time.";
  if (startMin % BLOCK_MINUTES || endMin % BLOCK_MINUTES) {
    return `Times must fall on ${BLOCK_MINUTES} minute boundaries.`;
  }
  if (endMin <= startMin) return "End time must be after start time.";

  const duration = endMin - startMin;
  if (duration < MIN_BOOKING_MINUTES) return `Minimum booking is ${MIN_BOOKING_MINUTES} minutes.`;
  if (duration > MAX_BOOKING_MINUTES) return `Maximum booking is ${MAX_BOOKING_MINUTES / 60} hours.`;

  if (startMin < turf.openMin || endMin > turf.closeMin) {
    return `This turf is only open ${minToLabel(turf.openMin)} to ${minToLabel(turf.closeMin)}.`;
  }

  const today = todayStr();
  if (date < today) return "That date has already passed.";
  if (date === today && startMin <= nowMinIST()) return "That time has already passed today.";

  return null;
}

//GET /listings/:id/slots?date=YYYY-MM-DD  -> which blocks are already taken
module.exports.availability = async (req, res) => {
  const { id } = req.params;
  const date = req.query.date || todayStr();

  const turf = await Listing.findById(id);
  if (!turf) {
    return res.status(404).json({ error: "Turf not found" });
  }

  const locks = await SlotLock.find({ turf: id, date }).select("block");
  res.json({
    date,
    blockMinutes: BLOCK_MINUTES,
    openMin: turf.openMin,
    closeMin: turf.closeMin,
    pricePerHour: turf.price,
    bookedBlocks: locks.map(l => l.block)
  });
};

//POST /listings/:id/bookings
module.exports.createBooking = async (req, res) => {
  const { id } = req.params;
  const date = (req.body.date || "").trim();
  const startMin = Number(req.body.startMin);
  const endMin = Number(req.body.endMin);

  const turf = await Listing.findById(id);
  if (!turf) {
    req.flash("error", "Listing you requested for does not exist!");
    return res.redirect("/listings");
  }

  //an owner blocking slots on their own turf would take it off sale for real customers
  if (turf.owner && turf.owner.equals(req.user._id)) {
    req.flash("error", "You cannot book your own turf.");
    return res.redirect(`/listings/${id}?date=${encodeURIComponent(date)}`);
  }

  const problem = validateWindow(turf, date, startMin, endMin);
  if (problem) {
    req.flash("error", problem);
    return res.redirect(`/listings/${id}?date=${encodeURIComponent(date)}`);
  }

  const blocks = blocksFor(startMin, endMin);
  const hours = (endMin - startMin) / 60;
  const totalPrice = Math.round(hours * (turf.price || 0));

  //Claim every block first. insertMany with ordered:true stops at the first duplicate,
  //so if anyone else holds even one of these blocks we get a duplicate key error (11000)
  //instead of quietly creating an overlapping booking.
  //
  //_ids are generated up front on purpose: a rollback must delete ONLY the rows this
  //request created. Rolling back by {block, booking:null} instead would also match a
  //competing request's just-inserted lock (its booking id is attached a moment later),
  //so one failed attempt could free another user's block and let it be double booked.
  const lockDocs = blocks.map(block => ({
    _id: new mongoose.Types.ObjectId(),
    turf: id,
    date,
    block
  }));
  const ourLockIds = lockDocs.map(d => d._id);

  try {
    await SlotLock.insertMany(lockDocs, { ordered: true });
  } catch (err) {
    await SlotLock.deleteMany({ _id: { $in: ourLockIds } }); //only ever our own rows
    if (err.code === 11000 || err.writeErrors) {
      req.flash("error", "Sorry, part of that slot was just booked by someone else. Please pick another time.");
      return res.redirect(`/listings/${id}?date=${encodeURIComponent(date)}`);
    }
    throw err;
  }

  //blocks are ours now, so the booking itself cannot clash
  try {
    const booking = await Booking.create({
      turf: id,
      user: req.user._id,
      date,
      startMin,
      endMin,
      totalPrice
    });
    //point the locks at the booking so cancelling can find them
    await SlotLock.updateMany(
      { _id: { $in: ourLockIds } },
      { $set: { booking: booking._id } }
    );
    req.flash("success", `Booked ${minToLabel(startMin)}-${minToLabel(endMin)} on ${date} for ₹${totalPrice.toLocaleString("en-IN")}.`);
    res.redirect("/bookings");
  } catch (err) {
    //never leave orphan locks holding a slot nobody booked
    await SlotLock.deleteMany({ _id: { $in: ourLockIds } });
    throw err;
  }
};

//GET /bookings - the logged in user's bookings
module.exports.myBookings = async (req, res) => {
  const bookings = await Booking.find({ user: req.user._id })
    .populate("turf")
    .sort({ date: -1, startMin: -1 });
  res.render("bookings/index.ejs", { bookings, minToLabel, todayStr: todayStr() });
};

//GET /bookings/manage - bookings made on turfs this user owns
module.exports.manageBookings = async (req, res) => {
  const myTurfs = await Listing.find({ owner: req.user._id }).select("_id");
  const bookings = await Booking.find({ turf: { $in: myTurfs.map(t => t._id) } })
    .populate("turf")
    .populate("user")
    .sort({ date: -1, startMin: -1 });
  res.render("bookings/manage.ejs", { bookings, minToLabel, todayStr: todayStr() });
};

//DELETE /bookings/:bookingId - cancel, which frees the blocks again
module.exports.cancelBooking = async (req, res) => {
  const { bookingId } = req.params;
  const booking = await Booking.findById(bookingId);

  if (!booking) {
    req.flash("error", "Booking not found.");
    return res.redirect("/bookings");
  }
  if (!booking.user.equals(req.user._id)) {
    req.flash("error", "That is not your booking!");
    return res.redirect("/bookings");
  }
  if (booking.status === "cancelled") {
    req.flash("error", "That booking is already cancelled.");
    return res.redirect("/bookings");
  }

  booking.status = "cancelled";
  await booking.save();
  //releasing the locks is what actually puts the slot back on sale
  await SlotLock.deleteMany({ booking: booking._id });

  req.flash("success", "Booking cancelled.");
  res.redirect("/bookings");
};

module.exports.validateWindow = validateWindow;
