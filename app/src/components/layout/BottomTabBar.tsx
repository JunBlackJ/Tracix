import { Link, useLocation } from 'react-router-dom';
import { LayoutDashboard, Bell, Users, ShieldCheck, MoreHorizontal } from 'lucide-react';
import { useState } from 'react';

interface BottomTabBarProps {
  unresolvedAlerts: number;
  onMoreClick: () => void;
}

const TABS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { path: '/alertes', label: 'Alertes', icon: Bell, hasBadge: true },
  { path: '/membres', label: 'Membres', icon: Users },
  { path: '/plateformes', label: 'Plateformes', icon: ShieldCheck },
];

export function BottomTabBar({ unresolvedAlerts, onMoreClick }: BottomTabBarProps) {
  const location = useLocation();

  const isActive = (path: string) =>
    location.pathname === path || location.pathname.startsWith(path + '/');

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-30 lg:hidden border-t flex items-center justify-around"
      style={{
        height: 56,
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        background: 'hsl(220 20% 97% / 0.96)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        borderColor: 'hsl(var(--border))',
      }}
    >
      {TABS.map((tab) => {
        const active = isActive(tab.path);
        const Icon = tab.icon;
        return (
          <Link
            key={tab.path}
            to={tab.path}
            className="flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] min-w-[44px] transition-colors"
            style={{ color: active ? '#534AB7' : '#6B7280' }}
          >
            <div className="relative">
              <Icon className="w-5 h-5" />
              {tab.hasBadge && unresolvedAlerts > 0 && (
                <span
                  className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 flex items-center justify-center rounded-full text-[9px] font-bold text-white leading-none"
                  style={{ background: 'oklch(55% 0.22 25)' }}
                >
                  {unresolvedAlerts > 99 ? '99+' : unresolvedAlerts}
                </span>
              )}
            </div>
            <span className="text-[10px] font-medium">{tab.label}</span>
          </Link>
        );
      })}
      <button
        onClick={onMoreClick}
        className="flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[44px] min-w-[44px] transition-colors"
        style={{ color: '#6B7280' }}
      >
        <MoreHorizontal className="w-5 h-5" />
        <span className="text-[10px] font-medium">Plus</span>
      </button>
    </nav>
  );
}
