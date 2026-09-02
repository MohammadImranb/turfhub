const express = require("express");
const router = express.Router();
const wrapAsync = require("../utils/wrapAsync.js");
const passport = require("passport");
const { saveRedirectUrl } = require("../middleware.js");
const userController = require("../controllers/users.js");

router.route("/signup")
  .get(userController.renderSignupForm)
  .post(wrapAsync(userController.signup));

router.route("/login")
  .get(userController.renderLoginForm)
  .post(
    saveRedirectUrl, //must run before passport, which resets the session
    passport.authenticate("local", {
      failureRedirect: "/login",
      failureFlash: true //passport puts its own "Password or username is incorrect" into flash
    }),
    userController.login
  );

router.get("/logout", userController.logout);

module.exports = router;
