// The headline test: prove that concurrent requests cannot double-book a slot.
//
// This is the whole reason the SlotLock collection exists. A naive implementation
// ("is the slot free? yes -> insert the booking") passes every sequential test and
// still double-books in production, because two requests can both read "free"
// before either one writes. Only a concurrent test catches that.

const { startDb, stopDb, clearDb, ensureIndexes } = require("./setup.js");

let request, app, Listing, User, Booking, SlotLock;

beforeAll(async () => {
  await startDb();
  // required AFTER startDb so app.js picks up the in-memory connection string
  request = require("supertest");
  app = require("../app.js");
  Listing = require("../models/listing.js");
  User = require("../models/user.js");
  Booking = require("../models/booking.js");
  SlotLock = require("../models/slotLock.js");
  await ensureIndexes();
}, 120000);

afterAll(async () => {
  await stopDb();
});

// Logs a user in and returns the session cookie, so the booking routes see them
// as authenticated. Booking requires login, so every test needs this.
async function signUp(username) {
  const agent = request.agent(app);
  await agent.post("/signup").type("form").send({
    username,
    email: `${username}@test.local`,
    password: "testpass123"
  });
  return agent;
}

async function makeTurf(ownerId) {
  return Listing.create({
    title: "Concurrency Test Turf",
    description: "for tests",
    price: 1000,
    location: "Unkal",
    category: "Football 5s",
    openMin: 360,
    closeMin: 1380,
    owner: ownerId
  });
}

describe("booking concurrency", () => {
  beforeEach(async () => {
    await clearDb();
    await ensureIndexes();
  });

  test("N simultaneous requests for the SAME slot produce exactly one booking", async () => {
    const owner = await User.create({ username: "owner1", email: "o1@test.local" });
    const turf = await makeTurf(owner._id);

    // 10 different users all going for 18:00-19:00 on the same day
    const agents = await Promise.all(
      Array.from({ length: 10 }, (_, i) => signUp(`racer${i}`))
    );

    // Fire them together. Promise.all starts every request before any resolves,
    // which is what creates the race.
    await Promise.all(
      agents.map(a =>
        a.post(`/listings/${turf._id}/bookings`).type("form").send({
          date: "2099-01-01",
          startMin: 1080, // 18:00
          endMin: 1140    // 19:00
        })
      )
    );

    const confirmed = await Booking.countDocuments({ status: "confirmed" });
    const locks = await SlotLock.countDocuments({ date: "2099-01-01" });

    expect(confirmed).toBe(1);
    // 18:00-19:00 spans two 30-minute blocks
    expect(locks).toBe(2);
  }, 60000);

  test("partially overlapping concurrent requests leave no orphaned locks", async () => {
    const owner = await User.create({ username: "owner2", email: "o2@test.local" });
    const turf = await makeTurf(owner._id);

    const a = await signUp("overlapA");
    const b = await signUp("overlapB");

    // A wants 12:00-13:00 (blocks 24,25), B wants 12:30-13:30 (blocks 25,26).
    // They collide on block 25 only. Whoever loses must roll back the block it
    // did manage to insert, or that slot stays reserved by a booking that
    // never existed.
    await Promise.all([
      ...Array.from({ length: 4 }, () =>
        a.post(`/listings/${turf._id}/bookings`).type("form")
          .send({ date: "2099-02-02", startMin: 720, endMin: 780 })),
      ...Array.from({ length: 4 }, () =>
        b.post(`/listings/${turf._id}/bookings`).type("form")
          .send({ date: "2099-02-02", startMin: 750, endMin: 810 }))
    ]);

    const bookings = await Booking.find({ status: "confirmed" });
    const locks = await SlotLock.find({ date: "2099-02-02" });

    expect(bookings).toHaveLength(1);

    // every lock must belong to the surviving booking - none left dangling
    const orphans = locks.filter(l => !l.booking);
    expect(orphans).toHaveLength(0);
    expect(locks).toHaveLength(2);

    // and no two confirmed bookings may overlap in time
    for (let i = 0; i < bookings.length; i++) {
      for (let j = i + 1; j < bookings.length; j++) {
        const overlap =
          bookings[i].startMin < bookings[j].endMin &&
          bookings[i].endMin > bookings[j].startMin;
        expect(overlap).toBe(false);
      }
    }
  }, 60000);

  test("adjacent slots do NOT collide", async () => {
    const owner = await User.create({ username: "owner3", email: "o3@test.local" });
    const turf = await makeTurf(owner._id);
    const user = await signUp("adjacent");

    // back-to-back bookings share a boundary but no block, so both must succeed
    await user.post(`/listings/${turf._id}/bookings`).type("form")
      .send({ date: "2099-03-03", startMin: 600, endMin: 660 }); // 10:00-11:00
    await user.post(`/listings/${turf._id}/bookings`).type("form")
      .send({ date: "2099-03-03", startMin: 660, endMin: 720 }); // 11:00-12:00

    expect(await Booking.countDocuments({ status: "confirmed" })).toBe(2);
    expect(await SlotLock.countDocuments({ date: "2099-03-03" })).toBe(4);
  }, 60000);

  test("cancelling frees the slot for someone else", async () => {
    const owner = await User.create({ username: "owner4", email: "o4@test.local" });
    const turf = await makeTurf(owner._id);
    const first = await signUp("firstBooker");
    const second = await signUp("secondBooker");

    await first.post(`/listings/${turf._id}/bookings`).type("form")
      .send({ date: "2099-04-04", startMin: 600, endMin: 660 });

    const booking = await Booking.findOne({ status: "confirmed" });
    expect(booking).not.toBeNull();

    // the same slot must be refused while it is held
    await second.post(`/listings/${turf._id}/bookings`).type("form")
      .send({ date: "2099-04-04", startMin: 600, endMin: 660 });
    expect(await Booking.countDocuments({ status: "confirmed" })).toBe(1);

    // cancel, then it becomes available again
    await first.post(`/bookings/${booking._id}?_method=DELETE`).type("form").send({});
    expect(await SlotLock.countDocuments({ date: "2099-04-04" })).toBe(0);

    await second.post(`/listings/${turf._id}/bookings`).type("form")
      .send({ date: "2099-04-04", startMin: 600, endMin: 660 });
    expect(await Booking.countDocuments({ status: "confirmed" })).toBe(1);
  }, 60000);
});
