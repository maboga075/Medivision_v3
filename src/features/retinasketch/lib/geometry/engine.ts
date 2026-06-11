import { TEMPLATE, FOVEA_BANDS } from "./template";
import type {
  AnatomicalZone,
  DerivedAttributes,
  EtdrsSector,
  Quadrant,
  FoveaBand,
} from "../types";

/** Moteur géométrique pur : aucune dépendance UI. Calcule les 4 niveaux. */

type P = { x: number; y: number };

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

/** Calcule l'ensemble des attributs dérivés pour un point (mm, convention OD). */
export function computeAttributes(centroidMm: P): DerivedAttributes {
  const dFovea = dist(centroidMm, TEMPLATE.fovea);
  const dDisc = dist(centroidMm, TEMPLATE.disc);
  const dVessel = Math.min(
    ...ARCADES.map((line) => distanceToPolyline(centroidMm, line)),
  );

  return {
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

const round = (n: number) => Math.round(n * 100) / 100;

/** Centroïde et aire (mm²) d'une géométrie (point ou polygone). */
export function geometryMetrics(
  kind: "point" | "polygon",
  points: number[],
): { centroid: P; areaMm2: number | null } {
  if (kind === "point") {
    return { centroid: { x: points[0], y: points[1] }, areaMm2: null };
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
