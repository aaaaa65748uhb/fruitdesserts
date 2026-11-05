import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { dictionaries, type Strings } from './strings'

export type Lang = 'en' | 'he'

/** Hebrew browsers get Hebrew; everyone else English. The toggle overrides it. */
function detect(): Lang {
  try {
    const langs = typeof navigator !== 'undefined' ? navigator.languages ?? [navigator.language] : []
    if (langs.some((l) => /^(he|iw)\b/i.test(l))) return 'he'
  } catch {
    /* ignore */
  }
  return 'en'
}

interface LangState {
  lang: Lang
  setLang: (l: Lang) => void
}

export const useLang = create<LangState>()(
  persist((set) => ({ lang: detect(), setLang: (lang) => set({ lang }) }), {
    name: 'rolllab-lang-v1',
    storage: createJSONStorage(() => localStorage),
  }),
)

/** Current dictionary (React). */
export function useT(): Strings {
  const lang = useLang((s) => s.lang)
  return dictionaries[lang]
}

/** Current dictionary (outside React). */
export function tr(): Strings {
  return dictionaries[useLang.getState().lang]
}

export function currentLang(): Lang {
  return useLang.getState().lang
}

/* ---------------- catalog names ---------------- */

export interface Localizable {
  name: string
  description?: string
  he?: { name: string; description?: string; short?: string }
  short?: string
}

export function nameOf(item: Localizable | undefined | null, lang: Lang = currentLang()) {
  if (!item) return ''
  return lang === 'he' && item.he ? item.he.name : item.name
}

export function descOf(item: Localizable | undefined | null, lang: Lang = currentLang()) {
  if (!item) return ''
  return lang === 'he' && item.he?.description ? item.he.description : item.description ?? ''
}

/** Short name for the small printed cards on the counter. */
export function shortOf(item: Localizable | undefined | null, lang: Lang = currentLang()) {
  if (!item) return ''
  if (lang === 'he' && item.he) return item.he.short ?? item.he.name
  return item.short ?? item.name
}
