const Listing = require("../models/listing.js");
const Review = require("../models/reviews.js");

//Create
module.exports.createReview = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing you requested for does not exist!");
    return res.redirect("/listings");
  }

  let newReview = new Review(req.body.review);
  newReview.author = req.user._id; //stamp the logged in user as author
  await newReview.save();
  listing.reviews.push(newReview);
  await listing.save();
  req.flash("success", "New review added!");
  res.redirect(`/listings/${id}`);
};

//Delete
module.exports.destroyReview = async (req, res) => {
  const { id, reviewId } = req.params;
  await Listing.findByIdAndUpdate(id, { $pull: { reviews: reviewId } }); //pull the reviewId from the reviews array of the listing
  await Review.findByIdAndDelete(reviewId);
  req.flash("success", "Review deleted!");
  res.redirect(`/listings/${id}`);
};
