/**
 * TextTagField — adaptateur autour de TagAutocomplete pour un champ dont la
 * donnée reste stockée en `string` (compatibilité compte rendu / payload IA /
 * dossiers déjà enregistrés), mais qui s'édite comme les Antécédents : chips
 * multiples, auto-complétion et mémoire persistante des suggestions.
 *
 * Conversion : la chaîne est découpée sur les virgules en tags, et re-jointe
 * par « , » à chaque changement. Aucun tag ne contient de virgule (les valeurs
 * proposées sont des libellés courts) ; une saisie libre est toujours possible.
 */

import type { ReactNode } from 'react';
import TagAutocomplete from './TagAutocomplete';

interface TextTagFieldProps {
  label: ReactNode;
  /** Valeur stockée (texte). */
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  /** Persiste une nouvelle suggestion pour les prochaines sessions. */
  onPersistNew?: (item: string) => void;
  placeholder?: string;
  accent?: 'teal' | 'indigo';
  disabled?: boolean;
}

const SEPARATOR = ', ';

/** Découpe une valeur texte en tags (sur les virgules), sans vides ni doublons. */
function toTags(value: string): string[] {
  if (!value) return [];
  const seen = new Set<string>();
  return value
    .split(',')
    .map((s) => s.trim())
    .filter((s) => {
      if (!s || seen.has(s)) return false;
      seen.add(s);
      return true;
    });
}

export default function TextTagField({
  label,
  value,
  onChange,
  suggestions,
  onPersistNew,
  placeholder,
  accent = 'teal',
  disabled = false,
}: TextTagFieldProps) {
  const items = toTags(value);

  const field = (
    <TagAutocomplete
      label={label}
      selectedItems={items}
      suggestions={suggestions}
      onChange={(next) => onChange(next.join(SEPARATOR))}
      onPersistNew={onPersistNew}
      placeholder={placeholder}
      accent={accent}
    />
  );

  return disabled ? (
    <div className="opacity-50 pointer-events-none select-none">{field}</div>
  ) : (
    field
  );
}
