import { useSettings } from './useSettings';
import { DEFAULT_SUGGESTIONS } from '../constants/defaultSuggestions';
import type { FormulaireSettings } from '../types/settings';

export function useSuggestions() {
  const { settings } = useSettings();
  const form = settings?.formulario;

  const getSuggestions = (key: keyof FormulaireSettings): string[] => {
    const custom = form?.[key];
    // undefined → non personnalisé → utilise les défauts
    // [] ou autre tableau → utilise la valeur stockée (même vide)
    return custom !== undefined ? custom : (DEFAULT_SUGGESTIONS[key] ?? []);
  };

  return {
    macula:      getSuggestions('macula'),
    papille:     getSuggestions('papille'),
    peripherie:  getSuggestions('peripherie'),
    motifs:      getSuggestions('motifs'),
    antecedents: getSuggestions('antecedents'),
    diagnostics: getSuggestions('diagnostics'),
  };
}
