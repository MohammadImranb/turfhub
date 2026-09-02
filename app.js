require("dotenv").config();
const express = require("express");
const app = express();
const mongoose = require("mongoose");
const path = require("path");
const methodOverride = require("method-override");
const ejsMate= require("ejs-mate");
//Connection string comes from ATLASDB_URL - .env locally, host environment on Render.
//Both seed scripts read this same variable, so they can never target a different database.
//No fallback on purpose: a wrong-database default is harder to notice than a clear failure.
const dbUrl = process.env.ATLASDB_URL;
if (!dbUrl) {
  throw new Error("ATLASDB_URL is not set. Copy .env.example to .env and fill it in.");
}
const ExpressError = require("./utils/ExpressError.js");
const listingsRoutes = require("./routes/listing.js");
const reviewsRoutes = require("./routes/review.js");
const userRoutes = require("./routes/user.js");
const bookingRoutes = require("./routes/booking.js");
const session = require("express-session");
const flash = require("connect-flash");
//v6 is ESM-first, so the class sits on .MongoStore (v4/v5 exported it directly)
const { MongoStore } = require("connect-mongo");
const passport = require("passport");
const LocalStrategy = require("passport-local");
const User = require("./models/user.js");
main()
  .then(() => {
    console.log("connected to DB");
  })
  .catch((err) => {
    console.log(err);
  });

async function main() {
  await mongoose.connect(dbUrl);
}

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
app.engine("ejs", ejsMate); // to use ejs-mate for all .ejs files
app.use(express.static(path.join(__dirname, "public")));


//The session secret signs the session cookie. Anyone who knows it can forge a login,
//so it must never sit in the repo - it comes from .env locally and from the host in production.
//In production a missing secret is fatal: silently falling back to a public default would
//let anyone forge a session on the live site.
const SESSION_SECRET = process.env.SECRET || "dev-only-insecure-secret";
if (!process.env.SECRET) {
  if (process.env.NODE_ENV === "production") {
    throw new Error("SECRET must be set in the environment in production.");
  }
  console.warn("WARNING: SECRET is not set in .env - using an insecure development fallback.");
}

//Sessions live in Mongo, not in server memory. MemoryStore loses every login on restart
//and grows without bound, and it warns loudly in production.
const store = MongoStore.create({
  mongoUrl: dbUrl,
  crypto: { secret: SESSION_SECRET }, //session contents are encrypted at rest
  touchAfter: 24 * 3600 //only rewrite an unchanged session once a day, not on every request
});

store.on("error", (err) => {
  console.log("ERROR in MONGO SESSION STORE", err);
});

const sessionoptions=
{
  store,
  secret: SESSION_SECRET,
  resave:false,
  //false so we don't write a session document for every anonymous visitor and bot
  saveUninitialized:false,
  cookie:{
    httpOnly:true,
    maxAge:1000*60*60*24*7
  }
}
app.use(session(sessionoptions));
app.use(flash()); //flash needs the session, so it must come after it

//passport also rides on the session, so it comes after session() too
app.use(passport.initialize());
app.use(passport.session()); //keeps the user logged in across requests
passport.use(new LocalStrategy(User.authenticate())); //authenticate() comes from passport-local-mongoose
passport.serializeUser(User.serializeUser());     //what to store in the session
passport.deserializeUser(User.deserializeUser()); //how to get the user back out

//expose flash messages and the logged in user to every template - must run before the routes
app.use((req, res, next) => {
  //Calling req.flash() sets req.session.flash = {} even when nothing is waiting, which
  //counts as modifying the session and so persists a document for every anonymous
  //visitor and bot - defeating saveUninitialized:false. Only read when there is something.
  const pending = req.session.flash;
  res.locals.success = pending && pending.success ? req.flash("success") : [];
  res.locals.error = pending && pending.error ? req.flash("error") : [];
  res.locals.currentUser = req.user;
  next();
});

app.get("/", (req, res) => {
  res.redirect("/listings");
});

//all /listings routes live in routes/listing.js
app.use("/listings", listingsRoutes);
//all review routes live in routes/review.js (:id here is the listing id)
app.use("/listings/:id/reviews", reviewsRoutes);
app.use("/bookings", bookingRoutes);
//signup and login live at the root, so mount at "/"
app.use("/", userRoutes);

//404 - must stay AFTER every route
app.use((req, res, next) => {
  next(new ExpressError(404, "Page Not Found!"));
});

//middle ware for handling error - must stay LAST
app.use((err, req, res, next) => {
  let { statusCode = 500, message = "Something went wrong" } = err;
  if (err.name === "CastError") {
    statusCode = 400;
    message = "Invalid id!";
  }
  res.status(statusCode).render("error", { message });
});

//NOTE: 8080 is taken on this machine - Oracle's TNSLSNR binds 127.0.0.1:8080, which is a
//more specific bind than our 0.0.0.0:8080, so Windows sends every localhost request to
//Oracle and you get confusing 404s. Hosts like Render set PORT themselves.
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`server is listening on port ${PORT}`);
});


