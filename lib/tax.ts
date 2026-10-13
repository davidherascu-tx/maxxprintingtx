/** Houston, TX combined sales tax rate. Staff can change it in Admin → Settings. */
export const DEFAULT_TAX_RATE = 0.0825;

/** e.g. 0.0825 → "8.25%" */
export const taxLabel = (rate: number) => `${+(rate * 100).toFixed(3)}%`;

/** Sales tax on a subtotal, rounded to the cent. */
export const calcTax = (subtotal: number, rate: number) => Math.round(subtotal * rate * 100) / 100;
