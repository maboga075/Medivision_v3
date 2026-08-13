
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore, countAllDrafts } from "@/features/retinasketch/store/useStore";
import { searchLesions, RETINA_LESION_COLORS } from "@/features/retinasketch/lib/ontology/lesions";

interface CommandPaletteProps {
  /**
   * Crée et enregistre une nouvelle lésion en mémoire ; retourne son id pour
   * l'assigner. `color` = couleur choisie par le clinicien (optionnelle : à
   * défaut, une couleur est attribuée automatiquement).
   */
  onCreateLesion?: (name: string, color?: string) => Promise<{ id: string } | null>;
}

export default function CommandPalette({ onCreateLesion }: CommandPaletteProps) {
  const open = useStore((s) => s.paletteOpen);
  const setOpen = useStore((s) => s.setPaletteOpen);
  const assignLesion = useStore((s) => s.assignLesion);
  const setAnnotationLesion = useStore((s) => s.setAnnotationLesion);
  const selectedId = useStore((s) => s.selectedAnnotationId);
  const selectAnnotation = useStore((s) => s.selectAnnotation);
  // Brouillons de toutes les images (identification multi-images en une fois).
  const draftCount = useStore(countAllDrafts);

  // Une lésion sélectionnée → on (ré)identifie CETTE lésion (édition de couche) ;
  // sinon on valide tous les brouillons (flux d'identification habituel).
  const editing = !!selectedId;

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [creating, setCreating] = useState(false);
  const [createColor, setCreateColor] = useState<string>(RETINA_LESION_COLORS[0]);
  const inputRef = useRef<HTMLInputElement>(null);

  const results = useMemo(() => searchLesions(query), [query]);
  const target = editing ? 1 : draftCount;

  // Proposition de création : nom suffisant, pas déjà présent à l'identique.
  const trimmed = query.trim();
  const exactExists = results.some(
    (r) => r.name.toLowerCase() === trimmed.toLowerCase(),
  );
  const canCreate = !!onCreateLesion && trimmed.length >= 2 && !exactExists;

  const handleCreate = async () => {
    if (!onCreateLesion || !trimmed || creating) return;
    setCreating(true);
    try {
      const lesion = await onCreateLesion(trimmed, createColor);
      if (lesion) choose(lesion.id);
    } finally {
      setCreating(false);
    }
  };

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setCreateColor(RETINA_LESION_COLORS[0]);
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => setActive(0), [query]);

  const choose = (id: string) => {
    if (editing && selectedId) {
      setAnnotationLesion(selectedId, id);
      selectAnnotation(null);
    } else {
      assignLesion(id);
    }
    setQuery("");
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive((a) => Math.min(a + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (results[active]) choose(results[active].id);
      else if (canCreate) handleCreate();
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
                {editing ? "Modifier" : `${target} objet${target > 1 ? "s" : ""}`}
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

            {canCreate && (
              <div className="border-t border-slate-100 p-1.5">
                <button
                  onClick={handleCreate}
                  disabled={creating}
                  className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition hover:bg-teal-50 disabled:opacity-50"
                >
                  <span
                    className="grid h-5 w-5 shrink-0 place-items-center rounded-full text-white ring-1 ring-black/5"
                    style={{ backgroundColor: createColor }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round"><path d="M12 5v14M5 12h14" /></svg>
                  </span>
                  <span className="flex-1 text-sm font-medium text-slate-800">
                    {creating ? "Enregistrement…" : <>Créer la lésion «&nbsp;{trimmed}&nbsp;»</>}
                  </span>
                  <span className="text-xs text-teal-600">Nouvelle</span>
                </button>

                {/* Choix de la couleur : pastilles prédéfinies + sélecteur libre */}
                <div className="mt-1 flex items-center gap-1.5 px-3 pb-1.5">
                  <span className="mr-0.5 text-[11px] text-slate-400">Couleur</span>
                  {RETINA_LESION_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setCreateColor(c)}
                      title={c}
                      className={`h-4 w-4 shrink-0 rounded-full ring-1 transition ${
                        createColor.toLowerCase() === c.toLowerCase()
                          ? "ring-2 ring-slate-900 ring-offset-1"
                          : "ring-black/10 hover:scale-110"
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                  <label
                    className="relative ml-0.5 grid h-4 w-4 shrink-0 cursor-pointer place-items-center rounded-full ring-1 ring-black/10"
                    title="Couleur personnalisée"
                    style={{
                      background:
                        "conic-gradient(#ef4444,#eab308,#22c55e,#06b6d4,#3b82f6,#a855f7,#ef4444)",
                    }}
                  >
                    <input
                      type="color"
                      value={createColor}
                      onChange={(e) => setCreateColor(e.target.value)}
                      className="absolute inset-0 cursor-pointer opacity-0"
                    />
                  </label>
                </div>
              </div>
            )}

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
