/*
  Arithmetic behind the "cheaper model trap" estimate on the landing page.

  Assumptions, stated once here and repeated to the visitor on the page:
  - Every attempt has the same chance of success and attempts are independent.
  - A task is retried until it succeeds or reaches the attempt limit. A task
    that uses up its attempts counts as failed, and its attempts are still paid for.
  - Every attempt costs the same.

  This is an estimate from numbers the visitor types in. It is not a benchmark result.
*/

export interface ModelInput {
  /** Rupees for 1,000 attempts. */
  costPer1k: number
  /** Chance that one attempt succeeds, as a percentage above 0 and up to 100. */
  successRate: number
}

export interface Scenario {
  /** Tasks submitted each month. */
  monthlyTasks: number
  /** Attempts a task may use before it counts as failed. Whole number, 1 or more. */
  maxAttempts: number
}

export interface TokenAssumptions {
  inputTokens: number
  outputTokens: number
  /** Rupees per 1,000,000 input tokens. */
  inputPricePerMillion: number
  /** Rupees per 1,000,000 output tokens. */
  outputPricePerMillion: number
}

export interface Estimate {
  /** Probability a task succeeds within the attempt limit, 0 to 1. */
  eventualSuccess: number
  /** Expected attempts used per submitted task. */
  attemptsPerTask: number
  totalAttempts: number
  monthlyCost: number
  successfulTasks: number
  failedTasks: number
  /** Null when no task is expected to succeed. */
  costPerSuccess: number | null
}

export function estimate(model: ModelInput, scenario: Scenario): Estimate {
  const s = model.successRate / 100
  const n = scenario.maxAttempts

  // Chance that all n attempts fail.
  const neverSucceeds = (1 - s) ** n
  const eventualSuccess = 1 - neverSucceeds

  // Attempt k happens only if the k-1 before it failed: 1 + (1-s) + ... + (1-s)^(n-1).
  const attemptsPerTask = s > 0 ? eventualSuccess / s : n

  const totalAttempts = scenario.monthlyTasks * attemptsPerTask
  const monthlyCost = (totalAttempts * model.costPer1k) / 1000
  const successfulTasks = scenario.monthlyTasks * eventualSuccess
  const failedTasks = scenario.monthlyTasks * neverSucceeds

  return {
    eventualSuccess,
    attemptsPerTask,
    totalAttempts,
    monthlyCost,
    successfulTasks,
    failedTasks,
    costPerSuccess: successfulTasks > 0 ? monthlyCost / successfulTasks : null,
  }
}

/** Rupees for 1,000 attempts, from token counts and per-million-token prices. */
export function costPer1kFromTokens(tokens: TokenAssumptions): number {
  const perAttempt =
    (tokens.inputTokens * tokens.inputPricePerMillion + tokens.outputTokens * tokens.outputPricePerMillion) / 1_000_000
  return perAttempt * 1000
}

export interface BreakEven {
  /** Success rate (percent) the candidate needs, at its current price, to match cost per successful task. */
  successRate: number
  /** Price per 1,000 attempts the candidate needs, at its current success rate, to match. */
  costPer1k: number
}

/*
  Cost per successful task works out to (cost per attempt) / (success rate),
  whatever the attempt limit is, so break-even does not depend on the limit.
*/
export function breakEven(current: ModelInput, candidate: ModelInput): BreakEven {
  return {
    successRate: (candidate.costPer1k / current.costPer1k) * current.successRate,
    costPer1k: (current.costPer1k * candidate.successRate) / current.successRate,
  }
}

export type Outcome = 'costs-more' | 'cheaper' | 'cheaper-but-fails-more' | 'even'

export interface Comparison {
  outcome: Outcome
  /** Change in cost per successful task as a fraction of the current model's. Positive means dearer. */
  costPerSuccessChange: number
  /** Candidate monthly cost minus current monthly cost, in rupees. */
  monthlyCostDifference: number
  /** The same difference as a fraction of the current monthly cost. */
  monthlyCostChange: number
  /** Candidate failed tasks minus current failed tasks. */
  failedDifference: number
}

export function compare(current: Estimate, candidate: Estimate): Comparison | null {
  if (current.costPerSuccess === null || candidate.costPerSuccess === null) return null

  const costPerSuccessChange = (candidate.costPerSuccess - current.costPerSuccess) / current.costPerSuccess
  const monthlyCostDifference = candidate.monthlyCost - current.monthlyCost
  const failedDifference = candidate.failedTasks - current.failedTasks

  let outcome: Outcome
  if (Math.abs(costPerSuccessChange) < 0.0005) outcome = 'even'
  else if (costPerSuccessChange > 0) outcome = 'costs-more'
  else if (failedDifference >= 0.5) outcome = 'cheaper-but-fails-more'
  else outcome = 'cheaper'

  return {
    outcome,
    costPerSuccessChange,
    monthlyCostDifference,
    monthlyCostChange: monthlyCostDifference / current.monthlyCost,
    failedDifference,
  }
}

/** The numbers the calculator opens with. The hero illustration uses the same ones. */
export const STARTING_NUMBERS = {
  scenario: { monthlyTasks: 500_000, maxAttempts: 3 } satisfies Scenario,
  current: { costPer1k: 1000, successRate: 97 } satisfies ModelInput,
  candidate: { costPer1k: 500, successRate: 45 } satisfies ModelInput,
  currentTokens: {
    inputTokens: 2000,
    outputTokens: 500,
    inputPricePerMillion: 250,
    outputPricePerMillion: 1000,
  } satisfies TokenAssumptions,
  candidateTokens: {
    inputTokens: 2000,
    outputTokens: 750,
    inputPricePerMillion: 100,
    outputPricePerMillion: 400,
  } satisfies TokenAssumptions,
}
