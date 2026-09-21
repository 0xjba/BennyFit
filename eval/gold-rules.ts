/**
 * Facts derived from a stored household the same way by the answer key and by the
 * simulated person answering follow-ups, so the two can never disagree.
 *
 * Kept apart from scripts/generate-gold.ts because importing that file runs it.
 */

/** The disability-or-benefits half of the Veterans Pension gate. */
export function vaDisabledOrOnBenefits(f: {
  categorical: string;
  hasElderlyOrDisabled: boolean;
  claimantAge: number;
}): boolean {
  // The stored facts carry no separate disability flag. Under 60 the elderly-or-disabled
  // flag can only mean disabled, and SSI counts outright. A veteran of 60 to 64 is not
  // assumed to be disabled.
  return f.categorical === 'ssi' || (f.hasElderlyOrDisabled && f.claimantAge < 60);
}
