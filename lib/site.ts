export const site = {
  name: "Maxx Marketing Agency",
  legalName: "Maxx Marketing Agency LLC",
  tagline: "Printing • Marketing • Custom Products",
  address: {
    line1: "12655 Woodforest Blvd",
    line2: "Ste 100",
    city: "Houston",
    state: "TX",
    zip: "77015",
  },
  phone: "18328608817",
  phoneDisplay: "(832) 860-8817",
  email: "maxxmktg23@gmail.com",
  url: "https://maxxprintingtx.com",
};

export const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
  `${site.address.line1} ${site.address.line2}, ${site.address.city}, ${site.address.state} ${site.address.zip}`,
)}`;
