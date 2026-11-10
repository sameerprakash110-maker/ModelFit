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

/** Small per-unit amounts, with more decimals the smaller the amount: ₹1.03, ₹0.433. */
export function formatUnitRupees(value: number): string {
  const size = Math.abs(value)
  if (size >= 1000) return rupees(value, 0)
  if (size >= 1) return rupees(value, 2)
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
