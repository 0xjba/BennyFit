/**
 * Money is carried as integer cents everywhere inside the engine.
 *
 * Federal benefit arithmetic names its rounding steps explicitly, and they do not
 * agree with each other: SNAP rounds a household's 30% contribution up to the next
 * dollar (7 CFR 273.10(e)(2)(ii)(A)(1)) while carrying net income itself to the cent,
 * and rounds income calculations half-up (7 CFR 273.10(e)(1)(ii)(A)). Representing
 * dollars as floating point loses those distinctions in the third decimal place, so
 * nothing here is a float until it reaches the display layer.
 */

export type Cents = number;

export function dollars(amount: number): Cents {
  return Math.round(amount * 100);
}

export function toDollars(cents: Cents): number {
  return cents / 100;
}

/** Round to whole dollars, down at 1-49 cents and up at 50-99. 7 CFR 273.10(e)(1)(ii)(A). */
export function roundHalfUpToDollar(cents: Cents): Cents {
  return Math.floor((cents + 50) / 100) * 100;
}

/** Round up to the next whole dollar. Used for the SNAP 30% contribution. */
export function ceilToDollar(cents: Cents): Cents {
  return Math.ceil(cents / 100) * 100;
}

/** Round down to the previous whole dollar. */
export function floorToDollar(cents: Cents): Cents {
  return Math.floor(cents / 100) * 100;
}

/** A percentage of an amount, exact to the cent, rounded half-up at the cent. */
export function percentOf(cents: Cents, rate: number): Cents {
  return Math.round(cents * rate);
}

export function formatDollars(cents: Cents): string {
  const negative = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100).toLocaleString('en-US');
  const frac = abs % 100;
  const body = frac === 0 ? `$${whole}` : `$${whole}.${String(frac).padStart(2, '0')}`;
  return negative ? `-${body}` : body;
}

/** Whole-dollar display, for figures a program states in whole dollars. */
export function formatWholeDollars(cents: Cents): string {
  return `$${Math.round(cents / 100).toLocaleString('en-US')}`;
}
