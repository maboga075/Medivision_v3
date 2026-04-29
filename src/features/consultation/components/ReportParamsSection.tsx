import { AlertTriangle, Plus, X } from 'lucide-react';

interface ReportParamsSectionProps {
  showBadge: boolean;
  onShowBadgeChange: (v: boolean) => void;
  badgeVariant: 'surveillance' | 'alerte';
  onBadgeVariantChange: (v: 'surveillance' | 'alerte') => void;
  badgeCustomLabel: string;
  onBadgeCustomLabelChange: (v: string) => void;
  showBadgeCustom: boolean;
  onShowBadgeCustomChange: (v: boolean) => void;
  nextControlDelay: string;
  onNextControlDelayChange: (v: string) => void;
  customDelayText: string;
  onCustomDelayTextChange: (v: string) => void;
}

export default function ReportParamsSection({
  showBadge,
  onShowBadgeChange,
  badgeVariant,
  onBadgeVariantChange,
  badgeCustomLabel,
  onBadgeCustomLabelChange,
  showBadgeCustom,
  onShowBadgeCustomChange,
  nextControlDelay,
  onNextControlDelayChange,
  customDelayText,
  onCustomDelayTextChange,
}: ReportParamsSectionProps) {
  return (
    <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm mb-10 w-full">
      <div className="flex items-center gap-2 mb-5">
        <AlertTriangle className="w-5 h-5 text-slate-400" />
        <h3 className="text-xl font-extrabold text-slate-800 tracking-tight">
          Paramètres du compte rendu
        </h3>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Badge de sévérité */}
        <div className="space-y-3">
          <p className="text-xs font-black text-slate-500 uppercase tracking-wider">Badge de sévérité</p>
          <div className="flex gap-2">
            <button
              onClick={() => { onShowBadgeChange(false); onShowBadgeCustomChange(false); }}
              className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-colors ${!showBadge ? 'bg-slate-700 text-white border-slate-700' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
            >
              Non
            </button>
            <button
              onClick={() => onShowBadgeChange(true)}
              className={`px-4 py-2 rounded-xl text-sm font-bold border-2 transition-colors ${showBadge ? 'bg-amber-500 text-white border-amber-500' : 'bg-white text-slate-400 border-slate-200 hover:border-slate-300'}`}
            >
              Oui
            </button>
          </div>

          {showBadge && (
            <div className="space-y-2 animate-in slide-in-from-top-2 p-3 bg-slate-50 rounded-2xl border border-slate-100">
              <button
                onClick={() => { onBadgeVariantChange('surveillance'); onShowBadgeCustomChange(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${badgeVariant === 'surveillance' && !showBadgeCustom ? 'border-orange-300 bg-orange-50' : 'border-transparent bg-white hover:bg-slate-50'}`}
              >
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-orange-100 text-orange-800 border border-orange-300 uppercase tracking-wider whitespace-nowrap">
                  Surveillance recommandée
                </span>
              </button>

              <button
                onClick={() => { onBadgeVariantChange('alerte'); onShowBadgeCustomChange(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border-2 transition-all text-left ${badgeVariant === 'alerte' && !showBadgeCustom ? 'border-red-300 bg-red-50' : 'border-transparent bg-white hover:bg-slate-50'}`}
              >
                <span className="inline-block text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-800 border border-red-300 uppercase tracking-wider whitespace-nowrap">
                  Urgence thérapeutique
                </span>
              </button>

              {showBadgeCustom ? (
                <div className="flex gap-2 items-center">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${badgeVariant === 'alerte' ? 'bg-red-400' : 'bg-orange-400'}`} />
                  <input
                    autoFocus
                    value={badgeCustomLabel}
                    onChange={(e) => onBadgeCustomLabelChange(e.target.value)}
                    placeholder="Libellé personnalisé…"
                    className="flex-1 p-2 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-400 bg-white"
                  />
                  <div className="flex gap-1">
                    <button
                      onClick={() => onBadgeVariantChange('surveillance')}
                      className={`w-5 h-5 rounded-full bg-orange-300 border-2 transition-colors ${badgeVariant === 'surveillance' ? 'border-orange-600' : 'border-transparent'}`}
                      title="Orange"
                    />
                    <button
                      onClick={() => onBadgeVariantChange('alerte')}
                      className={`w-5 h-5 rounded-full bg-red-400 border-2 transition-colors ${badgeVariant === 'alerte' ? 'border-red-700' : 'border-transparent'}`}
                      title="Rouge"
                    />
                  </div>
                  <button
                    onClick={() => onShowBadgeCustomChange(false)}
                    className="p-1.5 text-slate-400 hover:text-slate-600 rounded-lg hover:bg-slate-100"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => onShowBadgeCustomChange(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-slate-300 text-slate-500 hover:bg-white text-sm font-bold transition-all"
                >
                  <Plus className="w-3.5 h-3.5" /> Indication personnalisée
                </button>
              )}
            </div>
          )}
        </div>

        {/* Délai prochain contrôle */}
        <div className="space-y-3">
          <p className="text-xs font-black text-slate-500 uppercase tracking-wider">
            Délai prochain contrôle OCT
          </p>
          <select
            value={nextControlDelay}
            onChange={(e) => { onNextControlDelayChange(e.target.value); onCustomDelayTextChange(''); }}
            className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold bg-white outline-none focus:border-teal-400 transition-colors"
          >
            <option value="">— Aucun délai précisé —</option>
            <option value="dans 1 an">Dans 1 an</option>
            <option value="dans 6 mois">Dans 6 mois</option>
            <option value="dans 3 mois">Dans 3 mois</option>
            <option value="dans 1 à 2 mois">Dans 1 à 2 mois</option>
            <option value="dans 1 mois">Dans 1 mois</option>
            <option value="suivi clinique simple">Suivi clinique simple</option>
            <option value="__custom__">Personnalisé…</option>
          </select>

          {nextControlDelay === '__custom__' && (
            <input
              autoFocus
              value={customDelayText}
              onChange={(e) => onCustomDelayTextChange(e.target.value)}
              placeholder="Ex : dans 3 semaines…"
              className="w-full p-3 border-2 border-slate-200 rounded-xl text-sm font-bold outline-none focus:border-teal-400 bg-white animate-in slide-in-from-top-2"
            />
          )}

          {((nextControlDelay && nextControlDelay !== '__custom__') ||
            (nextControlDelay === '__custom__' && customDelayText.trim())) && (
            <p className="text-xs text-slate-400 font-medium">
              → Ajouté en premier item de{' '}
              <span className="font-bold text-indigo-600">Suivi &amp; examens complémentaires</span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
