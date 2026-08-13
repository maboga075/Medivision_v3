/**
 * Colorimétrie de la rétinographie — source unique de vérité, partagée entre
 * l'éditeur (BackgroundImage, filtre CSS), le compte rendu (RetinaSchemaSvg,
 * filtre SVG) et l'export PDF (pré-passe canvas).
 *
 * Deux familles de réglages :
 *  - Luminosité / Contraste / Saturation : exprimables en `filter` CSS natif.
 *  - Netteté + Tons (hautes/basses lumières, points blanc/noir) : non exprimables
 *    en CSS natif → filtre SVG (`feConvolveMatrix` + `feComponentTransfer`) pour
 *    l'affichage temps réel, et convolution/LUT sur canvas pour l'export PDF.
 *
 * Neutre = valeurs par défaut (netteté 0, tons 0) → aucun filtre SVG appliqué.
 */

export interface ToneParams {
  sharpness: number; // 0..100
  highlights: number; // -100..100
  shadows: number; // -100..100
  whites: number; // -100..100
  blacks: number; // -100..100
}

/** Nombre d'échantillons de la courbe tonale (feComponentTransfer table). */
const LUT_N = 32;

/** Zones tonales : centre (0=noir, 1=blanc) et étalement de la cloche d'influence. */
const TONE_ZONES = [
  { key: "blacks", center: 0.0, sigma: 0.16 },
  { key: "shadows", center: 0.28, sigma: 0.2 },
  { key: "highlights", center: 0.72, sigma: 0.2 },
  { key: "whites", center: 1.0, sigma: 0.16 },
] as const;

/** Amplitude max d'un réglage tonal (±100 → déplace la zone de ±0.5 en luminance). */
const TONE_STRENGTH = 0.5;

/** Netteté max (coefficient du noyau de convolution) à 100. */
const SHARPEN_MAX_K = 1;

const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);

/** Vrai si tous les réglages tons + netteté sont neutres (aucun filtre requis). */
export function isNeutralTone(p: ToneParams): boolean {
  return (
    p.sharpness === 0 &&
    p.highlights === 0 &&
    p.shadows === 0 &&
    p.whites === 0 &&
    p.blacks === 0
  );
}

/**
 * Courbe tonale f(x) échantillonnée sur [0,1] : identité + somme des cloches de
 * chaque zone pondérées par son réglage. Utilisée telle quelle par le filtre SVG
 * (tableValues) et interpolée en LUT 256 pour le canvas.
 */
export function toneCurve(p: ToneParams): number[] {
  const amts: Record<string, number> = {
    blacks: (p.blacks / 100) * TONE_STRENGTH,
    shadows: (p.shadows / 100) * TONE_STRENGTH,
    highlights: (p.highlights / 100) * TONE_STRENGTH,
    whites: (p.whites / 100) * TONE_STRENGTH,
  };
  const out: number[] = [];
  for (let i = 0; i < LUT_N; i++) {
    const x = i / (LUT_N - 1);
    let y = x;
    for (const z of TONE_ZONES) {
      const w = Math.exp(-((x - z.center) ** 2) / (2 * z.sigma * z.sigma));
      y += amts[z.key] * w;
    }
    out.push(clamp01(y));
  }
  return out;
}

/** `tableValues` (chaîne) pour feFuncR/G/B, ou "" si la courbe est l'identité. */
export function toneTableValues(p: ToneParams): string {
  if (p.highlights === 0 && p.shadows === 0 && p.whites === 0 && p.blacks === 0) return "";
  return toneCurve(p)
    .map((v) => v.toFixed(4))
    .join(" ");
}

/** Coefficient du noyau de netteté (0 = aucune). */
export function sharpenK(sharpness: number): number {
  return (Math.max(0, Math.min(100, sharpness)) / 100) * SHARPEN_MAX_K;
}

/** Noyau 3×3 d'accentuation (Laplacien) pour feConvolveMatrix / canvas. */
export function sharpenKernel(sharpness: number): number[] {
  const k = sharpenK(sharpness);
  return [0, -k, 0, -k, 1 + 4 * k, -k, 0, -k, 0];
}

/** Chaîne `filter` CSS pour Luminosité/Contraste/Saturation (100 = neutre). */
export function colorCss(brightness: number, contrast: number, saturation: number): string {
  return `brightness(${brightness}%) contrast(${contrast}%) saturate(${saturation}%)`;
}

/**
 * Chaîne `filter` CSS complète pour l'affichage : le filtre SVG (tons + netteté)
 * est appliqué EN PREMIER, puis la colorimétrie native — même ordre que la
 * pré-passe canvas de l'export PDF (tons/netteté sur les pixels, puis couleur).
 * `svgFilterId` est l'id du <filter> rendu à proximité (ou null si neutre).
 */
export function displayFilterCss(
  brightness: number,
  contrast: number,
  saturation: number,
  svgFilterId: string | null,
): string {
  const color = colorCss(brightness, contrast, saturation);
  return svgFilterId ? `url(#${svgFilterId}) ${color}` : color;
}

/** Construit une LUT 256 entrées (0..255) à partir de la courbe tonale. */
function toneLUT256(p: ToneParams): Uint8ClampedArray {
  const curve = toneCurve(p);
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    const x = (i / 255) * (LUT_N - 1);
    const lo = Math.floor(x);
    const hi = Math.min(LUT_N - 1, lo + 1);
    const t = x - lo;
    lut[i] = Math.round((curve[lo] * (1 - t) + curve[hi] * t) * 255);
  }
  return lut;
}

/**
 * Applique tons + netteté sur les pixels d'une image et retourne un canvas (taille
 * naturelle). Réservé à l'export PDF (`ctx.filter: url()` peu fiable sur canvas).
 * Retourne `null` si les réglages sont neutres (l'appelant garde l'image d'origine).
 */
export function applyToneSharpen(
  img: HTMLImageElement,
  p: ToneParams,
): HTMLCanvasElement | null {
  if (isNeutralTone(p)) return null;
  const w = img.naturalWidth || img.width;
  const h = img.naturalHeight || img.height;
  if (!w || !h) return null;

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);

  let data = ctx.getImageData(0, 0, w, h);

  // 1) Tons : LUT par canal (R,G,B ; alpha inchangé).
  if (p.highlights !== 0 || p.shadows !== 0 || p.whites !== 0 || p.blacks !== 0) {
    const lut = toneLUT256(p);
    const d = data.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = lut[d[i]];
      d[i + 1] = lut[d[i + 1]];
      d[i + 2] = lut[d[i + 2]];
    }
  }

  // 2) Netteté : convolution 3×3 (noyau Laplacien), bords dupliqués.
  if (p.sharpness > 0) {
    data = convolve3x3(data, w, h, sharpenKernel(p.sharpness));
  }

  ctx.putImageData(data, 0, 0);
  return canvas;
}

/** Convolution 3×3 sur RGB (alpha préservé), bords en « duplicate ». */
function convolve3x3(src: ImageData, w: number, h: number, kernel: number[]): ImageData {
  const s = src.data;
  const out = new ImageData(w, h);
  const o = out.data;
  const at = (x: number, y: number) => {
    const cx = x < 0 ? 0 : x >= w ? w - 1 : x;
    const cy = y < 0 ? 0 : y >= h ? h - 1 : y;
    return (cy * w + cx) * 4;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const di = (y * w + x) * 4;
      for (let c = 0; c < 3; c++) {
        let acc = 0;
        let ki = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            acc += s[at(x + kx, y + ky) + c] * kernel[ki++];
          }
        }
        o[di + c] = acc < 0 ? 0 : acc > 255 ? 255 : acc;
      }
      o[di + 3] = s[di + 3];
    }
  }
  return out;
}
