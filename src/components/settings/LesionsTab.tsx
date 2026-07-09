import { useState } from 'react';
import { Plus, X, Palette, RotateCcw } from 'lucide-react';
import { useSettings } from '../../hooks/useSettings';
import { LESIONS } from '../../features/retinasketch/lib/ontology/lesions';
import type { CustomLesion } from '../../types/settings';

const CATEGORIES_PRESET = [
  'Hémorragie', 'Vasculaire', 'Exsudat', 'Dégénératif',
  'Œdème', 'Structurel', 'Traitement', 'Autre',
];

const DEFAULT_COLOR = '#14B8A6';

/** Génère les termes de recherche d'un nom de lésion. */
const termsFromName = (name: string): string[] => [
  name.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[-'\s]+/g, '_'),
];

function ColorDot({ color, size = 16 }: { color: string; size?: number }) {
  return (
    <span
      style={{ width: size, height: size, background: color, borderRadius: '50%', display: 'inline-block', flexShrink: 0 }}
    />
  );
}

/** Ligne d'une lésion, entièrement modifiable (couleur, nom, catégorie, suppression). */
function LesionRow({
  lesion,
  onPatch,
  onDelete,
  tone,
}: {
  lesion: CustomLesion;
  onPatch: (patch: Partial<CustomLesion>) => void;
  onDelete: () => void;
  tone: 'builtin' | 'custom';
}) {
  const bg = tone === 'custom' ? 'bg-teal-50 border-teal-100' : 'bg-slate-50 border-slate-100';
  return (
    <div className={`flex items-center gap-3 px-3 py-2 rounded-xl border ${bg}`}>
      {/* Couleur */}
      <label className="cursor-pointer flex-shrink-0" title="Changer la couleur">
        <ColorDot color={lesion.color} size={18} />
        <input
          type="color"
          value={lesion.color}
          onChange={(e) => onPatch({ color: e.target.value })}
          className="sr-only"
        />
      </label>
      {/* Nom (éditable) */}
      <input
        type="text"
        defaultValue={lesion.name}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v && v !== lesion.name) onPatch({ name: v, terms: termsFromName(v) });
          else e.target.value = lesion.name;
        }}
        onKeyDown={(e) => { if (e.key === 'Enter') (e.target as HTMLInputElement).blur(); }}
        className="flex-1 min-w-0 text-sm font-medium text-slate-800 bg-transparent border border-transparent hover:border-slate-200 focus:border-teal-400 rounded-lg px-2 py-1 outline-none"
      />
      {/* Catégorie (éditable) */}
      <select
        value={CATEGORIES_PRESET.includes(lesion.category) ? lesion.category : 'Autre'}
        onChange={(e) => onPatch({ category: e.target.value })}
        className="text-xs text-slate-500 bg-white border border-slate-200 rounded-full px-2 py-1 outline-none focus:border-teal-400 cursor-pointer"
      >
        {CATEGORIES_PRESET.map((c) => (
          <option key={c} value={c}>{c}</option>
        ))}
      </select>
      {/* Suppression */}
      <button
        type="button"
        onClick={onDelete}
        className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-red-100 text-slate-400 hover:text-red-600 transition-colors flex-shrink-0"
        aria-label={`Supprimer ${lesion.name}`}
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}

export default function LesionsTab() {
  const { settings, updateCustomLesions, updateLesionOverrides } = useSettings();
  const customLesions: CustomLesion[] = settings?.customLesions ?? [];
  const overrides: Record<string, CustomLesion | null> = settings?.lesionOverrides ?? {};

  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState(DEFAULT_COLOR);
  const [newCategory, setNewCategory] = useState('Autre');
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState('');

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2500);
  };

  // Lésions intégrées effectives (surcharges appliquées) + celles masquées (supprimées).
  const builtinEffective: CustomLesion[] = LESIONS
    .filter((l) => overrides[l.id] !== null)
    .map((l) => ({ ...l, ...(overrides[l.id] ?? {}) }));
  const hiddenBuiltins = LESIONS.filter((l) => overrides[l.id] === null);

  const patchBuiltin = async (id: string, patch: Partial<CustomLesion>) => {
    const base = LESIONS.find((l) => l.id === id);
    if (!base) return;
    const current = { ...base, ...(overrides[id] ?? {}) };
    const next: CustomLesion = { ...current, ...patch, id };
    try {
      await updateLesionOverrides({ ...overrides, [id]: next });
    } catch { showToast('Erreur de mise à jour'); }
  };
  const deleteBuiltin = async (id: string) => {
    try {
      await updateLesionOverrides({ ...overrides, [id]: null });
      showToast('Lésion masquée');
    } catch { showToast('Erreur de suppression'); }
  };
  const restoreBuiltin = async (id: string) => {
    const next = { ...overrides };
    delete next[id];
    try {
      await updateLesionOverrides(next);
      showToast('Lésion rétablie');
    } catch { showToast('Erreur'); }
  };

  const patchCustom = async (id: string, patch: Partial<CustomLesion>) => {
    try {
      await updateCustomLesions(customLesions.map((l) => (l.id === id ? { ...l, ...patch } : l)));
    } catch { showToast('Erreur de mise à jour'); }
  };
  const deleteCustom = async (id: string) => {
    try {
      await updateCustomLesions(customLesions.filter((l) => l.id !== id));
      showToast('Lésion supprimée');
    } catch { showToast('Erreur de suppression'); }
  };

  const handleAdd = async () => {
    const name = newName.trim();
    if (!name) return;
    const all = [...builtinEffective, ...customLesions];
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
        terms: termsFromName(name),
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
            Toutes les lésions sont modifiables : nom, couleur, catégorie, suppression.
          </p>
        </div>
      </div>

      {/* Lésions intégrées — désormais modifiables */}
      <div className="space-y-2">
        <span className="text-xs font-black text-slate-600 uppercase tracking-wider">Lésions intégrées</span>
        <div className="grid grid-cols-1 gap-1.5">
          {builtinEffective.map((l) => (
            <LesionRow
              key={l.id}
              lesion={l}
              tone="builtin"
              onPatch={(patch) => patchBuiltin(l.id, patch)}
              onDelete={() => deleteBuiltin(l.id)}
            />
          ))}
        </div>

        {/* Lésions intégrées masquées → rétablissables */}
        {hiddenBuiltins.length > 0 && (
          <div className="mt-2 space-y-1.5">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Masquées</span>
            {hiddenBuiltins.map((l) => (
              <div key={l.id} className="flex items-center gap-3 px-3 py-2 rounded-xl bg-slate-50 border border-dashed border-slate-200 opacity-70">
                <ColorDot color={l.color} />
                <span className="flex-1 text-sm font-medium text-slate-500 line-through">{l.name}</span>
                <button
                  type="button"
                  onClick={() => restoreBuiltin(l.id)}
                  className="flex items-center gap-1 text-xs font-bold text-teal-600 hover:text-teal-700 px-2 py-1 rounded-lg hover:bg-teal-50 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Rétablir
                </button>
              </div>
            ))}
          </div>
        )}
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
            <LesionRow
              key={l.id}
              lesion={l}
              tone="custom"
              onPatch={(patch) => patchCustom(l.id, patch)}
              onDelete={() => deleteCustom(l.id)}
            />
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
