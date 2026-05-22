import type { LucideIcon } from 'lucide-react';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
  hint?: string;
}

export function EmptyState({ icon: Icon, title, description, action, hint }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-[#534AB7]/8 flex items-center justify-center mb-4">
        <Icon className="w-8 h-8 text-[#534AB7]/60" />
      </div>
      <h3 className="text-base font-semibold text-gray-800 mb-1">{title}</h3>
      <p className="text-sm text-gray-400 max-w-xs mb-5">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#534AB7] text-white rounded-xl text-sm font-medium hover:bg-[#3C3489] transition-colors"
        >
          {action.label}
        </button>
      )}
      {hint && (
        <p className="text-xs text-gray-300 mt-4 max-w-xs">{hint}</p>
      )}
    </div>
  );
}

interface FilterEmptyProps {
  onReset: () => void;
}

export function FilterEmpty({ onReset }: FilterEmptyProps) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <p className="text-sm text-gray-400 mb-2">Aucun résultat pour ces filtres</p>
      <button
        onClick={onReset}
        className="text-xs text-[#534AB7] hover:underline"
      >
        Réinitialiser les filtres
      </button>
    </div>
  );
}
