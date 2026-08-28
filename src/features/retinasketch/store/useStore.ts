
import { create } from "zustand";
import type { Annotation, Laterality, ImageKind, ImageGeometry, RetinalLayer, CornealLayer } from "@/features/retinasketch/lib/types";
import { GEOMETRY_FOR_KIND, LABEL_FOR_KIND } from "@/features/retinasketch/lib/types";
import type { RetinaBackgroundSnapshot, RetinaSlotSnapshot } from "@/types/clinical";
import { computeAttributes, geometryMetrics, smoothFreeform, DEFAULT_TOPO_REFS, type TopoRefs } from "@/features/retinasketch/lib/geometry/engine";
import { TEMPLATE, createViewport, mirrorFor } from "@/features/retinasketch/lib/geometry/template";
import { imagePxToModelMm, imagePxLenToMm } from "@/features/retinasketch/lib/geometry/project";
import type { Pt } from "@/features/retinasketch/lib/geometry/angle";
import { getLesion } from "@/features/retinasketch/lib/ontology/lesions";
import type { EyeAnatomy, DiscShape, MaculaShape } from "@/features/retinasketch/lib/vision/anatomy";
import { polygonBBox } from "@/features/retinasketch/lib/vision/anatomy";

export type LayerKey =
  | "anatomy"
  | "nomenclature"
  | "quadrants"
  | "fovea"
  | "etdrs"
  | "periphery"
  | "vessels";

/** Disposition de l'espace de travail : 2 yeux côte à côte ou 1 œil plein cadre. */
export type WorkspaceLayout = "dual" | "mono";

/**
 * Outil de tracé actif :
 * - `lesion` : clic = spot, clic glissé = surface (comportement historique).
 * - `arrow`  : clic glissé = flèche de désignation (queue → pointe).
 */
export type DrawTool = "lesion" | "arrow";

/** Bornes de l'opacité globale des annotations (0 = invisibles, 1 = pleines). */
export const ANNOTATION_OPACITY_MIN = 0.2;
export const ANNOTATION_OPACITY_MAX = 1;
export const DEFAULT_ANNOTATION_OPACITY = 1;

/** Longueur minimale d'une flèche (mm) sous laquelle le tracé est ignoré. */
export const ARROW_MIN_LEN_MM = 0.4;

export const SPOT_MIN_MM = 0.15;
export const SPOT_MAX_MM = 4;

export const VIEW_MIN_SCALE = 0.5;
export const VIEW_MAX_SCALE = 8;

/**
 * Bornes du zoom de l'image de fond À L'INTÉRIEUR du cercle rétinien.
 * Min = 1 → la vue de départ (rétinographie à 50° remplissant le cercle) est la
 * limite basse : on ne peut jamais dézoomer au-delà de cette vue initiale.
 */
export const IMG_MIN_SCALE = 1;
export const IMG_MAX_SCALE = 8;

/** Carte indexée par latéralité (un enregistrement par œil). */
export type EyeMap<T> = Record<Laterality, T>;

/** Mesure d'angle iridocornéen : 3 points (fractions de largeur) + angle mesuré (°). */
export interface AngleMeasure {
  apex: Pt;
  armA: Pt;
  armB: Pt;
  angleDeg: number;
}

/** Transformation de vue (zoom/pan) — une par œil. */
export interface ViewState {
  scale: number;
  x: number; // translation écran (px)
  y: number;
}

/**
 * Image de rétinographie d'un œil, affichée en arrière-plan sous le schéma et
 * les annotations. La colorimétrie (opacité, luminosité, contraste, saturation)
 * est appliquée en CSS au rendu ; l'alignement (échelle, position, rotation)
 * permet de faire coïncider la fovéa et la papille réelles avec le template,
 * afin que la structuration des 4 niveaux reste cliniquement juste.
 */
export interface BackgroundState {
  src: string | null; // object URL (blob:) ou data URL — image AFFICHÉE
  srcOriginal: string | null; // image d'origine si le fond noir a été retiré
  blackRemoved: boolean; // vrai si le fond noir est actuellement détouré
  fileName: string | null;
  natW: number; // dimensions naturelles de l'image (px), 0 si inconnues
  natH: number;
  visible: boolean;
  vesselsSrc: string | null; // calque vaisseaux détectés (dataURL PNG)
  showVessels: boolean;
  // ——— Colorimétrie ———
  opacity: number; // 0..1
  brightness: number; // %, 100 = neutre
  contrast: number; // %, 100 = neutre
  saturation: number; // %, 100 = neutre
  // ——— Tons & netteté (0 = neutre) ———
  sharpness: number; // 0..100, accentuation locale des contours
  highlights: number; // -100..100, tons clairs
  shadows: number; // -100..100, tons foncés
  whites: number; // -100..100, point blanc
  blacks: number; // -100..100, point noir
  // ——— Alignement ———
  scale: number; // multiplicateur, 1 = ajusté au contour
  offsetXMm: number; // décalage horizontal (mm, +x = droite écran)
  offsetYMm: number; // décalage vertical (mm, +y = bas écran)
  rotationDeg: number; // rotation horaire
}

const DEFAULT_BACKGROUND_ADJ = {
  visible: true,
  opacity: 1,
  brightness: 100,
  contrast: 100,
  saturation: 100,
  sharpness: 0,
  highlights: 0,
  shadows: 0,
  whites: 0,
  blacks: 0,
  scale: 1,
  offsetXMm: 0,
  offsetYMm: 0,
  rotationDeg: 0,
} satisfies Omit<
  BackgroundState,
  | "src"
  | "srcOriginal"
  | "blackRemoved"
  | "fileName"
  | "natW"
  | "natH"
  | "vesselsSrc"
  | "showVessels"
>;

/** Fabrique un état d'image vierge (un par œil). */
function freshBackground(): BackgroundState {
  return {
    src: null,
    srcOriginal: null,
    blackRemoved: false,
    fileName: null,
    natW: 0,
    natH: 0,
    vesselsSrc: null,
    showVessels: false,
    ...DEFAULT_BACKGROUND_ADJ,
  };
}

/** Libère les object URLs (blob:) détenus par une image de fond. */
function revokeBackground(bg: BackgroundState) {
  if (bg.src?.startsWith("blob:")) URL.revokeObjectURL(bg.src);
  if (bg.srcOriginal?.startsWith("blob:")) URL.revokeObjectURL(bg.srcOriginal);
}

const freshView = (): ViewState => ({ scale: 1, x: 0, y: 0 });

/**
 * Galerie multi-images (Lot B) — chaque œil porte une liste de slots, chacun
 * portant son type/géométrie. Le slot ACTIF de chaque œil a ses données de
 * travail dans les champs existants (`backgrounds`/`anatomy`/`views`/`annotations`),
 * pour ne pas casser les consommateurs. Les slots INACTIFS sont rangés dans
 * `stash` (indexé par `id`) et échangés lors de la sélection.
 */
export interface SlotMeta {
  id: string;
  kind: ImageKind;
  geometry: ImageGeometry;
  label: string;
  /** Inclus dans l'impression et le compte rendu (sélection menu impression). */
  printSelected: boolean;
  /** Demi-dimensions custom du cadre (mm) — template libre à rognage dynamique. */
  frameHalfWMm?: number;
  frameHalfHMm?: number;
}

/** Données de travail rangées d'un slot inactif. */
export interface SlotData {
  background: BackgroundState;
  anatomy: EyeAnatomy | null;
  view: ViewState;
  annotations: Annotation[];
}

let slotCounter = 0;
const newSlotId = () => `s${Date.now().toString(36)}${(slotCounter++).toString(36)}`;

/** Crée un slot rétino vierge (slot de base de chaque œil). */
function freshRetinoSlot(): SlotMeta {
  return {
    id: newSlotId(),
    kind: "retino",
    geometry: GEOMETRY_FOR_KIND.retino,
    label: LABEL_FOR_KIND.retino,
    printSelected: true,
  };
}

/** Données vierges pour un nouveau slot (image vide, aucune annotation). */
const freshSlotData = (): SlotData => ({
  background: freshBackground(),
  anatomy: null,
  view: freshView(),
  annotations: [],
});

/** Reconstruit un BackgroundState à partir d'un instantané persisté (restore). */
function backgroundStateFromSnapshot(snap: RetinaBackgroundSnapshot): BackgroundState {
  return {
    ...freshBackground(),
    src: snap.src,
    fileName: "image.jpg",
    natW: snap.natW,
    natH: snap.natH,
    visible: snap.visible,
    opacity: snap.opacity,
    brightness: snap.brightness,
    contrast: snap.contrast,
    saturation: snap.saturation,
    // Tons & netteté — anciens instantanés sans ces champs → neutre.
    sharpness: snap.sharpness ?? 0,
    highlights: snap.highlights ?? 0,
    shadows: snap.shadows ?? 0,
    whites: snap.whites ?? 0,
    blacks: snap.blacks ?? 0,
    scale: snap.scale,
    offsetXMm: snap.offsetXMm,
    offsetYMm: snap.offsetYMm,
    rotationDeg: snap.rotationDeg,
  };
}

/**
 * Énumère les slots d'un œil avec leurs données de travail — le slot actif est
 * lu dans les champs courants, les inactifs dans le stash. Utilisé à la
 * fermeture pour sérialiser toute la galerie.
 */
/**
 * Nombre total de brouillons à identifier : slots actifs (annotations à plat)
 * + slots rangés (autres images de la galerie). Permet à la barre « à
 * identifier » de refléter toutes les images, pas seulement l'image affichée.
 */
export function countAllDrafts(s: {
  annotations: Annotation[];
  slotStash: Record<string, SlotData>;
}): number {
  const active = s.annotations.filter((a) => a.status === "draft").length;
  const stashed = Object.values(s.slotStash).reduce(
    (n, d) => n + d.annotations.filter((a) => a.status === "draft").length,
    0,
  );
  return active + stashed;
}

export function collectEyeSlots(eye: Laterality): { meta: SlotMeta; data: SlotData }[] {
  const s = useStore.getState();
  return s.slots[eye].map((meta) => {
    if (meta.id === s.activeSlot[eye]) {
      return {
        meta,
        data: {
          background: s.backgrounds[eye],
          anatomy: s.anatomy[eye],
          view: s.views[eye],
          annotations: s.annotations.filter((a) => a.laterality === eye),
        },
      };
    }
    return { meta, data: s.slotStash[meta.id] ?? freshSlotData() };
  });
}

interface State {
  /** Œil actif : reçoit les nouvelles annotations, cible de l'import et des outils. */
  laterality: Laterality;
  /** Disposition de l'espace : 2 yeux (défaut) ou 1 œil plein cadre. */
  layout: WorkspaceLayout;
  layers: Record<LayerKey, boolean>;
  annotations: Annotation[];
  hiddenLesionIds: string[];
  paletteOpen: boolean;
  spotRadiusMm: number;
  /** Outil de tracé actif (spot/surface ou flèche). */
  drawTool: DrawTool;
  /** Opacité globale appliquée au rendu de toutes les annotations (0.2..1). */
  annotationOpacity: number;
  author: string;
  /** Image de fond par œil. */
  backgrounds: EyeMap<BackgroundState>;
  /** Mode pointage des repères d'alignement (fovéa puis papille). */
  pointing: boolean;
  /** Mode d'ajustement de l'image à la souris (glisser = bouger, molette = zoom). */
  adjustImage: boolean;
  /** Zoom/pan par œil. */
  views: EyeMap<ViewState>;
  /** Vue double œil (OD|OG) pour impression paysage / export PDF. */
  doubleView: boolean;
  /** Mode SAM : clic → masque (pré-annotation IA). */
  samMode: boolean;
  /** Mode sélection : le clic sélectionne une lésion (au lieu d'en créer une). */
  selectMode: boolean;
  /** Annotation sélectionnée (édition / suppression individuelle). */
  selectedAnnotationId: string | null;
  /** Plusieurs lésions sous le clic → liste à choisir (coordonnées écran du panneau). */
  overlapPick: { eye: Laterality; x: number; y: number; ids: string[] } | null;
  /** Anatomie spécifique détectée/corrigée par œil (papille + macula, px image). */
  anatomy: EyeMap<EyeAnatomy | null>;
  /** Affichage de la proposition anatomique (calque). */
  anatomyVisible: boolean;
  /** Mode édition de l'anatomie (déplacer/redimensionner — outil de précision mono). */
  anatomyEdit: boolean;

  /** Épaisseur cornéenne (pachymétrie, µm) par œil — saisie sous une coupe OCT antérieur. */
  cornealThickness: EyeMap<string>;
  /**
   * Mesure d'angle iridocornéen par œil (template angle IC) : 3 points en
   * fractions de la largeur du panneau (redessin) + angle mesuré (autoritaire).
   */
  angleMeasure: EyeMap<AngleMeasure | null>;
  /** Grade de Shaffer forcé manuellement (0–4) ; null = déduit de l'angle. */
  shafferOverride: EyeMap<number | null>;
  /** Qualificatifs de la papille par œil (rétinographie) : pâle / surélevée / bords flous. */
  papillaQualifiers: EyeMap<string[]>;
  /**
   * Taille réelle (px) de la zone de dessin de l'œil affiché en plein cadre.
   * Partagée avec les overlays de précision (anatomie, angle…) pour qu'ils
   * projettent EXACTEMENT comme `RetinaStage` (même `vp`), sinon les poignées se
   * décalent du rendu (la galerie et les bandeaux réduisent la hauteur utile).
   */
  paneSize: { w: number; h: number };

  // ——— Galerie multi-images (Lot B) ———
  /** Liste des slots (ordre galerie) par œil. Le 1er slot est la rétino de base. */
  slots: EyeMap<SlotMeta[]>;
  /** Id du slot actif par œil (ses données vivent dans les champs de travail). */
  activeSlot: EyeMap<string>;
  /** Données rangées des slots INACTIFS, indexées par id de slot. */
  slotStash: Record<string, SlotData>;

  setLaterality: (l: Laterality) => void;
  setLayout: (l: WorkspaceLayout) => void;
  toggleLayer: (k: LayerKey) => void;
  /** Remplace l'état complet des calques (restauration depuis un CR sauvegardé). */
  setLayers: (layers: Record<LayerKey, boolean>) => void;
  setPaletteOpen: (open: boolean) => void;
  setSpotRadius: (mm: number) => void;
  adjustSpotRadius: (deltaMm: number) => void;
  setDrawTool: (t: DrawTool) => void;
  setAnnotationOpacity: (v: number) => void;
  /** Renseigne l'épaisseur cornéenne (µm) de l'œil (défaut = œil courant). */
  setCornealThickness: (v: string, eye?: Laterality) => void;
  /** Redimensionne le cadre du slot actif (template libre), demi-dimensions mm. */
  setActiveSlotFrame: (halfWMm: number, halfHMm: number, eye?: Laterality) => void;
  /** Enregistre la mesure d'angle iridocornéen de l'œil (template angle IC). */
  setAngleMeasure: (m: AngleMeasure | null, eye?: Laterality) => void;
  /** Force (ou libère avec null) le grade de Shaffer de l'œil. */
  setShafferOverride: (grade: number | null, eye?: Laterality) => void;
  /** Active/désactive un qualificatif de papille (rétinographie). */
  togglePapillaQualifier: (q: string, eye?: Laterality) => void;
  /** Publie la taille de la zone de dessin plein cadre (pour les overlays). */
  setPaneSize: (w: number, h: number) => void;

  setBackgroundImage: (src: string, fileName: string, eye?: Laterality) => void;
  updateBackground: (patch: Partial<BackgroundState>, eye?: Laterality) => void;
  toggleBackgroundVisibility: (eye?: Laterality) => void;
  resetBackgroundAdjustments: (eye?: Laterality) => void;
  /** Réinitialise uniquement la position/zoom/rotation de l'image (pas la colorimétrie). */
  resetBackgroundTransform: (eye?: Laterality) => void;
  removeBackground: (eye?: Laterality) => void;
  setPointing: (v: boolean) => void;
  setAdjustImage: (v: boolean) => void;
  setView: (v: ViewState, eye?: Laterality) => void;
  resetView: (eye?: Laterality) => void;
  setDoubleView: (v: boolean) => void;
  setSamMode: (v: boolean) => void;
  setSelectMode: (v: boolean) => void;
  selectAnnotation: (id: string | null) => void;
  setOverlapPick: (p: State["overlapPick"]) => void;

  // ——— Anatomie spécifique (papille + macula) ———
  /** Enregistre/efface l'anatomie d'un œil (détection ou sauvegarde). */
  setAnatomy: (eye: Laterality, a: EyeAnatomy | null) => void;
  /** Édite la papille (déplacer/redimensionner) — marque la source « manual ». */
  patchAnatomyDisc: (eye: Laterality, patch: Partial<DiscShape>) => void;
  /** Édite la macula (déplacer) — marque la source « manual ». */
  patchAnatomyMacula: (eye: Laterality, patch: Partial<MaculaShape>) => void;
  /** Remplace le contour (forme) de la papille — édition par sommets, source « manual ». */
  setDiscPolygon: (eye: Laterality, polygon: number[]) => void;
  clearAnatomy: (eye?: Laterality) => void;
  setAnatomyVisible: (v: boolean) => void;
  setAnatomyEdit: (v: boolean) => void;

  // ——— Galerie multi-images (Lot B) ———
  /** Ajoute un slot du type donné à un œil et le rend actif. Retourne son id. */
  addSlot: (kind: ImageKind, eye?: Laterality) => string;
  /** Sélectionne (rend actif) un slot d'un œil : échange les données de travail. */
  selectSlot: (id: string, eye?: Laterality) => void;
  /** Supprime un slot (≥ 1 slot conservé par œil). */
  removeSlot: (id: string, eye?: Laterality) => void;
  /** Modifie les métadonnées d'un slot (libellé, inclusion impression/CR). */
  updateSlotMeta: (id: string, patch: Partial<Pick<SlotMeta, "label" | "printSelected">>, eye?: Laterality) => void;
  /** Inverse l'inclusion d'un slot dans l'impression et le compte rendu. */
  toggleSlotPrint: (id: string, eye?: Laterality) => void;
  /** Restaure la galerie d'un œil depuis des instantanés persistés (au montage). */
  hydrateEyeSlots: (eye: Laterality, snaps: RetinaSlotSnapshot[]) => void;

  addSpot: (mx: number, my: number, eye?: Laterality) => void;
  addFreeform: (points: number[], eye?: Laterality) => void;
  /** Ajoute une flèche de désignation (brouillon) — `points = [xQueue,yQueue,xPointe,yPointe]`. */
  addArrow: (points: number[], eye?: Laterality) => void;
  /** Ajoute un polygone de lésion (brouillon) — utilisé par la pré-annotation SAM. */
  addLesionPolygon: (points: number[], eye?: Laterality) => void;

  /** Valide TOUS les brouillons avec la lésion choisie. */
  assignLesion: (lesionId: string) => void;
  /** Édition d'une couche : (ré)assigne une lésion à UNE annotation (la valide). */
  setAnnotationLesion: (id: string, lesionId: string) => void;
  /** Définit la couche d'une lésion sur coupe B-scan (rétine) ou cornée. */
  setAnnotationLayer: (id: string, layer: RetinalLayer | CornealLayer | null) => void;
  deleteAnnotation: (id: string) => void;
  deleteLesionGroup: (lesionId: string) => void;
  toggleLesionVisibility: (lesionId: string) => void;
  clearAll: () => void;

  // ——— Intégration (amorçage / nettoyage depuis la consultation) ———
  /** Amorce les annotations (OD + OG confondues, distinguées par `laterality`). */
  loadAnnotations: (anns: Annotation[]) => void;
  /** Réinitialise tout l'état (annotations, images, anatomie, vues) — au démontage. */
  resetAll: () => void;
}

let counter = 0;
const newId = () => `a${Date.now().toString(36)}${(counter++).toString(36)}`;
const clampRadius = (mm: number) =>
  Math.max(SPOT_MIN_MM, Math.min(SPOT_MAX_MM, mm));

/**
 * Repères de nomenclature (mm modèle) d'un œil : centres macula/papille détectés
 * s'ils existent (→ découpage 8 zones collant à l'anatomie réelle), sinon le
 * TEMPLATE standard. `imagePxToModelMm` est indépendant de la taille d'affichage
 * (le viewport se simplifie), d'où le viewport factice.
 */
function topoRefsForEye(s: State, eye: Laterality): TopoRefs {
  const anatomy = s.anatomy[eye];
  if (!anatomy || (!anatomy.macula && !anatomy.disc)) return DEFAULT_TOPO_REFS;
  const bg = s.backgrounds[eye];
  const vp = createViewport(1000, 1000, mirrorFor(eye));
  const bgT = {
    natW: anatomy.natW,
    natH: anatomy.natH,
    offsetXMm: bg.offsetXMm,
    offsetYMm: bg.offsetYMm,
    scale: bg.scale,
    rotationDeg: bg.rotationDeg,
  };
  return {
    fovea: anatomy.macula
      ? imagePxToModelMm(anatomy.macula.cx, anatomy.macula.cy, bgT, vp)
      : DEFAULT_TOPO_REFS.fovea,
    disc: anatomy.disc
      ? imagePxToModelMm(anatomy.disc.cx, anatomy.disc.cy, bgT, vp)
      : DEFAULT_TOPO_REFS.disc,
    maculaRmm: anatomy.macula
      ? imagePxLenToMm(anatomy.macula.r, anatomy.natW, anatomy.natH)
      : DEFAULT_TOPO_REFS.maculaRmm,
  };
}

function buildAnnotation(
  kind: "point" | "polygon" | "arrow",
  points: number[],
  radiusMm: number | null,
  laterality: Laterality,
  author: string,
  slotKind: ImageKind,
  refs: TopoRefs = DEFAULT_TOPO_REFS,
): Annotation {
  const { centroid, areaMm2 } = geometryMetrics(kind, points);
  return {
    id: newId(),
    kind,
    points,
    radiusMm,
    centroidMm: centroid,
    areaMm2:
      kind === "point" && radiusMm
        ? Math.round(Math.PI * radiusMm * radiusMm * 100) / 100
        : areaMm2,
    laterality,
    lesionId: null,
    status: "draft",
    // L'attribution dépend du type de coupe du slot actif (rétino, B-scan, …)
    // et des repères anatomiques (centres détectés si disponibles).
    attrs: computeAttributes(centroid, slotKind, refs),
    author,
    createdAt: new Date().toISOString(),
  };
}

/** Type de coupe du slot actif d'un œil (défaut « retino » si introuvable). */
function activeKind(s: State, eye: Laterality): ImageKind {
  const slotId = s.activeSlot[eye];
  return s.slots[eye].find((sl) => sl.id === slotId)?.kind ?? "retino";
}

/** Slots rétino de base (un par œil) au démarrage / après reset. */
function initialSlots(): { slots: EyeMap<SlotMeta[]>; activeSlot: EyeMap<string> } {
  const od = freshRetinoSlot();
  const os = freshRetinoSlot();
  return { slots: { OD: [od], OS: [os] }, activeSlot: { OD: od.id, OS: os.id } };
}

export const useStore = create<State>((set, get) => ({
  laterality: "OD",
  layout: "dual",
  layers: {
    // « Zones anatomiques » = modèle générique (papille/macula standard) en mode
    // démonstration → désactivé par défaut (on abandonne le repère fixe).
    anatomy: false,
    // « Nouvelle nomenclature » = découpage topographique 8 zones (item 4/5).
    nomenclature: false,
    quadrants: false,
    fovea: false,
    etdrs: false,
    periphery: false,
    vessels: false,
  },
  annotations: [],
  hiddenLesionIds: [],
  paletteOpen: false,
  spotRadiusMm: 0.5,
  drawTool: "lesion",
  annotationOpacity: DEFAULT_ANNOTATION_OPACITY,
  author: "Dr. Utilisateur",
  backgrounds: { OD: freshBackground(), OS: freshBackground() },
  pointing: false,
  adjustImage: false,
  views: { OD: freshView(), OS: freshView() },
  doubleView: false,
  samMode: false,
  selectMode: false,
  selectedAnnotationId: null,
  overlapPick: null,
  anatomy: { OD: null, OS: null },
  anatomyVisible: true,
  anatomyEdit: false,
  cornealThickness: { OD: "", OS: "" },
  angleMeasure: { OD: null, OS: null },
  shafferOverride: { OD: null, OS: null },
  papillaQualifiers: { OD: [], OS: [] },
  paneSize: { w: 0, h: 0 },
  ...initialSlots(),
  slotStash: {},

  setLaterality: (l) => set({ laterality: l }),
  setLayout: (l) => set({ layout: l }),
  toggleLayer: (k) =>
    set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  setLayers: (layers) => set({ layers: { ...layers } }),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setSpotRadius: (mm) => set({ spotRadiusMm: clampRadius(mm) }),
  adjustSpotRadius: (deltaMm) =>
    set((s) => ({ spotRadiusMm: clampRadius(s.spotRadiusMm + deltaMm) })),
  setDrawTool: (t) => set({ drawTool: t }),
  setAnnotationOpacity: (v) =>
    set({
      annotationOpacity: Math.max(
        ANNOTATION_OPACITY_MIN,
        Math.min(ANNOTATION_OPACITY_MAX, v),
      ),
    }),
  setCornealThickness: (v, eye) =>
    set((s) => ({
      cornealThickness: { ...s.cornealThickness, [eye ?? s.laterality]: v },
    })),
  setActiveSlotFrame: (halfWMm, halfHMm, eye) =>
    set((s) => {
      const k = eye ?? s.laterality;
      const activeId = s.activeSlot[k];
      return {
        slots: {
          ...s.slots,
          [k]: s.slots[k].map((sl) =>
            sl.id === activeId ? { ...sl, frameHalfWMm: halfWMm, frameHalfHMm: halfHMm } : sl,
          ),
        },
      };
    }),
  setAngleMeasure: (m, eye) =>
    set((s) => ({ angleMeasure: { ...s.angleMeasure, [eye ?? s.laterality]: m } })),
  setShafferOverride: (grade, eye) =>
    set((s) => ({ shafferOverride: { ...s.shafferOverride, [eye ?? s.laterality]: grade } })),
  togglePapillaQualifier: (q, eye) =>
    set((s) => {
      const k = eye ?? s.laterality;
      const cur = s.papillaQualifiers[k];
      const next = cur.includes(q) ? cur.filter((x) => x !== q) : [...cur, q];
      return { papillaQualifiers: { ...s.papillaQualifiers, [k]: next } };
    }),
  setPaneSize: (w, h) =>
    set((s) => (s.paneSize.w === w && s.paneSize.h === h ? {} : { paneSize: { w, h } })),

  setBackgroundImage: (src, fileName, eye) =>
    set((s) => {
      const k = eye ?? s.laterality;
      // Libère l'ancienne image de CET œil avant de la remplacer.
      revokeBackground(s.backgrounds[k]);
      return {
        backgrounds: {
          ...s.backgrounds,
          [k]: { ...freshBackground(), src, fileName },
        },
        // Nouvelle image → l'anatomie détectée précédente est périmée.
        anatomy: { ...s.anatomy, [k]: null },
      };
    }),

  updateBackground: (patch, eye) =>
    set((s) => {
      const k = eye ?? s.laterality;
      return {
        backgrounds: { ...s.backgrounds, [k]: { ...s.backgrounds[k], ...patch } },
      };
    }),

  toggleBackgroundVisibility: (eye) =>
    set((s) => {
      const k = eye ?? s.laterality;
      return {
        backgrounds: {
          ...s.backgrounds,
          [k]: { ...s.backgrounds[k], visible: !s.backgrounds[k].visible },
        },
      };
    }),

  resetBackgroundAdjustments: (eye) =>
    set((s) => {
      const k = eye ?? s.laterality;
      return {
        backgrounds: {
          ...s.backgrounds,
          [k]: { ...s.backgrounds[k], ...DEFAULT_BACKGROUND_ADJ },
        },
      };
    }),

  resetBackgroundTransform: (eye) =>
    set((s) => {
      const k = eye ?? s.laterality;
      return {
        backgrounds: {
          ...s.backgrounds,
          [k]: { ...s.backgrounds[k], scale: 1, offsetXMm: 0, offsetYMm: 0, rotationDeg: 0 },
        },
      };
    }),

  removeBackground: (eye) =>
    set((s) => {
      const k = eye ?? s.laterality;
      revokeBackground(s.backgrounds[k]);
      return {
        backgrounds: { ...s.backgrounds, [k]: freshBackground() },
        anatomy: { ...s.anatomy, [k]: null },
        pointing: false,
        anatomyEdit: false,
      };
    }),

  setPointing: (v) =>
    set({ pointing: v, adjustImage: v ? false : get().adjustImage, samMode: v ? false : get().samMode, selectMode: v ? false : get().selectMode, anatomyEdit: v ? false : get().anatomyEdit }),
  setAdjustImage: (v) =>
    set({ adjustImage: v, pointing: v ? false : get().pointing, samMode: v ? false : get().samMode, selectMode: v ? false : get().selectMode, anatomyEdit: v ? false : get().anatomyEdit }),
  setSamMode: (v) =>
    set({ samMode: v, pointing: v ? false : get().pointing, adjustImage: v ? false : get().adjustImage, selectMode: v ? false : get().selectMode, anatomyEdit: v ? false : get().anatomyEdit }),
  setSelectMode: (v) =>
    set({
      selectMode: v,
      // La sélection est exclusive des outils de précision ; on nettoie en sortie.
      pointing: v ? false : get().pointing,
      adjustImage: v ? false : get().adjustImage,
      samMode: v ? false : get().samMode,
      anatomyEdit: v ? false : get().anatomyEdit,
      selectedAnnotationId: v ? get().selectedAnnotationId : null,
      overlapPick: null,
    }),
  selectAnnotation: (id) => set({ selectedAnnotationId: id, overlapPick: null }),
  setOverlapPick: (p) => set({ overlapPick: p }),

  setAnatomy: (eye, a) =>
    set((s) => ({ anatomy: { ...s.anatomy, [eye]: a }, anatomyVisible: true })),
  patchAnatomyDisc: (eye, patch) =>
    set((s) => {
      const a = s.anatomy[eye];
      if (!a || !a.disc) return {};
      const old = a.disc;
      // Les contours IA (papille + cup) suivent la correction manuelle :
      // translation au déplacement, homothétie autour du centre au redimensionnement.
      const dx = (patch.cx ?? old.cx) - old.cx;
      const dy = (patch.cy ?? old.cy) - old.cy;
      const k = patch.rx !== undefined && old.rx > 0 ? patch.rx / old.rx : 1;
      const cx = patch.cx ?? old.cx;
      const cy = patch.cy ?? old.cy;
      const xform = (poly?: number[]) => {
        if (!poly || poly.length < 6) return poly;
        return poly.map((v, i) => {
          const isX = i % 2 === 0;
          const c = isX ? cx : cy;
          return c + (v + (isX ? dx : dy) - c) * k;
        });
      };
      return {
        anatomy: {
          ...s.anatomy,
          [eye]: {
            ...a,
            disc: {
              ...old,
              ...patch,
              polygon: xform(old.polygon),
              cupPolygon: xform(old.cupPolygon),
            },
            source: "manual",
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }),
  patchAnatomyMacula: (eye, patch) =>
    set((s) => {
      const a = s.anatomy[eye];
      if (!a || !a.macula) return {};
      return {
        anatomy: {
          ...s.anatomy,
          [eye]: { ...a, macula: { ...a.macula, ...patch }, source: "manual", updatedAt: new Date().toISOString() },
        },
      };
    }),
  setDiscPolygon: (eye, polygon) =>
    set((s) => {
      const a = s.anatomy[eye];
      if (!a || !a.disc || polygon.length < 6) return {};
      // L'ellipse englobante (cx/cy/rx/ry) est recalculée à partir du contour →
      // les poignées « déplacer / redimensionner » restent cohérentes avec la forme.
      const bb = polygonBBox(polygon);
      return {
        anatomy: {
          ...s.anatomy,
          [eye]: {
            ...a,
            disc: { ...a.disc, polygon, cx: bb.cx, cy: bb.cy, rx: bb.rx, ry: bb.ry },
            source: "manual",
            updatedAt: new Date().toISOString(),
          },
        },
      };
    }),
  clearAnatomy: (eye) =>
    set((s) => {
      const k = eye ?? s.laterality;
      return { anatomy: { ...s.anatomy, [k]: null }, anatomyEdit: false };
    }),
  setAnatomyVisible: (v) => set({ anatomyVisible: v }),
  setAnatomyEdit: (v) =>
    set({
      anatomyEdit: v,
      // Exclusif des autres outils de précision / sélection.
      pointing: v ? false : get().pointing,
      adjustImage: v ? false : get().adjustImage,
      samMode: v ? false : get().samMode,
      selectMode: v ? false : get().selectMode,
      selectedAnnotationId: v ? null : get().selectedAnnotationId,
    }),

  // ——— Galerie multi-images (Lot B) ———
  addSlot: (kind, eye) => {
    const k = eye ?? get().laterality;
    const sameKind = get().slots[k].filter((sl) => sl.kind === kind).length;
    const label = sameKind === 0 ? LABEL_FOR_KIND[kind] : `${LABEL_FOR_KIND[kind]} ${sameKind + 1}`;
    const meta: SlotMeta = {
      id: newSlotId(),
      kind,
      geometry: GEOMETRY_FOR_KIND[kind],
      label,
      printSelected: true,
      // Template libre : cadre initial 0.9R × 0.6R, redimensionnable ensuite.
      ...(kind === "free"
        ? { frameHalfWMm: TEMPLATE.retina.halfWidthMm * 0.9, frameHalfHMm: TEMPLATE.retina.halfWidthMm * 0.6 }
        : {}),
    };
    set((s) => ({
      slots: { ...s.slots, [k]: [...s.slots[k], meta] },
      slotStash: { ...s.slotStash, [meta.id]: freshSlotData() },
    }));
    // Rendre le nouveau slot actif (échange des données de travail).
    get().selectSlot(meta.id, k);
    return meta.id;
  },

  selectSlot: (id, eye) =>
    set((s) => {
      const k = eye ?? s.laterality;
      if (s.activeSlot[k] === id || !s.slots[k].some((sl) => sl.id === id)) return {};
      const oldId = s.activeSlot[k];
      // Range les données de travail du slot actuellement actif.
      const captured: SlotData = {
        background: s.backgrounds[k],
        anatomy: s.anatomy[k],
        view: s.views[k],
        annotations: s.annotations.filter((a) => a.laterality === k),
      };
      const target = s.slotStash[id] ?? freshSlotData();
      const nextStash = { ...s.slotStash, [oldId]: captured };
      delete nextStash[id];
      return {
        backgrounds: { ...s.backgrounds, [k]: target.background },
        anatomy: { ...s.anatomy, [k]: target.anatomy },
        views: { ...s.views, [k]: target.view },
        // Remplace les annotations de CET œil, conserve celles de l'autre.
        annotations: [...s.annotations.filter((a) => a.laterality !== k), ...target.annotations],
        activeSlot: { ...s.activeSlot, [k]: id },
        slotStash: nextStash,
        // La sélection de slot annule les modes transitoires.
        pointing: false,
        adjustImage: false,
        samMode: false,
        selectMode: false,
        anatomyEdit: false,
        selectedAnnotationId: null,
        overlapPick: null,
      };
    }),

  removeSlot: (id, eye) => {
    const k = eye ?? get().laterality;
    const s0 = get();
    if (s0.slots[k].length <= 1) return; // toujours au moins un slot par œil
    // Si le slot actif est supprimé, on bascule d'abord sur un voisin (ses
    // données sont alors rangées dans le stash, puis effacées ci-dessous).
    if (s0.activeSlot[k] === id) {
      const neighbor = s0.slots[k].find((sl) => sl.id !== id);
      if (neighbor) get().selectSlot(neighbor.id, k);
    }
    set((s) => {
      const nextStash = { ...s.slotStash };
      if (nextStash[id]) revokeBackground(nextStash[id].background);
      delete nextStash[id];
      return {
        slots: { ...s.slots, [k]: s.slots[k].filter((sl) => sl.id !== id) },
        slotStash: nextStash,
      };
    });
  },

  updateSlotMeta: (id, patch, eye) =>
    set((s) => {
      const k = eye ?? s.laterality;
      return {
        slots: {
          ...s.slots,
          [k]: s.slots[k].map((sl) => (sl.id === id ? { ...sl, ...patch } : sl)),
        },
      };
    }),

  toggleSlotPrint: (id, eye) =>
    set((s) => {
      const k = eye ?? s.laterality;
      return {
        slots: {
          ...s.slots,
          [k]: s.slots[k].map((sl) =>
            sl.id === id ? { ...sl, printSelected: !sl.printSelected } : sl,
          ),
        },
      };
    }),

  hydrateEyeSlots: (eye, snaps) =>
    set((s) => {
      if (snaps.length === 0) return {};
      const metas: SlotMeta[] = snaps.map((sn) => ({
        id: sn.id,
        kind: sn.kind,
        geometry: sn.geometry,
        label: sn.label,
        printSelected: sn.printSelected ?? true,
        ...(sn.frameHalfWMm != null ? { frameHalfWMm: sn.frameHalfWMm } : {}),
        ...(sn.frameHalfHMm != null ? { frameHalfHMm: sn.frameHalfHMm } : {}),
      }));
      const toData = (sn: RetinaSlotSnapshot): SlotData => ({
        background: sn.background ? backgroundStateFromSnapshot(sn.background) : freshBackground(),
        anatomy: null, // l'anatomie (papille/macula) est re-détectée, non persistée
        view: freshView(),
        annotations: sn.annotations.map((a) => ({ ...a, laterality: eye })),
      });
      // Slot actif restauré = rétino (sinon le premier).
      const activeSnap = snaps.find((sn) => sn.kind === "retino") ?? snaps[0];
      const activeData = toData(activeSnap);
      const nextStash = { ...s.slotStash };
      snaps.forEach((sn) => {
        if (sn.id !== activeSnap.id) nextStash[sn.id] = toData(sn);
      });
      return {
        slots: { ...s.slots, [eye]: metas },
        activeSlot: { ...s.activeSlot, [eye]: activeSnap.id },
        slotStash: nextStash,
        backgrounds: { ...s.backgrounds, [eye]: activeData.background },
        anatomy: { ...s.anatomy, [eye]: activeData.anatomy },
        views: { ...s.views, [eye]: activeData.view },
        annotations: [...s.annotations.filter((a) => a.laterality !== eye), ...activeData.annotations],
      };
    }),

  setView: (v, eye) =>
    set((s) => {
      const k = eye ?? s.laterality;
      return { views: { ...s.views, [k]: v } };
    }),
  resetView: (eye) =>
    set((s) => {
      const k = eye ?? s.laterality;
      return { views: { ...s.views, [k]: freshView() } };
    }),
  setDoubleView: (v) => set({ doubleView: v }),

  addSpot: (mx, my, eye) =>
    set((s) => ({
      annotations: [
        ...s.annotations,
        buildAnnotation("point", [mx, my], s.spotRadiusMm, eye ?? s.laterality, s.author, activeKind(s, eye ?? s.laterality), topoRefsForEye(s, eye ?? s.laterality)),
      ],
    })),

  addFreeform: (points, eye) => {
    const smoothed = smoothFreeform(points);
    if (smoothed.length < 6) return;
    set((s) => ({
      annotations: [
        ...s.annotations,
        buildAnnotation("polygon", smoothed, null, eye ?? s.laterality, s.author, activeKind(s, eye ?? s.laterality), topoRefsForEye(s, eye ?? s.laterality)),
      ],
    }));
  },

  addArrow: (points, eye) => {
    // Flèche = segment queue → pointe. On ignore les tracés trop courts (clic
    // sans glissé) pour ne pas créer de flèches dégénérées.
    if (points.length < 4) return;
    const [x0, y0, x1, y1] = points;
    if (Math.hypot(x1 - x0, y1 - y0) < ARROW_MIN_LEN_MM) return;
    set((s) => ({
      annotations: [
        ...s.annotations,
        buildAnnotation("arrow", [x0, y0, x1, y1], null, eye ?? s.laterality, s.author, activeKind(s, eye ?? s.laterality), topoRefsForEye(s, eye ?? s.laterality)),
      ],
    }));
  },

  addLesionPolygon: (points, eye) => {
    // Polygone issu de SAM : déjà propre, on évite le lissage agressif.
    if (points.length < 6) return;
    set((s) => ({
      annotations: [
        ...s.annotations,
        buildAnnotation("polygon", points, null, eye ?? s.laterality, s.author, activeKind(s, eye ?? s.laterality), topoRefsForEye(s, eye ?? s.laterality)),
      ],
    }));
  },

  assignLesion: (lesionId) =>
    set((s) => {
      if (!getLesion(lesionId)) return {};
      // Identifie TOUS les brouillons en une fois : slots actifs (annotations à
      // plat, les deux yeux) ET slots rangés (autres images de la galerie). Le
      // clinicien peut ainsi marquer une même lésion sur un B-scan, une rétino
      // et l'œil controlatéral, puis l'identifier d'un seul geste.
      const validate = (a: Annotation): Annotation =>
        a.status === "draft" ? { ...a, lesionId, status: "validated" as const } : a;
      const activeHasDraft = s.annotations.some((a) => a.status === "draft");
      const stashHasDraft = Object.values(s.slotStash).some((d) =>
        d.annotations.some((a) => a.status === "draft"),
      );
      if (!activeHasDraft && !stashHasDraft) return {};
      const nextStash: Record<string, SlotData> = {};
      for (const [id, d] of Object.entries(s.slotStash)) {
        nextStash[id] = { ...d, annotations: d.annotations.map(validate) };
      }
      return {
        annotations: s.annotations.map(validate),
        slotStash: nextStash,
        paletteOpen: false,
      };
    }),

  setAnnotationLesion: (id, lesionId) =>
    set((s) => {
      if (!getLesion(lesionId)) return {};
      return {
        annotations: s.annotations.map((a) =>
          a.id === id ? { ...a, lesionId, status: "validated" as const } : a,
        ),
        paletteOpen: false,
      };
    }),

  setAnnotationLayer: (id, layer) =>
    set((s) => ({
      annotations: s.annotations.map((a) => {
        if (a.id !== id) return a;
        // La couche n'existe que pour les coupes transversales (B-scan / cornée).
        if (a.attrs.context === "bscan") {
          return { ...a, attrs: { ...a.attrs, layer: layer as RetinalLayer | null } };
        }
        if (a.attrs.context === "cornea") {
          return { ...a, attrs: { ...a.attrs, layer: layer as CornealLayer | null } };
        }
        return a;
      }),
    })),

  deleteAnnotation: (id) =>
    set((s) => ({
      annotations: s.annotations.filter((a) => a.id !== id),
      selectedAnnotationId: s.selectedAnnotationId === id ? null : s.selectedAnnotationId,
      overlapPick: null,
    })),

  deleteLesionGroup: (lesionId) =>
    set((s) => ({
      annotations: s.annotations.filter((a) => a.lesionId !== lesionId),
      selectedAnnotationId: s.annotations.some(
        (a) => a.id === s.selectedAnnotationId && a.lesionId === lesionId,
      )
        ? null
        : s.selectedAnnotationId,
    })),

  toggleLesionVisibility: (lesionId) =>
    set((s) => ({
      hiddenLesionIds: s.hiddenLesionIds.includes(lesionId)
        ? s.hiddenLesionIds.filter((x) => x !== lesionId)
        : [...s.hiddenLesionIds, lesionId],
    })),

  clearAll: () => set({ annotations: [], selectedAnnotationId: null, overlapPick: null }),

  loadAnnotations: (anns) =>
    set({ annotations: anns.map((a) => ({ ...a })), selectedAnnotationId: null, overlapPick: null }),

  resetAll: () =>
    set((s) => {
      revokeBackground(s.backgrounds.OD);
      revokeBackground(s.backgrounds.OS);
      // Libère aussi les images des slots inactifs rangés.
      Object.values(s.slotStash).forEach((d) => revokeBackground(d.background));
      return {
        annotations: [],
        hiddenLesionIds: [],
        selectedAnnotationId: null,
        overlapPick: null,
        backgrounds: { OD: freshBackground(), OS: freshBackground() },
        anatomy: { OD: null, OS: null },
        views: { OD: freshView(), OS: freshView() },
        cornealThickness: { OD: "", OS: "" },
        angleMeasure: { OD: null, OS: null },
        shafferOverride: { OD: null, OS: null },
        papillaQualifiers: { OD: [], OS: [] },
        ...initialSlots(),
        slotStash: {},
        paletteOpen: false,
        pointing: false,
        adjustImage: false,
        samMode: false,
        selectMode: false,
        anatomyEdit: false,
        layout: "dual",
        doubleView: false,
        drawTool: "lesion",
        annotationOpacity: DEFAULT_ANNOTATION_OPACITY,
      };
    }),
}));
