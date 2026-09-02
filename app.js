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
const helmet = require("helmet");
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

//Security headers. The Content Security Policy has to name every external origin the
//app loads from, otherwise the browser blocks Bootstrap, Font Awesome, Mapbox and the
//images, and the site renders as unstyled text with no map.
const scriptSrcUrls = ["https://api.mapbox.com/", "https://cdn.jsdelivr.net/", "https://cdnjs.cloudflare.com/"];
const styleSrcUrls  = ["https://api.mapbox.com/", "https://cdn.jsdelivr.net/", "https://cdnjs.cloudflare.com/"];
const connectSrcUrls = ["https://api.mapbox.com/", "https://*.tiles.mapbox.com/", "https://events.mapbox.com/"];
const fontSrcUrls   = ["https://cdnjs.cloudflare.com/"];

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: [],
      connectSrc: ["'self'", ...connectSrcUrls],
      //no 'unsafe-inline' here on purpose - the map data moved to data-* attributes
      //so nothing in this app needs an inline <script>
      scriptSrc: ["'self'", ...scriptSrcUrls],
      //styles still need it: a few templates use inline style="" attributes.
      //Inline style is far less dangerous than inline script.
      styleSrc: ["'self'", "'unsafe-inline'", ...styleSrcUrls],
      workerSrc: ["'self'", "blob:"],  //Mapbox GL renders tiles in a web worker
      childSrc: ["blob:"],
      objectSrc: [],
      imgSrc: [
        "'self'",
        "blob:",
        "data:",
        "https://res.cloudinary.com/",   //uploaded turf photos
        "https://images.unsplash.com/"   //default/seed images
      ],
      fontSrc: ["'self'", ...fontSrcUrls]
    }
  },
  //Mapbox fetches tiles cross-origin; the strictest COEP breaks that
  crossOriginEmbedderPolicy: false
}));

//Render (and most hosts) put a reverse proxy in front of the app and terminate HTTPS there,
//so Express sees a plain HTTP connection. Without this, req.secure is false and a
//"secure" session cookie is never sent - the user logs in and is immediately logged out.
app.set("trust proxy", 1);

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));
app.use(express.urlencoded({ extended: true }));
app.use(methodOverride("_method"));
//Strip MongoDB operator keys ($ne, $gt, $where, ...) out of request bodies before they can
//reach a query. Joi already rejects them on every route that has a schema, and Express 5's
//default "simple" query parser cannot build nested objects from a query string at all - but
//this closes the whole class of bug rather than relying on each new route remembering Joi.
//NOTE: express-mongo-sanitize is not used because it reassigns req.query, which is a
//getter in Express 5 and throws.
function stripOperators(value) {
  if (!value || typeof value !== "object") return;
  for (const key of Object.keys(value)) {
    if (key.startsWith("$") || key === "__proto__") {
      delete value[key];
    } else {
      stripOperators(value[key]);
    }
  }
}
app.use((req, res, next) => {
  stripOperators(req.body);
  next();
});

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
    httpOnly:true, //JavaScript cannot read the cookie, so XSS cannot steal the session
    //Render terminates TLS at its proxy, so only send the cookie over HTTPS in production.
    //Locally we serve plain HTTP, so forcing secure here would stop login working at all.
    secure: process.env.NODE_ENV === "production",
    //"lax" still sends the cookie on normal link navigation but not on cross-site
    //form posts, which blocks the simplest CSRF attacks
    sameSite: "lax",
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


