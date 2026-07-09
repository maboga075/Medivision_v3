
import type { InferenceSession, Tensor as OrtTensor } from "onnxruntime-web";
import { maskToPolygon } from "./contour";

/**
 * Service SAM (clic → masque) en navigateur via onnxruntime-web.
 * Modèle : MobileSAM (Apache-2.0), encodeur + décodeur ONNX dans /public/models.
 *  - encodeur : input_image [H,W,3] RGB brut (prétraitement interne) → image_embeddings [1,256,64,64]
 *  - décodeur : contrat SAM standard (point + padding label -1, orig_im_size) → masks [1,1,H,W]
 * L'inférence est 100 % locale ; rien ne quitte la machine.
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

const ENC_URL = "/models/mobile_sam_image_encoder.onnx";
const DEC_URL = "/models/sam_mask_decoder_single.onnx";
const MAX_SIDE = 1024;

let encoder: InferenceSession | null = null;
let decoder: InferenceSession | null = null;
let embedding: OrtTensor | null = null;
let embW = 0;
let embH = 0;
let factor = 1; // px naturels → px frame d'embedding

export function isModelLoaded() {
  return !!(encoder && decoder);
}
export function hasEmbedding() {
  return !!embedding;
}
export function clearEmbedding() {
  embedding = null;
}

export async function loadSam(): Promise<void> {
  if (encoder && decoder) return;
  const ort = await getOrt();
  const [enc, dec] = await Promise.all([
    ort.InferenceSession.create(ENC_URL, { executionProviders: ["wasm"] }),
    ort.InferenceSession.create(DEC_URL, { executionProviders: ["wasm"] }),
  ]);
  encoder = enc;
  decoder = dec;
}

/** Encode l'image (coûteux, ~1 fois par photo). */
export async function embedImage(src: string): Promise<void> {
  const ort = await getOrt();
  await loadSam();
  const img = await loadImage(src);
  factor = Math.min(1, MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  embW = Math.max(1, Math.round(img.naturalWidth * factor));
  embH = Math.max(1, Math.round(img.naturalHeight * factor));
  const cnv = document.createElement("canvas");
  cnv.width = embW;
  cnv.height = embH;
  const ctx = cnv.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, 0, 0, embW, embH);
  const data = ctx.getImageData(0, 0, embW, embH).data;
  const arr = new Float32Array(embW * embH * 3);
  for (let i = 0, j = 0; i < data.length; i += 4, j += 3) {
    arr[j] = data[i];
    arr[j + 1] = data[i + 1];
    arr[j + 2] = data[i + 2];
  }
  const input = new ort.Tensor("float32", arr, [embH, embW, 3]);
  const out = await encoder!.run({ input_image: input });
  embedding = out.image_embeddings as OrtTensor;
}

/** Points en pixels image NATURELS → polygone (px image naturels). */
export async function predictPolygon(
  points: { x: number; y: number; positive: boolean }[],
): Promise<number[]> {
  if (!embedding || !decoder) return [];
  const ort = await getOrt();
  const dec = 1024 / Math.max(embW, embH);
  const coords: number[] = [];
  const labels: number[] = [];
  for (const p of points) {
    coords.push(p.x * factor * dec, p.y * factor * dec);
    labels.push(p.positive ? 1 : 0);
  }
  coords.push(0, 0); // point de padding requis par le décodeur SAM
  labels.push(-1);
  const np = labels.length;

  const out = await decoder.run({
    image_embeddings: embedding,
    point_coords: new ort.Tensor("float32", Float32Array.from(coords), [1, np, 2]),
    point_labels: new ort.Tensor("float32", Float32Array.from(labels), [1, np]),
    mask_input: new ort.Tensor("float32", new Float32Array(256 * 256), [1, 1, 256, 256]),
    has_mask_input: new ort.Tensor("float32", Float32Array.from([0]), [1]),
    orig_im_size: new ort.Tensor("float32", Float32Array.from([embH, embW]), [2]),
  });

  const md = out.masks.data as Float32Array; // [1,1,embH,embW] logits
  const bin = new Uint8Array(embW * embH);
  let fg = 0;
  for (let i = 0; i < bin.length; i++) {
    if (md[i] > 0) {
      bin[i] = 1;
      fg++;
    }
  }
  // Masque implausible (quasi tout le champ) → sélection ratée, on s'abstient.
  const ratio = fg / bin.length;
  if (ratio < 0.0005 || ratio > 0.4) {
    console.warn("[SAM] masque rejeté, ratio =", ratio.toFixed(4), "(attendu 0.0005–0.4)");
    return [];
  }
  const polyEmb = maskToPolygon(bin, embW, embH, 2);
  const poly: number[] = [];
  for (let i = 0; i < polyEmb.length; i += 2) {
    poly.push(polyEmb[i] / factor, polyEmb[i + 1] / factor);
  }
  return poly;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const i = new Image();
    i.onload = () => resolve(i);
    i.onerror = reject;
    i.src = src;
  });
}
