import { useEffect, useRef } from "react";
import { useStore } from "../store/useStore";
import type { Annotation } from "../lib/types";
import type { RetinaPrintInfo } from "../lib/printInfo";
import type { RetinaBackgroundSnapshot, RetinaLayers } from "@/types/clinical";
import { snapshotBackground } from "../lib/export/backgroundSnapshot";
import Workspace from "./Workspace";

/** Instantané complet remonté à la fermeture (images + calques par œil). */
export interface RetinaCommit {
  od: RetinaBackgroundSnapshot | null;
  og: RetinaBackgroundSnapshot | null;
  layers: RetinaLayers;
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
  /** Crée et enregistre une lésion personnalisée en mémoire. */
  onCreateLesion?: (name: string) => Promise<{ id: string } | null>;
  /** Infos patient/clinique pour l'en-tête d'impression/export. */
  printInfo?: RetinaPrintInfo;
  /** Instantanés d'image existants (restaurés au montage). */
  backgroundOD?: RetinaBackgroundSnapshot | null;
  backgroundOG?: RetinaBackgroundSnapshot | null;
  /** Calques persistés (restaurés au montage). */
  layers?: RetinaLayers;
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
  layers,
  onCommit,
}: RetinaEditorProps) {
  const annotations = useStore((s) => s.annotations);
  const mounted = useRef(false);

  // Amorçage unique au montage : la latéralité de chaque annotation est forcée
  // selon sa source (robuste même si la donnée stockée est incohérente). On
  // restaure aussi les images de fond et l'état des calques du CR précédent.
  useEffect(() => {
    const seed: Annotation[] = [
      ...odAnnotations.map((a) => ({ ...a, laterality: "OD" as const })),
      ...ogAnnotations.map((a) => ({ ...a, laterality: "OS" as const })),
    ];
    useStore.getState().setLayout("dual");
    useStore.getState().loadAnnotations(seed);
    seedBackground(backgroundOD, "OD");
    seedBackground(backgroundOG, "OS");
    if (layers) useStore.getState().setLayers(layers);
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
    if (onCommit) {
      try {
        const st = useStore.getState();
        const [od, og] = await Promise.all([
          snapshotBackground(st.backgrounds.OD),
          snapshotBackground(st.backgrounds.OS),
        ]);
        onCommit({ od, og, layers: { ...st.layers } });
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
