import { z } from "zod";

/**
 * Modèle de données canonique de RetinaSketch.
 * Espace de coordonnées NORMALISÉ en millimètres, origine = fovéa.
 * Convention interne : œil droit (OD). Le rendu OG est obtenu par miroir
 * visuel + miroir de la saisie, la géométrie reste donc toujours en OD.
 */

export const Laterality = z.enum(["OD", "OS"]);
export type Laterality = z.infer<typeof Laterality>;

/**
 * Type d'image d'un slot de galerie :
 * - `retino`  : rétinographie (surface circulaire, anatomie fovéa/papille active).
 * - `octa`    : OCT-angiographie (surface carrée, sans anatomie rétinienne).
 * - `enface`  : OCT « de face » / en-face (surface carrée).
 * - `bscan`   : coupe B-scan OCT (surface rectangulaire).
 */
export const ImageKind = z.enum(["retino", "octa", "enface", "bscan"]);
export type ImageKind = z.infer<typeof ImageKind>;

/** Géométrie de la surface de travail (forme du clip). */
export const ImageGeometry = z.enum(["circle", "square", "rect"]);
export type ImageGeometry = z.infer<typeof ImageGeometry>;

/** Géométrie par défaut associée à chaque type d'image. */
export const GEOMETRY_FOR_KIND: Record<ImageKind, ImageGeometry> = {
  retino: "circle",
  octa: "square", // OCT-A : acquisition carrée (comme l'OCT en-face)
  enface: "square",
  bscan: "rect",
};

/** Seuls les slots rétino portent l'anatomie rétinienne (fovéa/papille/ETDRS). */
export const kindHasRetinalAnatomy = (kind: ImageKind): boolean => kind === "retino";

/** Libellé court par défaut pour un type d'image (numéroté à l'ajout). */
export const LABEL_FOR_KIND: Record<ImageKind, string> = {
  retino: "Rétinographie",
  octa: "OCT-A",
  enface: "OCT en-face",
  bscan: "B-scan",
};

export const Quadrant = z.enum(["TS", "TI", "NS", "NI"]);
export type Quadrant = z.infer<typeof Quadrant>;

export const FoveaBand = z.enum(["0-1mm", "1-3mm", "3-6mm", "6-12mm", ">12mm"]);
export type FoveaBand = z.infer<typeof FoveaBand>;

export const EtdrsSector = z.enum([
  "C",
  "SI",
  "NI",
  "II",
  "TI",
  "SE",
  "NE",
  "IE",
  "TE",
]);
export type EtdrsSector = z.infer<typeof EtdrsSector>;

export const AnatomicalZone = z.enum([
  "Papille",
  "Zone péripapillaire",
  "Macula",
  "Fovéa",
  "Rétine temporale",
  "Rétine nasale",
  "Périphérie",
]);
export type AnatomicalZone = z.infer<typeof AnatomicalZone>;

/** Attributs cliniques dérivés automatiquement par le moteur géométrique. */
export const DerivedAttributes = z.object({
  anatomicalZone: AnatomicalZone,
  quadrant: Quadrant,
  foveaBand: FoveaBand,
  distanceToFoveaMm: z.number(),
  etdrsSector: EtdrsSector.nullable(),
  distanceToDiscMm: z.number(),
  vascularRelation: z.object({
    nearVessel: z.boolean(),
    distanceToVesselMm: z.number().nullable(),
  }),
});
export type DerivedAttributes = z.infer<typeof DerivedAttributes>;

export const Annotation = z.object({
  id: z.string(),
  /**
   * Type de tracé :
   * - `point`   : spot ponctuel (rayon `radiusMm`).
   * - `polygon` : détourage de surface fermé.
   * - `arrow`   : flèche de désignation, `points = [xQueue,yQueue,xPointe,yPointe]`,
   *               couleur héritée de la lésion (pas de remplissage ni d'aire).
   */
  kind: z.enum(["point", "polygon", "arrow"]),
  /** Coordonnées en mm, espace fovéal, format plat [x0,y0,x1,y1,...]. */
  points: z.array(z.number()),
  /** Rayon en mm pour un spot ponctuel (diamètre ajustable). */
  radiusMm: z.number().nullable(),
  /** Centroïde mm — point de référence pour la structuration. */
  centroidMm: z.object({ x: z.number(), y: z.number() }),
  areaMm2: z.number().nullable(),
  laterality: Laterality,
  lesionId: z.string().nullable(),
  status: z.enum(["draft", "validated"]),
  attrs: DerivedAttributes,
  author: z.string(),
  createdAt: z.string(),
});
export type Annotation = z.infer<typeof Annotation>;
