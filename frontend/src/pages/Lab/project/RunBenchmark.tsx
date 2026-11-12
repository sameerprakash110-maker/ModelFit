import { Play } from 'lucide-react'
import { useId } from 'react'
import { Link } from 'react-router-dom'
import { addTestCasePath, newBenchmarkPath } from './context.ts'

/**
 * Starts the new-benchmark wizard for this project. Without test cases there is
 * nothing to ask the models, so the button is disabled and says what to do.
 */
export function RunBenchmark({
  projectId,
  hasTestCases,
  onAddTestCase,
  size = 'md',
}: {
  projectId: string
  hasTestCases: boolean
  /** On the analysis tab, opens the test case form in place instead of navigating. */
  onAddTestCase?: () => void
  size?: 'sm' | 'md'
}) {
  const id = useId()
  const className = `btn-primary${size === 'sm' ? ' btn-sm' : ''}`
  if (hasTestCases) {
    return (
      <Link to={newBenchmarkPath(projectId)} className={className}>
        <Play aria-hidden="true" />
        Run benchmark
      </Link>
    )
  }
  return (
    <span className="run-blocked">
      <button type="button" className={className} disabled aria-describedby={`${id}-why`}>
        <Play aria-hidden="true" />
        Run benchmark
      </button>
      <span id={`${id}-why`} className="hint">
        Needs at least one test case.{' '}
        {onAddTestCase ? (
          <button type="button" className="btn-text" onClick={onAddTestCase}>
            Add test case
          </button>
        ) : (
          <Link to={addTestCasePath(projectId)}>Add test case</Link>
        )}
      </span>
    </span>
  )
}
