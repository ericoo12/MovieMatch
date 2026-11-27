// Rena hjälpfunktioner för filmvalet. Inga Deno- eller nätverksberoenden,
// så de kan testas med Vitest (se selection.test.ts).

/** Sant om texten bara innehåller latinska bokstäver, siffror, skiljetecken och symboler. */
export function isLatinText(text: string): boolean {
  return /^[\p{Script=Latin}\p{N}\p{P}\p{S}\p{Zs}\p{M}]*$/u.test(text)
}

type TitleSources = {
  title: string
  original_title: string
  /** Översättningar från TMDB:s translations-svar, t.ex. { iso_639_1: 'en', data: { title: '…' } }. */
  translations?: { iso_639_1: string; data: { title?: string; overview?: string } }[]
}

/**
 * Väljer en läsbar titel. TMDB faller tillbaka på originaltiteln när svensk översättning saknas,
 * vilket ger t.ex. japanska eller koreanska tecken. Ordning: svensk, engelsk, original, vad som helst.
 */
export function readableTitle(m: TitleSources): string {
  const sv = m.translations?.find((t) => t.iso_639_1 === 'sv')?.data.title
  const en = m.translations?.find((t) => t.iso_639_1 === 'en')?.data.title
  const options = [m.title, sv, en, m.original_title].filter((t): t is string => Boolean(t && t.trim()))
  return options.find(isLatinText) ?? options[0] ?? 'Okänd titel'
}

/** Vikt för slumpningen: filmer i en filmserie (t.ex. Harry Potter) kommer upp mer sällan. */
export const FRANCHISE_WEIGHT = 0.35

export function movieWeight(m: { inCollection: boolean }): number {
  return m.inCollection ? FRANCHISE_WEIGHT : 1
}

/**
 * Viktat urval utan återläggning (Efraimidis–Spirakis): varje film får nyckeln random^(1/vikt),
 * och de n högsta nycklarna väljs. En film med vikt 0.35 väljs alltså mer sällan, men aldrig aldrig.
 */
export function weightedSample<T>(items: T[], n: number, weight: (item: T) => number, random = Math.random): T[] {
  return items
    .map((item) => ({ item, key: Math.pow(random(), 1 / Math.max(weight(item), 1e-6)) }))
    .sort((a, b) => b.key - a.key)
    .slice(0, n)
    .map((x) => x.item)
}

export function shuffle<T>(items: T[], random = Math.random): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Handlingen på svenska, annars engelska. null om ingen finns. */
export function readableOverview(m: {
  overview?: string | null
  translations?: { iso_639_1: string; data: { overview?: string } }[]
}): string | null {
  const en = m.translations?.find((t) => t.iso_639_1 === 'en')?.data.overview
  const options = [m.overview, en].map((t) => t?.trim()).filter((t): t is string => Boolean(t))
  return options[0] ?? null
}
