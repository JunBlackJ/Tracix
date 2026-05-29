import React from 'react';

interface FilterChip {
  label: string;
  value: string;
  active: boolean;
}

interface MobileFilterBarProps {
  chips: FilterChip[];
  onChipClick: (value: string) => void;
}

export function MobileFilterBar({ chips, onChipClick }: MobileFilterBarProps) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none -mx-4 px-4">
      {chips.map((chip) => (
        <button
          key={chip.value}
          onClick={() => onChipClick(chip.value)}
          className="flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-colors min-h-[32px]"
          style={{
            background: chip.active ? 'oklch(42% 0.18 280 / 0.12)' : 'oklch(95% 0.005 260)',
            color: chip.active ? 'oklch(42% 0.18 280)' : 'oklch(40% 0.02 260)',
            border: chip.active ? '1px solid oklch(42% 0.18 280 / 0.3)' : '1px solid oklch(90% 0.006 260)',
          }}
        >
          {chip.label}
        </button>
      ))}
    </div>
  );
}
