const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const { isLoggedIn } = require("../middleware.js");
const bookingController = require("../controllers/bookings.js");

//my bookings
router.get("/", isLoggedIn, wrapAsync(bookingController.myBookings));

//bookings on turfs I own - must sit above /:bookingId
router.get("/manage", isLoggedIn, wrapAsync(bookingController.manageBookings));

//cancel
router.delete("/:bookingId", isLoggedIn, wrapAsync(bookingController.cancelBooking));

module.exports = router;
