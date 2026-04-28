"use client";
import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";

// ── Types ────────────────────────────────────────────────────────────────────

export interface KpiFormula {
  id: string;
  label: string;
  varA: string;
  op: "/" | "*" | "+" | "-";
  varB: string | null;
  scale: number;
}

export interface AutomationRule {
  id: string;
  metric: string;
  op: "<" | ">" | "=";
  threshold: number;
  action: "toast" | "email" | "flag";
  actionLabel: string;
  enabled: boolean;
}

export interface VisibilityConfig {
  kpi_conversion: boolean;
  kpi_ttf:        boolean;
  chart_sources:  boolean;
  table_recruiters: boolean;
}

export interface AdminConfig {
  formulas:   KpiFormula[];
  rules:      AutomationRule[];
  visibility: VisibilityConfig;
}

// ── Hardcoded fallback (used when backend is offline) ────────────────────────

export const HARDCODED_DEFAULTS: AdminConfig = {
  formulas: [
    { id: "conv_rate", label: "Conversion Rate %",  varA: "hires",        op: "/", varB: "offers",    scale: 100 },
    { id: "ttf",       label: "Time-to-Fill (avg)", varA: "avg_days_open", op: "+", varB: null,        scale: 1   },
  ],
  rules: [
    {
      id: "r1", metric: "interviews_per_week", op: "<", threshold: 7,
      action: "toast", actionLabel: "ממוצע ראיונות נמוך מהיעד", enabled: true,
    },
  ],
  visibility: {
    kpi_conversion:   true,
    kpi_ttf:          true,
    chart_sources:    true,
    table_recruiters: true,
  },
};

// ── Context ──────────────────────────────────────────────────────────────────

interface AdminConfigCtx {
  config:    AdminConfig;
  save:      (patch: Partial<AdminConfig>, section: "formulas" | "rules" | "visibility") => Promise<void>;
  isLoading: boolean;
  isOffline: boolean;
  lastSaved: string | null;
}

const AdminConfigContext = createContext<AdminConfigCtx | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

export function AdminConfigProvider({ children }: { children: React.ReactNode }) {
  const [config,    setConfig]    = useState<AdminConfig>(HARDCODED_DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/admin/config`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as AdminConfig;
      setConfig({ ...HARDCODED_DEFAULTS, ...data });
      setIsOffline(false);
    } catch {
      console.warn("[AdminConfig] Backend offline — using hardcoded defaults");
      setIsOffline(true);
      setConfig(HARDCODED_DEFAULTS);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(
    async (patch: Partial<AdminConfig>, section: "formulas" | "rules" | "visibility") => {
      return new Promise<void>((resolve, reject) => {
        setConfig(prev => {
          const next = { ...prev, ...patch };
          fetch(
            `${process.env.NEXT_PUBLIC_API_URL}/api/admin/config?section=${section}`,
            { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(next) }
          )
            .then(res => {
              if (!res.ok) throw new Error(`HTTP ${res.status}`);
              return res.json() as Promise<{ status: string; timestamp: string }>;
            })
            .then(data => {
              setLastSaved(data.timestamp ?? new Date().toISOString());
              resolve();
            })
            .catch(reject);
          return next; // optimistic update
        });
      });
    },
    []
  );

  return (
    <AdminConfigContext.Provider value={{ config, save, isLoading, isOffline, lastSaved }}>
      {children}
    </AdminConfigContext.Provider>
  );
}

// ── Consumer hook ─────────────────────────────────────────────────────────────

export function useAdminConfig(): AdminConfigCtx {
  const ctx = useContext(AdminConfigContext);
  if (!ctx) throw new Error("useAdminConfig must be used inside AdminConfigProvider");
  return ctx;
}

// ── Formula evaluator (shared by FormulaEditor + Analytics) ──────────────────

const MOCK_METRICS: Record<string, number> = {
  hires: 12, offers: 35, interviews: 89, avg_days_open: 23, applications: 210,
  interviews_per_week: 5,
};

export function evalFormula(f: KpiFormula, metrics: Record<string, number> = MOCK_METRICS): number {
  if (!f) return 0;
  const a = metrics[f.varA] ?? 0;
  // When varB is null, treat formula as unary (just return a * scale for +/-, or a for others)
  if (f.varB === null) return a * f.scale;
  const b = metrics[f.varB] ?? 0;
  if (f.op === "/" && b === 0) return 0;
  switch (f.op) {
    case "/": return (a / b) * f.scale;
    case "*": return  a * b  * f.scale;
    case "+": return (a + b) * f.scale;
    case "-": return (a - b) * f.scale;
    default:  return a;
  }
}
