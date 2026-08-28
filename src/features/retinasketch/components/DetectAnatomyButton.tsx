import { useState } from "react";
import { useStore } from "@/features/retinasketch/store/useStore";
import { detectAnatomy } from "@/features/retinasketch/lib/vision/anatomy";
import { detectDiscCup } from "@/features/retinasketch/lib/ai/discCup";
import type { Laterality } from "@/features/retinasketch/lib/types";

/** Charge une image (dataURL/blob) en HTMLImageElement. */
function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

/**
 * Bouton unifié (menu du haut) : détecte papille + macula EN MÊME TEMPS et sur
 * les DEUX yeux (si une rétinographie est chargée). Un re-clic efface le
 * détourage. Remplace les anciens boutons séparés par œil de « Image de fond ».
 */
export default function DetectAnatomyButton() {
  const anatomy = useStore((s) => s.anatomy);
  const slots = useStore((s) => s.slots);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const hasAnatomy = !!(anatomy.OD || anatomy.OS);
  // Au moins une rétinographie chargée (sinon rien à détecter).
  const anyRetinoLoaded = (["OD", "OS"] as Laterality[]).some((eye) => {
    const st = useStore.getState();
    const retino = slots[eye].find((sl) => sl.kind === "retino");
    if (!retino) return false;
    const src = retino.id === st.activeSlot[eye] ? st.backgrounds[eye].src : st.slotStash[retino.id]?.background.src ?? null;
    return !!src;
  });

  /** Source de la rétinographie d'un œil (slot actif ou rangé dans le stash). */
  const retinoSrc = (eye: Laterality): string | null => {
    const st = useStore.getState();
    const retino = st.slots[eye].find((sl) => sl.kind === "retino");
    if (!retino) return null;
    return retino.id === st.activeSlot[eye]
      ? st.backgrounds[eye].src
      : st.slotStash[retino.id]?.background.src ?? null;
  };

  /** Détecte papille + macula d'un œil (heuristique + contour IA best-effort). */
  const detectEye = async (eye: Laterality): Promise<boolean> => {
    const src = retinoSrc(eye);
    if (!src) return false;
    const img = await loadImage(src);
    const a = detectAnatomy(img, eye); // papille + macula ensemble
    if (!a) return false;
    const st = useStore.getState();
    st.setAnatomy(eye, {
      disc: a.disc,
      macula: a.macula,
      natW: a.natW,
      natH: a.natH,
      source: "heuristic",
      updatedAt: new Date().toISOString(),
    });
    // Contour réel de la papille (modèle IA) — best effort, sinon on garde l'ellipse.
    try {
      const dc = await detectDiscCup(src);
      const cur = useStore.getState().anatomy[eye];
      if (dc && cur) {
        st.setAnatomy(eye, {
          ...cur,
          disc: { cx: dc.cx, cy: dc.cy, rx: dc.rx, ry: dc.ry, polygon: dc.discPolygon, cupPolygon: dc.cupPolygon ?? undefined },
          source: "ai",
          updatedAt: new Date().toISOString(),
        });
      }
    } catch {
      /* modèle IA absent → ellipse conservée (ajustable à la main) */
    }
    return true;
  };

  const onClick = async () => {
    const st = useStore.getState();
    // Re-clic = masquer/effacer le détourage des deux yeux.
    if (hasAnatomy) {
      st.clearAnatomy("OD");
      st.clearAnatomy("OS");
      setMsg("");
      return;
    }
    setBusy(true);
    setMsg("");
    st.setAnatomyVisible(true);
    const okOD = await detectEye("OD");
    const okOS = await detectEye("OS");
    setBusy(false);
    if (!okOD && !okOS) {
      setMsg("Anatomie introuvable");
      return;
    }
    // Passe directement en ajustement manuel (poignées) — sur les 2 yeux, sans
    // bascule en mono. On confirme avec Entrée (géré dans Workspace).
    useStore.getState().setAnatomyEdit(true);
  };

  return (
    <div className="flex items-center gap-1.5">
      <button
        onClick={onClick}
        disabled={busy || (!hasAnatomy && !anyRetinoLoaded)}
        title="Détecter la papille et la macula (les deux yeux). Re-cliquer pour masquer."
        className={`flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition disabled:opacity-40 ${
          hasAnatomy
            ? "border-emerald-300 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
            : "border-slate-200 text-slate-600 hover:text-slate-900"
        }`}
      >
        <TargetIcon />
        {busy ? "Analyse…" : hasAnatomy ? "Masquer papille/macula" : "Détecter papille/macula"}
      </button>
      {msg && <span className="text-[11px] text-amber-600">{msg}</span>}
    </div>
  );
}

const TargetIcon = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="9" />
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3" strokeLinecap="round" />
  </svg>
);
