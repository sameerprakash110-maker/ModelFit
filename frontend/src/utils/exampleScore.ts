/*
  Scoring used by the "How to read a benchmark" example on the landing page.
  It works on illustrative demo data only. The real scoring belongs to the
  backend; this exists so the example's winner follows from the numbers shown
  instead of being typed in by hand.
*/

export interface ConfigurationResult {
  id: string
  name: string
  description: string
  /** Task success rate, percent. */
  success: number
  /** Quality score out of 100. */
  quality: number
  /** P95 latency in seconds. */
  latencyP95: number
  /** Rupees per successful task. */
  costPerSuccess: number
}

export interface Weights {
  success: number
  quality: number
  cost: number
  speed: number
}

export interface Thresholds {
  minSuccess: number
  minQuality: number
}

export interface ScoredConfiguration extends ConfigurationResult {
  ruledOutBy: 'success' | 'quality' | null
  /** Weighted score out of 100. Null when the configuration is ruled out. */
  overall: number | null
  isBestFit: boolean
}

export function scoreConfigurations(
  results: ConfigurationResult[],
  weights: Weights,
  thresholds: Thresholds,
): ScoredConfiguration[] {
  const ruledOutBy = (result: ConfigurationResult): ScoredConfiguration['ruledOutBy'] =>
    result.success < thresholds.minSuccess ? 'success' : result.quality < thresholds.minQuality ? 'quality' : null

  const eligible = results.filter((result) => ruledOutBy(result) === null)
  const lowestCost = Math.min(...eligible.map((result) => result.costPerSuccess))
  const fastest = Math.min(...eligible.map((result) => result.latencyP95))
  const totalWeight = weights.success + weights.quality + weights.cost + weights.speed

  const scored = results.map((result): ScoredConfiguration => {
    const reason = ruledOutBy(result)
    if (reason) return { ...result, ruledOutBy: reason, overall: null, isBestFit: false }

    // Cost and speed are scored against the best eligible configuration.
    const costEfficiency = (lowestCost / result.costPerSuccess) * 100
    const speed = (fastest / result.latencyP95) * 100
    const overall =
      (result.success * weights.success +
        result.quality * weights.quality +
        costEfficiency * weights.cost +
        speed * weights.speed) /
      totalWeight

    return { ...result, ruledOutBy: null, overall, isBestFit: false }
  })

  const best = Math.max(...scored.map((result) => result.overall ?? -Infinity))
  return scored.map((result) => ({ ...result, isBestFit: result.overall !== null && result.overall === best }))
}
