
import type Konva from "konva";
import type { Annotation, Laterality } from "@/features/retinasketch/lib/types";
import type { BackgroundState } from "@/features/retinasketch/store/useStore";
import type { RetinaPrintInfo } from "@/features/retinasketch/lib/printInfo";
import { generateReport } from "@/features/retinasketch/lib/report/generate";
import { TEMPLATE, createViewport, mirrorFor, type Viewport } from "@/features/retinasketch/lib/geometry/template";
import { applyToneSharpen, colorCss } from "@/features/retinasketch/lib/image/filters";

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/** Dessine une source (image ou canvas) avec le même transform que BackgroundImage
 * (cover + offset/scale/rotation). `natW/natH` = dimensions naturelles de la source. */
function drawTransformed(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  natW: number,
  natH: number,
  bg: BackgroundState,
  vp: Viewport,
  W: number,
  H: number,
  withFilter: boolean,
) {
  const pxPerMm = vp.pxPerMm;
  const boxW = 2 * TEMPLATE.retina.halfWidthMm * pxPerMm;
  const boxH = 2 * TEMPLATE.retina.halfHeightMm * pxPerMm;
  // « cover » : l'image remplit la boîte du cercle (recadrée), comme à l'écran.
  const k = Math.max(boxW / natW, boxH / natH);
  const dispW = natW * k;
  const dispH = natH * k;
  ctx.save();
  ctx.translate(W / 2 + bg.offsetXMm * pxPerMm, H / 2 + bg.offsetYMm * pxPerMm);
  ctx.rotate((bg.rotationDeg * Math.PI) / 180);
  ctx.scale(bg.scale, bg.scale);
  if (withFilter) {
    ctx.globalAlpha = bg.opacity;
    // Tons + netteté sont déjà appliqués sur les pixels de `source` (pré-passe) ;
    // ici on ne pose que la colorimétrie native (même ordre que l'affichage).
    ctx.filter = colorCss(bg.brightness, bg.contrast, bg.saturation);
  }
  ctx.drawImage(source, -dispW / 2, -dispH / 2, dispW, dispH);
  ctx.restore();
}

async function renderEyeCanvas(
  eye: Laterality,
  W: number,
  H: number,
  bg: BackgroundState,
  stage: Konva.Stage | null,
  showBg: boolean,
): Promise<HTMLCanvasElement> {
  const ratio = 2;
  const canvas = document.createElement("canvas");
  canvas.width = W * ratio;
  canvas.height = H * ratio;
  const ctx = canvas.getContext("2d")!;
  ctx.scale(ratio, ratio);
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, W, H);

  const vp = createViewport(W, H, mirrorFor(eye));
  if (showBg && bg.src && bg.visible) {
    const img = await loadImage(bg.src);
    const natW = img.naturalWidth;
    const natH = img.naturalHeight;
    // Pré-passe tons + netteté sur les pixels (canvas taille naturelle) ; l'image
    // d'origine est conservée si les réglages sont neutres.
    const processed = applyToneSharpen(img, {
      sharpness: bg.sharpness,
      highlights: bg.highlights,
      shadows: bg.shadows,
      whites: bg.whites,
      blacks: bg.blacks,
    });
    const source: CanvasImageSource = processed ?? img;
    // Clip circulaire = champ rétinien : masque le cadre noir, rien hors du cercle.
    ctx.save();
    ctx.beginPath();
    ctx.arc(W / 2, H / 2, TEMPLATE.retina.halfWidthMm * vp.pxPerMm, 0, Math.PI * 2);
    ctx.clip();
    drawTransformed(ctx, source, natW, natH, bg, vp, W, H, true);
    if (bg.showVessels && bg.vesselsSrc) {
      const v = await loadImage(bg.vesselsSrc);
      drawTransformed(ctx, v, v.naturalWidth, v.naturalHeight, bg, vp, W, H, false);
    }
    ctx.restore();
  }
  if (stage) {
    const sc = stage.toCanvas({ pixelRatio: ratio });
    ctx.drawImage(sc, 0, 0, W, H);
  }
  return canvas;
}

export async function exportDoubleEyePDF(opts: {
  annotations: Annotation[];
  backgrounds: Record<Laterality, BackgroundState>; // une image par œil
  size: { width: number; height: number };
  stages: { OD: Konva.Stage | null; OS: Konva.Stage | null };
  info?: RetinaPrintInfo;
}) {
  const { jsPDF } = await import("jspdf");
  const { width: W, height: H } = opts.size;

  const odCanvas = await renderEyeCanvas("OD", W, H, opts.backgrounds.OD, opts.stages.OD, opts.backgrounds.OD.src != null);
  const osCanvas = await renderEyeCanvas("OS", W, H, opts.backgrounds.OS, opts.stages.OS, opts.backgrounds.OS.src != null);

  const pdf = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  const pageW = 297;
  const margin = 10;
  const gap = 8;
  const colW = (pageW - 2 * margin - gap) / 2;

  // ─── En-tête patient / clinique ───
  const info = opts.info;
  pdf.setFontSize(14);
  pdf.setTextColor(20);
  pdf.text(info?.patientName || "Rétinographie — deux yeux", margin, 12);
  if (info?.patientAge) {
    const nameW = pdf.getTextWidth(info.patientName || "");
    pdf.setFontSize(10);
    pdf.setTextColor(120);
    pdf.text(`${info.patientAge} ans`, margin + nameW + 3, 12);
  }
  pdf.setFontSize(9);
  pdf.setTextColor(120);
  const rightLines = [info?.clinic, info?.doctor, info?.date || new Date().toLocaleDateString("fr-FR")].filter(Boolean) as string[];
  rightLines.forEach((line, i) => pdf.text(line, pageW - margin, 9 + i * 4, { align: "right" }));
  const subParts = [info?.folderId ? `Dossier : ${info.folderId}` : "", info?.motifs ? `Motif : ${info.motifs}` : ""].filter(Boolean);
  if (subParts.length) {
    pdf.setFontSize(8.5);
    pdf.text(subParts.join("   ·   "), margin, 17);
  }
  pdf.setDrawColor(30);
  pdf.setLineWidth(0.4);
  pdf.line(margin, 19, pageW - margin, 19);
  pdf.setTextColor(20);

  const imgH = colW * (H / W);
  const top = 25;
  pdf.setFontSize(11);
  pdf.text("Œil droit (OD)", margin, top);
  pdf.text("Œil gauche (OG)", margin + colW + gap, top);

  pdf.addImage(odCanvas.toDataURL("image/jpeg", 0.92), "JPEG", margin, top + 2, colW, imgH);
  pdf.addImage(osCanvas.toDataURL("image/jpeg", 0.92), "JPEG", margin + colW + gap, top + 2, colW, imgH);

  const ry = top + 2 + imgH + 6;
  pdf.setFontSize(9);
  pdf.text(generateReport(opts.annotations, "OD").split("\n"), margin, ry, { maxWidth: colW });
  pdf.text(generateReport(opts.annotations, "OS").split("\n"), margin + colW + gap, ry, { maxWidth: colW });

  pdf.save("retinasketch-compte-rendu.pdf");
}
