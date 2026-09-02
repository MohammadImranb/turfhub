// SAMPLE DATA - venue names and localities are real Hubballi-Dharwad sports venues
// (sourced from public directory listings), but prices, phone numbers, timings,
// amenities and photos below are INVENTED placeholders for this student project.
// Do not present them as real business information.

const sampleTurfs = [
  {
    title: "Daksha Arena ROC",
    description:
      "Multi-sport arena in Railway Colony with a full size box cricket cage and a 7-a-side football turf. Floodlit till late, popular for weekend corporate matches.",
    image: {
      filename: "turfimage",
      url: "https://images.unsplash.com/photo-1529900748604-07564a03e7f6?auto=format&fit=crop&w=800&q=60",
    },
    price: 1100,
    location: "Railway Colony",
    category: "Box Cricket",
    surface: "Artificial grass",
    openMin: 360,
    closeMin: 1380,
    amenities: ["Floodlights", "Parking", "Washroom", "Changing room", "Drinking water", "Seating"],
    phone: "+91 90000 10001",
  },
  {
    title: "Sports Parc Hubballi",
    description:
      "Spacious football and box cricket ground near Oxford College. Two turfs side by side, so larger groups can split into teams.",
    image: {
      filename: "turfimage",
      url: "https://images.unsplash.com/photo-1522778119026-d647f0596c20?auto=format&fit=crop&w=800&q=60",
    },
    price: 1000,
    location: "Gokul Road",
    category: "Football 7s",
    surface: "Artificial grass",
    openMin: 360,
    closeMin: 1350,
    amenities: ["Floodlights", "Parking", "Washroom", "Drinking water", "Equipment rental"],
    phone: "+91 90000 10002",
  },
  {
    title: "Sports Junction",
    description:
      "Well known Shirur Park venue offering cricket, football and badminton under one roof. Good lighting and covered seating for spectators.",
    image: {
      filename: "turfimage",
      url: "https://images.unsplash.com/photo-1540747913346-19e32dc3e97e?auto=format&fit=crop&w=800&q=60",
    },
    price: 900,
    location: "Shirur Park",
    category: "Multi-sport",
    surface: "Synthetic",
    openMin: 330,
    closeMin: 1380,
    amenities: ["Floodlights", "Parking", "Washroom", "Changing room", "Seating", "First aid"],
    phone: "+91 90000 10003",
  },
  {
    title: "Outfield Sports",
    description:
      "Compact football and volleyball turf in Laxmi Colony. Ideal for 5-a-side evening games, walking distance from the main road.",
    image: {
      filename: "turfimage",
      url: "https://images.unsplash.com/photo-1551958219-acbc608c6377?auto=format&fit=crop&w=800&q=60",
    },
    price: 750,
    location: "Laxmi Colony",
    category: "Football 5s",
    surface: "Artificial grass",
    openMin: 360,
    closeMin: 1320,
    amenities: ["Floodlights", "Washroom", "Drinking water"],
    phone: "+91 90000 10004",
  },
  {
    title: "Chaitanya Sports Foundation",
    description:
      "Training focused ground in Vidyanagar with proper cricket nets and coaching available. Bookable by the hour outside academy hours.",
    image: {
      filename: "turfimage",
      url: "https://images.unsplash.com/photo-1593766827228-8737b4534aa6?auto=format&fit=crop&w=800&q=60",
    },
    price: 600,
    location: "Vidyanagar",
    category: "Cricket Nets",
    surface: "Artificial grass",
    openMin: 330,
    closeMin: 1260,
    amenities: ["Parking", "Washroom", "Drinking water", "Equipment rental", "First aid"],
    phone: "+91 90000 10005",
  },
  {
    title: "Sports Arena Manjunath Nagar",
    description:
      "Neighbourhood box cricket and football turf with a tall net enclosure. Slots fill fast after 7pm on weekdays.",
    image: {
      filename: "turfimage",
      url: "https://images.unsplash.com/photo-1487466365202-1afdb86c764e?auto=format&fit=crop&w=800&q=60",
    },
    price: 850,
    location: "Manjunath Nagar",
    category: "Box Cricket",
    surface: "Artificial grass",
    openMin: 360,
    closeMin: 1380,
    amenities: ["Floodlights", "Parking", "Washroom", "Seating"],
    phone: "+91 90000 10006",
  },
  {
    title: "Playisto Arena",
    description:
      "Indoor wooden court in Vidyanagar for badminton, with four marked courts and shuttle rental at the desk.",
    image: {
      filename: "turfimage",
      url: "https://images.unsplash.com/photo-1521587760476-6c12a4b040da?auto=format&fit=crop&w=800&q=60",
    },
    price: 400,
    location: "Vidyanagar",
    category: "Badminton",
    surface: "Wooden",
    openMin: 360,
    closeMin: 1350,
    amenities: ["Washroom", "Changing room", "Drinking water", "Equipment rental"],
    phone: "+91 90000 10007",
  },
  {
    title: "Pro-Ace Badminton Academy",
    description:
      "Academy courts in Vidya Nagar available for casual booking during off-peak hours. Wooden flooring and proper court lighting.",
    image: {
      filename: "turfimage",
      url: "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=800&q=60",
    },
    price: 450,
    location: "Vidyanagar",
    category: "Badminton",
    surface: "Wooden",
    openMin: 330,
    closeMin: 1320,
    amenities: ["Washroom", "Changing room", "Drinking water", "First aid"],
    phone: "+91 90000 10008",
  },
  {
    title: "Excellent Sports Academy",
    description:
      "Kallur Layout court complex used for badminton coaching and open play. Quiet mornings, busy evenings.",
    image: {
      filename: "turfimage",
      url: "https://images.unsplash.com/photo-1613918431703-aa50889e3be9?auto=format&fit=crop&w=800&q=60",
    },
    price: 380,
    location: "Kallur Layout",
    category: "Badminton",
    surface: "Synthetic",
    openMin: 330,
    closeMin: 1290,
    amenities: ["Parking", "Washroom", "Drinking water"],
    phone: "+91 90000 10009",
  },
  {
    title: "Shambhavi's Badminton Arena",
    description:
      "Friendly local arena in Manjunath Nagar with two courts. Monthly passes available for regulars.",
    image: {
      filename: "turfimage",
      url: "https://images.unsplash.com/photo-1599391398131-cd12dfc6c24e?auto=format&fit=crop&w=800&q=60",
    },
    price: 350,
    location: "Manjunath Nagar",
    category: "Badminton",
    surface: "Synthetic",
    openMin: 360,
    closeMin: 1320,
    amenities: ["Washroom", "Drinking water", "Seating"],
    phone: "+91 90000 10010",
  },
  {
    title: "Decathlon Hubli Court",
    description:
      "Basketball and table tennis space on Gokul Road. Ample parking and easy access from the highway side.",
    image: {
      filename: "turfimage",
      url: "https://images.unsplash.com/photo-1546519638-68e109498ffc?auto=format&fit=crop&w=800&q=60",
    },
    price: 500,
    location: "Gokul Road",
    category: "Basketball",
    surface: "Concrete",
    openMin: 420,
    closeMin: 1290,
    amenities: ["Parking", "Washroom", "Drinking water", "Seating"],
    phone: "+91 90000 10011",
  },
  {
    title: "Yeligar Sports Arena",
    description:
      "Dharwad venue with pickleball courts and a box cricket cage. Worth the drive for the newer surface.",
    image: {
      filename: "turfimage",
      url: "https://images.unsplash.com/photo-1554068865-24cecd4e34b8?auto=format&fit=crop&w=800&q=60",
    },
    price: 700,
    location: "Dharwad",
    category: "Pickleball",
    surface: "Synthetic",
    openMin: 360,
    closeMin: 1350,
    amenities: ["Floodlights", "Parking", "Washroom", "Drinking water", "Equipment rental"],
    phone: "+91 90000 10012",
  },
  {
    title: "Keshwapur Turf Club",
    description:
      "Five-a-side football turf tucked behind the main Keshwapur market. Cash and UPI accepted at the gate.",
    image: {
      filename: "turfimage",
      url: "https://images.unsplash.com/photo-1508098682722-e99c43a406b2?auto=format&fit=crop&w=800&q=60",
    },
    price: 800,
    location: "Keshwapur",
    category: "Football 5s",
    surface: "Artificial grass",
    openMin: 360,
    closeMin: 1380,
    amenities: ["Floodlights", "Washroom", "Drinking water", "Seating"],
    phone: "+91 90000 10013",
  },
  {
    title: "Navanagar Sports Hub",
    description:
      "Newer multi-sport ground in Navanagar. Volleyball court by day, floodlit football turf in the evening.",
    image: {
      filename: "turfimage",
      url: "https://images.unsplash.com/photo-1577471488278-16eec37ffcc2?auto=format&fit=crop&w=800&q=60",
    },
    price: 650,
    location: "Navanagar",
    category: "Volleyball",
    surface: "Artificial grass",
    openMin: 360,
    closeMin: 1350,
    amenities: ["Floodlights", "Parking", "Washroom", "Drinking water", "First aid"],
    phone: "+91 90000 10014",
  },
  {
    title: "Unkal Lakeside Turf",
    description:
      "Football turf near Unkal Lake with an open feel and evening breeze. Popular for tournaments on Sundays.",
    image: {
      filename: "turfimage",
      url: "https://images.unsplash.com/photo-1459865264687-595d652de67e?auto=format&fit=crop&w=800&q=60",
    },
    price: 1200,
    location: "Unkal",
    category: "Football 7s",
    surface: "Artificial grass",
    openMin: 360,
    closeMin: 1380,
    amenities: ["Floodlights", "Parking", "Washroom", "Changing room", "Seating", "First aid"],
    phone: "+91 90000 10015",
  },
];

module.exports = { data: sampleTurfs };
