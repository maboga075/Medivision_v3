
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../store/useStore";
import { searchLesions } from "../lib/ontology/lesions";

export default function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const setOpen = useStore((s) => s.setPaletteOpen);
  const assignLesion = useStore((s) => s.assignLesion);
  const draftCount = useStore(
    (s) => s.annotations.filter((a) => a.status === "draft").length,
  );

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchLesions(query), [query]);
  const target = draftCount;

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  const choose = (id: string) => {
    assignLesion(id);
    setQuery("");
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter" && results[active]) {
      e.preventDefault();
      choose(results[active].id);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/20 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onMouseDown={() => setOpen(false)}
        >
          <motion.div
            className="mt-[18vh] w-[520px] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl"
            initial={{ scale: 0.96, y: -8, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ duration: 0.14 }}
            onMouseDown={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 border-b border-slate-100 px-4">
              <svg width="18" height="18" viewBox="0 0 24 24" className="text-slate-400">
                <circle cx="11" cy="11" r="7" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M21 21l-4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={onKey}
                placeholder="Identifier la lésion… (ex. « hema »)"
                className="w-full bg-transparent py-3.5 text-[15px] text-slate-800 outline-none placeholder:text-slate-400"
              />
              <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-500">
                {target} objet{target > 1 ? "s" : ""}
              </span>
            </div>

            <ul className="max-h-[320px] overflow-y-auto p-1.5">
              {results.length === 0 && (
                <li className="px-3 py-6 text-center text-sm text-slate-400">
                  {query ? "Aucune lésion correspondante" : "Saisissez un terme pour rechercher"}
                </li>
              )}
              {results.map((l, i) => (
                <li key={l.id}>
                  <button
                    onMouseEnter={() => setActive(i)}
                    onClick={() => choose(l.id)}
                    className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition ${
                      i === active ? "bg-blue-50" : "hover:bg-slate-50"
                    }`}
                  >
                    <span
                      className="h-3 w-3 shrink-0 rounded-full"
                      style={{ backgroundColor: l.color }}
                    />
                    <span className="flex-1 text-sm font-medium text-slate-800">
                      {l.name}
                    </span>
                    <span className="text-xs text-slate-400">{l.category}</span>
                  </button>
                </li>
              ))}
            </ul>

            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/60 px-4 py-2 text-[11px] text-slate-400">
              <span>↑↓ naviguer · ↵ valider · échap fermer</span>
              <span>RetinaSketch</span>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
