/**
 * TagAutocomplete — champ de saisie + liste déroulante filtrée (façon RetinaSketch)
 * pour sélectionner plusieurs valeurs dans une liste de suggestions, avec
 * création à la volée d'une nouvelle valeur (session ou persistée).
 *
 * - Les éléments sélectionnés s'affichent en chips supprimables.
 * - La saisie filtre les suggestions (insensible à la casse et aux accents).
 * - Navigation clavier : ↑/↓ pour parcourir, ↵ pour valider, échap pour fermer.
 * - Si le terme saisi n'existe pas : ligne « Ajouter « x » » (+ « garder » pour
 *   le persister via onPersistNew).
 * - `exclusiveItem` (ex. « Sans particularité ») est mutuellement exclusif.
 */

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Plus, X, Search, Save } from 'lucide-react';

export interface TagAutocompleteProps {
  label: ReactNode;
  required?: boolean;
  selectedItems: string[];
  suggestions: string[];
  onChange: (next: string[]) => void;
  /** Persiste une nouvelle valeur pour les prochaines sessions (Firebase). */
  onPersistNew?: (item: string) => void;
  placeholder?: string;
  accent?: 'teal' | 'indigo';
  /** Valeur mutuellement exclusive avec toutes les autres (ex. « Sans particularité »). */
  exclusiveItem?: string;
}

const ACCENT = {
  teal: {
    chip: 'bg-teal-500 text-white border-teal-500',
    focus: 'focus-within:border-teal-500',
    active: 'bg-teal-50 text-teal-800',
    create: 'bg-teal-50 hover:bg-teal-100 border-teal-200 text-teal-800',
    dot: 'bg-teal-600',
  },
  indigo: {
    chip: 'bg-indigo-500 text-white border-indigo-500',
    focus: 'focus-within:border-indigo-500',
    active: 'bg-indigo-50 text-indigo-800',
    create: 'bg-indigo-50 hover:bg-indigo-100 border-indigo-200 text-indigo-800',
    dot: 'bg-indigo-600',
  },
} as const;

const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

export default function TagAutocomplete({
  label,
  required = false,
  selectedItems,
  suggestions,
  onChange,
  onPersistNew,
  placeholder = 'Rechercher ou saisir…',
  accent = 'teal',
  exclusiveItem,
}: TagAutocompleteProps) {
  const c = ACCENT[accent];
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const q = norm(query);

  // Suggestions disponibles (non déjà sélectionnées) filtrées par la saisie.
  const filtered = useMemo(() => {
    const available = suggestions.filter((s) => !selectedItems.includes(s));
    if (!q) return available;
    return available.filter((s) => norm(s).includes(q));
  }, [suggestions, selectedItems, q]);

  const trimmed = query.trim();
  const existsSomewhere =
    [...suggestions, ...selectedItems].some((s) => norm(s) === q);
  const showCreate = trimmed.length >= 1 && !existsSomewhere;
  const optionCount = filtered.length + (showCreate ? 1 : 0);

  useEffect(() => setActive(0), [query]);

  // Fermeture au clic extérieur.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const addItem = (item: string) => {
    const v = item.trim();
    if (!v) return;
    let next: string[];
    if (exclusiveItem && v === exclusiveItem) {
      next = [exclusiveItem];
    } else {
      const base = exclusiveItem ? selectedItems.filter((i) => i !== exclusiveItem) : selectedItems;
      next = base.includes(v) ? base : [...base, v];
    }
    onChange(next);
    setQuery('');
    setActive(0);
    inputRef.current?.focus();
  };

  const removeItem = (item: string) => {
    onChange(selectedItems.filter((i) => i !== item));
  };

  const createItem = (persist: boolean) => {
    const v = trimmed;
    if (!v) return;
    if (persist) onPersistNew?.(v);
    addItem(v);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, optionCount - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (active < filtered.length) addItem(filtered[active]);
      else if (showCreate) createItem(false);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      if (query) setQuery('');
      else setOpen(false);
    } else if (e.key === 'Backspace' && !query && selectedItems.length > 0) {
      removeItem(selectedItems[selectedItems.length - 1]);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-sm font-bold text-slate-700 mb-2 flex items-center gap-2">
        {label}
        {required && <span className="text-red-500">*</span>}
      </label>

      {/* Chips sélectionnés */}
      {selectedItems.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedItems.map((item) => (
            <span
              key={item}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-bold border ${c.chip}`}
            >
              {item}
              <button
                type="button"
                onClick={() => removeItem(item)}
                aria-label={`Retirer ${item}`}
                className="opacity-70 hover:opacity-100 transition-opacity leading-none"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Champ de recherche */}
      <div className={`flex items-center gap-2 px-4 rounded-2xl border-2 border-slate-200 bg-white transition-all ${c.focus}`}>
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full py-3.5 text-[15px] bg-transparent outline-none placeholder:text-slate-400"
        />
      </div>

      {/* Liste déroulante */}
      {open && (filtered.length > 0 || showCreate) && (
        <ul className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl p-1.5">
          {filtered.map((s, i) => (
            <li key={s}>
              <button
                type="button"
                onMouseEnter={() => setActive(i)}
                onClick={() => addItem(s)}
                className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                  i === active ? c.active : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
                {s}
              </button>
            </li>
          ))}

          {showCreate && (
            <li>
              <div
                className={`flex items-center gap-2 rounded-lg px-2 py-1.5 mt-0.5 border transition ${
                  active === filtered.length ? c.create : `${c.create} opacity-95`
                }`}
                onMouseEnter={() => setActive(filtered.length)}
              >
                <button
                  type="button"
                  onClick={() => createItem(false)}
                  className="flex flex-1 items-center gap-2 text-left text-sm font-semibold"
                >
                  <span className={`h-5 w-5 shrink-0 rounded-full ${c.dot} text-white flex items-center justify-center`}>
                    <Plus className="w-3.5 h-3.5" />
                  </span>
                  Ajouter «&nbsp;{trimmed}&nbsp;»
                </button>
                {onPersistNew && (
                  <button
                    type="button"
                    onClick={() => createItem(true)}
                    title="Ajouter et garder pour les prochaines sessions"
                    className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-bold bg-white/70 hover:bg-white border border-current/20"
                  >
                    <Save className="w-3.5 h-3.5" /> garder
                  </button>
                )}
              </div>
            </li>
          )}
        </ul>
      )}
    </div>
  );
}
