"use client";

import React, { ReactNode, useEffect } from "react";
import { X } from "lucide-react";

interface SidePanelProps {
  open: boolean;
  onClose: () => void;
  /** Slot above the body — usually the entity title + status. */
  header?: ReactNode;
  children: ReactNode;
  /** width in px — default 480. */
  width?: number;
  /** ARIA label for screen readers. */
  ariaLabel?: string;
}

/**
 * Reusable side-panel drawer used by /candidates and /jobs.
 *
 * In RTL the drawer slides from the LEFT edge of the screen, leaving the
 * row list visible on the right (= reading-direction start). This matches the
 * GlobalSearch hover-expand pattern: header chrome stays anchored, only the
 * sibling content gets the drawer overlay.
 *
 * Closes on:
 *   - Backdrop click
 *   - Esc key
 *   - X button in the corner
 */
export function SidePanel({ open, onClose, header, children, width = 480, ariaLabel }: SidePanelProps) {
  // Esc to close. Only attach the listener while open to avoid global noise.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel ?? "פאנל פרטים"}
      className="fixed inset-0 z-[9999] flex"
      // Click-outside support: backdrop is to the right of the drawer in RTL.
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-slate-900/40 backdrop-blur-[2px] animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Drawer — anchored LEFT (in RTL this is the visual end of the row,
          letting the user keep the list in their natural reading direction). */}
      <aside
        className="relative ml-0 mr-auto h-full bg-white shadow-2xl border-r border-slate-200 animate-in slide-in-from-left duration-300 flex flex-col"
        style={{ width }}
        dir="rtl"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="סגור פאנל"
          className="absolute top-4 left-4 z-10 w-9 h-9 rounded-full bg-slate-50 hover:bg-white border border-slate-200 text-slate-500 hover:text-[#EF6B00] flex items-center justify-center shadow-sm transition-colors"
        >
          <X size={16} strokeWidth={1.75} />
        </button>

        {header && (
          <div className="px-6 pt-6 pb-4 border-b border-slate-200 shrink-0">
            {header}
          </div>
        )}

        <div className="flex-1 overflow-y-auto px-6 py-5">
          {children}
        </div>
      </aside>
    </div>
  );
}
