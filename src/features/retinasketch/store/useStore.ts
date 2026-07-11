
import { create } from "zustand";
import type { Annotation, Laterality } from "@/features/retinasketch/lib/types";
import { computeAttributes, geometryMetrics, smoothFreeform } from "@/features/retinasketch/lib/geometry/engine";
import { getLesion } from "@/features/retinasketch/lib/ontology/lesions";
import type { EyeAnatomy, DiscShape, MaculaShape } from "@/features/retinasketch/lib/vision/anatomy";
import { polygonBBox } from "@/features/retinasketch/lib/vision/anatomy";

export type LayerKey =
  | "anatomy"
  | "quadrants"
  | "fovea"
  | "etdrs"
  | "periphery"
  | "vessels";

/** Disposition de l'espace de travail : 2 yeux côte à côte ou 1 œil plein cadre. */
export type WorkspaceLayout = "dual" | "mono";

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

  setLaterality: (l: Laterality) => void;
  setLayout: (l: WorkspaceLayout) => void;
  toggleLayer: (k: LayerKey) => void;
  /** Remplace l'état complet des calques (restauration depuis un CR sauvegardé). */
  setLayers: (layers: Record<LayerKey, boolean>) => void;
  setPaletteOpen: (open: boolean) => void;
  setSpotRadius: (mm: number) => void;
  adjustSpotRadius: (deltaMm: number) => void;

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

  addSpot: (mx: number, my: number, eye?: Laterality) => void;
  addFreeform: (points: number[], eye?: Laterality) => void;
  /** Ajoute un polygone de lésion (brouillon) — utilisé par la pré-annotation SAM. */
  addLesionPolygon: (points: number[], eye?: Laterality) => void;

  /** Valide TOUS les brouillons avec la lésion choisie. */
  assignLesion: (lesionId: string) => void;
  /** Édition d'une couche : (ré)assigne une lésion à UNE annotation (la valide). */
  setAnnotationLesion: (id: string, lesionId: string) => void;
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

function buildAnnotation(
  kind: "point" | "polygon",
  points: number[],
  radiusMm: number | null,
  laterality: Laterality,
  author: string,
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
    attrs: computeAttributes(centroid),
    author,
    createdAt: new Date().toISOString(),
  };
}

export const useStore = create<State>((set, get) => ({
  laterality: "OD",
  layout: "dual",
  layers: {
    // « Zones anatomiques » = modèle générique (papille/macula standard) en mode
    // démonstration → désactivé par défaut (on abandonne le repère fixe).
    anatomy: false,
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

  setLaterality: (l) => set({ laterality: l }),
  setLayout: (l) => set({ layout: l }),
  toggleLayer: (k) =>
    set((s) => ({ layers: { ...s.layers, [k]: !s.layers[k] } })),
  setLayers: (layers) => set({ layers: { ...layers } }),
  setPaletteOpen: (open) => set({ paletteOpen: open }),
  setSpotRadius: (mm) => set({ spotRadiusMm: clampRadius(mm) }),
  adjustSpotRadius: (deltaMm) =>
    set((s) => ({ spotRadiusMm: clampRadius(s.spotRadiusMm + deltaMm) })),

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
        buildAnnotation("point", [mx, my], s.spotRadiusMm, eye ?? s.laterality, s.author),
      ],
    })),

  addFreeform: (points, eye) => {
    const smoothed = smoothFreeform(points);
    if (smoothed.length < 6) return;
    set((s) => ({
      annotations: [
        ...s.annotations,
        buildAnnotation("polygon", smoothed, null, eye ?? s.laterality, s.author),
      ],
    }));
  },

  addLesionPolygon: (points, eye) => {
    // Polygone issu de SAM : déjà propre, on évite le lissage agressif.
    if (points.length < 6) return;
    set((s) => ({
      annotations: [
        ...s.annotations,
        buildAnnotation("polygon", points, null, eye ?? s.laterality, s.author),
      ],
    }));
  },

  assignLesion: (lesionId) =>
    set((s) => {
      if (!getLesion(lesionId)) return {};
      const hasDraft = s.annotations.some((a) => a.status === "draft");
      if (!hasDraft) return {};
      return {
        annotations: s.annotations.map((a) =>
          a.status === "draft"
            ? { ...a, lesionId, status: "validated" as const }
            : a,
        ),
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
      return {
        annotations: [],
        hiddenLesionIds: [],
        selectedAnnotationId: null,
        overlapPick: null,
        backgrounds: { OD: freshBackground(), OS: freshBackground() },
        anatomy: { OD: null, OS: null },
        views: { OD: freshView(), OS: freshView() },
        paletteOpen: false,
        pointing: false,
        adjustImage: false,
        samMode: false,
        selectMode: false,
        anatomyEdit: false,
        layout: "dual",
        doubleView: false,
      };
    }),
}));
