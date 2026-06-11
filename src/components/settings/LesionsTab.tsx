import { useState } from 'react';
import { Plus, X, Palette, Lock } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { LESIONS } from '../../features/retinasketch/lib/ontology/lesions';
import type { CustomLesion } from '../../types/settings';

const CATEGORIES_PRESET = [
  'Hémorragie', 'Vasculaire', 'Exsudat', 'Dégénératif',
  'Œdème', 'Structurel', 'Traitement', 'Autre',
];

const DEFAULT_COLOR = '#14B8A6';

function ColorDot({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <span
      style={{ width: size, height: size, background: color, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}
    />
  );
}

export default function LesionsTab() {
  const { settings, updateCustomLesions } = useSettings();
  const customLesions: CustomLesion[] = settings?.customLesions ?? [];

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [newCategory, setNewCategory] = useState('Autre');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    const all = [...LESIONS, ...customLesions];
    if (all.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
      showToast('Une lésion avec ce nom existe déjà');
      return;
    }
    setSaving(true);
    try {
      const newLesion: CustomLesion = {
        id: `custom_${Date.now().toString(36)}`,
        name,
        color: newColor,
        category: newCategory,
        terms: [name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[-'\s]+/g, '_')],
      };
      await updateCustomLesions([...customLesions, newLesion]);
      setNewName('');
      setNewColor(DEFAULT_COLOR);
      setNewCategory('Autre');
      showToast(`"${name}" ajouté`);
    } catch {
      showToast("Erreur lors de l'ajout");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateColor = async (id: string, color: string) => {
    const updated = customLesions.map((l) => l.id === id ? { ...l, color } : l);
    try {
      await updateCustomLesions(updated);
    } catch {
      showToast('Erreur de mise à jour');
    }
  };

  const handleDelete = async (id: string) => {
    setSaving(true);
    try {
      await updateCustomLesions(customLesions.filter((l) => l.id !== id));
      showToast('Lésion supprimée');
    } catch {
      showToast('Erreur de suppression');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 bg-slate-800 text-white text-sm font-bold px-5 py-3 rounded-2xl shadow-xl animate-in slide-in-from-bottom-4 duration-200">
          {toast}
        </div>
      )}

      {/* En-tête */}
      <div className="flex items-center gap-3 pb-4 border-b border-slate-100">
        <div className="p-2 bg-teal-50 rounded-xl">
          <Palette className="w-5 h-5 text-teal-600" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-800">Bibliothèque des lésions</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Gérez les symptômes dessinables sur le schéma rétinien et leur code couleur.
          </p>
        </div>
      </div>

      {/* Lésions intégrées (lecture seule) */}
      <div className="space-y-2">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-xs font-black text-slate-600 uppercase tracking-wider">Lésions intégrées</span>
          <Lock className="w-3 h-3 text-slate-400" />
          <span className="text-xs text-slate-400 font-medium">— non modifiables</span>
        </div>
        <div className="grid grid-cols-1 gap-1.5">
          {LESIONS.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-slate-100">
              <ColorDot color={l.color} />
              <span className="flex-1 text-sm font-medium text-slate-700">{l.name}</span>
              <span className="text-xs text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{l.category}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Lésions personnalisées */}
      <div className="space-y-2">
        <span className="text-xs font-black text-teal-700 uppercase tracking-wider">Lésions personnalisées</span>

        {customLesions.length === 0 && (
          <p className="text-xs text-slate-400 italic py-2">
            Aucune lésion personnalisée — ajoutez-en ci-dessous ou créez-en directement lors d'une annotation.
          </p>
        )}

        <div className="grid grid-cols-1 gap-1.5">
          {customLesions.map((l) => (
            <div key={l.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-teal-50 border border-teal-100">
              {/* Sélecteur couleur inline */}
              <label className="cursor-pointer flex-shrink-0" title="Changer la couleur">
                <ColorDot color={l.color} size={18} />
                <input
                  type="color"
                  value={l.color}
                  onChange={(e) => handleUpdateColor(l.id, e.target.value)}
                  className="sr-only"
                />
              </label>
              <span className="flex-1 text-sm font-medium text-slate-800">{l.name}</span>
              <span className="text-xs text-teal-600 bg-teal-100 px-2 py-0.5 rounded-full">{l.category}</span>
              <button
                type="button"
                onClick={() => handleDelete(l.id)}
                disabled={saving}
                className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors disabled:opacity-40"
                aria-label={`Supprimer ${l.name}`}
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      </div>

      {/* Formulaire d'ajout */}
      <div className="border-2 border-teal-100 rounded-2xl p-4 space-y-3 bg-teal-50/40">
        <span className="text-xs font-black text-teal-700 uppercase tracking-wider">Ajouter une lésion</span>
        <div className="flex gap-3 items-end">
          {/* Sélecteur de couleur */}
          <div className="flex flex-col items-center gap-1">
            <span className="text-xs text-slate-500 font-bold uppercase">Couleur</span>
            <label className="cursor-pointer">
              <div
                className="w-9 h-9 rounded-xl border-2 border-white shadow-md"
                style={{ background: newColor }}
                title="Choisir la couleur"
              />
              <input
                type="color"
                value={newColor}
                onChange={(e) => setNewColor(e.target.value)}
                className="sr-only"
              />
            </label>
          </div>

          {/* Nom */}
          <div className="flex-1">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Nom</label>
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
              placeholder="Ex: Néovaisseaux sous-rétiniens…"
              disabled={saving}
              className="w-full px-3 py-2 text-sm border-2 border-slate-200 rounded-xl outline-none focus:border-teal-400 disabled:opacity-50 bg-white"
            />
          </div>

          {/* Catégorie */}
          <div>
            <label className="block text-xs font-bold text-slate-500 uppercase mb-1">Catégorie</label>
            <select
              value={newCategory}
              onChange={(e) => setNewCategory(e.target.value)}
              disabled={saving}
              className="px-3 py-2 text-sm border-2 border-slate-200 rounded-xl outline-none focus:border-teal-400 bg-white disabled:opacity-50"
            >
              {CATEGORIES_PRESET.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Bouton */}
          <button
            type="button"
            onClick={handleAdd}
            disabled={saving || !newName.trim()}
            className="w-9 h-9 flex-shrink-0 flex items-center justify-center rounded-xl bg-teal-600 text-white hover:bg-teal-700 disabled:opacity-40 disabled:cursor-not-allowed transition-all active:scale-95"
            aria-label="Ajouter"
          >
            <Plus className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
