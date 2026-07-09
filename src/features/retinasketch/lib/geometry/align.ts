/**
 * Alignement d'une rétinographie sur le template, à partir de deux repères
 * anatomiques (fovéa + papille) exprimés en pixels de l'image source.
 *
 * Deux correspondances de points déterminent une **similitude** unique
 * (translation + rotation + échelle uniforme, sans réflexion). On résout
 * directement les paramètres du transform CSS appliqué par `BackgroundImage`
 * (`scale`, `rotationDeg`, `offsetXMm`, `offsetYMm`).
 *
 * Astuce : le résultat est indépendant de la taille d'affichage (le `pxPerMm`
 * se simplifie). On travaille donc en espace mm avec `pxPerMm = 1` et l'origine
 * sur la fovéa — ce qui rend la fonction pure et testable (Vitest).
 */
import { TEMPLATE } from "./template";

export interface Landmarks {
  /** Fovéa en pixels de l'image source. */
  foveaPx: { x: number; y: number };
  /** Centre de la papille en pixels de l'image source. */
  discPx: { x: number; y: number };
}

export interface Alignment {
  scale: number;
  rotationDeg: number;
  offsetXMm: number;
  offsetYMm: number;
}

export function solveAlignment(
  marks: Landmarks,
  natW: number,
  natH: number,
  mirror: 1 | -1,
  opts?: { maxRotationDeg?: number },
): Alignment {
  // Échelle de base « cover » : mm par pixel source lorsque l'image remplit la
  // boîte du cercle rétinien (cf. object-fit:cover dans BackgroundImage). Le
  // résultat du calage est invariant au choix de base (similitude à 2 points),
  // mais doit rester cohérent avec le rendu → on utilise la même base « cover ».
  const k0 = Math.max(
    (2 * TEMPLATE.retina.halfWidthMm) / natW,
    (2 * TEMPLATE.retina.halfHeightMm) / natH,
  );
  const cImgX = natW / 2;
  const cImgY = natH / 2;

  // Position de base (mm, origine fovéa) des deux repères, avant transform.
  const qF = { x: (marks.foveaPx.x - cImgX) * k0, y: (marks.foveaPx.y - cImgY) * k0 };
  const qD = { x: (marks.discPx.x - cImgX) * k0, y: (marks.discPx.y - cImgY) * k0 };

  // Vecteur fovéa→papille observé (image) et cible (template, miroir inclus).
  const v = { x: qD.x - qF.x, y: qD.y - qF.y };
  const w = { x: TEMPLATE.disc.x * mirror, y: TEMPLATE.disc.y };

  const vLen = Math.hypot(v.x, v.y) || 1e-6;
  const scale = Math.max(0.2, Math.min(5, Math.hypot(w.x, w.y) / vLen));

  // Rotation, normalisée dans [-π, π], puis éventuellement bornée (calage auto :
  // les rétinographies sont quasi droites → on évite les rotations aberrantes
  // dues à une détection de fovéa imparfaite).
  let theta = Math.atan2(w.y, w.x) - Math.atan2(v.y, v.x);
  theta = Math.atan2(Math.sin(theta), Math.cos(theta));
  if (opts?.maxRotationDeg != null) {
    const lim = (opts.maxRotationDeg * Math.PI) / 180;
    theta = Math.max(-lim, Math.min(lim, theta));
  }

  // La fovéa cible est l'origine (0,0) ⇒ t = -scale·Rot(θ)·qF (recalculé avec θ borné).
  const cos = Math.cos(theta);
  const sin = Math.sin(theta);
  const offsetXMm = -scale * (cos * qF.x - sin * qF.y);
  const offsetYMm = -scale * (sin * qF.x + cos * qF.y);

  return { scale, rotationDeg: (theta * 180) / Math.PI, offsetXMm, offsetYMm };
}
