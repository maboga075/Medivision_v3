
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../store/useStore";

export default function DraftBar() {
  const draftCount = useStore(
    (s) => s.annotations.filter((a) => a.status === "draft").length,
  );
  const setPaletteOpen = useStore((s) => s.setPaletteOpen);

  return (
    <div className="pointer-events-none absolute bottom-6 left-1/2 z-20 -translate-x-1/2">
      <AnimatePresence>
        {draftCount > 0 && (
          <motion.button
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.16 }}
            onClick={() => setPaletteOpen(true)}
            className="pointer-events-auto flex items-center gap-3 rounded-full border border-slate-700 bg-slate-900 py-2 pl-4 pr-2 text-sm font-medium text-white shadow-xl shadow-slate-900/20"
          >
            <span>
              {draftCount} objet{draftCount > 1 ? "s" : ""} à identifier
            </span>
            <span className="flex items-center gap-1 rounded-full bg-white/15 px-2.5 py-1 text-xs">
              Identifier
              <kbd className="rounded bg-white/20 px-1">↵</kbd>
            </span>
          </motion.button>
        )}
      </AnimatePresence>
    </div>
  );
}
