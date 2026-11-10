/* Reading and validating what is typed into the calculator. */

import { formatCount, parseNumber } from '../../utils/format.ts'
import { STARTING_NUMBERS, costPer1kFromTokens } from '../../utils/trapMath.ts'
import type { ModelInput, Scenario, TokenAssumptions } from '../../utils/trapMath.ts'

export const MAX_ATTEMPTS_LIMIT = 10

/** Field values exactly as typed, so half-finished input is never thrown away. */
export interface ModelForm {
  costPer1k: string
  successRate: string
  inputPrice: string
  outputPrice: string
  inputTokens: string
  outputTokens: string
}

export interface ScenarioForm {
  monthlyTasks: string
  maxAttempts: string
}

export type ModelErrors = Partial<Record<keyof ModelForm, string>>
export type ScenarioErrors = Partial<Record<keyof ScenarioForm, string>>

function toModelForm(model: ModelInput, tokens: TokenAssumptions): ModelForm {
  return {
    costPer1k: formatCount(model.costPer1k),
    successRate: String(model.successRate),
    inputPrice: formatCount(tokens.inputPricePerMillion),
    outputPrice: formatCount(tokens.outputPricePerMillion),
    inputTokens: formatCount(tokens.inputTokens),
    outputTokens: formatCount(tokens.outputTokens),
  }
}

export const startingForms = () => ({
  current: toModelForm(STARTING_NUMBERS.current, STARTING_NUMBERS.currentTokens),
  candidate: toModelForm(STARTING_NUMBERS.candidate, STARTING_NUMBERS.candidateTokens),
  scenario: {
    monthlyTasks: formatCount(STARTING_NUMBERS.scenario.monthlyTasks),
    maxAttempts: String(STARTING_NUMBERS.scenario.maxAttempts),
  } satisfies ScenarioForm,
})

function positive(text: string): number | null {
  const value = parseNumber(text)
  return value !== null && value > 0 ? value : null
}

export interface ResolvedModel {
  /** Null while any field the estimate needs is missing or invalid. */
  input: ModelInput | null
  /** Cost for 1,000 attempts, typed in or worked out from tokens. */
  costPer1k: number | null
  successRate: number | null
  errors: ModelErrors
}

export function resolveModel(form: ModelForm, useTokens: boolean): ResolvedModel {
  const errors: ModelErrors = {}

  const rate = parseNumber(form.successRate)
  const successRate = rate !== null && rate >= 1 && rate <= 100 ? rate : null
  if (successRate === null) errors.successRate = 'Enter a rate from 1 to 100.'

  let costPer1k: number | null
  if (useTokens) {
    const inputPrice = positive(form.inputPrice)
    const outputPrice = positive(form.outputPrice)
    const inputTokens = positive(form.inputTokens)
    const outputTokens = positive(form.outputTokens)
    if (inputPrice === null) errors.inputPrice = 'Enter a price above 0.'
    if (outputPrice === null) errors.outputPrice = 'Enter a price above 0.'
    if (inputTokens === null) errors.inputTokens = 'Enter a token count above 0.'
    if (outputTokens === null) errors.outputTokens = 'Enter a token count above 0.'
    costPer1k =
      inputPrice !== null && outputPrice !== null && inputTokens !== null && outputTokens !== null
        ? costPer1kFromTokens({
            inputTokens,
            outputTokens,
            inputPricePerMillion: inputPrice,
            outputPricePerMillion: outputPrice,
          })
        : null
  } else {
    costPer1k = positive(form.costPer1k)
    if (costPer1k === null) errors.costPer1k = 'Enter a cost above 0.'
  }

  return {
    input: costPer1k !== null && successRate !== null ? { costPer1k, successRate } : null,
    costPer1k,
    successRate,
    errors,
  }
}

export function resolveScenario(form: ScenarioForm): { scenario: Scenario | null; errors: ScenarioErrors } {
  const errors: ScenarioErrors = {}

  const tasks = parseNumber(form.monthlyTasks)
  const monthlyTasks = tasks !== null && tasks >= 1 && Number.isInteger(tasks) ? tasks : null
  if (monthlyTasks === null) errors.monthlyTasks = 'Enter a whole number of tasks, 1 or more.'

  const attempts = parseNumber(form.maxAttempts)
  const maxAttempts =
    attempts !== null && Number.isInteger(attempts) && attempts >= 1 && attempts <= MAX_ATTEMPTS_LIMIT
      ? attempts
      : null
  if (maxAttempts === null) errors.maxAttempts = `Enter a whole number from 1 to ${MAX_ATTEMPTS_LIMIT}.`

  return {
    scenario: monthlyTasks !== null && maxAttempts !== null ? { monthlyTasks, maxAttempts } : null,
    errors,
  }
}
