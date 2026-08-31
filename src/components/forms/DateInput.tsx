/**
 * DateInput — saisie de date robuste sur mobile.
 *
 * Problème résolu : sur certains navigateurs Android, `<input type="date">`
 * n'autorise que le sélecteur natif, qui impose de remonter les années une par
 * une (pénible pour un patient né en 1950).
 *
 * Solution : champ texte au clavier numérique, format JJ/MM/AAAA auto-formaté
 * (insertion des « / » à la volée), avec un bouton calendrier optionnel qui
 * ouvre le sélecteur natif pour ceux qui le préfèrent.
 *
 * Contrat : la `value` échangée avec le parent reste au format ISO `AAAA-MM-JJ`
 * (identique à `<input type="date">`), donc le composant est un remplacement
 * transparent sans impact sur le stockage ni la logique aval.
 */

import { useEffect, useRef, useState } from 'react';
import { Calendar } from 'lucide-react';

interface DateInputProps {
  value: string; // ISO AAAA-MM-JJ (ou '')
  onChange: (iso: string) => void;
  className?: string;
  id?: string;
  'aria-label'?: string;
}

/** ISO (AAAA-MM-JJ) → affichage JJ/MM/AAAA. */
const isoToDisplay = (iso: string): string => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : '';
};

/**
 * Texte saisi → ISO si la date est complète ET valide, sinon ''.
 * Valide le jour selon le mois et l'année (années bissextiles incluses).
 */
const displayToIso = (text: string): string => {
  const digits = text.replace(/\D/g, '');
  if (digits.length !== 8) return '';
  const day = Number(digits.slice(0, 2));
  const month = Number(digits.slice(2, 4));
  const year = Number(digits.slice(4, 8));
  if (month < 1 || month > 12 || day < 1 || year < 1900) return '';
  const daysInMonth = new Date(year, month, 0).getDate();
  if (day > daysInMonth) return '';
  const dd = String(day).padStart(2, '0');
  const mm = String(month).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
};

/** Insère les séparateurs « / » au fil de la frappe (max 8 chiffres). */
const formatWhileTyping = (raw: string): string => {
  const digits = raw.replace(/\D/g, '').slice(0, 8);
  const parts = [digits.slice(0, 2), digits.slice(2, 4), digits.slice(4, 8)];
  return parts.filter((p) => p.length > 0).join('/');
};

export default function DateInput({
  value,
  onChange,
  className = '',
  id,
  'aria-label': ariaLabel,
}: DateInputProps) {
  const [text, setText] = useState<string>(() => isoToDisplay(value));
  const nativeRef = useRef<HTMLInputElement>(null);

  // Resynchronise l'affichage si la valeur ISO change côté parent (reset, chargement).
  useEffect(() => {
    if (displayToIso(text) !== value) setText(isoToDisplay(value));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handleTextChange = (raw: string) => {
    const formatted = formatWhileTyping(raw);
    setText(formatted);
    onChange(displayToIso(formatted)); // '' tant que la date n'est pas complète/valide
  };

  const openNativePicker = () => {
    const el = nativeRef.current;
    if (!el) return;
    // showPicker() : Chrome/Edge/Android. Repli sur focus+click sinon.
    if (typeof el.showPicker === 'function') {
      try {
        el.showPicker();
        return;
      } catch {
        /* certains contextes refusent showPicker hors interaction directe */
      }
    }
    el.focus();
    el.click();
  };

  return (
    <div className="relative flex w-full min-w-0 items-center">
      <input
        id={id}
        type="text"
        inputMode="numeric"
        autoComplete="bday"
        aria-label={ariaLabel}
        value={text}
        onChange={(e) => handleTextChange(e.target.value)}
        placeholder="JJ/MM/AAAA"
        className={`min-w-0 ${className}`}
      />
      <button
        type="button"
        onClick={openNativePicker}
        aria-label="Ouvrir le calendrier"
        title="Ouvrir le calendrier"
        className="absolute right-2 p-1.5 rounded-lg text-slate-400 hover:text-teal-600 hover:bg-slate-100 transition-colors"
      >
        <Calendar className="w-5 h-5" />
      </button>
      {/* Sélecteur natif caché, piloté par le bouton calendrier. */}
      <input
        ref={nativeRef}
        type="date"
        value={value}
        onChange={(e) => {
          onChange(e.target.value);
          setText(isoToDisplay(e.target.value));
        }}
        tabIndex={-1}
        aria-hidden="true"
        className="absolute right-2 w-0 h-0 opacity-0 pointer-events-none"
      />
    </div>
  );
}
