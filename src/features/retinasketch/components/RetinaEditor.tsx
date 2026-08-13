import { useEffect, useRef } from "react";
import { useStore, collectEyeSlots } from "../store/useStore";
import type { Annotation } from "../lib/types";
import type { RetinaPrintInfo } from "../lib/printInfo";
import type { RetinaBackgroundSnapshot, RetinaLayers, RetinaSlotSnapshot } from "@/types/clinical";
import { snapshotBackground } from "../lib/export/backgroundSnapshot";
import Workspace from "./Workspace";

/** Instantané complet remonté à la fermeture (images + calques par œil). */
export interface RetinaCommit {
  /** Slot rétino de chaque œil (pont avec le CR actuel). */
  od: RetinaBackgroundSnapshot | null;
  og: RetinaBackgroundSnapshot | null;
  /** Galerie complète de chaque œil (rétino + OCT-A + en-face + B-scan). */
  odSlots: RetinaSlotSnapshot[];
  ogSlots: RetinaSlotSnapshot[];
  layers: RetinaLayers;
  /** Opacité globale des annotations au moment de la fermeture. */
  annotationOpacity: number;
}

interface RetinaEditorProps {
  /** Annotations de l'œil droit (convention store « OD »). */
  odAnnotations: Annotation[];
  /** Annotations de l'œil gauche (convention store « OS »). */
  ogAnnotations: Annotation[];
  onChangeOD: (annotations: Annotation[]) => void;
  onChangeOG: (annotations: Annotation[]) => void;
  /** Ferme la modale (bouton « Terminer »). */
  onClose: () => void;
  /** Crée et enregistre une lésion personnalisée en mémoire (couleur optionnelle). */
  onCreateLesion?: (name: string, color?: string) => Promise<{ id: string } | null>;
  /** Infos patient/clinique pour l'en-tête d'impression/export. */
  printInfo?: RetinaPrintInfo;
  /** Instantanés d'image existants (restaurés au montage). Legacy : slot rétino seul. */
  backgroundOD?: RetinaBackgroundSnapshot | null;
  backgroundOG?: RetinaBackgroundSnapshot | null;
  /** Galerie multi-images persistée (prioritaire sur backgroundOD/OG si présente). */
  retinaSlotsOD?: RetinaSlotSnapshot[];
  retinaSlotsOG?: RetinaSlotSnapshot[];
  /** Calques persistés (restaurés au montage). */
  layers?: RetinaLayers;
  /** Opacité globale des annotations (restaurée au montage). */
  annotationOpacity?: number;
  /** Remonte images + calques à la fermeture (persistance CR). */
  onCommit?: (commit: RetinaCommit) => void;
}

/** Applique un instantané d'image au store pour l'œil donné. */
function seedBackground(snap: RetinaBackgroundSnapshot | null | undefined, eye: "OD" | "OS") {
  if (!snap?.src) return;
  const st = useStore.getState();
  st.setBackgroundImage(snap.src, "retinographie.jpg", eye);
  st.updateBackground(
    {
      natW: snap.natW,
      natH: snap.natH,
      visible: snap.visible,
      opacity: snap.opacity,
      brightness: snap.brightness,
      contrast: snap.contrast,
      saturation: snap.saturation,
      // Tons & netteté (rétrocompat : anciens instantanés sans ces champs → neutre).
      sharpness: snap.sharpness ?? 0,
      highlights: snap.highlights ?? 0,
      shadows: snap.shadows ?? 0,
      whites: snap.whites ?? 0,
      blacks: snap.blacks ?? 0,
      scale: snap.scale,
      offsetXMm: snap.offsetXMm,
      offsetYMm: snap.offsetYMm,
      rotationDeg: snap.rotationDeg,
    },
    eye,
  );
}

/**
 * Éditeur RetinaSketch double-œil, monté en modale plein écran depuis la
 * consultation. Amorce le store avec les annotations OD + OG (confondues dans
 * une seule liste, distinguées par `laterality`), puis remonte séparément les
 * modifications de chaque œil. L'état est réinitialisé au démontage.
 */
export default function RetinaEditor({
  odAnnotations,
  ogAnnotations,
  onChangeOD,
  onChangeOG,
  onClose,
  onCreateLesion,
  printInfo,
  backgroundOD,
  backgroundOG,
  retinaSlotsOD,
  retinaSlotsOG,
  layers,
  annotationOpacity,
  onCommit,
}: RetinaEditorProps) {
  const annotations = useStore((s) => s.annotations);
  const mounted = useRef(false);

  // Amorçage unique au montage : la latéralité de chaque annotation est forcée
  // selon sa source (robuste même si la donnée stockée est incohérente). On
  // restaure aussi les images de fond et l'état des calques du CR précédent.
  useEffect(() => {
    const st = useStore.getState();
    st.setLayout("dual");
    // Galerie multi-images persistée (Lot B) prioritaire ; sinon chemin legacy
    // (une seule rétino par œil via backgroundOD/OG + annotations à plat).
    const hasSlots = !!(retinaSlotsOD?.length || retinaSlotsOG?.length);
    if (hasSlots) {
      if (retinaSlotsOD?.length) st.hydrateEyeSlots("OD", retinaSlotsOD);
      if (retinaSlotsOG?.length) st.hydrateEyeSlots("OS", retinaSlotsOG);
    } else {
      const seed: Annotation[] = [
        ...odAnnotations.map((a) => ({ ...a, laterality: "OD" as const })),
        ...ogAnnotations.map((a) => ({ ...a, laterality: "OS" as const })),
      ];
      st.loadAnnotations(seed);
      seedBackground(backgroundOD, "OD");
      seedBackground(backgroundOG, "OS");
    }
    if (layers) useStore.getState().setLayers(layers);
    if (annotationOpacity != null) useStore.getState().setAnnotationOpacity(annotationOpacity);
    mounted.current = true;
    return () => {
      mounted.current = false;
      useStore.getState().resetAll();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Remontée des modifications vers le formulaire (après amorçage).
  useEffect(() => {
    if (!mounted.current) return;
    onChangeOD(annotations.filter((a) => a.laterality === "OD"));
    onChangeOG(annotations.filter((a) => a.laterality === "OS"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [annotations]);

  // Fermeture : capture les images + calques puis remonte le tout avant de fermer.
  const handleClose = async () => {
    const st = useStore.getState();
    // Lésions dessinées mais non renseignées (brouillons) : on prévient le
    // clinicien et on DEMANDE confirmation avant de fermer. « Annuler » revient à
    // l'éditeur pour terminer l'identification ; « OK » ferme sans rien supprimer
    // (les brouillons sont conservés — inertes dans les comptes rendus tant qu'ils
    // ne sont pas identifiés — pour pouvoir être repris plus tard).
    const drafts = st.annotations.filter((a) => a.status === "draft");
    if (drafts.length > 0) {
      const s = drafts.length > 1 ? "s" : "";
      const ok = window.confirm(
        `${drafts.length} lésion${s} en cours d'identification (non renseignée${s}).\n` +
          `Voulez-vous quand même fermer RetinaSketch ?\n\n` +
          `Elle${s} ser${drafts.length > 1 ? "ont" : "a"} conservée${s} en brouillon.`,
      );
      if (!ok) return;
    }
    if (onCommit) {
      try {
        // Sérialise toute la galerie de chaque œil (slot actif + slots rangés).
        const buildSlots = (eye: "OD" | "OS"): Promise<RetinaSlotSnapshot[]> =>
          Promise.all(
            collectEyeSlots(eye).map(async ({ meta, data }) => ({
              id: meta.id,
              kind: meta.kind,
              geometry: meta.geometry,
              label: meta.label,
              printSelected: meta.printSelected,
              background: data.background.src ? await snapshotBackground(data.background) : null,
              annotations: data.annotations,
            })),
          );
        const [odSlots, ogSlots] = await Promise.all([buildSlots("OD"), buildSlots("OS")]);
        // Pont avec le CR actuel : image du slot rétino de chaque œil.
        const odRetino = odSlots.find((s) => s.kind === "retino")?.background ?? null;
        const ogRetino = ogSlots.find((s) => s.kind === "retino")?.background ?? null;
        onCommit({
          od: odRetino,
          og: ogRetino,
          odSlots,
          ogSlots,
          layers: { ...st.layers },
          annotationOpacity: st.annotationOpacity,
        });
      } catch {
        /* la capture ne doit jamais empêcher la fermeture */
      }
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[100] bg-white">
      <Workspace onClose={handleClose} onCreateLesion={onCreateLesion} printInfo={printInfo} />
    </div>
  );
}
