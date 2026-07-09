/**
 * Capture de l'image de rétinographie (et de son réglage) depuis le store
 * RetinaSketch vers un instantané persistable dans l'état de consultation, afin
 * de reproduire fidèlement l'affichage dans le compte rendu.
 *
 * L'image est ré-encodée en JPEG compressé/redimensionné (bornée à MAX_DIM px)
 * pour rester légère (compatible stockage Firestore ~1 Mo par document).
 */
import type { RetinaBackgroundSnapshot } from "@/types/clinical";
import type { BackgroundState } from "@/features/retinasketch/store/useStore";

const MAX_DIM = 1000; // borne max du plus grand côté (px)
const JPEG_QUALITY = 0.72;

/** Charge une image (dataURL / blob URL) en objet HTMLImageElement. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Ré-encode une image en JPEG compressé (redimensionné si nécessaire). */
async function compressToJpeg(src: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const img = await loadImage(src);
    const natW = img.naturalWidth || img.width;
    const natH = img.naturalHeight || img.height;
    if (!natW || !natH) return null;

    const ratio = Math.min(1, MAX_DIM / Math.max(natW, natH));
    const w = Math.max(1, Math.round(natW * ratio));
    const h = Math.max(1, Math.round(natH * ratio));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    // Fond blanc : le JPEG n'a pas de transparence, évite un fond noir résiduel.
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);

    return { dataUrl: canvas.toDataURL("image/jpeg", JPEG_QUALITY), w: natW, h: natH };
  } catch {
    return null;
  }
}

/**
 * Produit un instantané persistable de l'image de fond d'un œil, ou `null` si
 * aucune image n'est chargée. Conserve l'alignement et la colorimétrie exacts.
 */
export async function snapshotBackground(bg: BackgroundState): Promise<RetinaBackgroundSnapshot | null> {
  if (!bg.src) return null;
  const compressed = await compressToJpeg(bg.src);
  if (!compressed) return null;

  return {
    src: compressed.dataUrl,
    natW: compressed.w,
    natH: compressed.h,
    visible: bg.visible,
    opacity: bg.opacity,
    brightness: bg.brightness,
    contrast: bg.contrast,
    saturation: bg.saturation,
    scale: bg.scale,
    offsetXMm: bg.offsetXMm,
    offsetYMm: bg.offsetYMm,
    rotationDeg: bg.rotationDeg,
  };
}
