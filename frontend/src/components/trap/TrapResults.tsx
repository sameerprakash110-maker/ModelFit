import { Equal, TrendingDown, TrendingUp, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import {
  formatCount,
  formatPercent,
  formatRupees,
  formatSignedCount,
  formatSignedPercent,
  formatSignedRupees,
  formatUnitRupees,
} from '../../utils/format.ts'
import type { BreakEven, Comparison, Estimate, ModelInput, Scenario } from '../../utils/trapMath.ts'
import { HangTag } from '../landing/HangTag.tsx'

export const CURRENT_NAME = 'The model you use now'
export const CANDIDATE_NAME = "The model you're considering"

interface TrapResultsProps {
  scenario: Scenario | null
  candidate: ModelInput | null
  currentStickerPer1k: number | null
  candidateStickerPer1k: number | null
  currentEstimate: Estimate | null
  candidateEstimate: Estimate | null
  comparison: Comparison | null
  breakEven: BreakEven | null
}

type Tone = 'bad' | 'good' | 'warn' | 'neutral'

interface Signal {
  tone: Tone
  icon: ReactNode
  headline: string
  detail: string
}

/* Whole tasks, rounded so that successful and failed always add up to the tasks submitted. */
function wholeTasks(estimate: Estimate, scenario: Scenario) {
  const failed = Math.round(estimate.failedTasks)
  return { failed, successful: scenario.monthlyTasks - failed }
}

function readSignal(comparison: Comparison): Signal {
  const perResult = formatPercent(Math.abs(comparison.costPerSuccessChange))
  const bill = formatRupees(Math.abs(comparison.monthlyCostDifference))
  const billShare = formatPercent(Math.abs(comparison.monthlyCostChange))
  const moreFailed = Math.round(comparison.failedDifference)
  const billIsLower = comparison.monthlyCostDifference < -0.5

  switch (comparison.outcome) {
    case 'costs-more':
      return {
        tone: 'bad',
        icon: <TrendingUp aria-hidden="true" />,
        headline: `Switching costs ${perResult} more for every successful task.`,
        detail: billIsLower
          ? `The monthly bill looks ${bill} smaller (${billShare} less), but only because ${formatCount(Math.max(moreFailed, 0))} more tasks fail. You pay less in total and more for each result.`
          : `The monthly bill goes up by ${bill} (${billShare} more)${moreFailed > 0 ? `, and ${formatCount(moreFailed)} more tasks fail` : ''}.`,
      }
    case 'cheaper':
      return {
        tone: 'good',
        icon: <TrendingDown aria-hidden="true" />,
        headline: `Switching saves ${perResult} on every successful task.`,
        detail: billIsLower
          ? `That is ${bill} less each month (${billShare}), with no more failed tasks than you have now.`
          : `The monthly bill changes by ${formatSignedRupees(comparison.monthlyCostDifference)} because more tasks succeed, and each one costs less.`,
      }
    case 'cheaper-but-fails-more':
      return {
        tone: 'warn',
        icon: <TriangleAlert aria-hidden="true" />,
        headline: `Cheaper per successful task, but ${formatCount(moreFailed)} more tasks fail each month.`,
        detail: `Each successful task costs ${perResult} less and the monthly bill changes by ${formatSignedRupees(comparison.monthlyCostDifference)}. Whether that is a saving depends on what a failed task costs your business, which this estimate leaves out.`,
      }
    case 'even':
      return {
        tone: 'neutral',
        icon: <Equal aria-hidden="true" />,
        headline: 'Both models cost the same per successful task.',
        detail:
          moreFailed === 0
            ? 'They also leave the same number of tasks failed, so on these numbers there is nothing to choose between them.'
            : `The difference is in how many tasks fail: ${formatSignedCount(moreFailed)} each month if you switch.`,
      }
  }
}

/** Colour for a difference: is the candidate's number better or worse than the current one? */
function toneFor(difference: number, lowerIsBetter: boolean): 'is-good' | 'is-bad' | '' {
  if (Math.abs(difference) < 0.0005) return ''
  return difference < 0 === lowerIsBetter ? 'is-good' : 'is-bad'
}

/** The headline result, shown beside the inputs: the two price tags and what switching would mean. */
export function TrapResults({
  scenario,
  currentStickerPer1k,
  candidateStickerPer1k,
  currentEstimate,
  candidateEstimate,
  comparison,
}: Omit<TrapResultsProps, 'candidate' | 'breakEven'>) {
  const signal = comparison ? readSignal(comparison) : null
  const outcome = comparison?.outcome ?? 'incomplete'

  const candidateCostsMore = outcome === 'costs-more'
  const currentCostsMore = outcome === 'cheaper' || outcome === 'cheaper-but-fails-more'

  return (
    <div className="trap-result">
      <p className="estimate-flag">Estimate from the numbers you entered. Not a benchmark result.</p>

      {/* Re-keyed on the outcome so the tags swing when the verdict flips. */}
      <div className="rack" key={outcome}>
        <HangTag
          name={CURRENT_NAME}
          variant="current"
          stickerPer1k={currentStickerPer1k}
          estimate={currentEstimate}
          maxAttempts={scenario?.maxAttempts ?? null}
          stamp={currentCostsMore ? { text: 'Costs more per result', tone: 'bad' } : null}
          tilt={-1.4}
        />
        <HangTag
          name={CANDIDATE_NAME}
          variant="candidate"
          stickerPer1k={candidateStickerPer1k}
          estimate={candidateEstimate}
          maxAttempts={scenario?.maxAttempts ?? null}
          stamp={
            candidateCostsMore
              ? { text: 'Costs more per result', tone: 'bad' }
              : outcome === 'cheaper-but-fails-more'
                ? { text: 'Fails more tasks', tone: 'warn' }
                : null
          }
          tilt={1.8}
        />
      </div>

      <div className="trap-verdict" aria-live="polite">
        {signal ? (
          <div className={`signal signal--${signal.tone}`}>
            <span className="signal-icon">{signal.icon}</span>
            <div>
              <p className="signal-headline">{signal.headline}</p>
              <p className="signal-detail">{signal.detail}</p>
            </div>
          </div>
        ) : (
          <p className="signal-empty">Fix the highlighted fields to see the estimate.</p>
        )}
      </div>

    </div>
  )
}

/** The full set of expected figures and the break-even points, shown under the calculator. */
export function TrapBreakdown({
  scenario,
  candidate,
  currentEstimate,
  candidateEstimate,
  comparison,
  breakEven,
}: Pick<
  TrapResultsProps,
  'scenario' | 'candidate' | 'currentEstimate' | 'candidateEstimate' | 'comparison' | 'breakEven'
>) {
  if (!scenario || !candidate || !currentEstimate || !candidateEstimate || !comparison) return null

  return (
    <div className="trap-breakdown">
      <ComparisonTable
        scenario={scenario}
        currentEstimate={currentEstimate}
        candidateEstimate={candidateEstimate}
        comparison={comparison}
      />
      {breakEven && <BreakEvenNotes candidate={candidate} breakEven={breakEven} />}
    </div>
  )
}

interface ComparisonTableProps {
  scenario: Scenario
  currentEstimate: Estimate
  candidateEstimate: Estimate
  comparison: Comparison
}

function ComparisonTable({ scenario, currentEstimate, candidateEstimate, comparison }: ComparisonTableProps) {
  const now = wholeTasks(currentEstimate, scenario)
  const next = wholeTasks(candidateEstimate, scenario)
  const attemptsDifference = candidateEstimate.totalAttempts - currentEstimate.totalAttempts

  const rows = [
    {
      label: 'Cost per successful task',
      now: formatUnitRupees(currentEstimate.costPerSuccess ?? 0),
      next: formatUnitRupees(candidateEstimate.costPerSuccess ?? 0),
      difference: formatSignedPercent(comparison.costPerSuccessChange),
      tone: toneFor(comparison.costPerSuccessChange, true),
    },
    {
      label: 'Expected monthly cost',
      now: formatRupees(currentEstimate.monthlyCost),
      next: formatRupees(candidateEstimate.monthlyCost),
      difference: `${formatSignedRupees(comparison.monthlyCostDifference)} (${formatSignedPercent(comparison.monthlyCostChange)})`,
      tone: toneFor(comparison.monthlyCostDifference, true),
    },
    {
      label: 'Expected successful tasks',
      now: formatCount(now.successful),
      next: formatCount(next.successful),
      difference: formatSignedCount(next.successful - now.successful),
      tone: toneFor(next.successful - now.successful, false),
    },
    {
      label: 'Expected failed tasks',
      now: formatCount(now.failed),
      next: formatCount(next.failed),
      difference: formatSignedCount(next.failed - now.failed),
      tone: toneFor(next.failed - now.failed, true),
    },
    {
      label: 'Expected attempts made',
      now: formatCount(currentEstimate.totalAttempts),
      next: formatCount(candidateEstimate.totalAttempts),
      difference: formatSignedCount(attemptsDifference),
      tone: '',
    },
  ]

  return (
    <table className="trap-table">
      <caption>Each month, for {formatCount(scenario.monthlyTasks)} submitted tasks</caption>
      <thead>
        <tr>
          <td />
          <th scope="col">
            <span className="swatch swatch--current" aria-hidden="true" />
            Now
          </th>
          <th scope="col">
            <span className="swatch swatch--candidate" aria-hidden="true" />
            Considering
          </th>
          <th scope="col">If you switch</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((row) => (
          <tr key={row.label}>
            <th scope="row">{row.label}</th>
            <td data-label="Now">{row.now}</td>
            <td data-label="Considering">{row.next}</td>
            <td data-label="If you switch" className={row.tone}>
              {row.difference}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}

interface BreakEvenNotesProps {
  candidate: ModelInput
  breakEven: BreakEven
}

function BreakEvenNotes({ candidate, breakEven }: BreakEvenNotesProps) {
  const rateReachable = breakEven.successRate <= 100

  return (
    <div className="break-even">
      <h3 className="h3">Where it breaks even</h3>
      <p>The model you're considering matches your current cost per successful task if either of these is true.</p>
      <ul>
        <li>
          {rateReachable ? (
            <>
              Its success rate reaches <strong>{formatPercent(breakEven.successRate / 100)}</strong> at the price you
              entered. You set {formatPercent(candidate.successRate / 100)}.
            </>
          ) : (
            <>At the price you entered it can't match, even with a success rate of 100%.</>
          )}
        </li>
        <li>
          Its cost drops to <strong>{formatUnitRupees(breakEven.costPer1k)}</strong> for 1,000 attempts at the success
          rate you entered. You set {formatUnitRupees(candidate.costPer1k)}.
        </li>
      </ul>
      <p className="break-even-note">
        The attempt limit doesn't move these points. It changes how many tasks fail and how large the bill is.
      </p>
    </div>
  )
}
