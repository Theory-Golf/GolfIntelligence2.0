'use client';

import { TABS } from '@/lib/golf/types';

interface DashboardNavProps {
  activeTab: string;
  onTabChange: (tab: string) => void;
}

export function DashboardNav({ activeTab, onTabChange }: DashboardNavProps) {
  return (
    <nav className="nav">
      <div className="nav-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`nav-tab ${activeTab === tab.id ? 'is-active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
