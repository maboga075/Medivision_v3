/**
 * Helpers de saisie du rapport C/D vertical.
 *
 * Le C/D vertical est toujours < 1 : seul « 0, » est sous-entendu et l'on ne
 * saisit que les décimales. La valeur reste stockée au format « 0.x » pour le
 * reste du pipeline (compte rendu, payload IA).
 */

export const CUP_DISC_MAX_DECIMALS = 2;

/** Décimales à afficher dans le champ (partie après « 0, »). */
export function cupDiscDecimals(stored: string): string {
  if (!stored) return '';
  const dot = stored.replace(',', '.').indexOf('.');
  const digits = dot === -1 ? '' : stored.replace(',', '.').slice(dot + 1);
  return digits.replace(/\D/g, '').slice(0, CUP_DISC_MAX_DECIMALS);
}

/** Reconstruit la valeur stockée « 0.x » à partir des décimales saisies. */
export function decimalsToCupDisc(input: string): string {
  const digits = input.replace(/\D/g, '').slice(0, CUP_DISC_MAX_DECIMALS);
  return digits ? `0.${digits}` : '';
}
