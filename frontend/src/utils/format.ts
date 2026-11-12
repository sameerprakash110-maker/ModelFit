/* Money is in Indian rupees and numbers use Indian digit grouping (5,00,000). */

const LOCALE = 'en-IN'

const rupeeFormatters = new Map<number, Intl.NumberFormat>()

function rupees(value: number, fractionDigits: number): string {
  let formatter = rupeeFormatters.get(fractionDigits)
  if (!formatter) {
    formatter = new Intl.NumberFormat(LOCALE, {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: fractionDigits,
      maximumFractionDigits: fractionDigits,
    })
    rupeeFormatters.set(fractionDigits, formatter)
  }
  return formatter.format(value)
}

/** Whole rupees, for monthly totals: ₹5,15,450. */
export const formatRupees = (value: number) => rupees(value, 0)

/** Small per-unit amounts, with more decimals the smaller the amount: ₹1.03, ₹0.50, ₹0.043. */
export function formatUnitRupees(value: number): string {
  const size = Math.abs(value)
  if (size >= 1000) return rupees(value, 0)
  if (size >= 100) return rupees(value, Math.abs(value - Math.round(value)) < 0.005 ? 0 : 2)
  if (size >= 0.1) return rupees(value, 2)
  if (size >= 0.01) return rupees(value, 3)
  return rupees(value, 4)
}

/** A rupee difference with an explicit sign: +₹52,325 or −₹52,325. */
export function formatSignedRupees(value: number): string {
  const rounded = Math.round(value)
  if (rounded === 0) return rupees(0, 0)
  return `${rounded > 0 ? '+' : '−'}${rupees(Math.abs(rounded), 0)}`
}

const countFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })
const decimalFormatter = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 4 })

export const formatCount = (value: number) => countFormatter.format(value)

export const wordCount = (text: string) => text.trim().split(/\s+/).filter(Boolean).length

export function formatSignedCount(value: number): string {
  const rounded = Math.round(value)
  if (rounded === 0) return '0'
  return `${rounded > 0 ? '+' : '−'}${countFormatter.format(Math.abs(rounded))}`
}

/** A fraction as a percentage: 0.078 becomes 7.8%. */
export function formatPercent(fraction: number, maxDigits = 1): string {
  return `${Number((fraction * 100).toFixed(maxDigits))}%`
}

export function formatSignedPercent(fraction: number, maxDigits = 1): string {
  const value = Number((fraction * 100).toFixed(maxDigits))
  if (value === 0) return '0%'
  return `${value > 0 ? '+' : '−'}${Math.abs(value)}%`
}

/** Reads what someone typed into a number field. Commas and spaces are ignored. */
export function parseNumber(text: string): number | null {
  const cleaned = text.replace(/[,\s]/g, '')
  if (cleaned === '') return null
  const value = Number(cleaned)
  return Number.isFinite(value) ? value : null
}

/** Regroups a typed number for display once the field loses focus. Leaves invalid text alone. */
export function regroup(text: string): string {
  const value = parseNumber(text)
  return value === null ? text : decimalFormatter.format(value)
}

/*
  The backend prices models in US dollars (providers publish USD rates).
  Shown in rupees at this rate. Override with VITE_USD_TO_INR in frontend/.env.
*/
export const USD_TO_INR: number = (() => {
  const fromEnv = Number(import.meta.env.VITE_USD_TO_INR)
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 88
})()

export const usdToInr = (usd: number) => usd * USD_TO_INR

/** Milliseconds, switching to seconds once it reads better: 342 ms, 1.4 s. */
export function formatMs(ms: number): string {
  // Only simulated runs come in under a millisecond; keep two decimals so they stay distinguishable.
  if (ms > 0 && ms < 1) return `${Number(ms.toFixed(2))} ms`
  if (ms >= 1000) return `${Number((ms / 1000).toFixed(ms >= 10_000 ? 0 : 1))} s`
  return `${Math.round(ms)} ms`
}

const dateFormatter = new Intl.DateTimeFormat(LOCALE, { day: 'numeric', month: 'short', year: 'numeric' })
const dateTimeFormatter = new Intl.DateTimeFormat(LOCALE, {
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
})

/* The backend sends naive UTC timestamps (no zone suffix); read them as UTC. */
function parseServerDate(value: string): Date {
  return new Date(/[zZ]|[+-]\d\d:\d\d$/.test(value) ? value : `${value}Z`)
}

export const formatDate = (value: string) => dateFormatter.format(parseServerDate(value))
export const formatDateTime = (value: string) => dateTimeFormatter.format(parseServerDate(value))
