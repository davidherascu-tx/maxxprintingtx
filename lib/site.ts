/** Business details as defined in code. Staff can change them in Admin → Settings (see `getSettings`). */
export const defaultSite = {
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

export type Site = typeof defaultSite;

export const fullAddress = (site: Site) =>
  `${site.address.line1}${site.address.line2 ? ` ${site.address.line2}` : ""}, ${site.address.city}, ${site.address.state} ${site.address.zip}`;

export const mapsUrl = (site: Site) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(fullAddress(site))}`;
