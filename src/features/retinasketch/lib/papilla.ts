/**
 * Qualificatifs cliniques rapides de la papille, proposés dans le template
 * rétinographie de RetinaSketch. Ils deviennent des observations « papille »
 * dans le compte rendu (fusionnés avec la saisie du formulaire à la fermeture).
 */
export const PAPILLA_QUALIFIERS = [
  "Papille pâle",
  "Papille surélevée",
  "Papille à bords flous",
] as const;

export type PapillaQualifier = (typeof PAPILLA_QUALIFIERS)[number];

/** Fusionne une sélection de qualificatifs dans une liste d'observations papille
 *  existante : retire les anciens qualificatifs connus, ajoute la sélection. */
export function mergePapillaQualifiers(existing: string[], selected: string[]): string[] {
  const withoutQualifiers = existing.filter((o) => !PAPILLA_QUALIFIERS.includes(o as PapillaQualifier));
  return [...new Set([...withoutQualifiers, ...selected])];
}
