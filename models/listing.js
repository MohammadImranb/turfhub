
const mongoose = require("mongoose");
const Schema = mongoose.Schema;
const Review = require("./reviews.js");
const { SPORT_NAMES, SURFACES, AMENITIES } = require("../constants.js");
const Booking = require("./booking.js");
const SlotLock = require("./slotLock.js");


const listingSchema = new Schema({
  title: {
    type: String,
    required: true,
  },
  description: String,

  image: {
    filename: String,
    url: {
      type: String,
      default:
        "https://images.unsplash.com/photo-1625505826533-5c80aca7d157"
    }
  },

  price: Number, //per hour
  location: String, //area within Hubballi-Dharwad
  //GeoJSON Point, filled in by geocoding the location on save.
  //Note the order is [longitude, latitude] - GeoJSON is lng first, the opposite of
  //the "lat, lng" you see in Google Maps. Swapping them puts Hubli in the ocean.
  //Optional so existing turfs keep working until they are backfilled.
  geometry: {
    type: {
      type: String,
      enum: ["Point"]
    },
    coordinates: {
      type: [Number]
    }
  },
  category: {
    type: String,
    enum: SPORT_NAMES,
    default: "Multi-sport"
  },
  surface: {
    type: String,
    enum: SURFACES,
    default: "Artificial grass"
  },
  //turfs open and close at fixed times, stored as minutes from midnight
  openMin: { type: Number, default: 360 },   //06:00
  closeMin: { type: Number, default: 1380 }, //23:00
  amenities: [{ type: String, enum: AMENITIES }],
  phone: String,
  reviews: [
    {
      type: Schema.Types.ObjectId,
      ref: "Review"
    }
  ],
  owner: {
    type: Schema.Types.ObjectId,
    ref: "User"
  }
});

//--- indexes ---
//the sport filter is an exact match, so this one is used on every filtered index page
listingSchema.index({ category: 1 });
//"bookings on my turfs" does Listing.find({ owner }), which would otherwise scan
listingSchema.index({ owner: 1 });
//exact-area lookups, and it keeps the door open for an area filter like the sport one
listingSchema.index({ location: 1 });
//NOTE: the ?q= search uses a case-insensitive regex, and MongoDB cannot use a plain
//index for an unanchored /foo/i match - it still scans. That is fine at this size.
//To make search indexed, switch the query to { $text: { $search: q } } and add:
//   listingSchema.index({ title: "text", description: "text", location: "text" });
//The trade-off is $text matches whole words only, so "vidya" stops finding "Vidyanagar".

//when a listing is deleted, delete all the reviews that belonged to it.
//findByIdAndDelete internally calls findOneAndDelete, so that is the hook name.
//post gives us the deleted document, so listing.reviews still holds the ids.
//must stay ABOVE mongoose.model() or it is never registered.
listingSchema.post("findOneAndDelete", async (listing) => {
  if (listing) {
    await Review.deleteMany({ _id: { $in: listing.reviews } });
    //same reasoning for bookings: leaving them behind orphans rows that point at a turf
    //that no longer exists, and orphan locks would hold slots on a deleted turf forever
    await Booking.deleteMany({ turf: listing._id });
    await SlotLock.deleteMany({ turf: listing._id });
  }
});

const Listing = mongoose.model("Listing", listingSchema);
module.exports = Listing;