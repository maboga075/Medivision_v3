import React, { useState } from 'react';
import { X } from 'lucide-react';

interface ChipGroupProps {
  label?: string;
  icon?: React.ReactNode;
  chips: string[];
  selected: string[];
  onToggle: (next: string[]) => void;
  onAddCustom?: (value: string) => void;
  norms?: string[];
  exclusions?: [string, string][];
}

export default function ChipGroup({
  label,
  icon,
  chips,
  selected,
  onToggle,
  onAddCustom,
  norms = ['Sans particularité'],
  exclusions = [],
}: ChipGroupProps) {
  const [showAdd, setShowAdd] = useState(false);
  const [custom, setCustom] = useState('');

  const handleToggle = (chip: string) => {
    if (norms.includes(chip)) return onToggle([chip]);

    let next = selected.includes(chip)
      ? selected.filter((x) => x !== chip)
      : [...selected.filter((x) => !norms.includes(x)), chip];

    if (!next.length) next = [norms[0]];

    if (!selected.includes(chip)) {
      exclusions.forEach(([a, b]) => {
        if (chip === a) next = next.filter((x) => x !== b);
        if (chip === b) next = next.filter((x) => x !== a);
      });
    }
    onToggle(next);
  };

  const handleAdd = () => {
    if (custom.trim()) {
      onAddCustom?.(custom.trim());
      onToggle([...selected.filter((x) => !norms.includes(x)), custom.trim()]);
      setCustom('');
      setShowAdd(false);
    }
  };

  return (
    <div className="mb-4">
      {label && (
        <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
          {icon} {label}
        </div>
      )}
      <div className="flex flex-wrap gap-3">
        {chips.map((c) => (
          <span
            key={c}
            onClick={() => handleToggle(c)}
            className={`px-4 py-2.5 rounded-2xl text-sm font-bold cursor-pointer border border-transparent transition-all active:scale-95 select-none ${
              selected.includes(c)
                ? 'bg-teal-500 text-white shadow-md'
                : 'bg-white text-slate-600 border-slate-200 hover:border-teal-300 shadow-sm'
            }`}
          >
            {c}
          </span>
        ))}

        {showAdd ? (
          <div className="flex items-center gap-2 p-1 bg-teal-50/50 rounded-2xl">
            <input
              autoFocus
              className="px-4 py-2 border-2 border-teal-300 rounded-xl text-sm outline-none focus:border-teal-500 min-w-[150px] font-bold"
              placeholder="Nouveau tag..."
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleAdd();
                if (e.key === 'Escape') setShowAdd(false);
              }}
            />
            <button
              onClick={handleAdd}
              className="bg-teal-500 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-teal-600 transition-colors"
            >
              OK
            </button>
            <button onClick={() => setShowAdd(false)} className="text-slate-400 hover:text-slate-600 p-2">
              <X className="w-5 h-5" />
            </button>
          </div>
        ) : (
          <span
            onClick={() => setShowAdd(true)}
            className="px-4 py-2.5 rounded-2xl text-sm font-bold cursor-pointer border-2 border-dashed border-slate-300 text-slate-500 hover:bg-slate-50 flex items-center select-none active:scale-95 transition-all"
          >
            ＋ Autre
          </span>
        )}
      </div>
    </div>
  );
}
