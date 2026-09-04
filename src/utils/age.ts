/**
 * Calcul d'âge précis (années révolues) à partir d'une date de naissance ISO
 * (`AAAA-MM-JJ`). Remplace l'ancienne approximation `getUTCFullYear()-1970` qui
 * pouvait se tromper d'un an autour de l'anniversaire.
 */
export function calculateAge(dob: string): number {
  if (!dob) return 0;
  const birth = new Date(dob);
  if (Number.isNaN(birth.getTime())) return 0;
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const monthDiff = now.getMonth() - birth.getMonth();
  // Anniversaire pas encore passé cette année → on retire une année.
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birth.getDate())) {
    age--;
  }
  return Math.max(0, age);
}
