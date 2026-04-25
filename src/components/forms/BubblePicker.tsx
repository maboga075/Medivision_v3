import { useRef, useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';

export interface BubblePickerProps {
  title: string;
  selectedItems: string[];
  suggestions: string[];
  onAdd: (item: string) => void;
  onRemove: (item: string) => void;
  disabled?: boolean;
}

export default function BubblePicker({
  title,
  selectedItems,
  suggestions,
  onAdd,
  onRemove,
  disabled = false,
}: BubblePickerProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setIsOpen(false);
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen]);

  const handleAddCustom = () => {
    const v = customInput.trim();
    if (v && !selectedItems.includes(v)) {
      onAdd(v);
      setCustomInput('');
    }
  };

  return (
    <div className={`space-y-2 ${disabled ? 'opacity-50 pointer-events-none select-none' : ''}`} ref={containerRef}>
      <div className="flex items-center justify-between">
        <h4 className="font-bold text-sm text-slate-700 flex items-center gap-2">
          <span className="text-slate-400">◈</span> {title}
        </h4>
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          disabled={disabled}
          aria-label={`${isOpen ? 'Fermer' : 'Ajouter'} — ${title}`}
          aria-expanded={isOpen}
          className={`w-11 h-11 flex items-center justify-center rounded-xl transition-all active:scale-95 ${
            isOpen
              ? 'text-teal-600 bg-teal-50 border border-teal-200'
              : 'text-slate-400 hover:text-teal-600 hover:bg-slate-100 border border-transparent'
          }`}
        >
          <Plus className={`w-5 h-5 transition-transform duration-200 ${isOpen ? 'rotate-45' : ''}`} />
        </button>
      </div>

      {/* Bulles sélectionnées ou état vide */}
      <div className="flex flex-wrap gap-2 min-h-[34px] items-center">
        {selectedItems.length === 0 ? (
          <span className="text-sm text-slate-400 italic px-3 py-1.5 bg-slate-50 rounded-full border border-dashed border-slate-200">
            ○ Sans particularité
          </span>
        ) : (
          selectedItems.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => onRemove(item)}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full text-sm font-medium bg-amber-50 text-amber-900 border border-amber-200 hover:bg-amber-100 active:scale-95 transition-all min-h-[44px]"
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
                type="button"
                onClick={() => onAdd(s)}
                disabled={selectedItems.includes(s)}
                className="px-4 py-2.5 rounded-full border text-sm font-medium transition-all active:scale-95 min-h-[44px]
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
              className="flex-1 px-3 py-2.5 text-sm border border-slate-200 rounded-lg outline-none focus:border-teal-400 min-h-[44px]"
            />
            <button
              type="button"
              onClick={handleAddCustom}
              disabled={!customInput.trim()}
              className="px-4 py-2.5 bg-teal-500 text-white rounded-lg text-sm font-bold disabled:opacity-40 hover:bg-teal-600 active:scale-95 transition-all min-h-[44px]"
            >
              OK
            </button>
            <button
              type="button"
              onClick={() => setIsOpen(false)}
              aria-label="Fermer"
              className="w-11 h-11 flex items-center justify-center text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100 active:scale-95 transition-all"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
