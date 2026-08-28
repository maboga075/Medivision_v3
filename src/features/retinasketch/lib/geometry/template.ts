/**
 * Template rétinien — constantes anatomiques en millimètres.
 * Origine (0,0) = fovéa. Modèle interne (convention OD) :
 *   +x = temporal, -x = nasal ; +y = inférieur, -y = supérieur.
 *
 * Affichage (convention clinicien, cf. `mirrorFor`) :
 *   - OD : papille à DROITE, fovéa à GAUCHE (mirror = -1)
 *   - OG : papille à GAUCHE, fovéa à DROITE (mirror = +1)
 * Le moteur reste en mm modèle ; seul le rendu est miroité.
 */
export const TEMPLATE = {
  fovea: { x: 0, y: 0 },
  // Distance disque-fovéa réelle (≈ 4,76 mm). Papille légèrement supérieure (y<0).
  disc: { x: -4.76, y: -0.34 },

  foveaRadiusMm: 0.5, // fovéa ≈ 1 mm de diamètre
  maculaRadiusMm: 2.6, // macula
  discRadiusMm: 0.85, // papille ≈ 1,7 mm de diamètre
  peripapillaryRadiusMm: 1.5, // anneau péripapillaire
  posteriorPoleRadiusMm: 6, // au-delà → périphérie

  // Grille ETDRS (rayons en mm)
  etdrs: { inner: 0.5, middle: 1.5, outer: 3.0 },

  // Champ d'une rétinographie standard ~50° : cercle de ≈ 16 mm de diamètre
  // (≈ 0,3 mm/° × 50°), parfaitement circulaire (halfWidth = halfHeight) → champ
  // rétinien net, clip circulaire propre et masque du cadre noir à l'impression.
  retina: { halfWidthMm: 8, halfHeightMm: 8 },

  // Distance de proximité vasculaire (relation aux arcades)
  vesselProximityMm: 0.6,
} as const;

/**
 * Sens du miroir d'affichage selon la latéralité (convention clinicien) :
 * OD → -1 (papille à droite), OG/OS → +1 (papille à gauche).
 */
export function mirrorFor(laterality: "OD" | "OG" | "OS"): 1 | -1 {
  return laterality === "OD" ? -1 : 1;
}

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
  mirror: 1 | -1; // -1 pour OD (papille à droite), +1 pour OG
}

export function createViewport(
  width: number,
  height: number,
  mirror: 1 | -1,
): Viewport {
  // On cale l'échelle pour que le cercle rétinien occupe presque tout l'espace
  // dédié à l'œil (marge minimale propre pour le trait de contour).
  const margin = 0.98;
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

/**
 * Vrai si le point (mm, origine fovéa) est dans le cercle rétinien (champ ~50°).
 * Empêche la création d'une lésion hors du cadre. `tol` (mm) tolère un léger débord.
 */
export function isInsideRetina(xMm: number, yMm: number, tol = 0.2): boolean {
  const r = TEMPLATE.retina.halfWidthMm + tol;
  return xMm * xMm + yMm * yMm <= r * r;
}

/**
 * Centre et rayon (px écran) du cercle du champ rétinien — source unique pour le
 * contour, le clip circulaire de l'image de fond et le masque d'impression.
 */
export function fieldCircle(vp: Viewport) {
  return { cx: vp.cx, cy: vp.cy, r: TEMPLATE.retina.halfWidthMm * vp.pxPerMm };
}

/**
 * Demi-extents (mm) du champ de travail selon la géométrie du slot (Lot B) :
 * - `circle` (rétino, OCT-A) : cercle de rayon halfWidthMm.
 * - `square` (OCT en-face)   : carré de côté 2·halfWidthMm.
 * - `rect`   (B-scan)        : rectangle large 2:1 (demi-hauteur réduite).
 */
export function fieldHalfExtentsMm(
  geometry: import("../types").ImageGeometry,
  /** Dimensions custom (mm) — template libre à cadre redimensionnable. */
  override?: { halfW: number; halfH: number } | null,
): {
  halfW: number;
  halfH: number;
} {
  const R = TEMPLATE.retina.halfWidthMm;
  if (override) return override;
  if (geometry === "rect") return { halfW: R, halfH: R * 0.5 }; // B-scan 2:1
  if (geometry === "rect43") return { halfW: R, halfH: R * 0.75 }; // suivi épaisseurs 4:3
  if (geometry === "free") return { halfW: R * 0.9, halfH: R * 0.6 }; // défaut template libre
  return { halfW: R, halfH: R }; // circle & square
}

/**
 * Forme du champ en coordonnées écran (px), pour le contour, le clip du canvas
 * et le clip de l'image de fond. Union discriminée par `kind`.
 */
export function fieldShape(
  geometry: import("../types").ImageGeometry,
  vp: Viewport,
  override?: { halfW: number; halfH: number } | null,
) {
  if (geometry === "circle") {
    return { kind: "circle" as const, cx: vp.cx, cy: vp.cy, r: TEMPLATE.retina.halfWidthMm * vp.pxPerMm };
  }
  const { halfW, halfH } = fieldHalfExtentsMm(geometry, override);
  return {
    kind: "rect" as const,
    cx: vp.cx,
    cy: vp.cy,
    halfW: halfW * vp.pxPerMm,
    halfH: halfH * vp.pxPerMm,
  };
}
