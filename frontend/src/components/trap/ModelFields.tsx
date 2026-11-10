import { useId } from 'react'
import { formatUnitRupees } from '../../utils/format.ts'
import { NumberField } from '../landing/NumberField.tsx'
import { TapeSlider } from '../landing/TapeSlider.tsx'
import type { ModelForm, ResolvedModel } from './trapForm.ts'

interface ModelFieldsProps {
  legend: string
  variant: 'current' | 'candidate'
  form: ModelForm
  resolved: ResolvedModel
  useTokens: boolean
  onChange: (patch: Partial<ModelForm>) => void
  /** Break-even success rate to flag on the tape, when there is one. */
  breakEvenRate?: number | null
}

/** The inputs for one model: what an attempt costs and how often an attempt succeeds. */
export function ModelFields({
  legend,
  variant,
  form,
  resolved,
  useTokens,
  onChange,
  breakEvenRate,
}: ModelFieldsProps) {
  const id = useId()
  const { errors } = resolved
  const sliderValue = Math.min(100, Math.max(1, Math.round(resolved.successRate ?? 1)))

  return (
    <fieldset className="trap-model">
      <legend>
        <span className={`swatch swatch--${variant}`} aria-hidden="true" />
        {legend}
      </legend>

      {useTokens ? (
        <>
          <div className="token-grid">
            <NumberField
              size="small"
              label="Input price, per 1M tokens"
              prefix="₹"
              value={form.inputPrice}
              onChange={(inputPrice) => onChange({ inputPrice })}
              error={errors.inputPrice}
            />
            <NumberField
              size="small"
              label="Output price, per 1M tokens"
              prefix="₹"
              value={form.outputPrice}
              onChange={(outputPrice) => onChange({ outputPrice })}
              error={errors.outputPrice}
            />
            <NumberField
              size="small"
              label="Input tokens per attempt"
              inputMode="numeric"
              value={form.inputTokens}
              onChange={(inputTokens) => onChange({ inputTokens })}
              error={errors.inputTokens}
            />
            <NumberField
              size="small"
              label="Output tokens per attempt"
              inputMode="numeric"
              value={form.outputTokens}
              onChange={(outputTokens) => onChange({ outputTokens })}
              error={errors.outputTokens}
            />
          </div>
          <p className="token-result">
            Cost for 1,000 attempts:{' '}
            <strong>{resolved.costPer1k === null ? '—' : formatUnitRupees(resolved.costPer1k)}</strong>
          </p>
        </>
      ) : (
        <NumberField
          label="Cost for 1,000 attempts"
          prefix="₹"
          value={form.costPer1k}
          onChange={(costPer1k) => onChange({ costPer1k })}
          error={errors.costPer1k}
        />
      )}

      <div className="slider-head">
        <span id={`${id}-rate`} className="field-label">
          Success rate per attempt
        </span>
        <span className={`num num--inline${errors.successRate ? ' is-invalid' : ''}`}>
          <input
            inputMode="decimal"
            autoComplete="off"
            value={form.successRate}
            onChange={(event) => onChange({ successRate: event.target.value })}
            aria-label="Success rate per attempt, in percent"
            aria-invalid={errors.successRate ? true : undefined}
            aria-describedby={errors.successRate ? `${id}-rate-error` : undefined}
          />
          <span aria-hidden="true">%</span>
        </span>
      </div>
      <TapeSlider
        labelledBy={`${id}-rate`}
        value={sliderValue}
        min={1}
        max={100}
        onChange={(value) => onChange({ successRate: String(value) })}
        valueText={(value) => `${value} percent`}
        marker={breakEvenRate != null ? { value: breakEvenRate, label: 'break-even' } : null}
      />
      {errors.successRate && (
        <p id={`${id}-rate-error`} className="field-error">
          {errors.successRate}
        </p>
      )}
    </fieldset>
  )
}
