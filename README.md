# TurfHub

A sports turf booking platform for Hubballi–Dharwad. Browse venues by sport and area,
see live slot availability, and book any 30-minute-aligned window.

Built with Node.js, Express, MongoDB and EJS.

---

## What it does

- **Browse turfs** by sport (Football 5s/7s, Box Cricket, Badminton, Tennis, …) and by area
- **Search** across turf name, area and sport
- **Flexible booking** — pick any start and end time on a 30-minute boundary, not fixed hourly slots
- **Live availability** — booked and past slots are greyed out per date
- **Reviews and ratings** with a star widget
- **Accounts** — sign up, log in, and manage your own bookings
- **Owner dashboard** — see who has booked the turfs you list
- **Maps** — each turf plotted with a marker and popup
- **Image upload** to Cloudinary, with automatic cleanup when a turf is edited or deleted

## The interesting part: concurrency-safe booking

Two users can click the same 7pm slot at the same instant. A "check if free, then insert"
has a race — both reads pass before either write lands, and you get a double booking.

Instead, each booking is decomposed into 30-minute **blocks**, and a `SlotLock` document is
written per block with a **unique compound index** on `{turf, date, block}`. MongoDB rejects
the second insert atomically, so a double booking is impossible at the database level rather
than the application level.

Users still choose arbitrary start and end times — the discretisation is internal.

If a booking partially overlaps an existing one, the blocks that did get inserted are rolled
back by their pre-generated `_id`s, so no slot is left reserved by a booking that never
completed.

Verified with 24 simultaneous requests for overlapping windows: exactly one confirmed
booking, zero orphaned locks.

## Tech stack

| Layer | Choice |
|---|---|
| Server | Node.js, Express 5 |
| Database | MongoDB with Mongoose 9 |
| Views | EJS + ejs-mate layouts |
| Auth | Passport.js (local strategy), sessions in MongoDB |
| Validation | Joi (server-side) |
| Images | Cloudinary via multer |
| Maps | Mapbox GL JS + Geocoding API |

## Project structure

```
app.js              express setup, session, passport, route mounting
constants.js        sports, areas, amenities, booking granularity - single source of truth
schema.js           Joi validation schemas
middleware.js       validation, isLoggedIn, isOwner, isReviewAuthor
models/             Listing, Review, User, Booking, SlotLock
controllers/        listings, reviews, users, bookings
routes/             listing, review, user, booking
views/              EJS templates
public/             css and client-side js
init/               database seeding and one-off scripts
utils/              wrapAsync, ExpressError, geocode
```

## Running locally

**Requirements:** Node 22.x and a MongoDB database (local or Atlas).

```bash
git clone <your-repo-url>
cd turfhub
npm install
```

Copy the example environment file and fill in your own values:

```bash
cp .env.example .env
```

You will need:

| Variable | Where to get it |
|---|---|
| `ATLASDB_URL` | MongoDB Atlas → Connect → Drivers. Add the database name between `/` and `?` |
| `SECRET` | any long random string — `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `CLOUDINARY_CLOUD_NAME` / `_KEY` / `_SECRET` | Cloudinary console → Settings → API Keys |
| `MAP_TOKEN` | Mapbox account → default public token (starts with `pk.`) |

Then seed and run:

```bash
npm start                        # start the server on http://localhost:3000
# sign up an account at /signup first - seeded turfs need an owner
npm run seed                     # load the sample Hubballi turfs
node init/backfillGeometry.js    # geocode them for the map
```

## Notes

- Passwords are never stored — `passport-local-mongoose` keeps a salt and hash.
- Session documents are encrypted at rest and expire via a TTL index.
- `.env` is gitignored. `.env.example` documents the keys without any real values.
- Sample turf **names and localities are real Hubballi–Dharwad venues**, but prices, phone
  numbers, timings, amenities and photos are invented placeholders for this project.
