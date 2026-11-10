import { Minus, Plus } from 'lucide-react'
import { useId } from 'react'
import { parseNumber, regroup } from '../../utils/format.ts'

interface NumberFieldProps {
  label: string
  value: string
  onChange: (value: string) => void
  /** Shown before the number, for example the rupee sign. */
  prefix?: string
  /** Shown after the number, for example a percent sign. */
  suffix?: string
  /** Message shown under the field when the value can't be used. */
  error?: string | null
  hint?: string
  inputMode?: 'decimal' | 'numeric'
  size?: 'large' | 'small'
  /** When set, minus and plus buttons step the value within these bounds. */
  stepper?: { min: number; max: number; decrementLabel: string; incrementLabel: string }
}

/** A labelled number input with a visible unit, an error message and optional step buttons. */
export function NumberField({
  label,
  value,
  onChange,
  prefix,
  suffix,
  error,
  hint,
  inputMode = 'decimal',
  size = 'large',
  stepper,
}: NumberFieldProps) {
  const id = useId()
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined

  const step = (delta: number) => {
    if (!stepper) return
    const current = parseNumber(value)
    const base = current === null ? stepper.min : Math.round(current)
    onChange(String(Math.min(stepper.max, Math.max(stepper.min, base + delta))))
  }

  return (
    <div className={`field field--${size}`}>
      <label className="field-label" htmlFor={id}>
        {label}
      </label>
      <div className={`num${error ? ' is-invalid' : ''}`}>
        {stepper && (
          <button type="button" className="num-step" aria-label={stepper.decrementLabel} onClick={() => step(-1)}>
            <Minus aria-hidden="true" />
          </button>
        )}
        {prefix && <span aria-hidden="true">{prefix}</span>}
        <input
          id={id}
          inputMode={inputMode}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          onBlur={() => onChange(regroup(value))}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
        />
        {suffix && <span aria-hidden="true">{suffix}</span>}
        {stepper && (
          <button type="button" className="num-step" aria-label={stepper.incrementLabel} onClick={() => step(1)}>
            <Plus aria-hidden="true" />
          </button>
        )}
      </div>
      {error ? (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      ) : (
        hint && (
          <p id={`${id}-hint`} className="field-hint">
            {hint}
          </p>
        )
      )}
    </div>
  )
}
