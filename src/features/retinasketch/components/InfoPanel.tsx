
import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/features/retinasketch/store/useStore";
import LesionPanel from "./LesionPanel";
import ReportPanel from "./ReportPanel";

/**
 * Bouton d'en-tête « Lésions & rapport » : ouvre en déroulant le panneau des
 * calques + le compte rendu. Rendu dans la barre du haut (`Workspace`).
 */
export default function InfoPanel() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const validatedCount = useStore(
    (s) => s.annotations.filter((a) => a.status === "validated").length,
  );

  useEffect(() => {
    const onDown = (e: MouseEvent) => {
      if (open && ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium transition ${
          open ? "text-slate-900" : "text-slate-600 hover:text-slate-900"
        }`}
      >
        <List />
        Lésions & rapport
        {validatedCount > 0 && (
          <span className="rounded-full bg-slate-900 px-1.5 text-[10px] font-semibold text-white">
            {validatedCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -6, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.98 }}
            transition={{ duration: 0.12 }}
            className="absolute left-0 top-full z-40 mt-1.5 flex max-h-[80vh] w-80 flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 shadow-xl shadow-slate-900/10 backdrop-blur"
          >
            <LesionPanel />
            <ReportPanel />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const List = () => (
  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);
