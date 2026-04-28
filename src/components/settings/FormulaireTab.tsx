import { useState } from 'react';
import { Plus, X, RotateCcw, Layers, Lock } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { DEFAULT_SUGGESTIONS } from '../../constants/defaultSuggestions';

type CategoryKey = 'macula' | 'papille' | 'peripherie' | 'motifs' | 'antecedents' | 'diagnostics';

const CATEGORIES: { key: CategoryKey; label: string; description: string }[] = [
  { key: 'macula',      label: 'Macula',               description: 'Observations maculaires OCT' },
  { key: 'papille',     label: 'Papille',               description: 'Observations papillaires OCT' },
  { key: 'peripherie',  label: 'Périphérie',            description: 'Observations de la périphérie rétinienne' },
  { key: 'motifs',      label: 'Motifs médicaux',       description: 'Motifs d\'examen proposés à la création du dossier' },
  { key: 'antecedents', label: 'Antécédents',           description: 'Antécédents proposés à la création du dossier' },
  { key: 'diagnostics', label: 'Diagnostics fréquents', description: 'Diagnostics proposés dans le formulaire de consultation' },
];

// Items protégés — ne peuvent pas être supprimés
const PROTECTED = new Set(['Sans particularité']);

export default function FormulaireTab() {
  // Un seul appel useSettings — évite le double-hook
  const { settings, updateBulles } = useSettings();
  const [newItems, setNewItems] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [openCategory, setOpenCategory] = useState<CategoryKey | null>('macula');
  const [toast, setToast] = useState('');

  // Calcule les items depuis CE settings — pas un hook séparé
  const getItems = (key: CategoryKey): string[] => {
    const stored = settings?.formulario?.[key];
    return stored !== undefined ? stored : (DEFAULT_SUGGESTIONS[key] ?? []);
  };

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleRemove = async (category: CategoryKey, item: string) => {
    if (PROTECTED.has(item)) return;
    setSaving(category);
    try {
      const updated = getItems(category).filter((i) => i !== item);
      await updateBulles(category, updated);
      showToast('Suggestion supprimée');
    } catch {
      showToast('Erreur lors de la suppression');
    } finally {
      setSaving(null);
    }
  };

  const handleAdd = async (category: CategoryKey) => {
    const raw = newItems[category]?.trim();
    if (!raw) return;
    const current = getItems(category);
    if (current.some((i) => i.toLowerCase() === raw.toLowerCase())) {
      showToast('Cette suggestion existe déjà');
      return;
    }
    setSaving(category);
    try {
      await updateBulles(category, [...current, raw]);
      setNewItems((prev) => ({ ...prev, [category]: '' }));
      showToast(`"${raw}" ajouté`);
    } catch {
      showToast("Erreur lors de l'ajout");
    } finally {
      setSaving(null);
    }
  };

  const handleReset = async (category: CategoryKey, label: string) => {
    if (!window.confirm(`Remettre "${label}" aux valeurs par défaut ?`)) return;
    setSaving(category);
    try {
      await updateBulles(category, [...(DEFAULT_SUGGESTIONS[category] ?? [])]);
      showToast('Liste remise par défaut');
    } catch {
      showToast('Erreur de réinitialisation');
    } finally {
      setSaving(null);
    }
  };

  if (!settings) {
    return (
      <div className="flex items-center justify-center py-16 gap-3 text-slate-400">
        <div className="w-5 h-5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm font-medium">Chargement…</span>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl animate-in slide-in-from-bottom-4 duration-200">
          {toast}
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-teal-50 rounded-xl">
          <Layers className="w-5 h-5 text-teal-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">Suggestions du formulaire</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Cliquez sur une catégorie pour la modifier. <Lock className="w-3 h-3 inline text-slate-400" /> = protégé, non supprimable.
          </p>
        </div>
      </div>

      {/* Catégories accordéon */}
      {CATEGORIES.map((cat) => {
        const items = getItems(cat.key);
        const isSaving = saving === cat.key;
        const isOpen = openCategory === cat.key;

        return (
          <div
            key={cat.key}
            className={`border rounded-2xl overflow-hidden transition-all ${
              isOpen ? 'border-teal-300 shadow-sm' : 'border-slate-200'
            }`}
          >
            {/* Header accordéon */}
            <button
              type="button"
              onClick={() => setOpenCategory(isOpen ? null : cat.key)}
              className={`w-full flex items-center justify-between px-4 py-3 text-left transition-colors ${
                isOpen ? 'bg-teal-50' : 'bg-white hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`text-sm font-bold ${isOpen ? 'text-teal-700' : 'text-slate-700'}`}>
                  {cat.label}
                </span>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                  isOpen ? 'bg-teal-100 text-teal-700' : 'bg-slate-100 text-slate-500'
                }`}>
                  {items.length}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {isSaving && (
                  <div className="w-3.5 h-3.5 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
                )}
                <span className={`text-slate-400 text-xs transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </div>
            </button>

            {/* Corps accordéon */}
            {isOpen && (
              <div className={`px-4 pb-4 pt-3 bg-white space-y-3 border-t border-slate-100 ${isSaving ? 'opacity-60 pointer-events-none' : ''}`}>

                {/* Description */}
                <p className="text-xs text-slate-400">{cat.description}</p>

                {/* Pills */}
                <div className="flex flex-wrap gap-1.5 min-h-10 p-3 bg-slate-50 rounded-xl border border-slate-100">
                  {items.length === 0 ? (
                    <span className="text-xs text-slate-400 italic self-center w-full text-center py-1">
                      Aucune suggestion — ajoutez-en ci-dessous
                    </span>
                  ) : (
                    items.map((item) => {
                      const isProtected = PROTECTED.has(item);
                      return (
                        <span
                          key={item}
                          title={isProtected ? 'Suggestion protégée — non supprimable' : undefined}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-full text-xs font-medium select-none ${
                            isProtected
                              ? 'bg-slate-200 text-slate-500 cursor-default'
                              : 'bg-teal-600 text-white'
                          }`}
                        >
                          {isProtected && <Lock className="w-2.5 h-2.5 opacity-60 flex-shrink-0" />}
                          {item}
                          {!isProtected && (
                            <button
                              type="button"
                              onClick={() => handleRemove(cat.key, item)}
                              className="opacity-60 hover:opacity-100 transition-opacity w-3.5 h-3.5 flex items-center justify-center bg-white/20 hover:bg-white/40 rounded-full flex-shrink-0 active:scale-90"
                              aria-label={`Supprimer ${item}`}
                            >
                              <X className="w-2 h-2" />
                            </button>
                          )}
                        </span>
                      );
                    })
                  )}
                </div>

                {/* Ligne d'ajout */}
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newItems[cat.key] ?? ''}
                    onChange={(e) => setNewItems((prev) => ({ ...prev, [cat.key]: e.target.value }))}
                    onKeyDown={(e) => e.key === 'Enter' && handleAdd(cat.key)}
                    placeholder={`Nouvelle suggestion…`}
                    disabled={isSaving}
                    className="flex-1 px-3 py-2 text-sm border-2 border-slate-200 rounded-xl outline-none focus:border-teal-400 disabled:opacity-50 transition-colors bg-white"
                  />
                  <button
                    type="button"
                    onClick={() => handleAdd(cat.key)}
                    disabled={isSaving || !newItems[cat.key]?.trim()}
                    className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                    aria-label="Ajouter"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => handleReset(cat.key, cat.label)}
                    disabled={isSaving}
                    title="Remettre les valeurs par défaut"
                    className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl border-2 border-slate-200 text-slate-400 hover:border-slate-300 hover:text-slate-600 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>

              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
