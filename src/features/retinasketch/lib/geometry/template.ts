/**
 * Template rétinien — constantes anatomiques en millimètres.
 * Origine (0,0) = fovéa. Convention œil droit (OD) :
 *   +x = temporal (vers la droite à l'écran), -x = nasal
 *   +y = inférieur (vers le bas),            -y = supérieur
 * Valeurs schématiques inspirées de l'anatomie réelle (distance disque-fovéa
 * ≈ 4,76 mm, diamètre papillaire ≈ 1,8 mm, macula ≈ 5,5 mm, grille ETDRS 1/3/6).
 */
export const TEMPLATE = {
  fovea: { x: 0, y: 0 },
  // Distance disque-fovéa volontairement étirée pour un espace clair
  // entre la macula et l'anneau péripapillaire (lisibilité schématique).
  disc: { x: -5.7, y: -0.34 },

  foveaRadiusMm: 0.5, // fovéa ≈ 1 mm de diamètre
  maculaRadiusMm: 2.6, // macula
  discRadiusMm: 0.85, // papille ≈ 1,7 mm de diamètre
  peripapillaryRadiusMm: 1.5, // anneau péripapillaire
  posteriorPoleRadiusMm: 6, // au-delà → périphérie

  // Grille ETDRS (rayons en mm)
  etdrs: { inner: 0.5, middle: 1.5, outer: 3.0 },

  // Contour rétinien schématique (demi-axes de l'ellipse, en mm)
  retina: { halfWidthMm: 15.5, halfHeightMm: 13 },

  // Distance de proximité vasculaire (relation aux arcades)
  vesselProximityMm: 0.6,
} as const;

export const FOVEA_BANDS: { band: import("../types").FoveaBand; maxMm: number }[] =
  [
    { band: "0-1mm", maxMm: 1 },
    { band: "1-3mm", maxMm: 3 },
    { band: "3-6mm", maxMm: 6 },
    { band: "6-12mm", maxMm: 12 },
    { band: ">12mm", maxMm: Infinity },
  ];

/** Viewport : transforme l'espace mm en pixels écran. */
export interface Viewport {
  cx: number; // origine fovéa en px
  cy: number;
  pxPerMm: number;
  mirror: 1 | -1; // -1 pour OG (œil gauche)
}

export function createViewport(
  width: number,
  height: number,
  mirror: 1 | -1,
): Viewport {
  // On cale l'échelle pour que le contour rétinien tienne avec une marge.
  const margin = 0.92;
  const scaleX = (width / 2) * margin / TEMPLATE.retina.halfWidthMm;
  const scaleY = (height / 2) * margin / TEMPLATE.retina.halfHeightMm;
  const pxPerMm = Math.min(scaleX, scaleY);
  return { cx: width / 2, cy: height / 2, pxPerMm, mirror };
}

export function toScreen(mx: number, my: number, vp: Viewport) {
  return { x: vp.cx + mx * vp.pxPerMm * vp.mirror, y: vp.cy + my * vp.pxPerMm };
}

export function toModel(sx: number, sy: number, vp: Viewport) {
  return {
    x: ((sx - vp.cx) / vp.pxPerMm) * vp.mirror,
    y: (sy - vp.cy) / vp.pxPerMm,
  };
}
