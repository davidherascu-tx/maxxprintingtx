import {
  Anton,
  Archivo_Black,
  Bebas_Neue,
  Inter,
  Lobster,
  Montserrat,
  Oswald,
  Pacifico,
  Permanent_Marker,
  Playfair_Display,
  Roboto_Slab,
} from "next/font/google";

const anton = Anton({ weight: "400", subsets: ["latin"], display: "swap" });
const archivo = Archivo_Black({ weight: "400", subsets: ["latin"], display: "swap" });
const bebas = Bebas_Neue({ weight: "400", subsets: ["latin"], display: "swap" });
const inter = Inter({ subsets: ["latin"], display: "swap" });
const lobster = Lobster({ weight: "400", subsets: ["latin"], display: "swap" });
const montserrat = Montserrat({ subsets: ["latin"], display: "swap" });
const oswald = Oswald({ subsets: ["latin"], display: "swap" });
const pacifico = Pacifico({ weight: "400", subsets: ["latin"], display: "swap" });
const marker = Permanent_Marker({ weight: "400", subsets: ["latin"], display: "swap" });
const playfair = Playfair_Display({ subsets: ["latin"], display: "swap" });
const robotoSlab = Roboto_Slab({ subsets: ["latin"], display: "swap" });

const all = [
  ["Montserrat", montserrat],
  ["Anton", anton],
  ["Bebas Neue", bebas],
  ["Archivo Black", archivo],
  ["Oswald", oswald],
  ["Inter", inter],
  ["Roboto Slab", robotoSlab],
  ["Playfair Display", playfair],
  ["Pacifico", pacifico],
  ["Lobster", lobster],
  ["Permanent Marker", marker],
] as const;

export type DesignFont = { name: string; family: string };

export const designFonts: DesignFont[] = all.map(([name, f]) => ({ name, family: f.style.fontFamily }));

/** Class names that make sure every font's @font-face is on the page. */
export const designFontClasses = all.map(([, f]) => f.className);
