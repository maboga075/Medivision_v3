import { useState } from 'react';
import { X, Plus } from 'lucide-react';

const PREDEFINED_REASONS = [
  'Cataracte',
  'Nystagmus',
  'Opacité cornéenne',
  'Ptôse',
  'Miose',
  'Mydriase',
  'Pupille peu réactive',
  'Mouvements involontaires',
  'Fixation difficile',
];

interface ModalAcquisitionQualityProps {
  isOpen: boolean;
  side: 'OD' | 'OG';
  quality: 'faible' | 'impossible';
  reasons: string[];
  onClose: () => void;
  onSave: (reasons: string[]) => void;
}

export default function ModalAcquisitionQuality({
  isOpen,
  side,
  quality,
  reasons,
  onClose,
  onSave,
}: ModalAcquisitionQualityProps) {
  const [selected, setSelected] = useState<string[]>(reasons);
  const [customInput, setCustomInput] = useState('');

  if (!isOpen) return null;

  const toggle = (r: string) =>
    setSelected(prev =>
      prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r]
    );

  const addCustom = () => {
    const v = customInput.trim();
    if (v && !selected.includes(v)) {
      setSelected(prev => [...prev, v]);
      setCustomInput('');
    }
  };

  const qualityLabel = quality === 'faible' ? '⚠ Faible' : '✗ Impossible';
  const qualityBadge = quality === 'faible'
    ? 'bg-orange-50 text-orange-700 border-orange-300'
    : 'bg-red-50 text-red-700 border-red-300';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md max-h-[85vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <h3 className="font-extrabold text-slate-800 text-base">
              Causes — {side === 'OD' ? 'Œil droit' : 'Œil gauche'}
            </h3>
            <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold border ${qualityBadge}`}>
              {qualityLabel}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 px-6 py-5 space-y-5">
          <p className="text-xs text-slate-500 font-medium uppercase tracking-wider">
            Sélectionnez une ou plusieurs causes :
          </p>

          {/* Raisons prédéfinies */}
          <div className="flex flex-wrap gap-2">
            {PREDEFINED_REASONS.map(r => {
              const isSelected = selected.includes(r);
              return (
                <button
                  key={r}
                  type="button"
                  onClick={() => toggle(r)}
                  className={`px-3 py-2 rounded-xl text-sm font-medium border transition-all active:scale-95 ${
                    isSelected
                      ? 'bg-teal-500 border-teal-500 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:border-teal-300 hover:bg-teal-50'
                  }`}
                >
                  {isSelected && <span className="mr-1">✓</span>}
                  {r}
                </button>
              );
            })}
          </div>

          {/* Cause personnalisée */}
          <div className="border-t border-slate-100 pt-4">
            <label className="block text-xs font-bold text-slate-500 uppercase mb-2">
              Autre cause
            </label>
            <div className="flex gap-2">
              <input
                type="text"
                value={customInput}
                onChange={e => setCustomInput(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') addCustom();
                  if (e.key === 'Escape') onClose();
                }}
                placeholder="Précisez une autre cause…"
                className="flex-1 px-3 py-2.5 text-sm border-2 border-slate-200 rounded-xl outline-none focus:border-teal-400"
              />
              <button
                type="button"
                onClick={addCustom}
                disabled={!customInput.trim()}
                className="w-11 h-11 flex items-center justify-center bg-teal-500 text-white rounded-xl disabled:opacity-40 hover:bg-teal-600 active:scale-95 transition-all"
              >
                <Plus className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Causes sélectionnées */}
          {selected.length > 0 && (
            <div>
              <p className="text-xs font-bold text-slate-500 uppercase mb-2">
                Causes retenues ({selected.length})
              </p>
              <div className="flex flex-wrap gap-2">
                {selected.map(r => (
                  <div
                    key={r}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-teal-50 text-teal-800 border border-teal-200 rounded-full text-sm font-medium"
                  >
                    {r}
                    <button
                      type="button"
                      onClick={() => setSelected(prev => prev.filter(x => x !== r))}
                      className="hover:text-teal-600 transition-colors"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors active:scale-95"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={() => { onSave(selected); onClose(); }}
            className="flex-1 px-4 py-2.5 text-sm font-bold text-white bg-teal-500 hover:bg-teal-600 rounded-xl transition-colors active:scale-95"
          >
            Enregistrer
          </button>
        </div>

      </div>
    </div>
  );
}
