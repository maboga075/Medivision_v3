/**
 * DoctorCombobox — sélecteur de médecin à choix unique avec recherche au clavier.
 *
 * - Filtre la liste en tapant les premières lettres du nom (ou prénom),
 *   insensible à la casse et aux accents.
 * - Médecins classés par ordre alphabétique du nom, en occultant tout
 *   préfixe « Dr. » / « Pr. » éventuel.
 * - Navigation clavier : ↑/↓ pour parcourir, ↵ pour valider, échap pour fermer.
 *
 * Choix unique (contrairement à TagAutocomplete qui est multi-valeurs), mais
 * réutilise le même vocabulaire visuel (champ arrondi + liste déroulante).
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { Search, Check, ChevronDown, X } from 'lucide-react';
import type { Doctor } from '../../types/settings';

interface DoctorComboboxProps {
  doctors: Doctor[];
  selectedId: string;
  onChange: (id: string) => void;
  placeholder?: string;
}

/** Normalise pour comparaison : minuscules, sans accents, sans espaces superflus. */
const norm = (s: string): string =>
  s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').trim();

/** Retire un préfixe civilité (Dr./Pr./Dr/Pr) en tête de chaîne pour le tri. */
const stripTitle = (s: string): string =>
  s.replace(/^\s*(dr|pr|docteur|professeur)\.?\s+/i, '').trim();

/** Libellé affiché pour un médecin (civilité conservée à l'affichage). */
const doctorLabel = (d: Doctor): string => `Dr. ${d.prenom} ${d.nom}`.trim();

export default function DoctorCombobox({
  doctors,
  selectedId,
  onChange,
  placeholder = 'Rechercher un médecin…',
}: DoctorComboboxProps) {
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selected = doctors.find((d) => d.id === selectedId);

  // Tri alphabétique sur le nom (préfixe civilité occulté), puis prénom.
  const sorted = useMemo(
    () =>
      [...doctors].sort((a, b) => {
        const byName = norm(stripTitle(a.nom)).localeCompare(norm(stripTitle(b.nom)), 'fr');
        return byName !== 0 ? byName : norm(a.prenom).localeCompare(norm(b.prenom), 'fr');
      }),
    [doctors]
  );

  // Filtrage par saisie (nom ou prénom).
  const q = norm(query);
  const filtered = useMemo(() => {
    if (!q) return sorted;
    return sorted.filter((d) => norm(`${stripTitle(d.nom)} ${d.prenom}`).includes(q));
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

  const select = (d: Doctor) => {
    onChange(d.id);
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
    <div ref={containerRef} className="relative w-full sm:w-64">
      {/* Champ : affiche la sélection courante, sinon la saisie de recherche */}
      <div className="flex items-center gap-2 px-3 rounded-xl border-2 border-slate-200 bg-slate-50 transition-all focus-within:border-teal-500 focus-within:bg-white">
        <Search className="w-4 h-4 text-slate-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={open || !selected ? query : doctorLabel(selected)}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            setQuery('');
          }}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          className="w-full py-2.5 text-sm font-bold bg-transparent outline-none placeholder:font-medium placeholder:text-slate-400"
        />
        {selected && !open ? (
          <button
            type="button"
            onClick={clear}
            aria-label="Effacer le médecin sélectionné"
            className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        ) : (
          <ChevronDown
            className={`w-4 h-4 text-slate-400 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        )}
      </div>

      {/* Liste déroulante */}
      {open && (
        <ul className="absolute z-30 mt-1 w-full max-h-64 overflow-y-auto rounded-xl border border-slate-200 bg-white shadow-xl p-1.5">
          {filtered.length === 0 && (
            <li className="px-3 py-2.5 text-sm text-slate-400">Aucun médecin trouvé</li>
          )}
          {filtered.map((d, i) => {
            const isSel = d.id === selectedId;
            return (
              <li key={d.id}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => select(d)}
                  className={`flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-left text-sm transition ${
                    i === active ? 'bg-teal-50 text-teal-800' : 'text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <span className="w-4 shrink-0">
                    {isSel && <Check className="w-4 h-4 text-teal-600" />}
                  </span>
                  <span className="font-semibold">{doctorLabel(d)}</span>
                  {d.specialite && (
                    <span className="ml-auto text-xs text-slate-400 truncate">{d.specialite}</span>
                  )}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
