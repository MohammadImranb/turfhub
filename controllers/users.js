const User = require("../models/user.js");

//Signup form
module.exports.renderSignupForm = (req, res) => {
  res.render("users/signup.ejs");
};

//Signup
module.exports.signup = async (req, res, next) => {
  //try/catch here rather than letting wrapAsync throw, so a duplicate username
  //shows as a flash message instead of the error page
  try {
    let { username, email, password } = req.body;
    const newUser = new User({ email, username });
    const registeredUser = await User.register(newUser, password); //register() hashes the password
    //log them straight in instead of making them sign in again
    req.login(registeredUser, (err) => {
      if (err) {
        return next(err);
      }
      req.flash("success", "Welcome to Wanderlust!");
      res.redirect("/listings");
    });
  } catch (e) {
    req.flash("error", e.message);
    res.redirect("/signup");
  }
};

//Login form
module.exports.renderLoginForm = (req, res) => {
  res.render("users/login.ejs");
};

//Login (runs after passport.authenticate has succeeded)
module.exports.login = (req, res) => {
  req.flash("success", "Welcome back to Wanderlust!");
  //send them back where they were headed, else the listings page
  res.redirect(res.locals.redirectUrl || "/listings");
};

//Logout
module.exports.logout = (req, res, next) => {
  req.logout((err) => {
    if (err) {
      return next(err);
    }
    req.flash("success", "You are logged out!");
    res.redirect("/listings");
  });
};
