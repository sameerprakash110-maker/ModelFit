import { RotateCcw } from 'lucide-react'
import { useId, useState } from 'react'
import { NumberField } from '../../../components/landing/NumberField.tsx'
import { SectionHead } from '../../../components/landing/SectionHead.tsx'
import { ModelFields } from '../../../components/trap/ModelFields.tsx'
import { CANDIDATE_NAME, CURRENT_NAME, TrapBreakdown, TrapResults } from '../../../components/trap/TrapResults.tsx'
import { MAX_ATTEMPTS_LIMIT, resolveModel, resolveScenario, startingForms } from '../../../components/trap/trapForm.ts'
import type { ModelForm, ScenarioForm } from '../../../components/trap/trapForm.ts'
import { breakEven, compare, estimate } from '../../../utils/trapMath.ts'

export function TrapCalculator() {
  const tokensId = useId()
  const [current, setCurrent] = useState<ModelForm>(() => startingForms().current)
  const [candidate, setCandidate] = useState<ModelForm>(() => startingForms().candidate)
  const [scenarioForm, setScenarioForm] = useState<ScenarioForm>(() => startingForms().scenario)
  const [useTokens, setUseTokens] = useState(false)

  const reset = () => {
    const start = startingForms()
    setCurrent(start.current)
    setCandidate(start.candidate)
    setScenarioForm(start.scenario)
    setUseTokens(false)
  }

  // Everything below is derived on each render, so results follow every keystroke.
  const resolvedCurrent = resolveModel(current, useTokens)
  const resolvedCandidate = resolveModel(candidate, useTokens)
  const { scenario, errors: scenarioErrors } = resolveScenario(scenarioForm)

  const currentEstimate = resolvedCurrent.input && scenario ? estimate(resolvedCurrent.input, scenario) : null
  const candidateEstimate = resolvedCandidate.input && scenario ? estimate(resolvedCandidate.input, scenario) : null
  const comparison = currentEstimate && candidateEstimate ? compare(currentEstimate, candidateEstimate) : null
  const points =
    resolvedCurrent.input && resolvedCandidate.input ? breakEven(resolvedCurrent.input, resolvedCandidate.input) : null

  return (
    <section id="trap" className="trap">
      <div className="wrap">
        <SectionHead title="The cheaper model trap">
          A model that costs half as much per attempt is not cheaper if it fails often enough. Failed attempts are
          still paid for, and tasks that run out of attempts are never finished. Put in your own numbers and see
          where the saving goes.
        </SectionHead>

        <div className="trap-grid">
          <form className="trap-controls" onSubmit={(event) => event.preventDefault()} noValidate>
            <fieldset className="trap-scenario">
              <legend>The workload</legend>
              <div className="trap-scenario-fields">
                <NumberField
                  label="Tasks submitted each month"
                  inputMode="numeric"
                  value={scenarioForm.monthlyTasks}
                  onChange={(monthlyTasks) => setScenarioForm((form) => ({ ...form, monthlyTasks }))}
                  error={scenarioErrors.monthlyTasks}
                />
                <NumberField
                  label="Attempts allowed per task"
                  inputMode="numeric"
                  value={scenarioForm.maxAttempts}
                  onChange={(maxAttempts) => setScenarioForm((form) => ({ ...form, maxAttempts }))}
                  error={scenarioErrors.maxAttempts}
                  hint="After the last attempt, the task counts as failed."
                  stepper={{
                    min: 1,
                    max: MAX_ATTEMPTS_LIMIT,
                    decrementLabel: 'One attempt fewer',
                    incrementLabel: 'One attempt more',
                  }}
                />
              </div>

              <label className="switch" htmlFor={tokensId}>
                <input
                  id={tokensId}
                  type="checkbox"
                  role="switch"
                  checked={useTokens}
                  onChange={(event) => setUseTokens(event.target.checked)}
                />
                <span className="switch-track" aria-hidden="true" />
                <span>Work out the cost of an attempt from token prices</span>
              </label>
            </fieldset>

            <ModelFields
              legend={CURRENT_NAME}
              variant="current"
              form={current}
              resolved={resolvedCurrent}
              useTokens={useTokens}
              onChange={(patch) => setCurrent((form) => ({ ...form, ...patch }))}
            />
            <ModelFields
              legend={CANDIDATE_NAME}
              variant="candidate"
              form={candidate}
              resolved={resolvedCandidate}
              useTokens={useTokens}
              onChange={(patch) => setCandidate((form) => ({ ...form, ...patch }))}
              breakEvenRate={points && points.successRate <= 100 ? points.successRate : null}
            />

            <div className="trap-controls-foot">
              <p className="trap-hint">Drag a tape, type a rate, or focus a tape and use the arrow keys.</p>
              <button type="button" className="text-button" onClick={reset}>
                <RotateCcw aria-hidden="true" />
                Reset the numbers
              </button>
            </div>
          </form>

          <TrapResults
            scenario={scenario}
            currentStickerPer1k={resolvedCurrent.costPer1k}
            candidateStickerPer1k={resolvedCandidate.costPer1k}
            currentEstimate={currentEstimate}
            candidateEstimate={candidateEstimate}
            comparison={comparison}
          />
        </div>

        <TrapBreakdown
          scenario={scenario}
          candidate={resolvedCandidate.input}
          currentEstimate={currentEstimate}
          candidateEstimate={candidateEstimate}
          comparison={comparison}
          breakEven={points}
        />

        <details className="assumptions" open>
          <summary>How this estimate is worked out</summary>
          <div className="assumptions-body">
            <div>
              <h3>What it assumes</h3>
              <ul>
                <li>Every attempt has the same chance of success, whatever happened on the attempts before it.</li>
                <li>
                  A task is retried until it succeeds or uses up its allowed attempts. After that it counts as failed.
                </li>
                <li>
                  Every attempt costs the same, including the ones that fail
                  {useTokens ? ', and uses the same number of input and output tokens' : ''}.
                </li>
              </ul>
              <h3>What it leaves out</h3>
              <ul>
                <li>How good the successful answers are, and how long they take.</li>
                <li>What a failed task costs your business.</li>
                <li>
                  The real success rate. That is the number a benchmark on your own tasks measures, and the one you
                  are guessing here.
                </li>
              </ul>
            </div>
            <div>
              <h3>The sums</h3>
              <dl className="formulas">
                {useTokens && (
                  <div>
                    <dt>Cost of one attempt</dt>
                    <dd>
                      (input tokens × input price + output tokens × output price) ÷ 10,00,000, with prices per 1M
                      tokens
                    </dd>
                  </div>
                )}
                <div>
                  <dt>Chance a task succeeds</dt>
                  <dd>1 − (1 − success rate) ^ attempts allowed</dd>
                </div>
                <div>
                  <dt>Expected attempts per task</dt>
                  <dd>chance a task succeeds ÷ success rate</dd>
                </div>
                <div>
                  <dt>Expected monthly cost</dt>
                  <dd>tasks submitted × expected attempts per task × cost of one attempt</dd>
                </div>
                <div>
                  <dt>Expected successful tasks</dt>
                  <dd>tasks submitted × chance a task succeeds</dd>
                </div>
                <div>
                  <dt>Cost per successful task</dt>
                  <dd>expected monthly cost ÷ expected successful tasks</dd>
                </div>
              </dl>
            </div>
          </div>
        </details>
      </div>
    </section>
  )
}
