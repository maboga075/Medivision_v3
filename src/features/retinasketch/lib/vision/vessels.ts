/**
 * Détection heuristique des vaisseaux rétiniens en navigateur (sans modèle).
 *
 * Principe : les vaisseaux sont des structures fines *plus sombres* que le fond,
 * surtout marquées sur le **canal vert**. On applique un « black top-hat » :
 *   réponse = flou(vert) − vert
 * grande là où le vert est localement sombre (donc sur les vaisseaux). On
 * normalise sur un percentile robuste, on masque la bordure, et on produit un
 * **calque RGBA transparent** (vaisseaux colorés) à superposer à la photo, aligné
 * car généré aux mêmes proportions.
 */
import { boxBlur } from "./blur";

const VESSEL_COLOR = { r: 34, g: 211, b: 238 }; // cyan, lisible sur le fond rouge

export function detectVessels(img: HTMLImageElement): string | null {
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  if (!natW || !natH) return null;

  const target = 900;
  const sc = Math.min(1, target / Math.max(natW, natH));
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

  const n = w * h;
  const green = new Float32Array(n);
  const maskF = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const r = data[i * 4];
    const g = data[i * 4 + 1];
    const b = data[i * 4 + 2];
    green[i] = g;
    maskF[i] = 0.299 * r + 0.587 * g + 0.114 * b > 30 ? 1 : 0;
  }

  // Estimation du fond + top-hat (rayon ≈ espacement vasculaire).
  const R = Math.max(4, Math.round(Math.min(w, h) * 0.05));
  const bg = boxBlur(green, w, h, R);

  // Masque érodé : exclut une bande près du bord/noir.
  const maskBlur = boxBlur(maskF, w, h, R);
  const maskIn = new Uint8Array(n);
  for (let i = 0; i < n; i++) maskIn[i] = maskBlur[i] > 0.999 ? 1 : 0;

  // Réponse + histogramme (256 bins) pour un percentile robuste.
  const resp = new Float32Array(n);
  const hist = new Uint32Array(256);
  let count = 0;
  for (let i = 0; i < n; i++) {
    if (!maskIn[i]) continue;
    const v = bg[i] - green[i];
    if (v > 0) {
      resp[i] = v;
      hist[Math.min(255, v | 0)]++;
      count++;
    }
  }
  if (count === 0) return emptyOverlay(w, h);

  // p99 comme borne haute de normalisation.
  let acc = 0;
  let p99 = 16;
  const target99 = count * 0.99;
  for (let b = 0; b < 256; b++) {
    acc += hist[b];
    if (acc >= target99) {
      p99 = Math.max(8, b);
      break;
    }
  }
  const T = Math.max(5, p99 * 0.22); // seuil bas
  const span = Math.max(1, p99 - T);

  const out = ctx.createImageData(w, h);
  const od = out.data;
  for (let i = 0; i < n; i++) {
    const v = resp[i];
    if (maskIn[i] && v > T) {
      const a = Math.min(1, (v - T) / span) * 0.85;
      od[i * 4] = VESSEL_COLOR.r;
      od[i * 4 + 1] = VESSEL_COLOR.g;
      od[i * 4 + 2] = VESSEL_COLOR.b;
      od[i * 4 + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(out, 0, 0);
  return cnv.toDataURL("image/png");
}

function emptyOverlay(w: number, h: number): string {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c.toDataURL("image/png");
}
