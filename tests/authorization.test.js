// Authorization tests: can one user modify another user's data?
//
// These matter more than they look. Hiding an Edit button in the template is not
// security - anyone can POST to the endpoint directly. Every test here bypasses the
// UI entirely and posts straight to the route, which is exactly what an attacker does.

const { startDb, stopDb, clearDb, ensureIndexes } = require("./setup.js");

let request, app, Listing, User, Review;

beforeAll(async () => {
  await startDb();
  request = require("supertest");
  app = require("../app.js");
  Listing = require("../models/listing.js");
  User = require("../models/user.js");
  Review = require("../models/reviews.js");
  await ensureIndexes();
});

afterAll(async () => {
  await stopDb();
});

async function signUp(username) {
  const agent = request.agent(app);
  await agent.post("/signup").type("form").send({
    username,
    email: `${username}@test.local`,
    password: "testpass123"
  });
  const user = await User.findOne({ username });
  return { agent, user };
}

const validListing = {
  "listing[title]": "Owned Turf",
  "listing[description]": "belongs to owner",
  "listing[price]": "900",
  "listing[location]": "Unkal",
  "listing[category]": "Tennis"
};

describe("authentication", () => {
  beforeEach(async () => {
    await clearDb();
    await ensureIndexes();
  });

  test("logged-out users cannot create a listing", async () => {
    const res = await request(app).post("/listings").type("form").send(validListing);
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/login");
    expect(await Listing.countDocuments()).toBe(0);
  });

  test("logged-out users cannot reach protected pages", async () => {
    for (const path of ["/listings/new", "/bookings", "/bookings/manage"]) {
      const res = await request(app).get(path);
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/login");
    }
  });

  test("passwords are hashed, and the hash is not exposed by default", async () => {
    await signUp("hashcheck");

    // passport-local-mongoose marks hash and salt as select:false, so an ordinary
    // query cannot leak them into a response even if someone renders the user object
    const viaMongoose = (await User.findOne({ username: "hashcheck" })).toObject();
    expect(viaMongoose.hash).toBeUndefined();
    expect(viaMongoose.salt).toBeUndefined();

    // but they ARE stored, and the plaintext password is not
    const mongoose = require("mongoose");
    const raw = await mongoose.connection.db
      .collection("users")
      .findOne({ username: "hashcheck" });
    expect(raw.hash).toBeDefined();
    expect(raw.salt).toBeDefined();
    expect(raw.password).toBeUndefined();
    expect(String(raw.hash)).not.toContain("testpass123");
  });

  test("duplicate usernames are rejected", async () => {
    await signUp("twice");
    const agent = request.agent(app);
    await agent.post("/signup").type("form").send({
      username: "twice", email: "other@test.local", password: "testpass123"
    });
    expect(await User.countDocuments({ username: "twice" })).toBe(1);
  });
});

describe("authorization - one user must not touch another's data", () => {
  beforeEach(async () => {
    await clearDb();
    await ensureIndexes();
  });

  test("a non-owner cannot edit, update or delete someone else's listing", async () => {
    const owner = await signUp("realowner");
    const attacker = await signUp("attacker");

    await owner.agent.post("/listings").type("form").send(validListing);
    const listing = await Listing.findOne({ title: "Owned Turf" });
    expect(listing).not.toBeNull();

    // GET the edit form
    const edit = await attacker.agent.get(`/listings/${listing._id}/edit`);
    expect(edit.status).toBe(302);

    // PUT an update
    await attacker.agent
      .post(`/listings/${listing._id}?_method=PUT`)
      .type("form")
      .send({ ...validListing, "listing[title]": "PWNED" });

    // DELETE
    await attacker.agent.post(`/listings/${listing._id}?_method=DELETE`).type("form").send({});

    // the database is the source of truth, not the HTTP status
    const after = await Listing.findById(listing._id);
    expect(after).not.toBeNull();
    expect(after.title).toBe("Owned Turf");
    expect(await Listing.countDocuments({ title: "PWNED" })).toBe(0);
  });

  test("the real owner CAN edit and delete their own listing", async () => {
    const owner = await signUp("genuineowner");
    await owner.agent.post("/listings").type("form").send(validListing);
    const listing = await Listing.findOne({ title: "Owned Turf" });

    const edit = await owner.agent.get(`/listings/${listing._id}/edit`);
    expect(edit.status).toBe(200);

    await owner.agent
      .post(`/listings/${listing._id}?_method=PUT`)
      .type("form")
      .send({ ...validListing, "listing[title]": "Renamed By Owner" });
    expect((await Listing.findById(listing._id)).title).toBe("Renamed By Owner");

    await owner.agent.post(`/listings/${listing._id}?_method=DELETE`).type("form").send({});
    expect(await Listing.findById(listing._id)).toBeNull();
  });

  test("a non-author cannot delete someone else's review", async () => {
    const owner = await signUp("turfowner2");
    const reviewer = await signUp("reviewer");
    const attacker = await signUp("reviewattacker");

    await owner.agent.post("/listings").type("form").send(validListing);
    const listing = await Listing.findOne({ title: "Owned Turf" });

    await reviewer.agent.post(`/listings/${listing._id}/reviews`).type("form")
      .send({ "review[rating]": "5", "review[comment]": "great turf" });
    const review = await Review.findOne({ comment: "great turf" });
    expect(review).not.toBeNull();

    await attacker.agent
      .post(`/listings/${listing._id}/reviews/${review._id}?_method=DELETE`)
      .type("form").send({});

    expect(await Review.findById(review._id)).not.toBeNull();
  });

  test("an owner cannot book their own turf", async () => {
    const owner = await signUp("selfbooker");
    await owner.agent.post("/listings").type("form").send(validListing);
    const listing = await Listing.findOne({ title: "Owned Turf" });

    await owner.agent.post(`/listings/${listing._id}/bookings`).type("form")
      .send({ date: "2099-06-06", startMin: 600, endMin: 660 });

    const Booking = require("../models/booking.js");
    const SlotLock = require("../models/slotLock.js");
    expect(await Booking.countDocuments()).toBe(0);
    // and the rejected attempt must not leave a slot reserved
    expect(await SlotLock.countDocuments()).toBe(0);
  });
});
