// EDIT THIS FILE: it holds all the shop's details. Nothing else needs changing for routine updates.
// Leave a value empty ("" or []) to hide that item on the page.
// NOTE: everything below is placeholder text. Replace it with your real info before launch.
window.SHOP = {
  tagline: "Trading cards, singles, and a place to play.",
  dayBlurb: "Browse singles, sealed product, and supplies.",
  nightBlurb: "Bring a deck and play. Check the schedule below.",

  // Games shown as tags under the hero
  games: ["Pokémon", "Magic: The Gathering", "Riftbound", "Yu-Gi-Oh!", "Disney Lorcana", "One Piece", "Flesh and Blood", "Star Wars Unlimited", "Dragon Ball"],

  // REGULAR HOURS: [day, hours] pairs, shown in this order. Day names must be full English names.
  // Hours posted on the hidden /update-hours page replace these until you click
  // "Go back to regular hours" there.
  hoursUrl: "https://ndc-checkout.nightanddaycards.workers.dev/hours",
  hours: [
    ["Monday", "10 am – 5 pm"],
    ["Tuesday", "10 am – 5 pm"],
    ["Wednesday", "10 am – 5 pm"],
    ["Thursday", "Closed"],
    ["Friday", "10 am – 5 pm"],
    ["Saturday", "11 am – 7 pm"],
    ["Sunday", "Closed"]
  ],

  events: [
    { name: "Wednesday night Riftbound", when: "Wednesdays, 6 pm", note: "Check in at the counter." }
  ],

  address: ["1704 Mileground Rd Ste c", "Morgantown, WV 26505"],
  mapUrl: "https://www.google.com/maps?sca_esv=908680befa061847&udm&fvr=1&pvq=Cg0vZy8xMXAxX3MxYjd4IhkKE25pZ2h0IGFuZCBkYXkgY2FyZHMQAhgDiQHeLFaoqsHOsA&lqi=ChNuaWdodCBhbmQgZGF5IGNhcmRzSPzRgvyHtYCACFojEAAQARACEAMYABgCGAMiE25pZ2h0IGFuZCBkYXkgY2FyZHOSAQVzdG9yZeABAA&vet=10CAAQoqAOahcKEwiIkefPvJeYAxUAAAAAHQAAAAAQDw..i&cs=0&um=1&ie=UTF-8&fb=1&gl=us&sa=X&ftid=0x88357b8ca39a754d:0xb0cec1aaa8562cde",      // e.g. a Google Maps link to the shop
  phone: "+13042784191",       // e.g. "555-555-5555"
  email: "nightanddaycards@gmail.com",       // e.g. "info@nightanddaycards.com"
  discordUrl: "https://discord.gg/UamsswJ4Q7",  // Discord invite link
  // Facebook page. Its public events are embedded in the "By night" section.
  facebookUrl: "https://www.facebook.com/profile.php?id=61594657520152",
  instagramUrl: "https://www.instagram.com/nightanddaycards/",
  shopUrl: "",      // Square Online store or checkout link

  // ONLINE ORDERING ON/OFF SWITCH. true = customers can add to cart and check out.
  // false = cart and "Add to cart" buttons are hidden; the cart page shows the
  // message below and saved carts are kept for when ordering is back on.
  onlineOrdering: true,
  orderingPausedMessage: "Online ordering is paused right now. Give us a call or stop by and we'll help you out.",
  // The checkout worker's URL (see worker/checkout-worker.js). Ordering stays off while empty.
  checkoutUrl: "https://ndc-checkout.nightanddaycards.workers.dev/",
  // Shown on the cart and order-complete pages
  pickupNote: "Pickup only. We'll hold paid orders for 7 days."
};
