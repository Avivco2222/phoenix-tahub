"use client";

import React, { ReactNode } from "react";

interface PageHeaderProps {
  /** Sidebar-matched icon for this page (e.g., <Building2 size={32} />). */
  icon: ReactNode;
  /** Page title in Hebrew. */
  title: string;
  /** One-line subtitle/description. */
  subtitle?: string;
  /** Optional right-side actions (buttons, switches, etc.). */
  actions?: ReactNode;
  /** Optional badge (e.g., DemoBadge) shown next to the title. */
  badge?: ReactNode;
}

/**
 * Uniform header used across all module pages. Keeps title/subtitle/icon styling
 * consistent and matches the icon to the corresponding sidebar entry.
 */
export function PageHeader({ icon, title, subtitle, actions, badge }: PageHeaderProps) {
  return (
    <div className="flex flex-col md:flex-row justify-between items-start md:items-end border-b border-slate-200 pb-5 gap-4">
      <div className="flex items-start gap-4 min-w-0">
        {/* Icon plate — matches the sidebar entry's icon. The animate-greeting-enter
            class (defined in globals.css) plays a one-shot spring entrance every
            navigation: scale-in + slight rotation overshoot, settling clean. */}
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#002649]/5 to-[#EF6B00]/10 text-[#EF6B00] flex items-center justify-center shrink-0 border border-[#002649]/10 animate-greeting-enter shadow-sm">
          {icon}
        </div>
        <div className="min-w-0">
          <h1 className="text-3xl font-black text-[#002649] tracking-tight flex items-center gap-3 flex-wrap">
            {title}
            {badge}
          </h1>
          {subtitle && (
            <p className="text-slate-500 mt-1.5 font-medium text-sm leading-snug">{subtitle}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex items-center gap-3 shrink-0 flex-wrap">{actions}</div>}
    </div>
  );
}
