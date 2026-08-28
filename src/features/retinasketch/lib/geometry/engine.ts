import { TEMPLATE, FOVEA_BANDS } from "./template";
import { attrContextForKind } from "../types";
import type {
  AnatomicalZone,
  DerivedAttributes,
  RetinoAttributes,
  EtdrsSector,
  Quadrant,
  FoveaBand,
  ImageKind,
  TransverseZone,
  TopoZone,
} from "../types";

/** Moteur géométrique pur : aucune dépendance UI. Calcule les 4 niveaux. */

type P = { x: number; y: number };

/**
 * Repères de la nomenclature 8 zones (mm modèle). Par défaut = constantes du
 * TEMPLATE ; peuvent être remplacés par les centres détectés (macula/papille)
 * pour que le découpage colle à l'anatomie réelle de l'image.
 */
export interface TopoRefs {
  fovea: P;
  disc: P;
  maculaRmm: number;
}
export const DEFAULT_TOPO_REFS: TopoRefs = {
  fovea: TEMPLATE.fovea,
  disc: TEMPLATE.disc,
  maculaRmm: TEMPLATE.maculaRadiusMm,
};

const dist = (a: P, b: P) => Math.hypot(a.x - b.x, a.y - b.y);

/** Échantillonne une courbe de Bézier quadratique en N segments. */
function bezier(p0: P, p1: P, p2: P, n = 40): P[] {
  const out: P[] = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n;
    const u = 1 - t;
    out.push({
      x: u * u * p0.x + 2 * u * t * p1.x + t * t * p2.x,
      y: u * u * p0.y + 2 * u * t * p1.y + t * t * p2.y,
    });
  }
  return out;
}

/** Arcades vasculaires temporales (sup. et inf.), en mm, convention OD. */
export function arcadePolylines(): P[][] {
  const d = TEMPLATE.disc;
  const sup = bezier(d, { x: 1, y: -7.5 }, { x: 13.5, y: -3 });
  const inf = bezier(d, { x: 1, y: 7.5 }, { x: 13.5, y: 3 });
  return [sup, inf];
}

function distanceToPolyline(pt: P, line: P[]): number {
  let min = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const len2 = dx * dx + dy * dy || 1e-9;
    let t = ((pt.x - a.x) * dx + (pt.y - a.y) * dy) / len2;
    t = Math.max(0, Math.min(1, t));
    const proj = { x: a.x + t * dx, y: a.y + t * dy };
    min = Math.min(min, dist(pt, proj));
  }
  return min;
}

const ARCADES = arcadePolylines();

/** Niveau 1 — Zone anatomique (ordre de précédence clinique). */
function anatomicalZone(pt: P, dFovea: number, dDisc: number): AnatomicalZone {
  if (dDisc <= TEMPLATE.discRadiusMm) return "Papille";
  if (dDisc <= TEMPLATE.peripapillaryRadiusMm) return "Zone péripapillaire";
  if (dFovea <= TEMPLATE.foveaRadiusMm) return "Fovéa";
  if (dFovea <= TEMPLATE.maculaRadiusMm) return "Macula";
  if (dFovea > TEMPLATE.posteriorPoleRadiusMm) return "Périphérie";
  return pt.x >= TEMPLATE.disc.x ? "Rétine temporale" : "Rétine nasale";
}

/**
 * Nomenclature 8 zones (fovéa/macula + papille). Espace mm modèle OD :
 * +x = temporal, -x = nasal ; +y = inférieur, -y = supérieur ; papille en `disc`.
 *
 * Règles :
 *  - Priorité : lésion dans le cercle maculaire → MS (sup.) ou MI (inf.).
 *  - Supérieur/inférieur : côté de la lésion par rapport à la ligne fovéa–papille.
 *  - Colonnes : temporal à l'axe fovéal (x≥0) = *-M temporal ; entre axes fovéal
 *    et papillaire (disc.x ≤ x < 0) = N*-M ; nasal à l'axe papillaire (x < disc.x)
 *    = N*-P.
 */
function topoZone(pt: P, refs: TopoRefs): TopoZone {
  const { fovea, disc, maculaRmm } = refs;
  // Vecteur fovéa→papille et fovéa→point (repères translatés sur la fovéa).
  const dx = disc.x - fovea.x;
  const dy = disc.y - fovea.y;
  const px = pt.x - fovea.x;
  const py = pt.y - fovea.y;
  // Côté supérieur = signe du produit vectoriel (F→P) × (F→pt) ; >0 ⇒ au-dessus.
  const superior = dx * py - dy * px > 0;

  // Priorité absolue : cercle maculaire (centré fovéa).
  if (Math.hypot(px, py) <= maculaRmm) return superior ? "MS" : "MI";

  if (pt.x >= fovea.x) return superior ? "TS-M" : "TI-M"; // temporal à l'axe fovéal
  if (pt.x >= disc.x) return superior ? "NS-M" : "NI-M"; // entre fovéa et papille
  return superior ? "NS-P" : "NI-P"; // nasal à l'axe papillaire
}

/** Niveau 2 — Quadrant (centré papille, convention OD). */
function quadrant(pt: P): Quadrant {
  const temporal = pt.x >= TEMPLATE.disc.x;
  const superior = pt.y < TEMPLATE.disc.y;
  if (temporal) return superior ? "TS" : "TI";
  return superior ? "NS" : "NI";
}

/** Niveau 3 — Bande de distance à la fovéa. */
function foveaBand(dFovea: number): FoveaBand {
  return FOVEA_BANDS.find((b) => dFovea <= b.maxMm)!.band;
}

/** Niveau 4 — Secteur ETDRS (centré fovéa, sectorisation diagonale à 45°). */
function etdrsSector(pt: P, dFovea: number): EtdrsSector | null {
  const { inner, middle, outer } = TEMPLATE.etdrs;
  if (dFovea <= inner) return "C";
  if (dFovea > outer) return null;

  // Angle : +x temporal, +y inférieur. Secteurs séparés par les diagonales.
  const ang = Math.atan2(pt.y, pt.x); // [-π, π]
  const deg = (ang * 180) / Math.PI;
  let dir: "S" | "I" | "N" | "T";
  if (deg >= -45 && deg < 45) dir = "T"; // temporal
  else if (deg >= 45 && deg < 135) dir = "I"; // inférieur
  else if (deg >= -135 && deg < -45) dir = "S"; // supérieur
  else dir = "N"; // nasal

  const ring = dFovea <= middle ? "I" : "E"; // interne / externe
  return `${dir}${ring}` as EtdrsSector;
}

/** Attributs pour une rétinographie de face (référentiel fovéa/papille/ETDRS). */
function computeRetinoAttributes(centroidMm: P, refs: TopoRefs): RetinoAttributes {
  const dFovea = dist(centroidMm, TEMPLATE.fovea);
  const dDisc = dist(centroidMm, TEMPLATE.disc);
  const dVessel = Math.min(
    ...ARCADES.map((line) => distanceToPolyline(centroidMm, line)),
  );

  return {
    context: "retino",
    topoZone: topoZone(centroidMm, refs),
    anatomicalZone: anatomicalZone(centroidMm, dFovea, dDisc),
    quadrant: quadrant(centroidMm),
    foveaBand: foveaBand(dFovea),
    distanceToFoveaMm: round(dFovea),
    etdrsSector: etdrsSector(centroidMm, dFovea),
    distanceToDiscMm: round(dDisc),
    vascularRelation: {
      nearVessel: dVessel <= TEMPLATE.vesselProximityMm,
      distanceToVesselMm: round(dVessel),
    },
  };
}

/**
 * Zone transverse d'une coupe, selon l'éloignement du centre (rapporté à la
 * demi-largeur du champ). Les coupes rect/carré sont centrées à l'origine.
 */
function transverseZone(relative: number): TransverseZone {
  if (relative < 0.34) return "centrale";
  if (relative < 0.67) return "paracentrale";
  return "périphérique";
}

/**
 * Calcule les attributs dérivés d'une lésion selon le type de coupe.
 * - `retino` : référentiel anatomique de face (inchangé).
 * - `bscan`/`cornea` : coupe transversale (position + couche à saisir).
 * - `octa`/`enface` : secteur en-face simple.
 * La couche (`layer`) n'est pas géométrique : elle reste `null` ici et sera
 * renseignée manuellement (ou par un modèle IA ultérieur).
 */
export function computeAttributes(
  centroidMm: P,
  kind: ImageKind,
  refs: TopoRefs = DEFAULT_TOPO_REFS,
): DerivedAttributes {
  const R = TEMPLATE.retina.halfWidthMm;
  switch (attrContextForKind(kind)) {
    case "retino":
      return computeRetinoAttributes(centroidMm, refs);
    case "bscan":
      // Coupe rectangulaire : position le long de la coupe (axe x).
      return {
        context: "bscan",
        transverseZone: transverseZone(Math.abs(centroidMm.x) / R),
        layer: null,
      };
    case "cornea":
      return {
        context: "cornea",
        transverseZone: transverseZone(Math.abs(centroidMm.x) / R),
        layer: null,
      };
    case "octa":
      // Champ carré centré macula : nomenclature 8 zones + éloignement radial.
      return {
        context: "octa",
        topoZone: topoZone(centroidMm, refs),
        transverseZone: transverseZone(Math.hypot(centroidMm.x, centroidMm.y) / R),
      };
  }
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Centroïde et aire (mm²) d'une géométrie (point, polygone ou flèche). */
export function geometryMetrics(
  kind: "point" | "polygon" | "arrow",
  points: number[],
): { centroid: P; areaMm2: number | null } {
  if (kind === "point") {
    return { centroid: { x: points[0], y: points[1] }, areaMm2: null };
  }
  if (kind === "arrow") {
    // Point de référence clinique = la POINTE de la flèche (ce qu'elle désigne),
    // et non son milieu : c'est la localisation utile pour la structuration.
    return { centroid: { x: points[2], y: points[3] }, areaMm2: null };
  }
  const n = points.length / 2;
  let area = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < n; i++) {
    const x0 = points[2 * i];
    const y0 = points[2 * i + 1];
    const x1 = points[2 * ((i + 1) % n)];
    const y1 = points[2 * ((i + 1) % n) + 1];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cx += (x0 + x1) * cross;
    cy += (y0 + y1) * cross;
  }
  area /= 2;
  if (Math.abs(area) < 1e-6) {
    // dégénéré : moyenne simple
    let mx = 0;
    let my = 0;
    for (let i = 0; i < n; i++) {
      mx += points[2 * i];
      my += points[2 * i + 1];
    }
    return { centroid: { x: mx / n, y: my / n }, areaMm2: 0 };
  }
  return {
    centroid: { x: cx / (6 * area), y: cy / (6 * area) },
    areaMm2: round(Math.abs(area)),
  };
}

/** Lissage / débruitage d'un tracé main levée (suppression des points trop proches). */
export function smoothFreeform(points: number[], minDistMm = 0.35): number[] {
  if (points.length < 6) return points;
  const out: number[] = [points[0], points[1]];
  for (let i = 1; i < points.length / 2; i++) {
    const x = points[2 * i];
    const y = points[2 * i + 1];
    const lx = out[out.length - 2];
    const ly = out[out.length - 1];
    if (Math.hypot(x - lx, y - ly) >= minDistMm) out.push(x, y);
  }
  return out.length >= 6 ? out : points;
}
