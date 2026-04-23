import { AlertTriangle, CheckCircle } from 'lucide-react';
import type { ValidationResult } from '../../types/ai';

interface ValidationBadgeProps {
  validation: ValidationResult | null;
}

const COLOR_MAP: Record<string, string> = {
  vert: 'bg-green-100 text-green-700 border-green-300',
  orange: 'bg-amber-100 text-amber-700 border-amber-300',
  rouge: 'bg-red-100 text-red-700 border-red-300',
};

const LABEL_MAP: Record<string, string> = {
  vert: 'Analyse Valide',
  orange: 'Analyse Partielle',
  rouge: 'Erreur Analyse',
};

export default function ValidationBadge({ validation }: ValidationBadgeProps) {
  if (!validation) return null;

  const icon =
    validation.score === 'vert' ? (
      <CheckCircle className="w-4 h-4" />
    ) : (
      <AlertTriangle className="w-4 h-4" />
    );

  return (
    <div
      className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 text-sm font-bold shadow-sm ${COLOR_MAP[validation.score]}`}
    >
      {icon}
      {LABEL_MAP[validation.score]}
      {validation.issues.length > 0 && (
        <span className="ml-1 opacity-80 bg-black/10 px-2 py-0.5 rounded-lg text-xs">
          ({validation.issues.length})
        </span>
      )}
    </div>
  );
}
