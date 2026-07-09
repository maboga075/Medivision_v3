/**
 * Détection heuristique des repères rétiniens (papille + fovéa) en navigateur,
 * par analyse de pixels sur canvas — sans dépendance ni modèle lourd.
 *
 * Heuristiques (volontairement simples, fournissent une *estimation initiale*
 * que le clinicien corrige ensuite par pointage manuel) :
 *   - **Papille** : région la plus brillante (hors bordure noire), après lissage.
 *   - **Fovéa**   : région la plus sombre dans une couronne autour de la papille.
 *
 * L'image est sous-échantillonnée (≈ 200 px de large) pour la rapidité ; les
 * coordonnées renvoyées sont remises à l'échelle des pixels source.
 */
import type { Landmarks } from "@/features/retinasketch/lib/geometry/align";
import { boxBlur } from "./blur";

export function detectLandmarks(img: HTMLImageElement): Landmarks | null {
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  if (!natW || !natH) return null;

  const DW = 200;
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
    return null; // canvas « taché » (cross-origin) — improbable avec un object URL
  }

  const n = w * h;
  const lum = new Float32Array(n);
  const mask = new Uint8Array(n); // 1 = rétine réelle, 0 = bordure noire
  for (let i = 0; i < n; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    const l = 0.299 * r + 0.587 * g + 0.114 * b;
    lum[i] = l;
    mask[i] = l > 25 ? 1 : 0;
  }

  const r = Math.max(2, Math.round(w * 0.03));
  const blur = boxBlur(lum, w, h, r);

  // Masque érodé : on écarte une bande près du bord/du noir afin que l'anneau
  // sombre du champ rétinien ne soit pas pris pour la fovéa.
  const maskFloat = new Float32Array(n);
  for (let i = 0; i < n; i++) maskFloat[i] = mask[i];
  const maskBlur = boxBlur(maskFloat, w, h, r);
  let maskIn = new Uint8Array(n);
  let inCount = 0;
  for (let i = 0; i < n; i++) {
    if (maskBlur[i] > 0.999) {
      maskIn[i] = 1;
      inCount++;
    }
  }
  if (inCount === 0) maskIn = mask; // image trop petite : repli sans érosion

  // Papille = pixel le plus brillant (intérieur de la rétine).
  let discI = -1;
  let discMax = -Infinity;
  for (let i = 0; i < n; i++) {
    if (maskIn[i] && blur[i] > discMax) {
      discMax = blur[i];
      discI = i;
    }
  }
  if (discI < 0) return null;
  const dX = discI % w;
  const dY = (discI / w) | 0;

  // Fovéa = zone la plus sombre dans une couronne autour de la papille.
  // Contrainte de secteur ~horizontal : la fovéa est sensiblement sur l'axe
  // horizontal passant par la papille (évite de capter une zone sombre au-dessus
  // ou en dessous, cause classique d'une rotation aberrante).
  const minD = 0.12 * w;
  const maxD = 0.42 * w;
  const TAN = 0.84; // ≈ tan(40°)
  let fovI = -1;
  let fovMin = Infinity;
  for (let i = 0; i < n; i++) {
    if (!maskIn[i]) continue;
    const x = i % w;
    const y = (i / w) | 0;
    const dx = x - dX;
    const dy = y - dY;
    const d = Math.hypot(dx, dy);
    if (d < minD || d > maxD) continue;
    if (Math.abs(dy) > TAN * Math.abs(dx)) continue; // hors secteur horizontal
    if (blur[i] < fovMin) {
      fovMin = blur[i];
      fovI = i;
    }
  }
  // Repli : si le secteur horizontal ne donne rien, on relâche la contrainte.
  if (fovI < 0) {
    for (let i = 0; i < n; i++) {
      if (!maskIn[i]) continue;
      const x = i % w;
      const y = (i / w) | 0;
      const d = Math.hypot(x - dX, y - dY);
      if (d < minD || d > maxD) continue;
      if (blur[i] < fovMin) {
        fovMin = blur[i];
        fovI = i;
      }
    }
  }
  if (fovI < 0) return null;
  const fX = fovI % w;
  const fY = (fovI / w) | 0;

  return {
    discPx: { x: dX / sc, y: dY / sc },
    foveaPx: { x: fX / sc, y: fY / sc },
  };
}
