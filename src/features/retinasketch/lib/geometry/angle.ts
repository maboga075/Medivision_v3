/**
 * Mesure de l'angle iridocornéen (template angle IC) + classification de Shaffer.
 *
 * L'outil repose sur 3 points : l'apex (éperon scléral) et 2 points le long des
 * deux parois de l'angle. L'angle mesuré est l'angle entre les deux bras au
 * sommet ; la classe de Shaffer en est déduite (toujours surchargée à la main).
 */

export type Pt = [number, number];

/** Angle (degrés) entre les vecteurs apex→a et apex→b, dans [0, 180]. */
export function computeAngleDeg(apex: Pt, a: Pt, b: Pt): number {
  const v1: Pt = [a[0] - apex[0], a[1] - apex[1]];
  const v2: Pt = [b[0] - apex[0], b[1] - apex[1]];
  const n1 = Math.hypot(v1[0], v1[1]);
  const n2 = Math.hypot(v2[0], v2[1]);
  if (n1 < 1e-6 || n2 < 1e-6) return 0;
  const cos = (v1[0] * v2[0] + v1[1] * v2[1]) / (n1 * n2);
  const clamped = Math.max(-1, Math.min(1, cos));
  return Math.round((Math.acos(clamped) * 180) / Math.PI);
}

/** Grade de Shaffer (0–4) selon l'ouverture angulaire (degrés). */
export function shafferFromAngle(deg: number): 0 | 1 | 2 | 3 | 4 {
  if (deg >= 35) return 4; // angle grand ouvert (35–45°)
  if (deg >= 20) return 3; // angle ouvert (20–35°)
  if (deg >= 10) return 2; // angle modérément étroit (~20°)
  if (deg > 0) return 1; // angle très étroit (~10°)
  return 0; // angle fermé
}

/** Libellé clinique d'un grade de Shaffer. */
export const SHAFFER_LABEL: Record<0 | 1 | 2 | 3 | 4, string> = {
  0: "Fermé",
  1: "Très étroit",
  2: "Modérément étroit",
  3: "Ouvert",
  4: "Grand ouvert",
};
