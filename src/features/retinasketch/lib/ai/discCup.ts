
import type { InferenceSession, Tensor as OrtTensor } from "onnxruntime-web";
import { maskToPolygon } from "./contour";

/**
 * Segmentation IA de la papille (disque optique) + excavation (cup), en navigateur.
 *
 * Modèle : W-Net léger (ensemble), entraîné disc+cup (AutoMorph, lwnet), exporté
 * ONNX → `/public/models/disc_cup_wnet.onnx`. Entrée [1,3,512,512] RGB ÷255 ;
 * sortie `prob` [1,3,512,512] (softmax moyenné : 0 fond / 1 disque / 2 cup).
 *
 * Contrairement à MobileSAM (générique) ou à un seuil d'intensité, ce modèle est
 * **spécialisé rétine** : il reconnaît la papille sémantiquement et ignore les
 * lésions claires. 100 % local. Si le modèle est absent (`npm run setup:models`),
 * `detectDiscCup` lève → l'appelant retombe sur l'ajustement par intensité.
 */
type OrtModule = typeof import("onnxruntime-web");
let ortPromise: Promise<OrtModule> | null = null;
function getOrt(): Promise<OrtModule> {
  if (!ortPromise) {
    ortPromise = import("onnxruntime-web").then((ort) => {
      ort.env.wasm.numThreads = 1; // évite l'exigence COOP/COEP
      ort.env.wasm.wasmPaths =
        "https://cdn.jsdelivr.net/npm/onnxruntime-web@1.20.1/dist/";
      return ort;
    });
  }
  return ortPromise;
}

const MODEL_URL = "/models/disc_cup_wnet.onnx";
const SIZE = 512;

let session: InferenceSession | null = null;

export function isDiscModelLoaded() {
  return !!session;
}

export async function loadDiscModel(): Promise<void> {
  if (session) return;
  const ort = await getOrt();
  session = await ort.InferenceSession.create(MODEL_URL, { executionProviders: ["wasm"] });
}

export interface DiscCupResult {
  /** Contour de la papille (px image naturels). */
  discPolygon: number[];
  /** Contour de l'excavation, ou null si absente/non fiable. */
  cupPolygon: number[] | null;
  /** Ellipse englobante de la papille (px image) → poignées d'édition. */
  cx: number;
  cy: number;
  rx: number;
  ry: number;
}

/** Segmente la papille + cup d'une rétinographie (object URL). px image naturels. */
export async function detectDiscCup(src: string): Promise<DiscCupResult | null> {
  const ort = await getOrt();
  await loadDiscModel();
  const img = await loadImage(src);
  const natW = img.naturalWidth;
  const natH = img.naturalHeight;
  if (!natW || !natH) return null;

  // Prétraitement : redimensionnement (anisotrope) en 512², CHW float [0,1].
  const cnv = document.createElement("canvas");
  cnv.width = SIZE;
  cnv.height = SIZE;
  const ctx = cnv.getContext("2d", { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, SIZE, SIZE);
  const data = ctx.getImageData(0, 0, SIZE, SIZE).data;
  const plane = SIZE * SIZE;
  const arr = new Float32Array(3 * plane);
  for (let i = 0, p = 0; i < data.length; i += 4, p++) {
    arr[p] = data[i] / 255;
    arr[plane + p] = data[i + 1] / 255;
    arr[2 * plane + p] = data[i + 2] / 255;
  }
  const input = new ort.Tensor("float32", arr, [1, 3, SIZE, SIZE]);
  const out = await session!.run({ input });
  const prob = (out["prob"] ?? out[Object.keys(out)[0]]) as OrtTensor;
  const pd = prob.data as Float32Array;

  // argmax sur les 3 canaux → masques disque (classe ≥ 1) et cup (classe 2).
  const disc = new Uint8Array(plane);
  const cup = new Uint8Array(plane);
  for (let p = 0; p < plane; p++) {
    const p0 = pd[p];
    const p1 = pd[plane + p];
    const p2 = pd[2 * plane + p];
    let cls = 0;
    let mx = p0;
    if (p1 > mx) {
      mx = p1;
      cls = 1;
    }
    if (p2 > mx) {
      cls = 2;
    }
    if (cls >= 1) disc[p] = 1;
    if (cls === 2) cup[p] = 1;
  }

  // maskToPolygon garde déjà la plus grande composante connexe.
  const discSmall = maskToPolygon(disc, SIZE, SIZE, 2);
  if (discSmall.length < 8) return null;
  const cupSmall = maskToPolygon(cup, SIZE, SIZE, 2);

  const sx = natW / SIZE;
  const sy = natH / SIZE;
  const discPolygon = scalePoly(discSmall, sx, sy);
  const cupPolygon = cupSmall.length >= 8 ? scalePoly(cupSmall, sx, sy) : null;
  const m = bbox(discPolygon);
  return { discPolygon, cupPolygon, cx: m.cx, cy: m.cy, rx: m.rx, ry: m.ry };
}

function scalePoly(poly: number[], sx: number, sy: number): number[] {
  const out = new Array<number>(poly.length);
  for (let i = 0; i < poly.length; i += 2) {
    out[i] = poly[i] * sx;
    out[i + 1] = poly[i + 1] * sy;
  }
  return out;
}

function bbox(poly: number[]) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < poly.length; i += 2) {
    const x = poly[i];
    const y = poly[i + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return { cx: (minX + maxX) / 2, cy: (minY + maxY) / 2, rx: (maxX - minX) / 2, ry: (maxY - minY) / 2 };
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
}
