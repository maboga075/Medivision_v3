
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/features/retinasketch/store/useStore";
import { designViewport, screenToImagePx, imagePxToModelMm } from "@/features/retinasketch/lib/geometry/project";
import { mirrorFor } from "@/features/retinasketch/lib/geometry/template";
import { loadSam, embedImage, predictPolygon, clearEmbedding } from "@/features/retinasketch/lib/ai/sam";

interface Props {
  width: number;
  height: number;
}

type Status = "loading" | "embedding" | "ready" | "predicting" | "error";

/**
 * Pré-annotation IA : clic → masque (MobileSAM, 100 % navigateur). Le polygone
 * détouré devient une lésion brouillon (mm), que le clinicien valide ensuite —
 * alimentant le flywheel d'apprentissage.
 */
export default function SamOverlay({ width, height }: Props) {
  const samMode = useStore((s) => s.samMode);
  const setSamMode = useStore((s) => s.setSamMode);
  const laterality = useStore((s) => s.laterality);
  const bg = useStore((s) => s.backgrounds[s.laterality]);
  const view = useStore((s) => s.views[s.laterality]);
  const addLesionPolygon = useStore((s) => s.addLesionPolygon);

  const ref = useRef<HTMLDivElement>(null);
  const embeddedSrc = useRef<string | null>(null);
  const [status, setStatus] = useState<Status>("loading");
  const [msg, setMsg] = useState("");
  const [note, setNote] = useState("");

  // Prépare le modèle + l'embedding quand on entre en mode SAM.
  useEffect(() => {
    if (!samMode || !bg.src) return;
    let cancelled = false;
    (async () => {
      try {
        setStatus("loading");
        setMsg("Chargement du modèle IA…");
        await loadSam();
        if (cancelled) return;
        if (embeddedSrc.current !== bg.src) {
          setStatus("embedding");
          setMsg("Analyse de l'image…");
          await embedImage(bg.src!);
          embeddedSrc.current = bg.src;
        }
        if (!cancelled) setStatus("ready");
      } catch (e) {
        if (!cancelled) {
          setStatus("error");
          setMsg("Échec du modèle IA (voir console).");
          console.error("[SAM]", e);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [samMode, bg.src]);

  // Nouvelle image → invalide l'embedding.
  useEffect(() => {
    if (embeddedSrc.current && embeddedSrc.current !== bg.src) {
      embeddedSrc.current = null;
      clearEmbedding();
    }
  }, [bg.src]);

  useEffect(() => {
    if (!samMode) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setSamMode(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [samMode, setSamMode]);

  if (!samMode || !bg.src || !bg.natW || !bg.natH) return null;

  const mirror = mirrorFor(laterality);
  const vp = designViewport(width, height, mirror);
  const bgT = {
    natW: bg.natW,
    natH: bg.natH,
    offsetXMm: bg.offsetXMm,
    offsetYMm: bg.offsetYMm,
    scale: bg.scale,
    rotationDeg: bg.rotationDeg,
  };

  const onClick = async (e: React.MouseEvent) => {
    if (status !== "ready") return;
    const rect = ref.current!.getBoundingClientRect();
    const imgPt = screenToImagePx(e.clientX - rect.left, e.clientY - rect.top, bgT, vp, view);
    if (imgPt.x < 0 || imgPt.y < 0 || imgPt.x > bg.natW || imgPt.y > bg.natH) return;
    setStatus("predicting");
    setMsg("Détourage…");
    try {
      const polyImg = await predictPolygon([{ x: imgPt.x, y: imgPt.y, positive: true }]);
      if (polyImg.length >= 6) {
        const mm: number[] = [];
        for (let i = 0; i < polyImg.length; i += 2) {
          const p = imagePxToModelMm(polyImg[i], polyImg[i + 1], bgT, vp);
          mm.push(p.x, p.y);
        }
        addLesionPolygon(mm);
      } else {
        setNote("Rien de net ici — visez le centre de la lésion");
        setTimeout(() => setNote(""), 2200);
      }
    } catch (err) {
      console.error("[SAM predict]", err);
    } finally {
      setStatus("ready");
    }
  };

  const busy = status === "loading" || status === "embedding" || status === "predicting";

  return (
    <div
      ref={ref}
      onClick={onClick}
      className={`absolute inset-0 z-[25] ${busy ? "cursor-wait" : "cursor-crosshair"}`}
    >
      <div className="pointer-events-none absolute left-1/2 top-4 flex -translate-x-1/2 items-center gap-3 rounded-full bg-violet-700 px-4 py-2 text-sm font-medium text-white shadow-xl">
        <BrainDot busy={busy} />
        {note
          ? note
          : status === "ready"
            ? "Cliquez une lésion à détourer (IA)"
            : status === "error"
              ? msg
              : msg || "…"}
        <button
          onClick={(e) => {
            e.stopPropagation();
            setSamMode(false);
          }}
          className="pointer-events-auto ml-1 rounded-full bg-white/15 px-2 py-0.5 text-xs hover:bg-white/25"
        >
          Terminer · Échap
        </button>
      </div>
    </div>
  );
}

const BrainDot = ({ busy }: { busy: boolean }) => (
  <span
    className={`inline-block h-2 w-2 rounded-full bg-white ${busy ? "animate-pulse" : ""}`}
  />
);
