/**
 * Recadrage automatique d'une rétinographie importée.
 *
 * À l'import, le disque rétinien est souvent plus petit que le cadre de l'image
 * (bordure noire du capteur). On calcule l'échelle et le décalage qui centrent
 * le disque et le font remplir le champ circulaire du schéma, de sorte qu'aucun
 * liseré noir ne subsiste — sans modifier le fichier d'origine.
 *
 * La géométrie suit exactement le modèle d'affichage (cover dans une boîte de
 * côté = diamètre du champ, puis transform translate(offset) + scale) partagé
 * par BackgroundImage (éditeur), RetinaSchemaSvg (compte rendu) et l'export PDF.
 */
import { TEMPLATE } from "./template";
import { detectContentBounds } from "@/features/retinasketch/lib/vision/trimBlack";

export interface AutoFrame {
  scale: number;
  offsetXMm: number;
  offsetYMm: number;
}

// Bornes de sécurité : on ne réduit jamais l'image (>=1) et on limite le zoom
// pour éviter un cadrage aberrant si la détection échoue.
const MIN_SCALE = 1;
const MAX_SCALE = 2.5;
// En-deçà de ce ratio, le contenu remplit déjà le cadre → pas de recadrage.
const FILL_RATIO = 0.98;

/**
 * Calcule le recadrage automatique d'une image, ou `null` si aucun cadre noir
 * significatif n'est détecté (contenu déjà plein cadre) ou image illisible.
 */
export function computeAutoFrame(img: HTMLImageElement): AutoFrame | null {
  const bounds = detectContentBounds(img);
  if (!bounds) return null;

  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  const minDim = Math.min(natW, natH);
  if (!minDim || !bounds.diameter) return null;

  // Contenu déjà plein cadre : rien à recadrer.
  if (bounds.diameter >= minDim * FILL_RATIO) return null;

  const fieldWmm = 2 * TEMPLATE.retina.halfWidthMm;
  const fieldHmm = 2 * TEMPLATE.retina.halfHeightMm;

  const scale = Math.min(MAX_SCALE, Math.max(MIN_SCALE, minDim / bounds.diameter));
  const offsetXMm = -((bounds.cx - natW / 2) * fieldWmm) / bounds.diameter;
  const offsetYMm = -((bounds.cy - natH / 2) * fieldHmm) / bounds.diameter;

  return { scale, offsetXMm, offsetYMm };
}
