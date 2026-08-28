/**
 * PrescriberCombobox — sélecteur de médecin prescripteur (recherche au clavier).
 *
 * Jumeau de DoctorCombobox, mais opère sur une simple liste de noms
 * (`string[]`, ex. settings.prescripteurs) au lieu d'objets Doctor.
 *
 * - Filtre la liste en tapant les premières lettres, insensible à la casse
 *   et aux accents.
 * - Tri alphabétique en occultant tout préfixe « Dr. » / « Pr. ».
 * - Navigation clavier : ↑/↓ pour parcourir, ↵ pour valider, échap pour fermer.
 * - Valeur vide = « — Non spécifié — ».
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Check, ChevronDown, X } from 'lucide-react';

interface PrescriberComboboxProps {
  options: string[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
}

/** Normalise pour comparaison : minuscules, sans accents, sans espaces superflus. */
const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Retire un préfixe civilité (Dr./Pr./Docteur/Professeur) en tête de chaîne. */
const stripTitle = (s: string): string =>
  s.replace(/^\s*(dr|pr|docteur|professeur)\.?\s+/i, '').trim();

const UNSPECIFIED = '— Non spécifié —';

export default function PrescriberCombobox({
  options,
  value,
  onChange,
  placeholder = 'Rechercher un médecin…',
  className = '',
}: PrescriberComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Tri alphabétique sur le nom (préfixe civilité occulté), dédoublonné.
  const sorted = useMemo(() => {
    const unique = Array.from(new Set(options.filter((o) => o.trim() !== '')));
    return unique.sort((a, b) => norm(stripTitle(a)).localeCompare(norm(stripTitle(b)), 'fr'));
  }, [options]);

  // Filtrage par saisie (sur le nom sans civilité).
  const q = norm(query);
  const filtered = useMemo(() => {
    if (!q) return sorted;
    return sorted.filter((o) => norm(stripTitle(o)).includes(q));
  }, [sorted, q]);

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

  const select = (name: string) => {
    onChange(name);
    setQuery('');
    setOpen(false);
  };

  const clear = () => {
    onChange('');
    setQuery('');
    inputRef.current?.focus();
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setOpen(true);
      setActive((a) => Math.min(a + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => Math.max(a - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (open && filtered[active]) select(filtered[active]);
      else setOpen(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      {/* Champ : affiche la sélection courante, sinon la saisie de recherche */}
      <div className="flex items-center gap-2 px-4 rounded-2xl border-2 border-slate-200 bg-white transition-all focus-within:border-teal-500">
        <Search className="w-5 h-5 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={open ? query : value}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onKeyDown={onKeyDown}
          placeholder={value ? placeholder : UNSPECIFIED}
          className="w-full py-4 text-lg bg-transparent outline-none placeholder:text-slate-400"
        />
        {value && !open ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Effacer le médecin sélectionné"
            className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        ) : (
          <ChevronDown
            className={`w-5 h-5 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </div>

      {/* Liste déroulante */}
      {open && (
        <ul className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl p-1.5">
          {/* Option « Non spécifié » pour revenir à l'absence de prescripteur */}
          <li>
            <button
              type="button"
              onClick={() => select('')}
              className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                value === '' ? 'bg-teal-50 text-teal-800' : 'text-slate-400 hover:bg-slate-50'
              }`}
            >
              <span className="w-4 shrink-0">
                {value === '' && <Check className="w-4 h-4 text-teal-600" />}
              </span>
              <span className="italic">{UNSPECIFIED}</span>
            </button>
          </li>

          {filtered.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-slate-400">Aucun médecin trouvé</li>
          )}
          {filtered.map((name, i) => {
            const isSel = name === value;
            return (
              <li key={name}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => select(name)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    i === active ? 'bg-teal-50 text-teal-800' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="w-4 shrink-0">
                    {isSel && <Check className="w-4 h-4 text-teal-600" />}
                  </span>
                  <span className="font-semibold">{name}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
