"use client";

import React, { useState, useEffect } from "react";
import { APP_THEMES, AppThemeId } from "@/lib/constants";
import { ActionButton } from "@/components/EnterpriseUI";

export type WorkspaceParadigm = "studio" | "terminal" | "spatial" | "classic";

export const WORKSPACE_PARADIGMS: { id: WorkspaceParadigm; name: string }[] = [
  { id: "studio", name: "Studio Split OS" },
  { id: "terminal", name: "Quant Terminal" },
  { id: "spatial", name: "Spatial Glass Dock" },
  { id: "classic", name: "Classic Executive" },
];

export function useWorkspaceParadigm(defaultMode: WorkspaceParadigm = "studio") {
  const [paradigm, setParadigm] = useState<WorkspaceParadigm>(defaultMode);
  useEffect(() => {
    const saved = localStorage.getItem("profound_ui_paradigm_v3") as WorkspaceParadigm;
    if (saved && WORKSPACE_PARADIGMS.some((p) => p.id === saved)) setParadigm(saved);
  }, []);
  const changeParadigm = (next: WorkspaceParadigm) => {
    setParadigm(next);
    localStorage.setItem("profound_ui_paradigm_v3", next);
  };
  return { paradigm, changeParadigm };
}

export function ProfoundWorkspaceShell({
  portalTitle, roleLabel, userName, navItems = [], activeNav, onSelectNav,
  telemetry = [], paradigm, onParadigmChange, themeId, onThemeChange,
  isAdmin = false, onlineCount = 1, statusMsg = "", headerActions, onSignOut, children,
}: any) {
  const currentTheme = (APP_THEMES && APP_THEMES.find((t: any) => t.id === themeId)) || {
    shellBg: "bg-black text-zinc-100", badge: "bg-emerald-500/20 text-emerald-300 border-emerald-500/40", accentBg: "bg-emerald-500 text-black",
  };

  return (
    <div className={`min-h-screen flex flex-col ${paradigm === "studio" || paradigm === "terminal" ? "md:flex-row" : ""} ${currentTheme.shellBg} font-sans`}>
      {(paradigm === "studio" || paradigm === "terminal") && (
        <aside className="hidden md:flex flex-col justify-between w-64 border-r border-zinc-800 bg-zinc-950 p-4 shrink-0">
          <div className="space-y-5">
            <div className="border-b border-zinc-800 pb-4">
              <span className={`text-[9px] uppercase px-2 py-0.5 rounded border font-bold ${currentTheme.badge}`}>{roleLabel}</span>
              <h1 className="text-base font-bold text-white mt-1.5 truncate">{portalTitle}</h1>
            </div>
            <nav className="space-y-1.5">
              {navItems.map((item: any) => (
                <button key={item.id} type="button" onClick={() => onSelectNav(item.id)} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold cursor-pointer ${activeNav === item.id ? currentTheme.accentBg : "text-zinc-400 hover:text-white hover:bg-zinc-900"}`}>
                  <span>{item.code}. {item.label}</span>
                  {item.count !== undefined && <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-black/30">{item.count}</span>}
                </button>
              ))}
            </nav>
          </div>
          <ActionButton onClick={onSignOut} loadingText="..." className="w-full py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-red-300 text-xs font-bold">Sign Out</ActionButton>
        </aside>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-zinc-800 bg-zinc-950/90 px-4 sm:px-6 py-3.5 flex flex-wrap items-center justify-between gap-3 sticky top-0 z-30">
          <div className="flex flex-wrap items-center gap-2">
            {telemetry.map((t: any, idx: number) => (
              <div key={idx} className="px-3 py-1.5 rounded-xl bg-black border border-zinc-800 font-mono">
                <span className="text-[9px] uppercase text-zinc-500 block">{t.label}</span>
                <span className="text-sm font-bold text-white">{t.value}</span>
              </div>
            ))}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <select value={paradigm} onChange={(e) => onParadigmChange(e.target.value as WorkspaceParadigm)} className="rounded-xl bg-zinc-900 border border-zinc-700 px-3 py-2 text-xs text-emerald-300 font-bold">
              {WORKSPACE_PARADIGMS.map((p) => <option key={p.id} value={p.id}>UI: {p.name}</option>)}
            </select>
            {APP_THEMES && (
              <select value={themeId} onChange={(e) => onThemeChange(e.target.value as AppThemeId)} className="rounded-xl bg-zinc-900 border border-zinc-800 px-2.5 py-2 text-xs text-zinc-200 font-bold">
                {APP_THEMES.map((t: any) => <option key={t.id} value={t.id}>{t.name}</option>)}
              </select>
            )}
            {headerActions}
          </div>
        </header>

        {(paradigm === "classic" || paradigm === "spatial") && (
          <div className="px-4 sm:px-6 pt-3 flex flex-wrap gap-1.5">
            {navItems.map((item: any) => (
              <button key={item.id} type="button" onClick={() => onSelectNav(item.id)} className={`px-3.5 py-2 rounded-xl text-xs font-bold cursor-pointer ${activeNav === item.id ? currentTheme.accentBg : "bg-zinc-900 text-zinc-400 hover:text-white"}`}>
                {item.label} {item.count !== undefined ? `(${item.count})` : ""}
              </button>
            ))}
          </div>
        )}

        {statusMsg && <div className="mx-4 sm:mx-6 mt-4 p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/40 text-emerald-300 text-xs font-bold text-center">{statusMsg}</div>}
        <main className="flex-1 p-4 sm:p-6 overflow-y-auto pb-24">{children}</main>
        {isAdmin && (
          <footer className="px-6 py-2 border-t border-zinc-800 bg-zinc-950 text-[11px] font-mono text-emerald-400">
            MASTER ADMIN ONLINE PRESENCE: {onlineCount} ACTIVE
          </footer>
        )}
      </div>
    </div>
  );
}
