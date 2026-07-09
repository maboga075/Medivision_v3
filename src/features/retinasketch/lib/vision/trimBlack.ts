/**
 * Détourage du fond noir d'une rétinographie : les pixels sombres **connectés au
 * bord** de l'image (l'anneau noir du champ, pas les lésions sombres internes)
 * sont rendus **transparents**. Objectif : ne pas imprimer d'aplat noir (encre).
 *
 * Méthode : remplissage par diffusion (flood fill) depuis les 4 bords sur les
 * pixels dont la luminance est sous un seuil → seul le pourtour noir est retiré,
 * jamais une hémorragie ou une zone sombre entourée de rétine.
 *
 * 100 % navigateur, sans dépendance. Renvoie un data URL PNG (avec alpha) ou
 * `null` si rien à retirer / image illisible.
 */
export function trimBlackBackground(
  img: HTMLImageElement,
  threshold = 42,
  // Plafond haut : la plupart des rétinographies ne sont pas redimensionnées,
  // donc l'image détourée conserve les dimensions natives (natW/natH restent
  // valides pour les outils Align/SAM). Sécurité mémoire pour les très grandes.
  maxDim = 4000,
): string | null {
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  if (!natW || !natH) return null;

  const sc = Math.min(1, maxDim / Math.max(natW, natH));
  const w = Math.max(1, Math.round(natW * sc));
  const h = Math.max(1, Math.round(natH * sc));

  const cnv = document.createElement("canvas");
  cnv.width = w;
  cnv.height = h;
  const ctx = cnv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);

  let imageData: ImageData;
  try {
    imageData = ctx.getImageData(0, 0, w, h);
  } catch {
    return null; // canvas « taché » (cross-origin)
  }
  const data = imageData.data;
  const n = w * h;

  const dark = new Uint8Array(n);
  for (let i = 0; i < n; i++) {
    const l =
      0.299 * data[i * 4] + 0.587 * data[i * 4 + 1] + 0.114 * data[i * 4 + 2];
    dark[i] = l < threshold ? 1 : 0;
  }

  // BFS depuis les bords sur les pixels sombres connectés.
  const visited = new Uint8Array(n);
  const stack = new Int32Array(n);
  let sp = 0;
  const push = (i: number) => {
    if (dark[i] && !visited[i]) {
      visited[i] = 1;
      stack[sp++] = i;
    }
  };
  for (let x = 0; x < w; x++) {
    push(x);
    push((h - 1) * w + x);
  }
  for (let y = 0; y < h; y++) {
    push(y * w);
    push(y * w + (w - 1));
  }
  while (sp > 0) {
    const i = stack[--sp];
    const x = i % w;
    const y = (i / w) | 0;
    if (x > 0) push(i - 1);
    if (x < w - 1) push(i + 1);
    if (y > 0) push(i - w);
    if (y < h - 1) push(i + w);
  }

  let removed = 0;
  for (let i = 0; i < n; i++) {
    if (visited[i]) {
      data[i * 4 + 3] = 0; // alpha = 0 → transparent
      removed++;
    }
  }
  if (removed === 0) return null;

  ctx.putImageData(imageData, 0, 0);
  return cnv.toDataURL("image/png");
}

/** Boîte englobante du disque rétinien (contenu non-noir), en px de l'image native. */
export interface ContentBounds {
  cx: number; // centre X du contenu (px natifs)
  cy: number; // centre Y du contenu (px natifs)
  diameter: number; // diamètre du contenu = max(largeur, hauteur) de la boîte (px natifs)
}

/**
 * Détecte la boîte englobante du contenu rétinien (pixels clairs) d'une
 * rétinographie, en ignorant le cadre noir. Sert au recadrage automatique à
 * l'import : centrer le disque et le faire remplir le champ circulaire.
 *
 * Renvoie `null` si l'image est illisible (canvas taché cross-origin) ou vide.
 */
export function detectContentBounds(
  img: HTMLImageElement,
  threshold = 42,
  maxDim = 1200,
): ContentBounds | null {
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  if (!natW || !natH) return null;

  const sc = Math.min(1, maxDim / Math.max(natW, natH));
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
    return null; // canvas « taché » (cross-origin)
  }

  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const l = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      if (l >= threshold) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < minX || maxY < minY) return null;

  const bw = maxX - minX + 1;
  const bh = maxY - minY + 1;
  return {
    cx: (minX + maxX) / 2 / sc,
    cy: (minY + maxY) / 2 / sc,
    diameter: Math.max(bw, bh) / sc,
  };
}
