const joi=require("joi");
const { SPORT_NAMES, SURFACES, AMENITIES, AREAS } = require("./constants.js");

module.exports.listingSchema = joi.object({
    listing: joi.object({
        title: joi.string().required(),
        description: joi.string().required(),
        price: joi.number().required().min(0), //per hour
        //must be one of the 18 known areas - the form is a dropdown, and geocoding
        //relies on the value being a real locality, so free text is not accepted
        location: joi.string().valid(...AREAS).required(),
        category: joi.string().valid(...SPORT_NAMES).required(),
        surface: joi.string().valid(...SURFACES).allow("", null),
        phone: joi.string().pattern(/^[0-9+\-\s]{7,15}$/).allow("", null),
        openMin: joi.number().min(0).max(1440).allow("", null),
        closeMin: joi.number().min(0).max(1440).allow("", null),
        //a single checkbox posts a string, several post an array - accept both
        amenities: joi.alternatives().try(
            joi.array().items(joi.string().valid(...AMENITIES)),
            joi.string().valid(...AMENITIES)
        ).allow("", null),
        image: joi.any().optional()
    }).required()
});

module.exports.reviewSchema = joi.object({
    review: joi.object({
        comment: joi.string().required(),
        rating: joi.number().required().min(1).max(5)
    }).required()
});
