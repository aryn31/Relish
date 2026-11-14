"use client";
import { createContext, useContext } from "react";
import { translate as tl } from "@/lib/hi";
const Ctx = createContext<string>("en");
export function I18nProvider({ lang, children }: { lang: string; children: React.ReactNode }) { return <Ctx.Provider value={lang}>{children}</Ctx.Provider>; }
/** Client-side English-as-key translator. */
export function useT() { const lang = useContext(Ctx); return (s: string, vars?: Record<string, string | number>) => tl(lang, s, vars); }
