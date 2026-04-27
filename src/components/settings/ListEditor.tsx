import { useState } from 'react';
import { Plus, X } from 'lucide-react';

interface ListEditorProps {
  title: string;
  placeholder: string;
  items: string[];
  onAdd: (item: string) => Promise<void>;
  onRemove: (index: number) => Promise<void>;
}

export default function ListEditor({ title, placeholder, items, onAdd, onRemove }: ListEditorProps) {
  const [newItem, setNewItem] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const handleAdd = async () => {
    const trimmed = newItem.trim();
    if (!trimmed || items.includes(trimmed)) return;
    setBusy(true);
    try {
      await onAdd(trimmed);
      setNewItem('');
      setIsAdding(false);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-slate-50 border border-slate-200 rounded-2xl p-5">
      <h4 className="text-sm font-black uppercase tracking-wider text-slate-700 mb-4">{title}</h4>

      <div className="flex flex-wrap gap-2 min-h-[36px] mb-4">
        {items.length === 0 ? (
          <span className="text-sm text-slate-400 italic">Aucun élément — utilise les valeurs par défaut.</span>
        ) : (
          items.map((item, idx) => (
            <span
              key={idx}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white border border-slate-300 text-sm font-medium text-slate-700"
            >
              {item}
              <button
                type="button"
                onClick={() => onRemove(idx)}
                className="text-slate-400 hover:text-red-500 transition-colors"
                title="Supprimer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </span>
          ))
        )}
      </div>

      {isAdding ? (
        <div className="flex gap-2">
          <input
            type="text"
            value={newItem}
            onChange={(e) => setNewItem(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAdd();
              if (e.key === 'Escape') { setIsAdding(false); setNewItem(''); }
            }}
            placeholder={placeholder}
            autoFocus
            className="flex-1 p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-500"
          />
          <button
            type="button"
            onClick={handleAdd}
            disabled={!newItem.trim() || busy}
            className="flex items-center gap-1.5 bg-teal-600 hover:bg-teal-700 text-white px-4 py-3 rounded-xl font-bold text-sm transition-colors disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            {busy ? '…' : 'Ajouter'}
          </button>
          <button
            type="button"
            onClick={() => { setIsAdding(false); setNewItem(''); }}
            className="px-4 py-3 rounded-xl border-2 border-slate-200 text-slate-500 hover:bg-slate-100 text-sm font-bold transition-colors"
          >
            Annuler
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setIsAdding(true)}
          className="flex items-center gap-2 text-sm font-bold text-teal-600 hover:text-teal-800 border-2 border-dashed border-teal-200 hover:border-teal-400 px-4 py-2.5 rounded-xl transition-all active:scale-95"
        >
          <Plus className="w-4 h-4" />
          Ajouter un élément
        </button>
      )}
    </div>
  );
}
