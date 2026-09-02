const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const bookingSchema = new Schema({
  turf: { type: Schema.Types.ObjectId, ref: "Listing", required: true },
  user: { type: Schema.Types.ObjectId, ref: "User", required: true },
  date: { type: String, required: true },     //"YYYY-MM-DD" in IST
  startMin: { type: Number, required: true }, //510 = 08:30
  endMin: { type: Number, required: true },   //570 = 09:30
  totalPrice: { type: Number, required: true },
  status: {
    type: String,
    enum: ["confirmed", "cancelled"],
    default: "confirmed"
  },
  createdAt: { type: Date, default: Date.now }
});

//used by "my bookings" and the owner dashboard
bookingSchema.index({ user: 1, date: -1 });
bookingSchema.index({ turf: 1, date: 1 });

module.exports = mongoose.model("Booking", bookingSchema);
