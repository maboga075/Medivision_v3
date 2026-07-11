/**
 * ReportAudienceToggle — choix du compte rendu affiché :
 *  - « OCT »    : mise en page OCT (portrait, RNFL/GCL/C-D).
 *  - « Rétino » : mise en page rétinographie (paysage, schémas pleine largeur).
 *  - « Patient »: version vulgarisée pour le patient.
 * Disponible pour tout patient (même OCT seul). Non imprimé (classe no-print
 * à appliquer par le parent).
 */

import { Stethoscope, Eye, HeartHandshake } from 'lucide-react';

export type ReportAudience = 'oct' | 'retino' | 'patient';

interface Props {
  value: ReportAudience;
  onChange: (v: ReportAudience) => void;
}

const OPTIONS: { key: ReportAudience; label: string; Icon: typeof Stethoscope }[] = [
  { key: 'oct', label: 'Compte rendu OCT', Icon: Stethoscope },
  { key: 'retino', label: 'Compte rendu Rétino', Icon: Eye },
  { key: 'patient', label: 'Compte rendu patient', Icon: HeartHandshake },
];

export default function ReportAudienceToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex bg-white border border-slate-200 rounded-full p-1 shadow-sm">
      {OPTIONS.map(({ key, label, Icon }) => (
        <button
          key={key}
          type="button"
          onClick={() => onChange(key)}
          className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
            value === key ? 'bg-teal-600 text-white shadow' : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <Icon className="w-4 h-4" /> {label}
        </button>
      ))}
    </div>
  );
}
