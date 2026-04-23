import React, { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { hasRealSelection } from '../../utils/clinicalData';

interface CollapsibleSectionProps {
  title: string;
  icon?: string;
  selectedData: string[];
  children: React.ReactNode;
}

export default function CollapsibleSection({ title, icon, selectedData, children }: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(false);
  const activeCount = hasRealSelection(selectedData) ? selectedData.length : 0;

  return (
    <div className="border-2 border-slate-100 rounded-2xl overflow-hidden bg-white mb-3 shadow-sm transition-all hover:border-slate-200">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full p-4 bg-slate-50 hover:bg-slate-100 transition-colors flex justify-between items-center outline-none"
      >
        <span className="text-sm font-extrabold text-slate-700 uppercase tracking-wider flex items-center gap-3">
          {icon && (
            <span className="text-lg bg-white p-2 rounded-xl shadow-sm border border-slate-100">{icon}</span>
          )}
          {title}
          {activeCount > 0 && (
            <span className="bg-teal-500 text-white px-2 py-0.5 rounded-lg text-xs font-black shadow-sm ml-2">
              {activeCount}
            </span>
          )}
        </span>
        <div className="p-1.5 bg-white rounded-full shadow-sm border border-slate-100">
          {isOpen ? (
            <ChevronDown className="w-5 h-5 text-teal-600" />
          ) : (
            <ChevronRight className="w-5 h-5 text-slate-400" />
          )}
        </div>
      </button>
      {isOpen && (
        <div className="p-5 border-t-2 border-slate-50 bg-white animate-in slide-in-from-top-2">
          {children}
        </div>
      )}
    </div>
  );
}
