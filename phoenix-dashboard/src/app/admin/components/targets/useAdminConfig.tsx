"use client";
import React, {
  createContext, useContext, useEffect, useState, useCallback,
} from "react";
import { getAdminHeaders, getApiBaseUrl } from "@/lib/api";

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
  formulas: [],
  rules: [],
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
  loadError: string | null;
  lastSaved: string | null;
}

const AdminConfigContext = createContext<AdminConfigCtx | null>(null);

// ── Provider ─────────────────────────────────────────────────────────────────

export function AdminConfigProvider({ children }: { children: React.ReactNode }) {
  const [config,    setConfig]    = useState<AdminConfig>(HARDCODED_DEFAULTS);
  const [isLoading, setIsLoading] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [lastSaved, setLastSaved] = useState<string | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/admin/config`, { headers: getAdminHeaders() });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as AdminConfig;
      setConfig({ ...HARDCODED_DEFAULTS, ...data });
      setIsOffline(false);
      setLoadError(null);
    } catch {
      console.warn("[AdminConfig] Backend unavailable");
      setIsOffline(true);
      setConfig(HARDCODED_DEFAULTS);
      setLoadError("טעינת הגדרות אדמין מהשרת נכשלה.");
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = useCallback(
    async (patch: Partial<AdminConfig>, section: "formulas" | "rules" | "visibility") => {
      const next = { ...config, ...patch };
      setConfig(next); // optimistic update
      const res = await fetch(
        `${getApiBaseUrl()}/api/admin/config?section=${section}`,
        { method: "POST", headers: getAdminHeaders(), body: JSON.stringify(next) }
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json() as { status: string; timestamp: string };
      setLastSaved(data.timestamp ?? new Date().toISOString());
    },
    [config]
  );

  return (
    <AdminConfigContext.Provider value={{ config, save, isLoading, isOffline, loadError, lastSaved }}>
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

export function evalFormula(f: KpiFormula, metrics: Record<string, number>): number {
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
