import type { Annotation, Laterality } from "@/features/retinasketch/lib/types";

/**
 * Module IA v2 — types du « flywheel » d'apprentissage.
 *
 * Chaque consultation validée est enregistrée localement (IndexedDB) comme
 * `TrainingCase` : l'image alignée + les annotations validées (labels) + plus
 * tard l'embedding DINOv2. C'est la matière première de l'apprentissage continu.
 */

/** Snapshot de l'alignement de la rétinographie au moment de l'enregistrement. */
export interface CaseAlignment {
  fileName: string | null;
  natW: number;
  natH: number;
  offsetXMm: number;
  offsetYMm: number;
  scale: number;
  rotationDeg: number;
}

export interface TrainingCase {
  id: string;
  createdAt: string; // ISO 8601
  laterality: Laterality;
  /** Rétinographie (downscalée, JPEG) telle qu'annotée ; null si aucune image. */
  imageBlob: Blob | null;
  /** Paramètres pour reprojeter la géométrie mm → pixels image au moment du training. */
  alignment: CaseAlignment | null;
  /** Annotations validées = labels (géométrie mm normalisée + type + attributs dérivés). */
  annotations: Annotation[];
  /** Embedding du backbone gelé (DINOv2) ; rempli ultérieurement, sert au k-NN. */
  embedding: number[] | null;
  note?: string;
}

/** Contrat d'un extracteur de features (DINOv2 via ONNX/Core ML), branché en P9-1. */
export interface Embedder {
  /** Retourne le vecteur d'embedding L2-normalisé d'une rétinographie. */
  embed(image: HTMLImageElement | HTMLCanvasElement): Promise<number[]>;
  readonly dim: number;
}

/** Contrat d'un segmenteur interactif (SAM clic→masque), branché en P9-0 (modèle). */
export interface InteractiveSegmenter {
  /** Encode l'image une fois (coûteux), puis on peut prompter par clics. */
  setImage(image: HTMLImageElement | HTMLCanvasElement): Promise<void>;
  /** À partir de points cliqués (px image), renvoie un masque (polygone px image). */
  predict(points: { x: number; y: number; positive: boolean }[]): Promise<number[]>;
}

/**
 * Contrat d'un détecteur d'anatomie (papille + macula) — défini dans
 * `lib/vision/anatomy.ts`. L'heuristique luminance actuelle l'implémente déjà ;
 * une future IA de segmentation (CNN/U-Net) la remplacera via la même interface,
 * sans toucher à l'affichage, à l'édition ni à la sauvegarde (store).
 */
export type { AnatomyDetector, EyeAnatomy } from "@/features/retinasketch/lib/vision/anatomy";
