import React from 'react';

interface MobileDataCardProps {
  avatar?: React.ReactNode;
  title: string;
  subtitle?: string;
  badge?: React.ReactNode;
  pills?: React.ReactNode;
  onClick?: () => void;
  actions?: React.ReactNode;
}

export function MobileDataCard({ avatar, title, subtitle, badge, pills, onClick, actions }: MobileDataCardProps) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-4 border-b transition-colors active:bg-gray-50"
      style={{ borderColor: 'oklch(90% 0.006 260)', cursor: onClick ? 'pointer' : 'default' }}
    >
      {avatar && <div className="flex-shrink-0">{avatar}</div>}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-gray-900 truncate">{title}</span>
          {badge && <div className="flex-shrink-0">{badge}</div>}
        </div>
        {subtitle && (
          <p className="text-xs text-gray-500 truncate mt-0.5">{subtitle}</p>
        )}
        {pills && (
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5">{pills}</div>
        )}
      </div>
      {actions && <div className="flex-shrink-0">{actions}</div>}
    </div>
  );
}
