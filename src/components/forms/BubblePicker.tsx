import { useState } from 'react';
import { Plus, X } from 'lucide-react';

export interface BubblePickerProps {
  title: string;
  selectedItems: string[];
  suggestions: string[];
  onAdd: (item: string) => void;
  onRemove: (item: string) => void;
}

export default function BubblePicker({
  title,
  selectedItems,
  suggestions,
  onAdd,
  onRemove,
}: BubblePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');

  const showDefault = selectedItems.length === 0;

  const handleAddCustom = () => {
    const v = customInput.trim();
    if (v && !selectedItems.includes(v)) {
      onAdd(v);
      setCustomInput('');
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm text-slate-700 flex items-center gap-2">
          <span className="text-slate-400">◈</span> {title}
        </h4>
        <button
          onClick={() => setIsOpen(!isOpen)}
          className={`p-1 rounded-lg transition-colors ${
            isOpen
              ? 'text-teal-600 bg-teal-50'
              : 'text-slate-400 hover:text-teal-600 hover:bg-slate-100'
          }`}
          title={`Ajouter — ${title}`}
        >
          <Plus className="w-4 h-4" />
        </button>
      </div>

      {/* Bulles sélectionnées ou état vide */}
      <div className="flex flex-wrap gap-2 min-h-[34px] items-center">
        {showDefault ? (
          <span className="text-sm text-slate-400 italic px-3 py-1.5 bg-slate-50 rounded-full border border-dashed border-slate-200">
            ○ Sans particularité
          </span>
        ) : (
          selectedItems.map((item) => (
            <button
              key={item}
              onClick={() => onRemove(item)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 active:scale-95 transition-all"
            >
              {item}
              <X className="w-3.5 h-3.5 opacity-60" />
            </button>
          ))
        )}
      </div>

      {/* Panneau de suggestions */}
      {isOpen && (
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm space-y-3 animate-in slide-in-from-top-2">
          <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Propositions</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <button
                key={s}
                onClick={() => onAdd(s)}
                disabled={selectedItems.includes(s)}
                className="px-3 py-1.5 rounded-full border text-sm font-medium transition-all active:scale-95
                  disabled:opacity-40 disabled:cursor-not-allowed
                  border-slate-200 text-slate-700 hover:enabled:bg-teal-50 hover:enabled:border-teal-300 hover:enabled:text-teal-800"
              >
                {s}
              </button>
            ))}
          </div>
          <div className="flex gap-2 pt-2 border-t border-slate-100">
            <input
              value={customInput}
              onChange={(e) => setCustomInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAddCustom();
                if (e.key === 'Escape') setIsOpen(false);
              }}
              placeholder="Observation personnalisée…"
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg outline-none focus:border-teal-400"
            />
            <button
              onClick={handleAddCustom}
              disabled={!customInput.trim()}
              className="px-3 py-2 bg-teal-500 text-white rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-teal-600 transition-colors"
            >
              OK
            </button>
            <button
              onClick={() => setIsOpen(false)}
              className="px-3 py-2 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
