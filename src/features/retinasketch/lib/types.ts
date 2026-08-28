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
 * - `cornea`  : OCT segment antérieur — cornée (coupe rectangulaire).
 * - `angle`   : OCT segment antérieur — angle irido-cornéen (coupe rectangulaire).
 */
export const ImageKind = z.enum(["retino", "octa", "enface", "bscan", "cornea", "angle"]);
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
  cornea: "rect", // OCT antérieur cornée : coupe rectangulaire
  angle: "rect", // OCT antérieur angle IC : coupe rectangulaire
};

/** Seuls les slots rétino portent l'anatomie rétinienne (fovéa/papille/ETDRS). */
export const kindHasRetinalAnatomy = (kind: ImageKind): boolean => kind === "retino";

/** Libellé court par défaut pour un type d'image (numéroté à l'ajout). */
export const LABEL_FOR_KIND: Record<ImageKind, string> = {
  retino: "Rétinographie",
  octa: "OCT-A",
  enface: "OCT en-face",
  bscan: "B-scan",
  cornea: "OCT cornée",
  angle: "OCT angle IC",
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

/** Couches rétiniennes (coupe B-scan) — saisie manuelle, détection IA à venir. */
export const RetinalLayer = z.enum([
  "RNFL", "GCL", "IPL", "INL", "OPL", "ONL",
  "Photorécepteurs", "EPR", "Choroïde",
  "Rétine interne", "Rétine externe", "Toute épaisseur",
]);
export type RetinalLayer = z.infer<typeof RetinalLayer>;

/** Couches cornéennes (OCT segment antérieur) — saisie manuelle. */
export const CornealLayer = z.enum([
  "Épithélium", "Bowman", "Stroma", "Descemet", "Endothélium", "Toute épaisseur",
]);
export type CornealLayer = z.infer<typeof CornealLayer>;

/** Position transverse dans une coupe, selon l'éloignement du centre. */
export const TransverseZone = z.enum(["centrale", "paracentrale", "périphérique"]);
export type TransverseZone = z.infer<typeof TransverseZone>;

/**
 * Famille d'attribution : référentiel d'interprétation d'une lésion. Plusieurs
 * types de coupe partagent la même famille (cornea+angle, octa+enface).
 */
export const AttrContext = z.enum(["retino", "bscan", "cornea", "octa"]);
export type AttrContext = z.infer<typeof AttrContext>;

export const attrContextForKind = (kind: ImageKind): AttrContext => {
  switch (kind) {
    case "retino": return "retino";
    case "bscan": return "bscan";
    case "cornea":
    case "angle": return "cornea";
    case "octa":
    case "enface": return "octa";
  }
};

const VascularRelation = z.object({
  nearVessel: z.boolean(),
  distanceToVesselMm: z.number().nullable(),
});

/** Attributs — rétinographie de face (référentiel fovéa/papille/ETDRS). */
export const RetinoAttributes = z.object({
  context: z.literal("retino"),
  anatomicalZone: AnatomicalZone,
  quadrant: Quadrant,
  foveaBand: FoveaBand,
  distanceToFoveaMm: z.number(),
  etdrsSector: EtdrsSector.nullable(),
  distanceToDiscMm: z.number(),
  vascularRelation: VascularRelation,
});
export type RetinoAttributes = z.infer<typeof RetinoAttributes>;

/** Attributs — coupe B-scan rétinienne (position transverse + couche). */
export const BscanAttributes = z.object({
  context: z.literal("bscan"),
  transverseZone: TransverseZone,
  layer: RetinalLayer.nullable(),
});
export type BscanAttributes = z.infer<typeof BscanAttributes>;

/** Attributs — coupe cornée / angle irido-cornéen (couche cornéenne). */
export const CorneaAttributes = z.object({
  context: z.literal("cornea"),
  transverseZone: TransverseZone,
  layer: CornealLayer.nullable(),
});
export type CorneaAttributes = z.infer<typeof CorneaAttributes>;

/** Attributs — OCT-A / en-face (secteur simple). */
export const OctaAttributes = z.object({
  context: z.literal("octa"),
  transverseZone: TransverseZone,
});
export type OctaAttributes = z.infer<typeof OctaAttributes>;

/** Attributs cliniques dérivés, discriminés par famille d'attribution. */
export const DerivedAttributes = z.discriminatedUnion("context", [
  RetinoAttributes,
  BscanAttributes,
  CorneaAttributes,
  OctaAttributes,
]);
export type DerivedAttributes = z.infer<typeof DerivedAttributes>;

/** Libellé court de localisation, tolérant à toutes les familles d'attribution. */
export function anatomicalLabel(attrs: DerivedAttributes): string {
  switch (attrs.context) {
    case "retino":
      return attrs.anatomicalZone;
    case "bscan":
      return `B-scan · ${attrs.transverseZone}${attrs.layer ? ` · ${attrs.layer}` : ""}`;
    case "cornea":
      return `Cornée · ${attrs.transverseZone}${attrs.layer ? ` · ${attrs.layer}` : ""}`;
    case "octa":
      return `OCT-A · ${attrs.transverseZone}`;
  }
}

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
