"use client";

import React, { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, Users, Briefcase, FileText, Loader2, Sparkles } from "lucide-react";
import { searchTools, toolHref, type EffectiveAppEntry } from "@/lib/tools-registry";
import { useAppConfig } from "@/lib/use-app-config";

interface CandidateHit { id: string; name: string; email: string; phone: string; source: string }
interface JobHit { id: string; title: string; department: string; hiring_manager: string }
interface ApplicationHit { app_id: string; status: string; recruiter: string; candidate_name: string; job_title: string; days_in_process: number }

interface SearchResults {
  candidates: CandidateHit[];
  jobs: JobHit[];
  applications: ApplicationHit[];
}

const EMPTY: SearchResults = { candidates: [], jobs: [], applications: [] };
const EXPANDED_WIDTH = 320;

/**
 * Global cross-module search.
 *
 * Behaviour:
 *   - At rest: a 36px wide pill with just a Search icon. Lives inline in the
 *     header; never overlays sibling content.
 *   - On hover OR focus-within: the pill grows in place to 320px, revealing
 *     the input. Width transitions are CSS-driven, so layout doesn't jump.
 *   - Results render in an absolutely-positioned dropdown anchored to the
 *     pill's bottom-right (RTL). The dropdown DOES NOT affect layout; it
 *     simply floats over content.
 *   - Browser autocomplete / autocorrect / spell-check are intentionally
 *     enabled so users get the OS-native suggestions while typing.
 *
 * Keyboard: Cmd/Ctrl+K focuses the input; Esc clears+blurs; ↑/↓/Enter navigate.
 */
export function GlobalSearch() {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [activeIdx, setActiveIdx] = useState(0);
  const [focused, setFocused] = useState(false);
  const [hovering, setHovering] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "";

  // Debounced fetch (only when there's a real query and the input is engaged).
  useEffect(() => {
    const trimmed = query.trim();
    if (trimmed.length < 2) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      try {
        const res = await fetch(`${apiUrl}/api/search?q=${encodeURIComponent(trimmed)}&limit=8`, {
          credentials: "include",
          cache: "no-store",
        });
        if (res.ok) {
          const data = (await res.json()) as SearchResults;
          setResults(data);
        } else {
          setResults(EMPTY);
        }
      } catch {
        setResults(EMPTY);
      } finally {
        setLoading(false);
      }
    }, 250);
    return () => clearTimeout(handle);
  }, [query, apiUrl]);

  // Cmd/Ctrl + K focuses the input.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      } else if (e.key === "Escape" && document.activeElement === inputRef.current) {
        setQuery("");
        inputRef.current?.blur();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Apply admin overrides so hidden apps don't surface in search (non-admin
  // recruiters); admin overrides also affect the "new/update/coming_soon" tag
  // shown in the result row sublabel.
  const { overrides } = useAppConfig();
  const toolHits: EffectiveAppEntry[] = useMemo(() => searchTools(query, 5, overrides), [query, overrides]);

  // Build flat results list for keyboard navigation + dropdown render.
  // Order: tools → candidates → jobs → applications.
  const items = (() => {
    const arr: { kind: "tool" | "candidate" | "job" | "application"; label: string; sublabel: string; href: string }[] = [];
    toolHits.forEach(t => {
      const tagLabel =
        t.effectiveTag === "coming_soon" ? " · בקרוב" :
        t.effectiveTag === "update" ? " · עדכון" :
        t.effectiveTag === "new" ? " · חדש" : "";
      arr.push({ kind: "tool", label: t.title, sublabel: `${t.description}${tagLabel}`, href: toolHref(t) });
    });
    results.candidates.forEach(c => arr.push({
      kind: "candidate", label: c.name, sublabel: `${c.email || ""}${c.source ? ` · ${c.source}` : ""}`,
      href: `/candidates?id=${encodeURIComponent(c.id)}`,
    }));
    results.jobs.forEach(j => arr.push({
      kind: "job", label: j.title, sublabel: `${j.department || ""}${j.hiring_manager ? ` · ${j.hiring_manager}` : ""}`,
      href: `/jobs?id=${encodeURIComponent(j.id)}`,
    }));
    results.applications.forEach(a => arr.push({
      kind: "application", label: `${a.candidate_name ?? "—"} → ${a.job_title ?? "—"}`,
      sublabel: `${a.status}${a.recruiter ? ` · מגייסת: ${a.recruiter}` : ""} · ${a.days_in_process}ימ׳`,
      href: `/candidates?app=${encodeURIComponent(a.app_id)}`,
    }));
    return arr;
  })();

  // Reset highlight on results change.
  useEffect(() => { setActiveIdx(0); }, [results]);

  const handleSelect = useCallback((idx: number) => {
    const item = items[idx];
    if (!item) return;
    setQuery("");
    inputRef.current?.blur();
    router.push(item.href);
  }, [items, router]);

  const onInputKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, items.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      handleSelect(activeIdx);
    }
  };

  // Dropdown only when the user has actually typed something meaningful.
  // `items` already includes tools + API results; that's the source of truth.
  const trimmed = query.trim();
  const showResults = focused && trimmed.length >= 2 && items.length > 0;
  const showEmpty = focused && trimmed.length >= 2 && !loading && items.length === 0;

  // Pill expands when ANY of: input is focused, query has content, mouse is
  // hovering the wrapper. We track all three in React state and drive the
  // width via inline style — inline always wins over Tailwind's CSS, which
  // avoids specificity tug-of-war between `w-9` and `focus-within:w-[320px]`.
  const expanded = focused || !!query || hovering;

  return (
    <div
      ref={containerRef}
      className="search-wrapper relative h-9"
      style={{ width: EXPANDED_WIDTH }} // reserve max width so layout never shifts
      onMouseEnter={() => setHovering(true)}
      onMouseLeave={() => setHovering(false)}
    >
      <div
        data-search-pill
        // Anchored on the LEFT edge of the reserved slot so the icon sits next
        // to the bell (which is to the left of the search in RTL). Growing the
        // width extends the pill RIGHTWARD into empty header space — the bell
        // stays exactly where it is.
        className={`absolute top-0 left-0 h-9 flex items-center border border-slate-200 rounded-full overflow-hidden transition-[width,box-shadow,background-color] duration-300 ease-out ${expanded ? "bg-white shadow-md ring-2 ring-[#EF6B00]/20" : "bg-slate-50"}`}
        style={{ width: expanded ? EXPANDED_WIDTH : 36 }}
      >
        <Search
          size={16}
          strokeWidth={1.75}
          className={`shrink-0 mr-3 ms-3 transition-colors ${expanded ? "text-[#EF6B00]" : "text-slate-500"}`}
        />
        <input
          ref={inputRef}
          type="search"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={onInputKey}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            // Delay blur to let click handlers on result rows fire.
            setTimeout(() => setFocused(false), 120);
          }}
          placeholder="חיפוש מועמדים, משרות, תהליכים..."
          className="flex-1 bg-transparent outline-none text-sm font-medium text-[#002649] placeholder:text-slate-400 placeholder:font-normal min-w-0 ml-2"
          // Browser-native autocorrect / autocomplete enabled (Hebrew + English).
          autoComplete="on"
          autoCorrect="on"
          spellCheck
          inputMode="search"
          dir="rtl"
        />
        {loading && (
          <Loader2 size={14} className="animate-spin text-[#EF6B00] shrink-0 ml-3" />
        )}
        {!loading && !query && (
          <kbd className="hidden md:inline-flex text-[10px] font-bold text-slate-400 bg-white border border-slate-200 rounded px-1.5 py-0.5 whitespace-nowrap shrink-0 ml-3">
            Ctrl+K
          </kbd>
        )}
      </div>

      {/* Results dropdown — absolutely positioned so it never affects layout.
          Anchored to the pill's bottom edge in RTL. */}
      {(showResults || showEmpty) && (
        <div
          // Aligned to the LEFT edge — same anchor as the pill — so the
          // dropdown grows downward + rightward into open header space, never
          // reaching back across the bell.
          className="absolute top-[calc(100%+6px)] left-0 w-[440px] max-w-[92vw] bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden z-[10000] animate-in fade-in zoom-in-95 origin-top-left"
          dir="rtl"
        >
          <div className="max-h-96 overflow-y-auto">
            {showEmpty && (
              <div className="px-4 py-6 text-center text-xs text-slate-400 font-medium">
                לא נמצאו תוצאות עבור &quot;{trimmed}&quot;
              </div>
            )}
            {showResults && (
              <>
                {/* Tools — rendered first so they're the top hit. Each row offers
                    a deep-link into /ai-hub?cat=...&tool=..., letting the
                    recruiter open any tool without navigating menus. */}
                {toolHits.length > 0 && (
                  <SectionHeader icon={<Sparkles size={12} strokeWidth={1.75} />} label={`אפליקציות (${toolHits.length})`} />
                )}
                {toolHits.map((t, idx) => {
                  const i = idx;
                  const tagLabel =
                    t.effectiveTag === "coming_soon" ? " · בקרוב" :
                    t.effectiveTag === "update" ? " · עדכון" :
                    t.effectiveTag === "new" ? " · חדש" : "";
                  return <ResultRow key={`tool-${t.id}`} active={i === activeIdx}
                    icon={<Sparkles size={14} strokeWidth={1.75} className="text-[#EF6B00]"/>}
                    label={t.title}
                    sublabel={`${t.description}${tagLabel}`}
                    onMouseEnter={() => setActiveIdx(i)} onClick={() => handleSelect(i)} />;
                })}

                {results.candidates.length > 0 && (
                  <SectionHeader icon={<Users size={12} strokeWidth={1.75} />} label={`מועמדים (${results.candidates.length})`} />
                )}
                {results.candidates.map((c, idx) => {
                  const i = toolHits.length + idx;
                  return <ResultRow key={c.id} active={i === activeIdx} icon={<Users size={14} strokeWidth={1.75} />} label={c.name} sublabel={`${c.email || ""}${c.source ? ` · ${c.source}` : ""}`} onMouseEnter={() => setActiveIdx(i)} onClick={() => handleSelect(i)} />;
                })}

                {results.jobs.length > 0 && (
                  <SectionHeader icon={<Briefcase size={12} strokeWidth={1.75} />} label={`משרות (${results.jobs.length})`} />
                )}
                {results.jobs.map((j, idx) => {
                  const i = toolHits.length + results.candidates.length + idx;
                  return <ResultRow key={j.id} active={i === activeIdx} icon={<Briefcase size={14} strokeWidth={1.75} />} label={j.title} sublabel={`${j.department || ""}${j.hiring_manager ? ` · ${j.hiring_manager}` : ""}`} onMouseEnter={() => setActiveIdx(i)} onClick={() => handleSelect(i)} />;
                })}

                {results.applications.length > 0 && (
                  <SectionHeader icon={<FileText size={12} strokeWidth={1.75} />} label={`תהליכי גיוס (${results.applications.length})`} />
                )}
                {results.applications.map((a, idx) => {
                  const i = toolHits.length + results.candidates.length + results.jobs.length + idx;
                  return <ResultRow key={a.app_id} active={i === activeIdx} icon={<FileText size={14} strokeWidth={1.75} />} label={`${a.candidate_name ?? "—"} → ${a.job_title ?? "—"}`} sublabel={`${a.status}${a.recruiter ? ` · מגייסת: ${a.recruiter}` : ""} · ${a.days_in_process}ימ׳`} onMouseEnter={() => setActiveIdx(i)} onClick={() => handleSelect(i)} />;
                })}
              </>
            )}
          </div>

          {showResults && (
            <div className="px-4 py-2 border-t border-slate-100 bg-slate-50 text-[10px] text-slate-400 font-medium flex items-center justify-between">
              <span>↑↓ ניווט · Enter לבחירה · Esc לסגירה</span>
              <span className="font-bold">{items.length} תוצאות</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function SectionHeader({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <div className="flex items-center gap-1.5 px-4 py-1.5 bg-slate-50/70 border-b border-slate-100 text-[10px] font-black uppercase tracking-wider text-slate-500">
      {icon}
      {label}
    </div>
  );
}

function ResultRow({ active, icon, label, sublabel, onMouseEnter, onClick }: { active: boolean; icon: React.ReactNode; label: string; sublabel: string; onMouseEnter: () => void; onClick: () => void }) {
  return (
    <button
      type="button"
      onMouseEnter={onMouseEnter}
      onMouseDown={(e) => e.preventDefault()} // keep input focus so onBlur doesn't fire before click
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-2.5 text-right transition-colors border-b border-slate-50 last:border-b-0 ${active ? "bg-orange-50/80" : "hover:bg-slate-50"}`}
    >
      <span className={`shrink-0 ${active ? "text-[#EF6B00]" : "text-slate-400"}`}>{icon}</span>
      <span className="flex-1 min-w-0">
        <span className="block text-sm font-bold text-[#002649] truncate">{label}</span>
        <span className="block text-[11px] text-slate-500 truncate">{sublabel}</span>
      </span>
    </button>
  );
}
