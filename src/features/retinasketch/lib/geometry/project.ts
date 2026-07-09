/**
 * Conversions de coordonnées entre l'écran, les pixels de l'image de fond et
 * l'espace modèle (mm). Pur, réutilisable (SAM, alignement…).
 *
 * Reprend la même transformation que `BackgroundImage` : l'image est ajustée
 * « cover » à la boîte du cercle rétinien puis transformée par translate(offset)·
 * scale·rotate autour du centre, le tout sous le zoom/pan global de la vue.
 */
import { TEMPLATE, createViewport, toModel, toScreen, type Viewport } from "./template";

/** mm par pixel source, base « cover » — indépendant de la résolution d'affichage. */
function coverMmPerPx(natW: number, natH: number): number {
  return Math.max(
    (2 * TEMPLATE.retina.halfWidthMm) / natW,
    (2 * TEMPLATE.retina.halfHeightMm) / natH,
  );
}

/** Longueur (px image) → mm (échelle « cover »). */
export function imagePxLenToMm(len: number, natW: number, natH: number): number {
  return len * coverMmPerPx(natW, natH);
}

/**
 * Pixel image → mm « domicile » (image au transform identité). Destiné à un rendu
 * Konva SOUS le `imageFrame`, qui réapplique ensuite le transform de l'image →
 * l'anatomie suit l'image (zoom/pan/rotation) comme les lésions.
 */
export function imagePxToHomeMm(
  px: number,
  py: number,
  natW: number,
  natH: number,
  vp: Viewport,
): { x: number; y: number } {
  const kMm = coverMmPerPx(natW, natH);
  return { x: (px - natW / 2) * kMm * vp.mirror, y: (py - natH / 2) * kMm };
}

export interface BgTransform {
  natW: number;
  natH: number;
  offsetXMm: number;
  offsetYMm: number;
  scale: number;
  rotationDeg: number;
}

export interface ViewTransform {
  scale: number;
  x: number;
  y: number;
}

/** Facteur d'échelle « cover » (px écran / px source) : l'image remplit la boîte. */
function coverK(vp: Viewport, natW: number, natH: number) {
  const boxW = 2 * TEMPLATE.retina.halfWidthMm * vp.pxPerMm;
  const boxH = 2 * TEMPLATE.retina.halfHeightMm * vp.pxPerMm;
  return Math.max(boxW / natW, boxH / natH);
}

/** Clic écran (px conteneur) → pixel de l'image source. */
export function screenToImagePx(
  sx: number,
  sy: number,
  bg: BgTransform,
  vp: Viewport,
  view: ViewTransform,
): { x: number; y: number } {
  const k = coverK(vp, bg.natW, bg.natH);
  const tx = bg.offsetXMm * vp.pxPerMm;
  const ty = bg.offsetYMm * vp.pxPerMm;
  const th = (bg.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  const s = bg.scale || 1;
  const dvx = (sx - view.x) / view.scale; // défait le zoom/pan global
  const dvy = (sy - view.y) / view.scale;
  const ux = dvx - vp.cx - tx;
  const uy = dvy - vp.cy - ty;
  const dx = (cos * ux + sin * uy) / s; // (1/s)·Rot(-θ)
  const dy = (-sin * ux + cos * uy) / s;
  return { x: bg.natW / 2 + dx / k, y: bg.natH / 2 + dy / k };
}

/** Pixel de l'image source → coordonnées modèle (mm, origine fovéa). */
export function imagePxToModelMm(
  px: number,
  py: number,
  bg: BgTransform,
  vp: Viewport,
): { x: number; y: number } {
  const k = coverK(vp, bg.natW, bg.natH);
  const tx = bg.offsetXMm * vp.pxPerMm;
  const ty = bg.offsetYMm * vp.pxPerMm;
  const th = (bg.rotationDeg * Math.PI) / 180;
  const cos = Math.cos(th);
  const sin = Math.sin(th);
  const s = bg.scale || 1;
  const rx = (px - bg.natW / 2) * k;
  const ry = (py - bg.natH / 2) * k;
  const designX = vp.cx + s * (cos * rx - sin * ry) + tx;
  const designY = vp.cy + s * (sin * rx + cos * ry) + ty;
  return toModel(designX, designY, vp);
}

/** Construit le viewport (design, sans zoom) pour une taille de scène + latéralité. */
export function designViewport(width: number, height: number, mirror: 1 | -1) {
  return createViewport(width, height, mirror);
}

/**
 * Pixel image → position écran (px conteneur), transform de l'image inclus.
 * Sert à positionner les poignées d'édition de l'anatomie (overlay HTML).
 */
export function imagePxToScreen(
  px: number,
  py: number,
  bg: BgTransform,
  vp: Viewport,
  view: ViewTransform,
): { x: number; y: number } {
  const m = imagePxToModelMm(px, py, bg, vp);
  const s = toScreen(m.x, m.y, vp);
  return { x: view.x + view.scale * s.x, y: view.y + view.scale * s.y };
}
