// EDIT THIS FILE: it holds all the shop's details. Nothing else needs changing for routine updates.
// Leave a value empty ("" or []) to hide that item on the page.
// NOTE: everything below is placeholder text. Replace it with your real info before launch.
window.SHOP = {
  tagline: "Trading cards, singles, and a place to play.",
  dayBlurb: "Browse singles, sealed product, and supplies.",
  nightBlurb: "Bring a deck and play. Check the schedule below.",

  // Games shown as tags under the hero
  games: ["Magic: The Gathering", "Pokémon", "Yu-Gi-Oh!", "Disney Lorcana"],

  // [day, hours] pairs, shown in this order. Day names must be full English names.
  hours: [
    ["Monday", "Closed"],
    ["Tuesday", "11 am – 7 pm"],
    ["Wednesday", "11 am – 7 pm"],
    ["Thursday", "11 am – 7 pm"],
    ["Friday", "11 am – 10 pm"],
    ["Saturday", "11 am – 10 pm"],
    ["Sunday", "12 – 6 pm"]
  ],

  events: [
    { name: "Friday night tournament", when: "Fridays, 6 pm", note: "Check in at the counter." },
    { name: "Casual play", when: "Saturdays, 3 pm", note: "Free to join." }
  ],

  address: ["123 Main St", "City, ST 00000"],
  mapUrl: "",      // e.g. a Google Maps link to the shop
  phone: "",       // e.g. "555-555-5555"
  email: "",       // e.g. "info@nightanddaycards.com"
  discordUrl: "",  // Discord invite link
  shopUrl: ""      // Square Online store or checkout link
};
