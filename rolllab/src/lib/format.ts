import { catalog } from '../config/catalog'

const fmt = new Intl.NumberFormat(catalog.currency.locale, {
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
})

/** Formats an amount using the catalog currency, e.g. "₪23". */
export function money(amount: number) {
  const sign = amount < 0 ? '−' : ''
  return `${sign}${catalog.currency.symbol}${fmt.format(Math.abs(amount))}`
}

export function plural(n: number, one: string, many: string) {
  return `${n} ${n === 1 ? one : many}`
}
