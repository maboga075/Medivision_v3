/**
 * Anatomie spécifique à chaque rétinographie : papille (disque optique) + macula,
 * détectées sur l'image uploadée. Couche **DÉTECTION** de la fonctionnalité (pure,
 * sans état ni UI) — clairement séparée de l'affichage, de l'édition et de la
 * sauvegarde (cf. `store.anatomy`, `RetinaStage` (affichage), `AnatomyOverlay`).
 *
 * Coordonnées en **pixels de l'image source** (invariantes au transform
 * d'affichage) → la même anatomie suit l'image quand on la déplace/zoome, et le
 * format est prêt pour une future IA de Computer Vision (même interface
 * `AnatomyDetector`, qui remplacera l'heuristique sans toucher au reste).
 */
import type { Laterality } from "@/features/retinasketch/lib/types";
import { TEMPLATE } from "@/features/retinasketch/lib/geometry/template";
import { detectLandmarks } from "./detect";

/** Disque optique (papille) — ellipse en pixels image (rx = ry pour un cercle). */
export interface DiscShape {
  cx: number;
  cy: number;
  rx: number;
  ry: number;
  /**
   * Contour réel de la papille détouré par l'IA (segmenteur disc/cup), fermé, en
   * pixels image `[x,y,...]`. Absent → on affiche l'ellipse (cx/cy/rx/ry) en repli.
   * Quand présent, c'est lui qui est affiché ; cx/cy/rx/ry restent l'ellipse
   * englobante (poignées d'édition + dérivation de la macula).
   */
  polygon?: number[];
  /** Contour de l'excavation (cup) détouré par l'IA, px image. Optionnel. */
  cupPolygon?: number[];
}

/** Macula — cercle indicatif en pixels image (centre = fovéa estimée). */
export interface MaculaShape {
  cx: number;
  cy: number;
  r: number;
}

/**
 * Anatomie d'un œil (proposition détectée puis corrigée par le clinicien).
 * `disc` et `macula` sont INDÉPENDANTS : détecter la papille n'affiche pas la
 * macula (et inversement). Au moins l'un des deux est présent quand l'objet existe.
 */
export interface EyeAnatomy {
  disc?: DiscShape;
  macula?: MaculaShape;
  /** Provenance : heuristique navigateur, correction manuelle, ou IA (futur). */
  source: "heuristic" | "manual" | "ai";
  /** Dimensions de l'image au moment de la détection (cohérence des pixels). */
  natW: number;
  natH: number;
  updatedAt: string; // ISO 8601
}

/**
 * Contrat d'un détecteur d'anatomie. L'implémentation actuelle est heuristique
 * (luminance) ; une future IA de segmentation (U-Net / CNN) implémentera la même
 * interface et sera injectée à la place, sans changer l'affichage/édition/store.
 */
export interface AnatomyDetector {
  detect(img: HTMLImageElement, laterality: Laterality): EyeAnatomy | null;
}

/**
 * Détection heuristique :
 *  - **Papille** : région la plus brillante (réutilise `detectLandmarks`) ; rayon
 *    estimé à la taille anatomique moyenne (rapport disque/champ), corrigeable.
 *  - **Macula** : dérivée de la papille + orientation OD/OG + distance anatomique
 *    moyenne (fovéa ≈ 4,76 mm de la papille). Si la fovéa détectée (zone sombre)
 *    est cohérente avec l'estimation, on l'utilise (plus précise).
 */
export function detectAnatomy(
  img: HTMLImageElement,
  laterality: Laterality,
): EyeAnatomy | null {
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  if (!natW || !natH) return null;

  const marks = detectLandmarks(img);
  if (!marks) return null;
  const disc = marks.discPx;

  // Le champ (cover) remplit la plus petite dimension de l'image.
  const fieldDiaPx = Math.min(natW, natH);
  const fieldMm = 2 * TEMPLATE.retina.halfWidthMm; // diamètre du champ (mm)
  const pxPerMm = fieldDiaPx / fieldMm; // px image / mm anatomique

  const discRadiusPx = TEMPLATE.discRadiusMm * pxPerMm;
  const maculaRadiusPx = TEMPLATE.maculaRadiusMm * pxPerMm;

  // Ajuste la taille/position de la papille à l'intensité réelle (région brillante
  // autour du centre détecté) → ellipse mesurée, pas un cercle fixe. Bornée :
  // jamais aberrante. Repli sur le cercle anatomique si l'ajustement échoue.
  const fit = fitDiscEllipse(img, disc, discRadiusPx);
  const discShape: DiscShape = fit
    ? { cx: fit.cx, cy: fit.cy, rx: fit.rx, ry: fit.ry }
    : { cx: disc.x, cy: disc.y, rx: discRadiusPx, ry: discRadiusPx };

  // Vecteur papille → fovéa (modèle OD), miroité selon la latéralité, à la
  // distance anatomique moyenne. OD : fovéa à gauche de la papille ; OG : à droite.
  const vx = TEMPLATE.fovea.x - TEMPLATE.disc.x; // +4,76 (modèle OD)
  const vy = TEMPLATE.fovea.y - TEMPLATE.disc.y; // +0,34
  const vlen = Math.hypot(vx, vy) || 1;
  const dirX = laterality === "OD" ? -1 : 1; // image non miroitée
  const distPx = vlen * pxPerMm;
  let macX = disc.x + (dirX * Math.abs(vx)) / vlen * distPx;
  let macY = disc.y + (vy / vlen) * distPx;

  // Si la fovéa détectée (zone sombre) est proche de l'estimation géométrique,
  // on la préfère (plus précise) ; sinon on garde l'estimation (plus robuste).
  const fov = marks.foveaPx;
  if (Math.hypot(fov.x - macX, fov.y - macY) < 0.6 * distPx) {
    macX = fov.x;
    macY = fov.y;
  }

  // Bornage : la macula ne doit jamais sortir du champ rétinien (cercle centré,
  // rayon = fieldDiaPx/2). Sans ce garde, une papille mal détectée pouvait
  // projeter la macula hors champ. On la ramène sur le bord si nécessaire.
  {
    const fcx = natW / 2;
    const fcy = natH / 2;
    const maxR = Math.max(0, fieldDiaPx / 2 - maculaRadiusPx);
    const dx = macX - fcx;
    const dy = macY - fcy;
    const d = Math.hypot(dx, dy);
    if (d > maxR && d > 1e-6) {
      macX = fcx + (dx / d) * maxR;
      macY = fcy + (dy / d) * maxR;
    }
  }

  return {
    disc: discShape,
    macula: { cx: macX, cy: macY, r: maculaRadiusPx },
    source: "heuristic",
    natW,
    natH,
    updatedAt: new Date().toISOString(),
  };
}

/**
 * Ajuste la papille à l'intensité, autour du centre détecté : moments de la
 * région brillante (pâleur du disque) dans une fenêtre locale → demi-axes
 * (rx, ry). Résultat **borné** par rapport à l'estimation anatomique (jamais
 * aberrant, contrairement à une segmentation libre) et entièrement corrigeable.
 * Pur (canvas hors écran) ; renvoie `null` si rien d'exploitable (→ repli cercle).
 */
function fitDiscEllipse(
  img: HTMLImageElement,
  center: { x: number; y: number },
  estRadiusPx: number,
): { cx: number; cy: number; rx: number; ry: number } | null {
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  if (!natW || !natH) return null;

  const DW = 400; // résolution de travail (compromis précision / coût)
  const sc = Math.min(1, DW / natW);
  const w = Math.max(1, Math.round(natW * sc));
  const h = Math.max(1, Math.round(natH * sc));
  const cnv = document.createElement("canvas");
  cnv.width = w;
  cnv.height = h;
  const ctx = cnv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  let data: Uint8ClampedArray;
  try {
    data = ctx.getImageData(0, 0, w, h).data;
  } catch {
    return null;
  }

  const cx = center.x * sc;
  const cy = center.y * sc;
  const R = Math.max(4, estRadiusPx * sc);
  const win = 2.2 * R; // fenêtre d'analyse autour de la papille
  const x0 = Math.max(0, Math.floor(cx - win));
  const x1 = Math.min(w - 1, Math.ceil(cx + win));
  const y0 = Math.max(0, Math.floor(cy - win));
  const y1 = Math.min(h - 1, Math.ceil(cy + win));
  const lumAt = (x: number, y: number) => {
    const i = (y * w + x) * 4;
    return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  };

  let maxL = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (Math.hypot(x - cx, y - cy) > win) continue;
      const l = lumAt(x, y);
      if (l > maxL) maxL = l;
    }
  if (maxL < 30) return null;
  const t = 0.74 * maxL; // seuil « pâleur du disque » relatif au max local

  let sx = 0;
  let sy = 0;
  let sxx = 0;
  let syy = 0;
  let n = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (Math.hypot(x - cx, y - cy) > win) continue;
      const l = lumAt(x, y);
      if (l < t || l < 30) continue;
      sx += x;
      sy += y;
      sxx += x * x;
      syy += y * y;
      n++;
    }
  if (n < 12) return null;

  const mcx = sx / n;
  const mcy = sy / n;
  const varx = Math.max(0, sxx / n - mcx * mcx);
  const vary = Math.max(0, syy / n - mcy * mcy);
  const K = 2.1; // demi-axe ≈ K·σ couvre l'étendue de la pâleur
  const clampR = (r: number) => Math.min(Math.max(r, 0.45 * R), 2.4 * R);
  const rx = clampR(K * Math.sqrt(varx));
  const ry = clampR(K * Math.sqrt(vary));
  // Centre raffiné seulement s'il reste proche du centre détecté (robustesse).
  let ox = cx;
  let oy = cy;
  if (Math.hypot(mcx - cx, mcy - cy) < 0.8 * R) {
    ox = mcx;
    oy = mcy;
  }
  return { cx: ox / sc, cy: oy / sc, rx: rx / sc, ry: ry / sc };
}

/** Détecteur heuristique par défaut (remplaçable par une IA via la même interface). */
export const heuristicAnatomyDetector: AnatomyDetector = { detect: detectAnatomy };

/**
 * Convertit une ellipse (cx/cy/rx/ry, px image) en polygone fermé de `n` sommets.
 * Sert de repli pour l'édition de FORME quand aucun contour IA n'est disponible :
 * le clinicien obtient toujours des poignées par sommet pour corriger la papille.
 */
export function ellipseToPolygon(disc: DiscShape, n = 20): number[] {
  const out: number[] = [];
  for (let i = 0; i < n; i++) {
    const t = (i / n) * Math.PI * 2;
    out.push(disc.cx + disc.rx * Math.cos(t), disc.cy + disc.ry * Math.sin(t));
  }
  return out;
}

/** Boîte englobante d'un polygone `[x,y,...]` → ellipse (cx/cy/rx/ry). */
export function polygonBBox(poly: number[]): { cx: number; cy: number; rx: number; ry: number } {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < poly.length; i += 2) {
    const x = poly[i], y = poly[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, rx: (maxX - minX) / 2, ry: (maxY - minY) / 2 };
}
