const mongoose = require("mongoose");
const Schema = mongoose.Schema;
//v9 is transpiled ESM, so the plugin function sits on .default (v8 and below exported it directly)
const passportLocalMongoose = require("passport-local-mongoose").default;

const userSchema = new Schema({
  email: {
    type: String,
    required: true
  }
});

//adds username, hash and salt fields plus register/authenticate/serializeUser helpers,
//so we never store a plain password ourselves
userSchema.plugin(passportLocalMongoose);

module.exports = mongoose.model("User", userSchema);
