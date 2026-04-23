import { Edit3 } from 'lucide-react';

// Édition inline sur une seule ligne (valeur courte : nom, date, mesure)
interface EditableInlineProps {
  value: string | undefined;
  field: string;
  onEdit: (field: string, value: string) => void;
  className?: string;
}

export const EditableInline = ({ value, field, onEdit, className = '' }: EditableInlineProps) => (
  <span
    contentEditable
    suppressContentEditableWarning
    onBlur={(e) => onEdit(field, e.currentTarget.innerText)}
    className={`outline-none hover:bg-teal-50 border-b border-transparent hover:border-teal-300 transition-colors cursor-text inline-block min-w-[20px] ${className}`}
  >
    {value ?? '—'}
  </span>
);

// Édition d'une section avec label (interprétation, conclusion, etc.)
interface EditableSectionProps {
  label: string;
  value: string | undefined;
  field: string;
  onEdit: (field: string, value: string) => void;
}

export const EditableSection = ({ label, value, onEdit, field }: EditableSectionProps) => {
  if (!value) return null;
  return (
    <div className="group relative py-1 border-b border-transparent hover:border-teal-200 transition-colors flex items-start gap-3">
      <span className="text-[10px] font-bold text-[#0C2233] min-w-[140px] uppercase pt-1 tracking-wide shrink-0">
        {label} :
      </span>
      <div
        contentEditable
        suppressContentEditableWarning
        onBlur={(e) => onEdit(field, e.currentTarget.innerText)}
        className="text-[11px] text-slate-700 outline-none flex-1 focus:bg-teal-50 p-1 rounded min-h-[20px] transition-colors leading-relaxed"
      >
        {value}
      </div>
      <Edit3 className="w-3 h-3 text-teal-300 opacity-0 group-hover:opacity-100 absolute right-0 mt-1 shrink-0 transition-opacity" />
    </div>
  );
};

// Édition d'un bloc texte libre (conclusion, recommandations)
interface EditableBlockProps {
  value: string | undefined;
  field: string;
  onEdit: (field: string, value: string) => void;
  className?: string;
}

export const EditableBlock = ({ value, field, onEdit, className = '' }: EditableBlockProps) => (
  <div
    contentEditable
    suppressContentEditableWarning
    onBlur={(e) => onEdit(field, e.currentTarget.innerText)}
    className={`outline-none hover:bg-teal-50/50 focus:bg-teal-50/50 border-b border-transparent hover:border-teal-200 transition-colors ${className}`}
  >
    {value ?? '—'}
  </div>
);
