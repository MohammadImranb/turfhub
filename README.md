# TurfHub

[![CI](https://github.com/MohammadImranb/turfhub/actions/workflows/ci.yml/badge.svg)](https://github.com/MohammadImranb/turfhub/actions/workflows/ci.yml)

Book a sports turf in Hubballi without phoning six places first.

**Live:** https://turfhub-hubli.onrender.com
*(free tier — the first request after a quiet period takes about a minute to wake up)*

---

## The problem

If you want to play football or box cricket in Hubballi on a Saturday evening, the process
today is: find turf numbers on Justdial or Instagram, call each one, ask what's free, get
told "7 to 8 is gone, 8:30 is open", call the next place to compare, then call back to
confirm. Nothing is written down anywhere. Half the venues don't answer.

There's no single place to see which turfs exist, what they cost, and what's actually free
tonight.

## What TurfHub does

Lists turfs across Hubballi–Dharwad by sport and area, shows what's free on a given day,
and lets a logged-in user reserve a slot.

- Filter by sport (Football 5s/7s, Box Cricket, Cricket Nets, Badminton, Tennis, Basketball,
  Volleyball, Pickleball) or search by name, area or sport
- Pick **any** start and end time on a 30-minute boundary — 8:30 to 9:30 if that's what
  you want, not a fixed hourly grid
- See booked, past and free slots for the selected date before choosing
- Leave a review; delete only your own
- Turf owners get a separate view of who has booked their venues
- Each turf is geocoded and shown on a map with its area, sport and hourly rate

Prices are per hour in ₹. Areas are real Hubballi–Dharwad localities — Vidyanagar,
Gokul Road, Keshwapur, Unkal, Shirur Park, Navanagar, Manjunath Nagar, Dharwad and others.

---

## The part that was actually hard

Everything above is CRUD. The real problem in a booking system is what happens when two
people want the same slot at the same instant.

The obvious implementation looks fine and is wrong:

```js
const clash = await Booking.findOne({ turf, date, /* overlapping */ });
if (!clash) {
  await Booking.create({ ... });   // both requests get here
}
```

Both requests run the read before either runs the write. Both see the slot as free. Both
insert. You've double-booked a turf, and no test that sends one request at a time will
ever catch it.

An in-memory lock doesn't fix it either — that protects one Node process, and the normal
way to scale is to run several. The guarantee has to live somewhere every process shares.

### How it works instead

Each booking is broken into fixed 30-minute **blocks**. A separate `SlotLock` collection
holds one row per occupied block, with a unique compound index:

```js
slotLockSchema.index({ turf: 1, date: 1, block: 1 }, { unique: true });
```

Booking 08:30–09:30 claims blocks 17 and 18 (`minutes / 30`). Inserting those rows *is*
the reservation. If any block is already taken, MongoDB rejects the insert with a
duplicate-key error, atomically — there's no window between checking and writing, because
there's no check. The write is the check.

The user still picks arbitrary times. The block split is internal; it's what turns "any
time range" into something a unique index can enforce.

### The bug I found in my own rollback

If a booking partly overlaps an existing one, the blocks that *did* insert have to be
rolled back — otherwise a slot stays reserved by a booking that never completed.

My first version deleted by block number, filtered on `booking: null`. That looked correct
and wasn't: a competing request's freshly-inserted locks *also* have `booking: null` for the
few milliseconds before it attaches the booking id. So one failed request could delete
another request's lock, leaving a live booking with an unlocked slot — a double-booking
created by the cleanup itself.

I reproduced it deterministically, then fixed it by generating the `_id`s up front and
rolling back only those:

```js
catch (err) {
  await SlotLock.deleteMany({ _id: { $in: ourLockIds } });  // only ever our own rows
  ...
}
```

An earlier concurrency test had passed before this fix, purely on timing luck. That's the
thing about race conditions — passing once proves very little.

### Tested, not assumed

`tests/booking.concurrency.test.js` fires overlapping requests with `Promise.all` against a
real MongoDB and asserts:

| Scenario | Assertion |
|---|---|
| 10 simultaneous requests, same slot | exactly 1 booking, exactly 2 locks |
| 8 concurrent, partially overlapping | 1 booking, 0 orphaned locks, no two bookings overlap |
| Adjacent slots (10–11 and 11–12) | both succeed — a shared boundary isn't a clash |
| Cancel, then rebook the same window | locks released, slot genuinely reusable |

The adjacent-slot test matters: an over-eager lock would pass the first test and quietly
block legitimate bookings.

---

## Tech stack

| | | Why |
|---|---|---|
| Runtime | Node 22 | Mongoose 9 needs ≥ 20.19 |
| Server | Express 5 | Async errors reach the error handler without wrapping every route |
| Database | MongoDB + Mongoose 9 | Documents suit listings with optional geometry, amenity arrays and nested image data. Mongoose adds schemas, validation and middleware hooks |
| Views | EJS + ejs-mate | Server-rendered. No separate frontend build or API layer to maintain |
| Auth | Passport (local) | `passport-local-mongoose` handles PBKDF2 salting and hashing — raw passwords never touch my code |
| Sessions | connect-mongo | In the database, not server memory: survives restarts and works across instances |
| Validation | Joi | Rejects bad input before it reaches business logic |
| Images | Cloudinary + multer | Host filesystems are ephemeral; uploads stream straight out and old assets are destroyed on edit/delete |
| Maps | Mapbox GL JS | Areas geocoded on save, stored as GeoJSON |
| Security | helmet, express-rate-limit | CSP without `unsafe-inline`, brute-force limit on auth routes |
| Tests | Jest + supertest | Against real MongoDB, not a mock |
| Container | Docker (multi-stage, Alpine) | 297 MB image, runs as non-root |
| CI/CD | GitHub Actions → Render | Deployment gated on the test suite |

## Layout

```
app.js          config, middleware order, route mounting, error handler
constants.js    sports, areas, amenities, BLOCK_MINUTES — defined once, imported everywhere
schema.js       Joi validation
middleware.js   validateListing, validateReview, isLoggedIn, isOwner, isReviewAuthor
models/         Listing · Review · User · Booking · SlotLock
controllers/    listings · reviews · users · bookings
routes/         listing · review · user · booking
views/          EJS templates
utils/          wrapAsync · ExpressError · geocode
tests/          setup + concurrency + authorization suites
init/           seed script, one-off geometry backfill
```

`constants.js` exists because the sport list was originally duplicated across the model
enum, the Joi schema, the filter bar, two forms and the seed script. Changing it meant
editing six files or the filters broke silently.

---

## Running it

### With Docker (nothing else needed)

The compose stack brings its own MongoDB, so there's no Atlas account and no API keys:

```bash
docker compose up --build
docker compose exec app npm run seed     # load the sample Hubballi turfs
```

Open **http://127.0.0.1:3000**.

> Use `127.0.0.1`, not `localhost`. On Windows, Docker Desktop's WSL relay holds the IPv6
> loopback and `localhost` resolves to that first — you'll get connection errors from a
> container that's running perfectly.

### Without Docker

Needs Node 22 and a MongoDB you can reach.

```bash
npm install
cp .env.example .env      # then fill it in
npm start
```

| Variable | Where it comes from |
|---|---|
| `ATLASDB_URL` | Atlas → Connect → Drivers. **Add the database name between `/` and `?`** — Atlas doesn't include it, and Mongoose silently falls back to a database called `test` |
| `SECRET` | any long random string — `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"` |
| `CLOUDINARY_CLOUD_NAME` / `_KEY` / `_SECRET` | Cloudinary console → Settings → API Keys |
| `MAP_TOKEN` | Mapbox → default public token (starts with `pk.`) |

If your database password contains any of `: / ? # [ ] @` it has to be percent-encoded
(`@` → `%40`), or the connection string parses wrongly. Easiest fix is a password with only
letters and numbers.

Then seed:

```bash
npm run seed                     # needs at least one signed-up user to own the turfs
node init/backfillGeometry.js    # geocode them for the map
```

## Tests

```bash
npm test
```

Runs against a real MongoDB on `127.0.0.1:27017`, in a database called `turfhub_test`
(override with `MONGO_TEST_URL`). `tests/setup.js` refuses to run unless the database name
contains `test`, so a mistyped URL can't wipe real data.

Not a mocked driver, deliberately — the whole booking design rests on a unique index, and
only a real mongod enforces that. A mock would let the concurrency tests pass while
production double-booked.

The authorization tests post directly to endpoints rather than going through the UI, and
assert against the **database** rather than the HTTP status. Hiding an Edit button isn't
security, and a 302 doesn't prove the write was stopped.

## CI/CD

`.github/workflows/ci.yml`, three jobs:

1. **test** — `npm ci`, then the suite against a `mongo:7` service container
2. **docker** — needs `test`. Builds the image, then checks it doesn't run as root and
   doesn't contain a `.env`
3. **deploy** — needs both. Triggers Render, and only on a push to `main`, never a PR

The `needs:` keys are what make it a gate rather than three things running in parallel — a
failing test stops the release instead of deploying alongside it. Only the deploy job uses
a secret; test and build need none.

Before this, Render was set to deploy on its own after CI passed. It silently never fired,
and the live site served stale code for a day with no error anywhere. Having the pipeline
trigger the deploy explicitly is both more reliable and easier to debug.

---

## Things I'd fix next

- **Orphaned locks after a crash.** If the process dies between the locks being written and
  the booking row being created, those locks survive with nothing attached. A TTL index or a
  sweeper would clear them.
- **Search does a collection scan.** Case-insensitive unanchored regex can't use an index.
  Fine at this size; a `$text` index is the fix, at the cost of losing partial-word matching
  (`"vidya"` would stop finding Vidyanagar).
- **No payments.** Bookings are reservations.
- **The Atlas user has `atlasAdmin`.** Should be `readWrite` on one database.
- **Postgres deserved more thought.** Exclusion constraints over ranges map to this problem
  more directly than anything MongoDB offers. The block-and-unique-index approach works, but
  it's a workaround for a constraint the database can't express natively.

## Note on the sample data

Venue names and localities are real Hubballi–Dharwad sports venues, taken from public
directory listings. **Prices, phone numbers, timings, amenities and photos are invented** —
none of it is real business information, and it shouldn't be treated as such.
