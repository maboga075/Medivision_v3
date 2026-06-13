import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "../store/useStore";
import { searchLesions, setCustomLesions } from "../lib/ontology/lesions";
import { useSettings } from "../../../hooks/useSettings";
import type { CustomLesion } from "../../../types/settings";

const CATEGORIES_PRESET = [
  'Hémorragie', 'Vasculaire', 'Exsudat', 'Dégénératif',
  'Œdème', 'Structurel', 'Traitement', 'Autre',
];

export default function CommandPalette() {
  const open = useStore((s) => s.paletteOpen);
  const setOpen = useStore((s) => s.setPaletteOpen);
  const assignLesion = useStore((s) => s.assignLesion);
  const draftCount = useStore(
    (s) => s.annotations.filter((a) => a.status === "draft").length,
  );

  const { settings, updateCustomLesions } = useSettings();

  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Mode création en live
  const [creating, setCreating] = useState(false);
  const [newColor, setNewColor] = useState("#14B8A6");
  const [newCategory, setNewCategory] = useState("Autre");
  const [saving, setSaving] = useState(false);

  const results = useMemo(() => searchLesions(query), [query]);
  // La recherche est tolérante (sous-séquences) : elle renvoie souvent des
  // correspondances approximatives. On propose donc la création dès qu'aucune
  // lésion ne correspond EXACTEMENT au terme saisi, même si des résultats
  // approchants existent — sinon le bouton « Créer » n'apparaîtrait quasi jamais.
  const trimmedQuery = query.trim();
  const exactMatch = results.some(
    (l) => l.name.toLowerCase() === trimmedQuery.toLowerCase(),
  );
  const showCreateOption = trimmedQuery.length >= 2 && !exactMatch;
  const target = draftCount;

  useEffect(() => {
    if (open) {
      setQuery("");
      setActive(0);
      setCreating(false);
      setNewColor("#14B8A6");
      setNewCategory("Autre");
      setTimeout(() => inputRef.current?.focus(), 10);
    }
  }, [open]);

  useEffect(() => { setActive(0); setCreating(false); }, [query]);

  const choose = (id: string) => {
    assignLesion(id);
    setQuery("");
  };

  const handleCreate = async () => {
    const name = query.trim();
    if (!name) return;
    setSaving(true);
    try {
      const existing: CustomLesion[] = settings?.customLesions ?? [];
      const newLesion: CustomLesion = {
        id: `custom_${Date.now().toString(36)}`,
        name,
        color: newColor,
        category: newCategory,
        terms: [name.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[-'\s]+/g, "_")],
      };
      const updated = [...existing, newLesion];
      // Sync registre immédiat pour que assignLesion trouve la lésion
      setCustomLesions(updated as Parameters<typeof setCustomLesions>[0]);
      // Assigner la lésion aux annotations en brouillon
      assignLesion(newLesion.id);
      // Sauvegarder en async
      await updateCustomLesions(updated);
    } catch (e) {
      console.error("[CommandPalette] création lésion", e);
    } finally {
      setSaving(false);
      setCreating(false);
    }
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
      if (creating) { setCreating(false); } else { setOpen(false); }
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
            {/* Champ de recherche */}
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

            {/* Résultats */}
            <ul className="max-h-[280px] overflow-y-auto p-1.5">
              {results.length === 0 && !showCreateOption && (
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
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: l.color }} />
                    <span className="flex-1 text-sm font-medium text-slate-800">{l.name}</span>
                    <span className="text-xs text-slate-400">{l.category}</span>
                  </button>
                </li>
              ))}

              {/* Option de création en live */}
              {showCreateOption && !creating && (
                <li>
                  <button
                    onClick={() => setCreating(true)}
                    className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left bg-teal-50 hover:bg-teal-100 transition border border-teal-200 mx-0.5 mt-0.5"
                  >
                    <span className="h-6 w-6 shrink-0 rounded-full bg-teal-600 text-white flex items-center justify-center text-sm font-bold">+</span>
                    <span className="flex-1 text-sm font-semibold text-teal-800">
                      Créer <em className="not-italic font-bold">« {query} »</em>
                    </span>
                    <span className="text-xs text-teal-600">Nouvelle lésion</span>
                  </button>
                </li>
              )}
            </ul>

            {/* Formulaire de création inline */}
            {creating && (
              <div className="border-t border-teal-100 bg-teal-50 px-4 py-3 space-y-3">
                <p className="text-xs font-bold text-teal-700 uppercase tracking-wider">
                  Créer « {query} »
                </p>
                <div className="flex gap-3 items-center">
                  {/* Couleur */}
                  <label className="cursor-pointer flex-shrink-0" title="Choisir la couleur">
                    <div
                      className="w-9 h-9 rounded-xl border-2 border-white shadow"
                      style={{ background: newColor }}
                    />
                    <input
                      type="color"
                      value={newColor}
                      onChange={(e) => setNewColor(e.target.value)}
                      className="sr-only"
                    />
                  </label>
                  {/* Catégorie */}
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value)}
                    className="flex-1 px-3 py-2 text-sm border-2 border-slate-200 rounded-xl outline-none focus:border-teal-400 bg-white"
                  >
                    {CATEGORIES_PRESET.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                  {/* Valider */}
                  <button
                    type="button"
                    onClick={handleCreate}
                    disabled={saving}
                    className="px-4 py-2 bg-teal-600 hover:bg-teal-700 text-white text-sm font-bold rounded-xl disabled:opacity-40 active:scale-95 transition-all"
                  >
                    {saving ? "…" : "Créer"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setCreating(false)}
                    className="px-3 py-2 text-slate-500 hover:text-slate-700 text-sm font-medium rounded-xl hover:bg-slate-100 transition-all"
                  >
                    Annuler
                  </button>
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
