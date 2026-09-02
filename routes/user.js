const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const passport = require("passport");
const { saveRedirectUrl } = require("../middleware.js");
const userController = require("../controllers/users.js");
const rateLimit = require("express-rate-limit");

//Without this, nothing stops a script trying thousands of passwords against one account.
//Only the POST routes are limited - browsing and viewing the forms stay unrestricted.
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, //15 minutes
  limit: 10,                //10 attempts per IP per window
  standardHeaders: "draft-7",
  legacyHeaders: false,
  //a plain 429 body would be a dead end, so send them back with a flash message
  handler: (req, res) => {
    req.flash("error", "Too many attempts. Please try again in 15 minutes.");
    res.redirect(req.path === "/signup" ? "/signup" : "/login");
  }
});

router.route("/signup")
  .get(userController.renderSignupForm)
  .post(authLimiter, wrapAsync(userController.signup));

router.route("/login")
  .get(userController.renderLoginForm)
  .post(
    authLimiter,
    saveRedirectUrl, //must run before passport, which resets the session
    passport.authenticate("local", {
      failureRedirect: "/login",
      failureFlash: true //passport puts its own "Password or username is incorrect" into flash
    }),
    userController.login
  );

router.get("/logout", userController.logout);

module.exports = router;
