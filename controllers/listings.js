const Listing = require("../models/listing.js");
const { cloudinary } = require("../cloudConfig.js");
const SlotLock = require("../models/slotLock.js");
const { geocodeArea } = require("../utils/geocode.js");
const {
  SPORTS, AREAS, SURFACES, AMENITIES,
  BLOCK_MINUTES, minToLabel, todayStr, nowMinIST
} = require("../constants.js");

//Index - also handles ?q= search and ?category= filter
module.exports.index = async (req, res) => {
  const { q, category } = req.query;
  const filter = {};

  if (category) {
    filter.category = category;
  }

  if (q && q.trim()) {
    //escape regex metacharacters so a search for "a+b" cannot break the query
    const safe = q.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const rx = new RegExp(safe, "i");
    filter.$or = [{ title: rx }, { location: rx }, { category: rx }];
  }

  const allListings = await Listing.find(filter);
  res.render("listings/index", { allListings, q: q || "", category: category || "", sports: SPORTS });
};

//New form
module.exports.renderNewForm = (req, res) => {
  res.render("listings/new.ejs", { sports: SPORTS, areas: AREAS, surfaces: SURFACES, amenities: AMENITIES });
};

//Show
module.exports.showListing = async (req, res) => {
  let { id } = req.params;
  //nested populate so we get each review's author, not just the review
  const listing = await Listing.findById(id)
    .populate({ path: "reviews", populate: { path: "author" } })
    .populate("owner");
  if (!listing) {
    req.flash("error", "Listing you requested for does not exist!");
    return res.redirect("/listings");
  }

  //which blocks are already taken on the selected day, so the picker can grey them out
  const date = /^\d{4}-\d{2}-\d{2}$/.test(req.query.date || "") ? req.query.date : todayStr();
  const locks = await SlotLock.find({ turf: id, date }).select("block");
  const bookedBlocks = locks.map(l => l.block);

  res.render("listings/show", {
    listing,
    date,
    bookedBlocks,
    blockMinutes: BLOCK_MINUTES,
    minToLabel,
    today: todayStr(),
    nowMin: nowMinIST(),
    mapToken: process.env.MAP_TOKEN //presence of this also makes the layout load Mapbox GL JS
  });
};

//Create
module.exports.createListing = async (req, res) => {
  const newListing = new Listing(req.body.listing);
  if (req.file) {
    newListing.image = { filename: req.file.filename, url: req.file.path };
  }
  newListing.owner = req.user._id; //stamp the logged in user as owner
  //null if Mapbox is unreachable - the turf still saves, it just has no pin
  const geo = await geocodeArea(newListing.location);
  if (geo) {
    newListing.geometry = geo;
  }
  await newListing.save();
  req.flash("success", "New listing created!");
  res.redirect("/listings");
};

//Edit form
module.exports.renderEditForm = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing you requested for does not exist!");
    return res.redirect("/listings");
  }
  res.render("listings/edit.ejs", { listing, sports: SPORTS, areas: AREAS, surfaces: SURFACES, amenities: AMENITIES });
};

//Update
module.exports.updateListing = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findById(id);
  if (!listing) {
    req.flash("error", "Listing you requested for does not exist!");
    return res.redirect("/listings");
  }
  const areaChanged = req.body.listing.location !== listing.location;
  Object.assign(listing, req.body.listing);
  //only re-geocode when the area actually changed, to avoid a pointless API call on every edit
  if (areaChanged || !listing.geometry || !listing.geometry.coordinates || !listing.geometry.coordinates.length) {
    const geo = await geocodeArea(listing.location);
    if (geo) {
      listing.geometry = geo;
    }
  }
  if (req.file) {
    if (listing.image?.filename) {
      await cloudinary.uploader.destroy(listing.image.filename);
    }
    listing.image = { filename: req.file.filename, url: req.file.path };
  }
  await listing.save();
  req.flash("success", "Listing updated!");
  res.redirect(`/listings/${id}`);
};

//Delete
module.exports.destroyListing = async (req, res) => {
  let { id } = req.params;
  const listing = await Listing.findByIdAndDelete(id);
  if (listing?.image?.filename) {
    await cloudinary.uploader.destroy(listing.image.filename);
  }
  req.flash("success", "Listing deleted!");
  res.redirect("/listings");
};
