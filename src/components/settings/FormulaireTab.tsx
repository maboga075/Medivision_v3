import { useState } from 'react';
import { Plus, X, Layers } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { BUBBLE_PICKER_SUGGESTIONS } from '../../utils/constants';
import type { BubbleSuggestion } from '../../types/settings';
import ListEditor from './ListEditor';

const CATEGORIES = ['macula', 'papille', 'peripherie'] as const;
type Category = typeof CATEGORIES[number];

const CAT_LABELS: Record<Category, string> = {
  macula: 'Macula',
  papille: 'Papille',
  peripherie: 'Périphérie',
};

export default function FormulaireTab() {
  const { settings, updateBulles, updateFormulaire } = useSettings();
  const [activeCategory, setActiveCategory] = useState<Category>('macula');
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 3000);
  };

  const customBulles = settings?.formulario?.bulles?.[activeCategory] ?? [];

  // Suggestions par défaut de la constante (sans celles déjà en custom)
  const defaults = (BUBBLE_PICKER_SUGGESTIONS[activeCategory] as readonly string[]) ?? [];

  const handleAdd = async () => {
    const label = newLabel.trim();
    if (!label) return;
    if (customBulles.some((b) => b.label.toLowerCase() === label.toLowerCase())) {
      showToast('Cette suggestion existe déjà');
      return;
    }
    setAdding(true);
    try {
      const newBulle: BubbleSuggestion = {
        id: `bulle_${Date.now()}`,
        label,
        category: activeCategory,
        isCustom: true,
      };
      await updateBulles(activeCategory, [...customBulles, newBulle]);
      setNewLabel('');
      showToast('Suggestion ajoutée');
    } catch {
      showToast('Erreur lors de l\'ajout');
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await updateBulles(activeCategory, customBulles.filter((b) => b.id !== id));
      showToast('Suggestion supprimée');
    } catch {
      showToast('Erreur lors de la suppression');
    }
  };

  const handleAddDefault = async (label: string) => {
    if (customBulles.some((b) => b.label === label)) return;
    const newBulle: BubbleSuggestion = {
      id: `bulle_${Date.now()}`,
      label,
      category: activeCategory,
      isCustom: false,
    };
    await updateBulles(activeCategory, [...customBulles, newBulle]);
    showToast(`"${label}" ajouté aux suggestions personnalisées`);
  };

  return (
    <div className="space-y-6">
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl animate-in slide-in-from-bottom-4">
          {toast}
        </div>
      )}

      <div className="flex items-center gap-2 pb-4 border-b border-slate-100">
        <div className="p-2 bg-amber-50 rounded-xl">
          <Layers className="w-5 h-5 text-amber-600" />
        </div>
        <div>
          <h2 className="text-lg font-bold text-slate-800">Suggestions BubblePicker personnalisées</h2>
          <p className="text-sm text-slate-500">
            Ces suggestions s'ajoutent aux propositions par défaut dans le formulaire de saisie.
          </p>
        </div>
      </div>

      {/* Sélecteur de catégorie */}
      <div className="flex gap-2">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-all active:scale-95 ${
              activeCategory === cat
                ? 'bg-teal-600 border-teal-600 text-white'
                : 'bg-white border-slate-200 text-slate-600 hover:border-teal-300'
            }`}
          >
            {CAT_LABELS[cat]}
          </button>
        ))}
      </div>

      {/* Zone saisie custom */}
      <div className="flex gap-2">
        <input
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          placeholder={`Nouvelle suggestion pour ${CAT_LABELS[activeCategory]}…`}
          className="flex-1 p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500"
        />
        <button
          onClick={handleAdd}
          disabled={!newLabel.trim() || adding}
          className="flex items-center gap-2 bg-teal-600 hover:bg-teal-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-40"
        >
          <Plus className="w-4 h-4" />
          Ajouter
        </button>
      </div>

      {/* Suggestions personnalisées */}
      <div>
        <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">
          Suggestions personnalisées ({customBulles.length})
        </div>
        {customBulles.length === 0 ? (
          <p className="text-sm text-slate-400 italic py-4 text-center bg-slate-50 rounded-xl border border-dashed border-slate-200">
            Aucune suggestion personnalisée — les propositions par défaut seront utilisées.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {customBulles.map((b) => (
              <div
                key={b.id}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-teal-50 border border-teal-200 text-sm font-medium text-teal-900"
              >
                {b.label}
                <button
                  onClick={() => handleDelete(b.id)}
                  className="text-teal-400 hover:text-red-500 transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Propositions par défaut — cliquables pour import */}
      <div>
        <div className="text-xs font-black text-slate-500 uppercase tracking-wider mb-3">
          Propositions par défaut — cliquer pour personnaliser
        </div>
        <div className="flex flex-wrap gap-2">
          {defaults.map((label) => {
            const alreadyAdded = customBulles.some((b) => b.label === label);
            return (
              <button
                key={label}
                onClick={() => !alreadyAdded && handleAddDefault(label)}
                disabled={alreadyAdded}
                className={`px-3 py-1.5 rounded-full text-sm font-medium border transition-all ${
                  alreadyAdded
                    ? 'bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-teal-50 hover:border-teal-300 hover:text-teal-800 active:scale-95'
                }`}
              >
                {alreadyAdded ? '✓ ' : '+ '}
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Motifs fréquents ───────────────────────────────────── */}
      <div className="pt-4 border-t border-slate-100 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 rounded-xl">
            <Layers className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Motifs d'examen fréquents</h2>
            <p className="text-sm text-slate-500">
              Ces motifs seront proposés lors de la création ou modification d'un dossier patient.
            </p>
          </div>
        </div>
        <ListEditor
          title="Motifs fréquents"
          placeholder="ex : Suivi glaucome, BAV, DMLA…"
          items={settings?.formulario?.frequentDiagnoses ?? []}
          onAdd={async (item) => {
            const current = settings?.formulario?.frequentDiagnoses ?? [];
            await updateFormulaire({ frequentDiagnoses: [...current, item] });
            showToast(`"${item}" ajouté`);
          }}
          onRemove={async (idx) => {
            const current = settings?.formulario?.frequentDiagnoses ?? [];
            await updateFormulaire({ frequentDiagnoses: current.filter((_, i) => i !== idx) });
            showToast('Motif supprimé');
          }}
        />
      </div>

      {/* ─── Antécédents fréquents ──────────────────────────────── */}
      <div className="pt-4 border-t border-slate-100 space-y-4">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-orange-50 rounded-xl">
            <Layers className="w-5 h-5 text-orange-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Antécédents fréquents</h2>
            <p className="text-sm text-slate-500">
              Ces antécédents seront proposés lors de la création ou modification d'un dossier patient.
            </p>
          </div>
        </div>
        <ListEditor
          title="Antécédents fréquents"
          placeholder="ex : Diabète, HTA, Myopie forte…"
          items={settings?.formulario?.frequentAntecedents ?? []}
          onAdd={async (item) => {
            const current = settings?.formulario?.frequentAntecedents ?? [];
            await updateFormulaire({ frequentAntecedents: [...current, item] });
            showToast(`"${item}" ajouté`);
          }}
          onRemove={async (idx) => {
            const current = settings?.formulario?.frequentAntecedents ?? [];
            await updateFormulaire({ frequentAntecedents: current.filter((_, i) => i !== idx) });
            showToast('Antécédent supprimé');
          }}
        />
      </div>
    </div>
  );
}
