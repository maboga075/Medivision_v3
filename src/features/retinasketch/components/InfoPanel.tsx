
import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../store/useStore";
import LesionPanel from "./LesionPanel";
import ReportPanel from "./ReportPanel";

export default function InfoPanel() {
  const [open, setOpen] = useState(false);
  const validatedCount = useStore(
    (s) => s.annotations.filter((a) => a.status === "validated").length,
  );

  return (
    <div className="pointer-events-none absolute right-4 top-4 z-20 flex flex-col items-end gap-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="pointer-events-auto flex items-center gap-2 rounded-xl border border-slate-200 bg-white/90 px-3 py-2 text-sm font-medium text-slate-600 shadow-lg shadow-slate-900/5 backdrop-blur transition hover:text-slate-900"
      >
        <List />
        Lésions & rapport
        {validatedCount > 0 && (
          <span className="rounded-full bg-slate-900 px-1.5 text-xs font-semibold text-white">
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
            className="pointer-events-auto flex max-h-[75vh] w-80 flex-col overflow-y-auto rounded-2xl border border-slate-200 bg-white/95 shadow-xl shadow-slate-900/10 backdrop-blur"
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
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
  </svg>
);
