/*
  Turns a benchmark report from the backend into what the lab shows: one view
  per model, a verdict, and the evidence behind it. Pure functions only, and
  nothing is invented: every number traces back to a field in the report.
  Money arrives in US dollars and leaves in rupees.
*/
import type { Benchmark, BenchmarkReport, ModelMetrics, Project, TargetCategory, TestCase } from '../services/api.ts'
import { formatMs, formatPercent, formatUnitRupees, usdToInr } from './format.ts'

/** Projects with the most recent activity (creation or a benchmark) first. Used by the overview and the sidebar. */
export function sortProjectsByActivity(projects: Project[], benchmarks: Benchmark[]): Project[] {
  const latest = (p: Project) =>
    [p.created_at, ...benchmarks.filter((b) => b.project_id === p.id).map((b) => b.created_at)].sort().at(-1) ?? ''
  return [...projects].sort((a, b) => latest(b).localeCompare(latest(a)))
}

/** Test cases oldest first, so their numbers match everywhere they appear. */
export function orderTestCases(testCases: TestCase[]): TestCase[] {
  return [...testCases].sort((a, b) => a.created_at.localeCompare(b.created_at))
}

/* Eligibility thresholds. Mirrors backend/app/services/roi_service.py so the page can explain them. */
export const MIN_QUALITY = 6
export const RELATIVE_QUALITY = 0.85
export const MIN_SUCCESS_RATE = 0.9

export type Role = 'recommended' | 'baseline' | 'other'

export const ROLE_LABEL: Record<Role, string> = {
  recommended: 'Recommended',
  baseline: 'Used today',
  other: 'Other models',
}

export interface ModelView {
  name: string
  provider: string
  /** Drawing role. A model that is both recommended and used today is 'recommended' with isBaseline set. */
  role: Role
  isRecommended: boolean
  isBaseline: boolean
  isFallback: boolean
  calls: number
  successes: number
  failures: number
  /** 0–1 */
  successRate: number
  retryRate: number
  /** Average judge score, 0–10. Null when nothing was scored. */
  quality: number | null
  qualityMin: number | null
  qualityMax: number | null
  judged: number
  /** Milliseconds. Null when no call succeeded. */
  latencyP50: number | null
  latencyP95: number | null
  /** Rupees. Null when no call succeeded. */
  costPerSuccess: number | null
  totalCost: number
  avgInputTokens: number
  avgOutputTokens: number
  eligible: boolean
  ineligibleReason: string | null
}

export function buildModelViews(report: BenchmarkReport): ModelView[] {
  const rec = report.roi_recommendation
  const picked = rec?.category === 'no_eligible_model' ? null : (rec?.recommended_primary_model ?? null)
  const names = report.selected_models.length ? report.selected_models : Object.keys(report.model_metrics)

  return names.map((name) => {
    const m: ModelMetrics | undefined = report.model_metrics[name]
    const isRecommended = name === picked
    const isBaseline = name === report.baseline_model
    const successes = m?.reliability.successful_evaluations ?? 0
    const answered = successes > 0
    return {
      name,
      provider: m?.provider_name ?? '',
      role: isRecommended ? 'recommended' : isBaseline ? 'baseline' : 'other',
      isRecommended,
      isBaseline,
      isFallback: name === rec?.recommended_fallback_model,
      calls: m?.reliability.total_evaluations ?? 0,
      successes,
      failures: m?.reliability.failed_evaluations ?? 0,
      successRate: m?.reliability.success_rate ?? 0,
      retryRate: m?.reliability.retry_rate ?? 0,
      quality: m?.quality.average_judge_score ?? null,
      qualityMin: m?.quality.minimum_judge_score ?? null,
      qualityMax: m?.quality.maximum_judge_score ?? null,
      judged: m?.quality.sample_count ?? 0,
      latencyP50: answered && m ? m.performance.p50_latency : null,
      latencyP95: answered && m ? m.performance.p95_latency : null,
      costPerSuccess: answered && m ? usdToInr(m.financial.cost_per_successful_evaluation) : null,
      totalCost: m ? usdToInr(m.financial.total_execution_cost) : 0,
      avgInputTokens: m?.token_usage.average_input_tokens ?? 0,
      avgOutputTokens: m?.token_usage.average_output_tokens ?? 0,
      eligible: rec?.eligible_models.includes(name) ?? false,
      ineligibleReason: rec?.ineligible_reasons[name] ?? null,
    }
  })
}

/* ---------- comparing two models ---------- */

export type MetricKey = 'quality' | 'cost' | 'speed' | 'reliability'

export interface Finding {
  metric: MetricKey
  /** 'gain': the pick is better. 'loss': the pick is worse. 'same': no meaningful difference. */
  direction: 'gain' | 'loss' | 'same'
  text: string
}

/** "12× cheaper" for big gaps, "35% cheaper" for small ones. */
function relative(ratio: number, more: string, less: string): string {
  if (ratio >= 2) return `${Number(ratio.toFixed(ratio >= 10 ? 0 : 1))}× ${more}`
  if (ratio <= 0.5) return `${Number((1 / ratio).toFixed(1 / ratio >= 10 ? 0 : 1))}× ${less}`
  const pct = Math.round(Math.abs(1 - ratio) * 100)
  return `${pct}% ${ratio > 1 ? more : less}`
}

/** How `pick` compares with `ref` on each measured metric. Skips anything either model lacks. */
export function compare(pick: ModelView, ref: ModelView): Finding[] {
  const findings: Finding[] = []

  if (pick.quality !== null && ref.quality !== null) {
    const d = pick.quality - ref.quality
    const values = `${pick.quality.toFixed(1)} vs ${ref.quality.toFixed(1)} out of 10`
    if (Math.abs(d) < 0.3) findings.push({ metric: 'quality', direction: 'same', text: `About the same quality (${values})` })
    else if (d > 0) findings.push({ metric: 'quality', direction: 'gain', text: `Higher quality (${values})` })
    else
      findings.push({
        metric: 'quality',
        direction: 'loss',
        text: `${Math.abs(d) < 1 ? 'Slightly lower' : 'Lower'} quality (${values})`,
      })
  }

  if (pick.costPerSuccess !== null && ref.costPerSuccess !== null && pick.costPerSuccess > 0 && ref.costPerSuccess > 0) {
    const ratio = ref.costPerSuccess / pick.costPerSuccess
    const values = `${formatUnitRupees(pick.costPerSuccess)} vs ${formatUnitRupees(ref.costPerSuccess)} per answer`
    if (Math.abs(ratio - 1) < 0.1) findings.push({ metric: 'cost', direction: 'same', text: `About the same cost (${values})` })
    else
      findings.push({
        metric: 'cost',
        direction: ratio > 1 ? 'gain' : 'loss',
        text: `${capitalise(relative(ratio, 'cheaper', 'more expensive'))} (${values})`,
      })
  }

  if (pick.latencyP50 !== null && ref.latencyP50 !== null && pick.latencyP50 > 0 && ref.latencyP50 > 0) {
    const ratio = ref.latencyP50 / pick.latencyP50
    const values = `${formatMs(pick.latencyP50)} vs ${formatMs(ref.latencyP50)} typical response`
    if (Math.abs(ratio - 1) < 0.1) findings.push({ metric: 'speed', direction: 'same', text: `About the same speed (${values})` })
    else
      findings.push({
        metric: 'speed',
        direction: ratio > 1 ? 'gain' : 'loss',
        text: `${capitalise(relative(ratio, 'faster', 'slower'))} (${values})`,
      })
  }

  if (pick.calls > 0 && ref.calls > 0) {
    const d = pick.successRate - ref.successRate
    const values = `${formatPercent(pick.successRate)} vs ${formatPercent(ref.successRate)} of calls answered`
    if (Math.abs(d) < 0.01) findings.push({ metric: 'reliability', direction: 'same', text: `Same reliability (${values})` })
    else
      findings.push({
        metric: 'reliability',
        direction: d > 0 ? 'gain' : 'loss',
        text: `${d > 0 ? 'More' : 'Less'} reliable (${values})`,
      })
  }

  return findings
}

const capitalise = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/* ---------- the verdict ---------- */

export const TARGETS: { value: TargetCategory; label: string; because: string }[] = [
  {
    value: 'best_value',
    label: 'Best value',
    because: 'It gives the most quality per rupee among the models that passed the quality and reliability bar.',
  },
  {
    value: 'best_quality',
    label: 'Best quality',
    because: 'It scored highest on quality among the models that passed the quality and reliability bar.',
  },
  {
    value: 'lowest_cost',
    label: 'Lowest cost',
    because: 'It has the lowest cost per successful answer among the models that passed the quality and reliability bar.',
  },
  {
    value: 'fastest',
    label: 'Fastest',
    because: 'It answers fastest among the models that passed the quality and reliability bar.',
  },
]

export type VerdictKind = 'switch' | 'stay' | 'best' | 'inconclusive'

export interface Verdict {
  kind: VerdictKind
  /** The big word: Switch, Stay, Best fit, Not enough evidence. */
  word: string
  /** One plain sentence: what to do. */
  headline: string
  /** Why this model, given the target. */
  because: string
  pick: ModelView | null
  /** What the pick is compared against: the model used today, or the runner-up. */
  reference: ModelView | null
  referenceLabel: 'used today' | 'runner-up' | null
  findings: Finding[]
  monthly: {
    volume: number
    pick: number
    reference: number
    savings: number
    savingsPct: number
    /** Who the backend priced the comparison against. */
    against: 'baseline' | 'most expensive'
  } | null
  cautions: string[]
  /** Models that were ruled out, and why (from the backend). */
  ruledOut: { name: string; reason: string }[]
}

export function deriveVerdict(report: BenchmarkReport, models: ModelView[], target: TargetCategory): Verdict {
  const rec = report.roi_recommendation
  const ruledOut = Object.entries(rec?.ineligible_reasons ?? {}).map(([name, reason]) => ({ name, reason }))
  const baseline = models.find((m) => m.isBaseline) ?? null
  const pick = models.find((m) => m.isRecommended) ?? null
  const cautions: string[] = []

  if (report.is_mock) {
    cautions.push(
      'This was a simulated run. Scores, speeds and costs are placeholders, not measurements. Run it live before acting on it.',
    )
  }

  if (!rec || rec.category === 'no_eligible_model' || !pick) {
    return {
      kind: 'inconclusive',
      word: 'Not enough evidence',
      headline: 'No model cleared the bar, so there is nothing to recommend yet.',
      because: `To be recommended, a model needs a quality score of at least ${MIN_QUALITY}/10, within ${Math.round(
        RELATIVE_QUALITY * 100,
      )}% of the best score, and at least ${Math.round(MIN_SUCCESS_RATE * 100)}% of its calls answered.`,
      pick: null,
      reference: baseline,
      referenceLabel: baseline ? 'used today' : null,
      findings: [],
      monthly: null,
      cautions,
      ruledOut,
    }
  }

  const fallback = models.find((m) => m.isFallback) ?? null
  const reference = baseline && baseline !== pick ? baseline : fallback
  const referenceLabel = reference ? (reference === baseline ? 'used today' : 'runner-up') : null
  const because = TARGETS.find((t) => t.value === target)?.because ?? ''

  let kind: VerdictKind
  let word: string
  let headline: string
  if (baseline && pick === baseline) {
    kind = 'stay'
    word = 'Stay'
    headline = `Keep ${pick.name}. The model you use today is still the best fit.`
  } else if (baseline) {
    kind = 'switch'
    word = 'Switch'
    headline = `Switch from ${baseline.name} to ${pick.name}.`
  } else {
    kind = 'best'
    word = 'Best fit'
    headline = `${pick.name} is the best fit of the ${models.length} models tested.`
  }

  if (pick.judged > 0 && pick.judged < 5) {
    cautions.push(
      `Quality for ${pick.name} rests on only ${pick.judged} scored ${pick.judged === 1 ? 'answer' : 'answers'}. Add test cases or runs per test case for a steadier result.`,
    )
  }
  if (pick.quality === null) {
    cautions.push('Answers were not scored (the judge was off), so this pick does not account for answer quality.')
  }
  if (pick.failures > 0) {
    cautions.push(`${pick.name} failed ${pick.failures} of ${pick.calls} calls in this run.`)
  }

  return {
    kind,
    word,
    headline,
    because,
    pick,
    reference,
    referenceLabel,
    findings: reference ? compare(pick, reference) : [],
    monthly: {
      volume: rec.monthly_volume,
      pick: usdToInr(rec.estimated_monthly_cost_usd),
      reference: usdToInr(rec.estimated_premium_cost_usd),
      savings: usdToInr(rec.estimated_savings_usd),
      savingsPct: rec.savings_percentage,
      against: baseline && report.model_metrics[baseline.name] ? 'baseline' : 'most expensive',
    },
    cautions,
    ruledOut,
  }
}

/* ---------- one-line takeaways for charts ---------- */

function extremes<T>(items: T[], value: (item: T) => number | null) {
  const measured = items.filter((i) => value(i) !== null) as T[]
  if (measured.length === 0) return null
  const sorted = [...measured].sort((a, b) => (value(a) as number) - (value(b) as number))
  return { low: sorted[0], high: sorted[sorted.length - 1], count: measured.length }
}

export function qualityTakeaway(models: ModelView[]): string {
  const e = extremes(models, (m) => m.quality)
  if (!e) return 'No answers were scored, so quality was not measured.'
  if (e.count === 1) return `Only ${e.high.name} was scored: ${e.high.quality?.toFixed(1)}/10.`
  if ((e.high.quality as number) - (e.low.quality as number) < 0.3) {
    return `All models scored about the same (${e.high.quality?.toFixed(1)}/10), so quality does not separate them here.`
  }
  return `${e.high.name} scored highest at ${e.high.quality?.toFixed(1)}/10; ${e.low.name} scored lowest at ${e.low.quality?.toFixed(1)}.`
}

export function costTakeaway(models: ModelView[]): string {
  const e = extremes(models, (m) => m.costPerSuccess)
  if (!e) return 'No call succeeded, so cost per answer was not measured.'
  if (e.count === 1) return `Only ${e.low.name} answered: ${formatUnitRupees(e.low.costPerSuccess as number)} per answer.`
  const low = e.low.costPerSuccess as number
  const high = e.high.costPerSuccess as number
  if (low <= 0) return `${e.low.name} cost almost nothing per answer in this run.`
  const ratio = high / low
  if (ratio < 1.1) return `All models cost about the same per answer (${formatUnitRupees(low)}).`
  return `${e.low.name} is cheapest at ${formatUnitRupees(low)} per answer; ${e.high.name} costs ${relative(
    ratio,
    'more',
    'less',
  )}.`
}

export function speedTakeaway(models: ModelView[]): string {
  const e = extremes(models, (m) => m.latencyP50)
  if (!e) return 'No call succeeded, so speed was not measured.'
  if (e.count === 1) return `Only ${e.low.name} answered, typically in ${formatMs(e.low.latencyP50 as number)}.`
  const low = e.low.latencyP50 as number
  const high = e.high.latencyP50 as number
  if (low <= 0 || high / low < 1.1) return `All models answered at about the same speed (${formatMs(low)} typical).`
  return `${e.low.name} is fastest, typically ${formatMs(low)}; ${e.high.name} takes ${formatMs(high)}.`
}

/** Total spend per model in the run (rupees). */
export function spendTakeaway(models: ModelView[]): string {
  const withCalls = models.filter((m) => m.calls > 0)
  if (withCalls.length === 0) return 'No calls were made, so nothing was spent.'
  const total = withCalls.reduce((sum, m) => sum + m.totalCost, 0)
  if (total <= 0) return 'This run cost nothing measurable.'
  const top = [...withCalls].sort((a, b) => b.totalCost - a.totalCost)[0]
  const share = Math.round((top.totalCost / total) * 100)
  return withCalls.length === 1
    ? `${top.name} cost ${formatUnitRupees(top.totalCost)} for the whole run.`
    : `The run cost ${formatUnitRupees(total)} in model calls. ${top.name} accounts for ${share}% of it (${formatUnitRupees(top.totalCost)}).`
}

/** How often calls needed a retry. retryRate is the share of calls that took more than one attempt. */
export function retryTakeaway(models: ModelView[]): string {
  const withCalls = models.filter((m) => m.calls > 0)
  if (withCalls.length === 0) return 'No calls were made.'
  const retried = withCalls.filter((m) => m.retryRate > 0)
  if (retried.length === 0) return 'Every call answered or failed on its first attempt; no model needed a retry.'
  const worst = [...retried].sort((a, b) => b.retryRate - a.retryRate)[0]
  return retried.length === 1
    ? `Only ${worst.name} needed retries: ${formatPercent(worst.retryRate)} of its calls.`
    : `${retried.length} models needed retries. ${worst.name} retried most often: ${formatPercent(worst.retryRate)} of its calls.`
}

/**
 * The best model on one measure, for compact summaries. Returns "All models"
 * when every measured model ties, and null when nothing was measured.
 */
export function leaderOf(
  models: ModelView[],
  value: (m: ModelView) => number | null,
  better: 'higher' | 'lower',
): { name: string; value: number } | null {
  const measured = models
    .map((m) => ({ m, v: value(m) }))
    .filter((x): x is { m: ModelView; v: number } => x.v !== null)
  if (measured.length === 0) return null
  measured.sort((a, b) => (better === 'higher' ? b.v - a.v : a.v - b.v))
  const best = measured[0]
  const tied = measured.length > 1 && measured.every((x) => Math.abs(x.v - best.v) < 1e-9)
  return { name: tied ? 'All models' : best.m.name, value: best.v }
}

export function reliabilityTakeaway(models: ModelView[]): string {
  const withCalls = models.filter((m) => m.calls > 0)
  if (withCalls.length === 0) return 'No calls were made.'
  const failing = withCalls.filter((m) => m.failures > 0)
  if (failing.length === 0) return 'Every model answered every call.'
  return failing
    .map((m) => `${m.name} failed ${m.failures} of ${m.calls} ${m.calls === 1 ? 'call' : 'calls'}`)
    .join('; ')
    .concat('.')
}
