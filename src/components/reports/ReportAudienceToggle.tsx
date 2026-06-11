/**
 * ReportAudienceToggle — bascule entre la vue médecin et la vue patient
 * du compte rendu. Non imprimé (classe no-print à appliquer par le parent).
 */

import { Stethoscope, HeartHandshake } from 'lucide-react';

export type ReportAudience = 'medecin' | 'patient';

interface Props {
  value: ReportAudience;
  onChange: (v: ReportAudience) => void;
}

export default function ReportAudienceToggle({ value, onChange }: Props) {
  return (
    <div className="inline-flex bg-white border border-slate-200 rounded-full p-1 shadow-sm">
      <button
        type="button"
        onClick={() => onChange('medecin')}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
          value === 'medecin' ? 'bg-teal-600 text-white shadow' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <Stethoscope className="w-4 h-4" /> Vue médecin
      </button>
      <button
        type="button"
        onClick={() => onChange('patient')}
        className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
          value === 'patient' ? 'bg-teal-600 text-white shadow' : 'text-slate-500 hover:text-slate-800'
        }`}
      >
        <HeartHandshake className="w-4 h-4" /> Vue patient
      </button>
    </div>
  );
}
