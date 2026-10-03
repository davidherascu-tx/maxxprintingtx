/** Houston, TX combined sales tax rate. */
export const TAX_RATE = 0.0825;
export const TAX_LABEL = "8.25%";

/** Sales tax on a subtotal, rounded to the cent. */
export const calcTax = (subtotal: number) => Math.round(subtotal * TAX_RATE * 100) / 100;
