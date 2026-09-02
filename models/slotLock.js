const mongoose = require("mongoose");
const Schema = mongoose.Schema;

//One row per occupied time block. This collection exists purely so the database can
//reject a double booking atomically - an application level "is it free? ok, insert"
//check has a race window where two requests both pass before either writes.
const slotLockSchema = new Schema({
  turf: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
  date: { type: String, required: true },   //"YYYY-MM-DD", kept as a string to dodge UTC shifts
  block: { type: Number, required: true },  //minutes-from-midnight / BLOCK_MINUTES
  booking: { type: Schema.Types.ObjectId, ref: "Booking" }
});

//the whole point: the same block on the same turf and date can only be claimed once
slotLockSchema.index({ turf: 1, date: 1, block: 1 }, { unique: true });

module.exports = mongoose.model("SlotLock", slotLockSchema);
