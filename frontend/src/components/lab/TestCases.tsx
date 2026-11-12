import { Trash2 } from 'lucide-react'
import { useId, useState } from 'react'
import type { FormEvent } from 'react'
import { useActionError } from '../../hooks/useResource.ts'
import { api } from '../../services/api.ts'
import type { TestCase } from '../../services/api.ts'
import { ErrorNote } from './ui.tsx'

/** Test cases, oldest first, numbered so the numbers match the results page. */
export function TestCaseList({
  testCases,
  onChanged,
  compact = false,
}: {
  testCases: TestCase[]
  onChanged: () => void
  compact?: boolean
}) {
  const ordered = [...testCases].sort((a, b) => a.created_at.localeCompare(b.created_at))
  return (
    <ol className={`tc-list${compact ? ' tc-list--compact' : ''}`}>
      {ordered.map((tc, index) => (
        <TestCaseRow key={tc.id} testCase={tc} number={index + 1} onDeleted={onChanged} />
      ))}
    </ol>
  )
}

function TestCaseRow({ testCase, number, onDeleted }: { testCase: TestCase; number: number; onDeleted: () => void }) {
  const describeError = useActionError()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const onDelete = async () => {
    setBusy(true)
    setError(null)
    try {
      await api.deleteTestCase(testCase.id)
      onDeleted()
    } catch (err) {
      setError(describeError(err))
      setBusy(false)
      setConfirming(false)
    }
  }

  return (
    <li className="tc">
      <span className="tc-num" aria-hidden="true">
        {number}
      </span>
      <div className="tc-body">
        <p className="tc-input">
          <span className="visually-hidden">Test case {number}: </span>
          {testCase.input_prompt}
        </p>
        <p className="tc-good">
          <span>A good answer:</span> {testCase.expected_behavior}
        </p>
        {error && <p className="field-error">{error}</p>}
      </div>
      {confirming ? (
        <span className="tc-confirm">
          <button type="button" className="btn-danger btn-sm" onClick={onDelete} disabled={busy}>
            {busy ? 'Deleting…' : 'Delete'}
          </button>
          <button type="button" className="btn-text" onClick={() => setConfirming(false)}>
            Keep
          </button>
        </span>
      ) : (
        <button
          type="button"
          className="icon-btn"
          onClick={() => setConfirming(true)}
          aria-label={`Delete test case ${number}`}
          title="Delete test case"
        >
          <Trash2 aria-hidden="true" />
        </button>
      )}
    </li>
  )
}

/** Add one test case: a real input and what a good answer does. */
export function TestCaseForm({ projectId, onAdded }: { projectId: string; onAdded: () => void }) {
  const id = useId()
  const describeError = useActionError()
  const [input, setInput] = useState('')
  const [expected, setExpected] = useState('')
  const [errors, setErrors] = useState<{ input?: string; expected?: string }>({})
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [added, setAdded] = useState(0)

  const onSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const next: typeof errors = {}
    if (!input.trim()) next.input = 'Enter the message the model will receive.'
    if (!expected.trim()) next.expected = 'Describe what a good answer does, so the judge can score it.'
    setErrors(next)
    if (next.input || next.expected) return

    setSaving(true)
    setSubmitError(null)
    try {
      await api.createTestCase({ project_id: projectId, input_prompt: input.trim(), expected_behavior: expected.trim() })
      setInput('')
      setExpected('')
      setAdded((n) => n + 1)
      onAdded()
    } catch (err) {
      setSubmitError(describeError(err))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form className="form tc-form" onSubmit={onSubmit} noValidate>
      <div className="field">
        <label htmlFor={`${id}-input`}>Input</label>
        <textarea
          id={`${id}-input`}
          rows={3}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          readOnly={saving}
          placeholder="My card was charged twice for order #1234. Please help."
          aria-invalid={errors.input ? true : undefined}
          aria-describedby={`${id}-input-hint`}
        />
        {errors.input ? (
          <p id={`${id}-input-hint`} className="field-error">
            {errors.input}
          </p>
        ) : (
          <p id={`${id}-input-hint`} className="hint">
            A real message from your users or logs. Messy, realistic inputs make a better test than tidy ones.
          </p>
        )}
      </div>
      <div className="field">
        <label htmlFor={`${id}-expected`}>What a good answer does</label>
        <textarea
          id={`${id}-expected`}
          rows={2}
          value={expected}
          onChange={(e) => setExpected(e.target.value)}
          readOnly={saving}
          placeholder="Acknowledges the double charge, apologises, and routes the ticket to billing as urgent."
          aria-invalid={errors.expected ? true : undefined}
          aria-describedby={`${id}-expected-hint`}
        />
        {errors.expected ? (
          <p id={`${id}-expected-hint`} className="field-error">
            {errors.expected}
          </p>
        ) : (
          <p id={`${id}-expected-hint`} className="hint">
            Describe the qualities you want, not a word-for-word answer. The judge scores against this.
          </p>
        )}
      </div>
      {submitError && <ErrorNote>{submitError}</ErrorNote>}
      <div className="actions">
        <button type="submit" className="btn-secondary" disabled={saving}>
          {saving ? 'Adding…' : 'Add test case'}
        </button>
        <span className="sr-status" role="status">
          {added > 0 && !saving ? 'Test case added.' : ''}
        </span>
      </div>
    </form>
  )
}
